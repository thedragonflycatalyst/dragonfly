// coach-calendar: the trainer's Dragonfly calendar as a feed, and their own calendar's busy times in Dragonfly.
//
// GET  ?token=…                 → .ics feed of sessions and events (subscribe from Google, Outlook or Apple Calendar)
// POST { action: 'refresh_busy' } → fetches the trainer's private calendar link and blocks those times for client bookings
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
  const { data: me } = await admin.auth.getUser((req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''));
  if (!me?.user) return json(401, { error: 'sign_in_required' });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: 'bad_request' }); }
  if (body.action !== 'refresh_busy') return json(400, { error: 'bad_request' });

  const tid = me.user.id; // only the trainer themselves (not a team viewer) refreshes their own calendar
  const [{ data: det }, { data: tr }] = await Promise.all([
    admin.from('coach_trainer_details').select('busy_ics_url').eq('user_id', tid).maybeSingle(),
    admin.from('coach_trainers').select('timezone').eq('user_id', tid).maybeSingle(),
  ]);
  if (!tr) return json(403, { error: 'not_a_trainer' });
  if (!det?.busy_ics_url) { await admin.from('coach_external_busy').delete().eq('trainer_id', tid); return json(200, { blocks: 0 }); }
  const link = calendarUrl(det.busy_ics_url);
  if (!link) return json(400, { error: 'calendar_link_not_allowed' });
  let text = '';
  try {
    const res = await fetch(link, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return json(502, { error: 'calendar_unreachable' });
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > 8_000_000) return json(413, { error: 'calendar_too_big' });
    text = await res.text();
    if (text.length > 8_000_000 || !text.includes('BEGIN:VCALENDAR')) return json(502, { error: 'calendar_unreachable' });
  } catch { return json(502, { error: 'calendar_unreachable' }); }
  const blocks = busyFromIcs(text, new Date(), new Date(Date.now() + 60 * DAY), tr.timezone || 'UTC', 1500);
  await admin.from('coach_external_busy').delete().eq('trainer_id', tid);
  for (let i = 0; i < blocks.length; i += 500) {
    const { error } = await admin.from('coach_external_busy').insert(blocks.slice(i, i + 500).map((b) => ({ ...b, trainer_id: tid })));
    if (error) { console.error(error.message); return json(500, { error: 'save_failed' }); }
  }
  return json(200, { blocks: blocks.length });
});
