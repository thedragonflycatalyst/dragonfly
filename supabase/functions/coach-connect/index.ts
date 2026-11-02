// coach-connect: link Strava, Oura and WHOOP accounts and bring their data into Dragonfly.
//
// POST { action: 'start', provider, return_to }   → { url }  page where the person approves access
// GET  /coach-connect/callback/{provider}?code&state  (the provider sends them here) → saves tokens, first sync, back to the app
// POST { action: 'sync', provider? }               → { added }  pulls new workouts, sleep, recovery and activity
// POST { action: 'disconnect', provider }          → { ok }
// Needs each provider's developer app: STRAVA_CLIENT_ID/SECRET, OURA_CLIENT_ID/SECRET, WHOOP_CLIENT_ID/SECRET.
// Their redirect URL is {SUPABASE_URL}/functions/v1/coach-connect/callback/{provider}.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';

const cors = {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dragonfly-trainer, x-dragonfly-edit',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const WEB = Deno.env.get('DRAGONFLY_WEB_URL') ?? 'https://thedragonflycatalyst.github.io/dragonfly/';
const DAY = 86_400_000;

type Provider = 'strava' | 'oura' | 'whoop';
type Tok = { access_token: string; refresh_token?: string | null; expires_at?: string | null };
type Daily = { day: string; steps?: number; active_kcal?: number; distance_m?: number; sleep_min?: number; resting_hr?: number; hrv_ms?: number; readiness?: number };
type Act = { external_id: string; kind: string; name?: string | null; started_at: string; duration_s?: number | null; distance_m?: number | null; kcal?: number | null; avg_hr?: number | null };

const P = {
  strava: {
    auth: 'https://www.strava.com/oauth/authorize', token: 'https://www.strava.com/oauth/token', scope: 'read,activity:read_all', scopeKey: 'scope', extra: { approval_prompt: 'auto' },
  },
  oura: {
    auth: 'https://cloud.ouraring.com/oauth/authorize', token: 'https://api.ouraring.com/oauth/token', scope: 'personal daily heartrate workout', scopeKey: 'scope', extra: {},
  },
  whoop: {
    auth: 'https://api.prod.whoop.com/oauth/oauth2/auth', token: 'https://api.prod.whoop.com/oauth/oauth2/token',
    scope: 'offline read:profile read:recovery read:sleep read:workout read:cycles', scopeKey: 'scope', extra: {},
  },
} as const;
const creds = (p: Provider) => ({ id: Deno.env.get(`${p.toUpperCase()}_CLIENT_ID`), secret: Deno.env.get(`${p.toUpperCase()}_CLIENT_SECRET`) });
const redirectFor = (p: Provider) => `${Deno.env.get('SUPABASE_URL')}/functions/v1/coach-connect/callback/${p}`;

async function tokenRequest(p: Provider, params: Record<string, string>) {
  const { id, secret } = creds(p);
  const body = new URLSearchParams({ client_id: id!, client_secret: secret!, ...params });
  const res = await fetch(P[p].token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.access_token) { console.error('token', p, res.status, JSON.stringify(out).slice(0, 300)); throw new Error('token_failed'); }
  const expires = out.expires_at ? new Date(out.expires_at * 1000) : out.expires_in ? new Date(Date.now() + out.expires_in * 1000) : null;
  return { tok: { access_token: out.access_token as string, refresh_token: (out.refresh_token as string) ?? null, expires_at: expires?.toISOString() ?? null }, raw: out };
}

async function freshToken(admin: SupabaseClient, uid: string, p: Provider): Promise<string> {
  const { data: t } = await admin.from('coach_connection_tokens').select('*').eq('user_id', uid).eq('provider', p).maybeSingle();
  if (!t) throw new Error('not_connected');
  if (!t.expires_at || new Date(t.expires_at).getTime() > Date.now() + 120_000) return t.access_token;
  if (!t.refresh_token) throw new Error('expired');
  const { tok } = await tokenRequest(p, { grant_type: 'refresh_token', refresh_token: t.refresh_token, ...(p === 'whoop' ? { scope: 'offline' } : {}) });
  await admin.from('coach_connection_tokens').update({ access_token: tok.access_token, refresh_token: tok.refresh_token ?? t.refresh_token, expires_at: tok.expires_at }).eq('user_id', uid).eq('provider', p);
  return tok.access_token;
}

async function getJson(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error('expired');
  if (!res.ok) { console.error('fetch', url.split('?')[0], res.status); throw new Error('provider_error'); }
  return res.json();
}
const dayOf = (iso: string) => iso.slice(0, 10);

// ---------------------------------------------------------------- each provider's data, in Dragonfly's shape
async function pullStrava(token: string, since: Date): Promise<{ daily: Daily[]; acts: Act[] }> {
  const acts: Act[] = [];
  for (let page = 1; page <= 10; page++) {
    const list = await getJson(`https://www.strava.com/api/v3/athlete/activities?after=${Math.floor(since.getTime() / 1000)}&per_page=100&page=${page}`, token);
    for (const a of list ?? []) acts.push({ external_id: String(a.id), kind: String(a.sport_type ?? a.type ?? 'Workout').replace(/([a-z])([A-Z])/g, '$1 $2'), name: a.name ?? null,
      started_at: a.start_date, duration_s: a.elapsed_time ?? null, distance_m: a.distance != null ? Math.round(a.distance) : null,
      kcal: a.calories != null ? Math.round(a.calories) : a.kilojoules != null ? Math.round(a.kilojoules) : null, avg_hr: a.average_heartrate != null ? Math.round(a.average_heartrate) : null });
    if (!list || list.length < 100) break;
  }
  return { daily: [], acts };
}

async function pullOura(token: string, since: Date): Promise<{ daily: Daily[]; acts: Act[] }> {
  const q = `start_date=${dayOf(since.toISOString())}&end_date=${dayOf(new Date(Date.now() + DAY).toISOString())}`;
  const base = 'https://api.ouraring.com/v2/usercollection';
  const [act, sleep, ready, wk] = await Promise.all([
    getJson(`${base}/daily_activity?${q}`, token), getJson(`${base}/sleep?${q}`, token), getJson(`${base}/daily_readiness?${q}`, token), getJson(`${base}/workout?${q}`, token),
  ]);
  const days = new Map<string, Daily>();
  const at = (d: string) => { let x = days.get(d); if (!x) { x = { day: d }; days.set(d, x); } return x; };
  for (const a of act.data ?? []) { const d = at(a.day); d.steps = a.steps; d.active_kcal = a.active_calories; d.distance_m = a.equivalent_walking_distance; }
  for (const s of sleep.data ?? []) {
    if (s.type && s.type !== 'long_sleep' && s.type !== 'sleep') continue;
    const d = at(s.day); d.sleep_min = Math.round((s.total_sleep_duration ?? 0) / 60) || d.sleep_min;
    if (s.average_hrv) d.hrv_ms = s.average_hrv; if (s.lowest_heart_rate) d.resting_hr = s.lowest_heart_rate;
  }
  for (const r of ready.data ?? []) if (r.score != null) at(r.day).readiness = r.score;
  const acts: Act[] = (wk.data ?? []).map((w: Record<string, any>) => ({ external_id: String(w.id), kind: String(w.activity ?? 'Workout').replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase()),
    name: w.label ?? null, started_at: w.start_datetime, duration_s: Math.round((new Date(w.end_datetime).getTime() - new Date(w.start_datetime).getTime()) / 1000),
    distance_m: w.distance != null ? Math.round(w.distance) : null, kcal: w.calories != null ? Math.round(w.calories) : null, avg_hr: null }));
  return { daily: [...days.values()], acts };
}

async function whoopAll(path: string, token: string, since: Date) {
  const out: Record<string, any>[] = [];
  let next = '';
  for (let i = 0; i < 20; i++) {
    const r = await getJson(`https://api.prod.whoop.com/developer/v2/${path}?limit=25&start=${since.toISOString()}${next ? `&nextToken=${encodeURIComponent(next)}` : ''}`, token);
    out.push(...(r.records ?? []));
    next = r.next_token ?? r.nextToken ?? '';
    if (!next) break;
  }
  return out;
}
async function pullWhoop(token: string, since: Date): Promise<{ daily: Daily[]; acts: Act[] }> {
  const [rec, sleep, wk] = await Promise.all([whoopAll('recovery', token, since), whoopAll('activity/sleep', token, since), whoopAll('activity/workout', token, since)]);
  const days = new Map<string, Daily>();
  const at = (d: string) => { let x = days.get(d); if (!x) { x = { day: d }; days.set(d, x); } return x; };
  for (const s of sleep) {
    if (s.nap || !s.end || !s.score?.stage_summary) continue;
    const st = s.score.stage_summary;
    const d = at(dayOf(s.end)); d.sleep_min = Math.round(((st.total_in_bed_time_milli ?? 0) - (st.total_awake_time_milli ?? 0)) / 60000);
  }
  for (const r of rec) {
    if (!r.score) continue;
    const d = at(dayOf(r.created_at ?? r.updated_at));
    d.readiness = Math.round(r.score.recovery_score); d.resting_hr = Math.round(r.score.resting_heart_rate); d.hrv_ms = Math.round(r.score.hrv_rmssd_milli * 10) / 10;
  }
  const acts: Act[] = wk.map((w) => ({ external_id: String(w.id), kind: String(w.sport_name ?? 'Workout').replace(/-/g, ' ').replace(/^./, (c: string) => c.toUpperCase()), name: null,
    started_at: w.start, duration_s: Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / 1000),
    distance_m: w.score?.distance_meter != null ? Math.round(w.score.distance_meter) : null, kcal: w.score?.kilojoule != null ? Math.round(w.score.kilojoule / 4.184) : null,
    avg_hr: w.score?.average_heart_rate ?? null }));
  return { daily: [...days.values()], acts };
}
const PULL = { strava: pullStrava, oura: pullOura, whoop: pullWhoop };

async function save(admin: SupabaseClient, uid: string, p: Provider, data: { daily: Daily[]; acts: Act[] }) {
  if (data.acts.length) {
    const { error } = await admin.from('coach_activities').upsert(data.acts.map((a) => ({ ...a, user_id: uid, source: p, app: p === 'strava' ? 'Strava' : p === 'oura' ? 'Oura' : 'WHOOP' })), { onConflict: 'user_id,source,external_id', ignoreDuplicates: false });
    if (error) console.error('acts', error.message);
  }
  if (data.daily.length) {
    const { data: old } = await admin.from('coach_health_daily').select('*').eq('user_id', uid).in('day', data.daily.map((d) => d.day));
    const byDay = new Map((old ?? []).map((o) => [o.day, o]));
    const rows = data.daily.map((d) => {
      const o = byDay.get(d.day) ?? {};
      const max = (a?: number | null, b?: number | null) => (a == null ? b ?? null : b == null ? a : Math.max(a, b));
      return { user_id: uid, day: d.day, steps: max(o.steps, d.steps), active_kcal: max(o.active_kcal, d.active_kcal), distance_m: max(o.distance_m, d.distance_m),
        sleep_min: d.sleep_min ?? o.sleep_min ?? null, resting_hr: d.resting_hr ?? o.resting_hr ?? null, hrv_ms: d.hrv_ms ?? o.hrv_ms ?? null, readiness: d.readiness ?? o.readiness ?? null,
        water_ml: o.water_ml ?? null, sources: [...new Set([...(o.sources ?? []), p])], updated_at: new Date().toISOString() };
    });
    const { error } = await admin.from('coach_health_daily').upsert(rows, { onConflict: 'user_id,day' });
    if (error) console.error('daily', error.message);
  }
  await admin.from('coach_connections').update({ last_sync_at: new Date().toISOString(), status: 'ok' }).eq('user_id', uid).eq('provider', p);
  return data.acts.length + data.daily.length;
}

async function syncOne(admin: SupabaseClient, uid: string, p: Provider, since?: Date) {
  const { data: c } = await admin.from('coach_connections').select('last_sync_at').eq('user_id', uid).eq('provider', p).maybeSingle();
  const from = since ?? (c?.last_sync_at ? new Date(new Date(c.last_sync_at).getTime() - 3 * DAY) : new Date(Date.now() - 30 * DAY));
  try {
    return await save(admin, uid, p, await PULL[p](await freshToken(admin, uid, p), from));
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (m === 'expired' || m === 'token_failed') await admin.from('coach_connections').update({ status: 'expired' }).eq('user_id', uid).eq('provider', p);
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

  // The provider sends the person back here after they approve (no Dragonfly session on this request: the state proves who it is)
  const cb = url.pathname.match(/\/callback\/(strava|oura|whoop)\/?$/);
  if (req.method === 'GET' && cb) {
    const p = cb[1] as Provider;
    const state = url.searchParams.get('state') ?? '', code = url.searchParams.get('code');
    const { data: st } = await admin.from('coach_oauth_states').select('*').eq('state', state).eq('provider', p).maybeSingle();
    const back = (q: string) => Response.redirect(`${st?.return_to || `${WEB}connections`}${(st?.return_to ?? '').includes('?') ? '&' : '?'}${q}`, 302);
    if (!st || new Date(st.created_at).getTime() < Date.now() - 15 * 60_000) return back(`error=expired&provider=${p}`);
    await admin.from('coach_oauth_states').delete().eq('state', state);
    if (!code) return back(`error=denied&provider=${p}`);
    try {
      const { tok, raw } = await tokenRequest(p, { grant_type: 'authorization_code', code, redirect_uri: redirectFor(p) });
      await admin.from('coach_connection_tokens').upsert({ user_id: st.user_id, provider: p, ...tok });
      let account: string | null = null;
      if (p === 'strava') account = [raw.athlete?.firstname, raw.athlete?.lastname].filter(Boolean).join(' ') || null;
      else if (p === 'oura') account = (await getJson('https://api.ouraring.com/v2/usercollection/personal_info', tok.access_token).catch(() => ({}))).email ?? null;
      else account = (await getJson('https://api.prod.whoop.com/developer/v2/user/profile/basic', tok.access_token).catch(() => ({}))).email ?? null;
      await admin.from('coach_connections').upsert({ user_id: st.user_id, provider: p, account, status: 'ok', connected_at: new Date().toISOString() });
      await syncOne(admin, st.user_id, p, new Date(Date.now() - 90 * DAY)).catch((e) => console.error('first sync', e));
      return back(`connected=${p}`);
    } catch (e) { console.error(e); return back(`error=failed&provider=${p}`); }
  }

  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const { data: me } = await admin.auth.getUser((req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''));
  if (!me?.user) return json(401, { error: 'sign_in_required' });
  const uid = me.user.id;
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json(400, { error: 'bad_request' }); }
  const p = body.provider as Provider | undefined;
  if (p && !(p in P)) return json(400, { error: 'bad_request' });

  try {
    switch (body.action) {
      case 'available':
        return json(200, { providers: (Object.keys(P) as Provider[]).filter((x) => creds(x).id && creds(x).secret) });
      case 'start': {
        if (!p) return json(400, { error: 'bad_request' });
        const { id, secret } = creds(p);
        if (!id || !secret) return json(501, { error: 'provider_not_configured' });
        const ret = typeof body.return_to === 'string' && /^(https:\/\/thedragonflycatalyst\.github\.io\/|dragonfly:\/\/|exp:\/\/|http:\/\/localhost)/.test(body.return_to) ? body.return_to.slice(0, 300) : `${WEB}connections`;
        const state = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
        await admin.from('coach_oauth_states').insert({ state, user_id: uid, provider: p, return_to: ret });
        await admin.from('coach_oauth_states').delete().lt('created_at', new Date(Date.now() - DAY).toISOString());
        const q = new URLSearchParams({ client_id: id, response_type: 'code', redirect_uri: redirectFor(p), scope: P[p].scope, state, ...P[p].extra });
        return json(200, { url: `${P[p].auth}?${q}` });
      }
      case 'sync': {
        const { data: conns } = await admin.from('coach_connections').select('provider').eq('user_id', uid);
        let added = 0; const failed: string[] = [];
        for (const c of (conns ?? []).filter((c) => !p || c.provider === p)) {
          try { added += await syncOne(admin, uid, c.provider as Provider, body.history ? new Date(Date.now() - 365 * DAY) : undefined); } catch { failed.push(c.provider); }
        }
        return json(200, { added, failed });
      }
      case 'disconnect': {
        if (!p) return json(400, { error: 'bad_request' });
        await admin.from('coach_connection_tokens').delete().eq('user_id', uid).eq('provider', p);
        await admin.from('coach_connections').delete().eq('user_id', uid).eq('provider', p);
        return json(200, { ok: true });
      }
      default: return json(400, { error: 'bad_request' });
    }
  } catch (e) {
    console.error(e);
    return json(502, { error: e instanceof Error && ['expired', 'not_connected'].includes(e.message) ? e.message : 'provider_error' });
  }
});
