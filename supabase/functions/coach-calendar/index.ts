// coach-calendar: the trainer's Dragonfly calendar as a feed, and their own calendar's busy times in Dragonfly.
//
// GET  ?token=…                 → .ics feed of sessions and events (subscribe from Google, Outlook or Apple Calendar)
// POST { action: 'refresh_busy' } → fetches the trainer's private calendar link and blocks those times for client bookings
// POST { action: 'refresh_all' } + x-cron-secret → the same for every trainer with a linked calendar (pg_cron, every 5 min)
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';
import { buildIcs, busyFromIcs, calendarUrl, type FeedItem } from '../_shared/ics.ts';

const cors = {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dragonfly-trainer, x-dragonfly-edit',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const DAY = 86_400_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const token = url.searchParams.get('token') ?? '';
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return new Response('Not found', { status: 404 });
    const { data: det } = await admin.from('coach_trainer_details').select('user_id').eq('calendar_token', token).maybeSingle();
    if (!det) return new Response('Not found', { status: 404 });
    const tid = det.user_id as string;
    const since = new Date(Date.now() - 60 * DAY).toISOString();
    const [{ data: tr }, { data: bk }, { data: ev }, { data: cl }, { data: gr }] = await Promise.all([
      admin.from('coach_trainers').select('display_name,timezone').eq('user_id', tid).maybeSingle(),
      admin.from('coach_bookings').select('id,title,kind,location,starts_at,duration_min,repeat,repeat_until,skipped,notes,client_id,group_id').eq('trainer_id', tid)
        .or(`starts_at.gte.${since},repeat.neq.none`).limit(2000),
      admin.from('coach_events').select('id,title,location,starts_at,duration_min,cancelled').eq('trainer_id', tid).gte('starts_at', since).eq('cancelled', false).limit(1000),
      admin.from('coach_clients').select('id,first_name,last_name').eq('trainer_id', tid),
      admin.from('coach_groups').select('id,name').eq('trainer_id', tid),
    ]);
    const who = new Map<string, string>([...(cl ?? []).map((c) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(' ')] as [string, string]), ...(gr ?? []).map((g) => [g.id, g.name] as [string, string])]);
    const items: FeedItem[] = [
      ...(bk ?? []).filter((b) => b.repeat === 'none' || !b.repeat_until || b.repeat_until >= since.slice(0, 10)).map((b) => {
        const name = who.get(b.client_id ?? b.group_id ?? '');
        return { uid: `b-${b.id}`, title: name && !b.title.includes(name) ? `${b.title} · ${name}` : b.title, start: new Date(b.starts_at), minutes: b.duration_min,
          location: b.location, notes: b.notes, repeat: b.repeat, until: b.repeat_until, skipped: b.skipped };
      }),
      ...(ev ?? []).map((e) => ({ uid: `e-${e.id}`, title: e.title, start: new Date(e.starts_at), minutes: e.duration_min, location: e.location })),
    ];
    return new Response(buildIcs(`${tr?.display_name ?? 'Dragonfly'} · Dragonfly`, tr?.timezone || 'UTC', items), {
      headers: { ...cors, 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=900' },
    });
  }

  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: 'bad_request' }); }

  // Every 5 minutes (pg_cron job coach-busy-refresh): refresh every trainer who linked a calendar, so moved and
  // cancelled appointments (e.g. ClubAutomation) reach the website's booking calendar within minutes.
  if (body.action === 'refresh_all') {
    const { data: ok } = await admin.rpc('coach_cron_ok', { p: req.headers.get('x-cron-secret') ?? '' });
    if (ok !== true) return json(401, { error: 'unauthorized' });
    const [{ data: a }, { data: b }] = await Promise.all([
      admin.from('coach_trainer_details').select('user_id').not('busy_ics_url', 'is', null),
      admin.from('coach_calendar_feeds').select('trainer_id'),
    ]);
    const ids = new Set<string>([...(a ?? []).map((x: { user_id: string }) => x.user_id), ...(b ?? []).map((x: { trainer_id: string }) => x.trainer_id)]);
    const results: Record<string, unknown> = {};
    for (const t of ids) results[t] = await refresh(admin, t);
    return json(200, { trainers: results });
  }

  const { data: me } = await admin.auth.getUser((req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''));
  if (!me?.user) return json(401, { error: 'sign_in_required' });
  if (body.action !== 'refresh_busy') return json(400, { error: 'bad_request' });
  const r = await refresh(admin, me.user.id); // only the trainer themselves (not a team viewer) refreshes their own calendar
  return json(r.status, r.status === 200 ? { blocks: r.blocks } : { error: r.error });
});

// Refreshes every calendar the trainer linked (coach_calendar_feeds: ClubAutomation, Outlook, …). Each feed's busy times
// are swapped in one step; a feed that fails keeps its last good times and records the error, so nothing opens up by mistake.
// The single link from the Coach app's Connections screen (busy_ics_url) is added as a feed if it isn't one yet.
// deno-lint-ignore no-explicit-any
async function refresh(admin: any, tid: string): Promise<{ status: number; blocks?: number; error?: string; feeds?: unknown[] }> {
  const [{ data: det }, { data: tr }] = await Promise.all([
    admin.from('coach_trainer_details').select('busy_ics_url').eq('user_id', tid).maybeSingle(),
    admin.from('coach_trainers').select('timezone').eq('user_id', tid).maybeSingle(),
  ]);
  if (!tr) return { status: 403, error: 'not_a_trainer' };
  if (det?.busy_ics_url) {
    await admin.from('coach_calendar_feeds').upsert({ trainer_id: tid, label: 'Linked calendar', url: det.busy_ics_url }, { onConflict: 'trainer_id,url', ignoreDuplicates: true });
  }
  const { data: feeds } = await admin.from('coach_calendar_feeds').select('id,label,url').eq('trainer_id', tid);
  const out: unknown[] = [];
  let total = 0, failed = 0;
  for (const f of feeds ?? []) {
    const r = await refreshFeed(admin, f, tr.timezone || 'UTC');
    if (r.error) { failed++; await admin.from('coach_calendar_feeds').update({ error: r.error }).eq('id', f.id); }
    else total += r.blocks ?? 0;
    out.push({ label: f.label, ...r });
  }
  if (failed) await admin.from('coach_trainer_details').update({ busy_error: `${failed}_feed${failed > 1 ? 's' : ''}_failing` }).eq('user_id', tid);
  return { status: failed && failed === (feeds ?? []).length ? 502 : 200, blocks: total, feeds: out, ...(failed ? { error: 'some_feeds_failing' } : {}) };
}

// deno-lint-ignore no-explicit-any
async function refreshFeed(admin: any, f: { id: string; url: string }, tz: string): Promise<{ blocks?: number; error?: string }> {
  const link = calendarUrl(f.url);
  if (!link) return { error: 'calendar_link_not_allowed' };
  let text = '';
  try {
    const res = await fetch(link, { redirect: 'error', headers: { 'cache-control': 'no-cache', pragma: 'no-cache' }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { error: `calendar_unreachable_${res.status}` };
    if (Number(res.headers.get('content-length') ?? 0) > 8_000_000) return { error: 'calendar_too_big' };
    text = await res.text();
    if (text.length > 8_000_000 || !text.includes('BEGIN:VCALENDAR')) return { error: 'calendar_unreachable' };
  } catch { return { error: 'calendar_unreachable' }; }
  const blocks = busyFromIcs(text, new Date(Date.now() - DAY), new Date(Date.now() + 90 * DAY), tz, 3000);
  const { data: n, error } = await admin.rpc('coach_replace_feed_busy', { p_feed: f.id, p_rows: blocks });
  if (error) { console.error(error.message); return { error: 'save_failed' }; }
  return { blocks: n ?? blocks.length };
}
