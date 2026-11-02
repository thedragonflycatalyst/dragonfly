// coach-checkin-brief: talking points for a trainer's personal check-in with one client.
//
// POST { client_id }  (Authorization: the trainer's session; a team owner viewing a trainer sends x-dragonfly-trainer)
// → { summary, points: string[], message, wins: string[], watch: string[] }
// Reads the last 3 weeks (workouts, food diary, water, measurements, notes, last check-ins) on the server and asks
// Claude for a short brief. The trainer does the check-in themselves; nothing is sent to the client.
// Needs the ANTHROPIC_API_KEY secret (answers { error: 'not_configured' } without it). 40 briefs per trainer per day.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const DAILY_LIMIT = 40;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dragonfly-trainer, x-dragonfly-edit',
  'Access-Control-Max-Age': '86400',
};
const headers = { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });

const TOOL = {
  name: 'checkin_brief',
  description: 'A short brief to help a personal trainer check in with their client personally.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Two sentences on how the client has been doing lately.' },
      wins: { type: 'array', items: { type: 'string' }, description: 'Up to 3 specific things to praise.' },
      watch: { type: 'array', items: { type: 'string' }, description: 'Up to 3 things that may need attention.' },
      points: { type: 'array', items: { type: 'string' }, description: '3 to 5 questions or talking points for the conversation.' },
      message: { type: 'string', description: 'A warm, short opening text message the trainer could send, in a casual coaching voice, no emojis, signed by nobody.' },
    },
    required: ['summary', 'points', 'message'],
  },
};

const day = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  const url = Deno.env.get('SUPABASE_URL');
  const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !adminKey) return reply(503, { error: 'unavailable' });
  const aiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!aiKey) return reply(501, { error: 'not_configured' });
  const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: me, error: meErr } = await admin.auth.getUser(jwt);
  if (meErr || !me.user) return reply(401, { error: 'sign_in_required' });

  let body: { client_id?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: 'bad_request' }); }
  const clientId = body.client_id;
  if (typeof clientId !== 'string' || !/^[0-9a-f-]{36}$/i.test(clientId)) return reply(400, { error: 'bad_request' });

  // Whose client: yours, or the team trainer you (the owner) are viewing
  let trainerId = me.user.id;
  const viewing = req.headers.get('x-dragonfly-trainer');
  if (viewing && viewing !== me.user.id) {
    const { data: team } = await admin.from('coach_teams').select('id').eq('owner_id', me.user.id).maybeSingle();
    const { data: m } = team ? await admin.from('coach_team_members').select('id').eq('team_id', team.id).eq('trainer_id', viewing).eq('status', 'active').maybeSingle() : { data: null };
    if (!m) return reply(403, { error: 'not_your_team_member' });
    trainerId = viewing;
  }
  const { data: client } = await admin.from('coach_clients').select('id, trainer_id, user_id, first_name, goals, interests, status, started_on').eq('id', clientId).maybeSingle();
  if (!client || client.trainer_id !== trainerId) return reply(404, { error: 'not_your_client' });

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin.from('coach_ai_calls').select('id', { count: 'exact', head: true }).eq('user_id', me.user.id).eq('kind', 'checkin').gte('at', since);
  if ((count ?? 0) >= DAILY_LIMIT) return reply(429, { error: 'daily_limit' });
  await admin.from('coach_ai_calls').insert({ user_id: me.user.id, kind: 'checkin' });

  const from = day(new Date(Date.now() - 21 * 86_400_000)), today = day(new Date());
  const uid = client.user_id ?? '00000000-0000-0000-0000-000000000000';
  const [a, logs, food, water, meas, notes, checks, habits, health, synced] = await Promise.all([
    admin.from('coach_assignments').select('scheduled_on, title, status').eq('client_id', clientId).gte('scheduled_on', from).lte('scheduled_on', today).order('scheduled_on'),
    admin.from('coach_logs').select('performed_at, rpe, note, duration_seconds').eq('client_id', clientId).gte('performed_at', from).order('performed_at'),
    admin.from('coach_food_logs').select('eaten_on, n').eq('client_id', clientId).gte('eaten_on', from),
    admin.from('coach_water_logs').select('day, ml').eq('client_id', clientId).gte('day', from),
    admin.from('coach_measurements').select('measured_on, weight_kg, body_fat_pct').eq('client_id', clientId).order('measured_on', { ascending: false }).limit(6),
    admin.from('coach_notes').select('body, pinned, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5),
    admin.from('coach_checkins').select('done_on, channel, note, mood').eq('client_id', clientId).order('done_on', { ascending: false }).limit(3),
    admin.from('coach_habits').select('title, days_per_week, active').eq('client_id', clientId).eq('active', true),
    // From the apps they've connected (Health Connect, Oura, WHOOP, Strava…)
    admin.from('coach_health_daily').select('day, steps, sleep_min, resting_hr, hrv_ms, readiness').eq('user_id', uid).gte('day', from).order('day'),
    admin.from('coach_activities').select('started_at, kind, duration_s, distance_m, app').eq('user_id', uid).gte('started_at', from).order('started_at').limit(40),
  ]);
  // Daily calorie and protein totals from the diary
  const perDay: Record<string, { kcal: number; protein: number }> = {};
  for (const f of (food.data ?? []) as { eaten_on: string; n: Record<string, number> }[]) {
    const d = (perDay[f.eaten_on] ??= { kcal: 0, protein: 0 });
    d.kcal += Number(f.n?.kcal) || 0; d.protein += Number(f.n?.protein) || 0;
  }
  const facts = {
    first_name: client.first_name, goals: client.goals, interests: client.interests, client_since: client.started_on, today,
    workouts_scheduled: a.data ?? [], workouts_logged: logs.data ?? [],
    food_diary_days: Object.entries(perDay).map(([d, v]) => ({ day: d, kcal: Math.round(v.kcal), protein_g: Math.round(v.protein) })),
    water: water.data ?? [], recent_measurements: meas.data ?? [], trainer_notes: notes.data ?? [], previous_checkins: checks.data ?? [], habits: habits.data ?? [],
    synced_daily_health: health.data ?? [], synced_workouts_from_other_apps: synced.data ?? [],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': aiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('AI_MODEL') ?? 'claude-sonnet-5-5',
      max_tokens: 900,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'checkin_brief' },
      messages: [{ role: 'user', content: `You help a personal trainer prepare to check in personally with a client. Use only these facts from the last three weeks (JSON). Be specific and kind, never preachy; no medical advice. If there's little data, say so and suggest questions to learn more.\n\n${JSON.stringify(facts)}` }],
    }),
  });
  if (!res.ok) { console.error('ai error', res.status, await res.text()); return reply(502, { error: 'ai_unavailable' }); }
  const out = await res.json();
  const brief = (out.content ?? []).find((c: { type: string }) => c.type === 'tool_use')?.input ?? {};
  const list = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, n).map((x: string) => x.slice(0, 300)) : []);
  return reply(200, {
    summary: String(brief.summary ?? '').slice(0, 600), points: list(brief.points, 5), wins: list(brief.wins, 3), watch: list(brief.watch, 3), message: String(brief.message ?? '').slice(0, 600),
  });
});
