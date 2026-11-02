// coach-calendar-import: reads a screenshot (texts, a paper planner, another app's calendar) and lists the sessions in it.
//
// POST { image: base64 JPEG, today: 'YYYY-MM-DD', clients: string[] }  (Authorization: a trainer's session)
// → { sessions: [{ client, title, date, time, minutes, location }] }  Nothing is saved: the trainer reviews and adds them.
// Needs ANTHROPIC_API_KEY (answers { error: 'not_configured' } without it). 30 imports per trainer per day.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const DAILY_LIMIT = 30;
const MAX_IMAGE = 2_000_000;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dragonfly-trainer, x-dragonfly-edit',
  'Access-Control-Max-Age': '86400',
};
const headers = { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });

const TOOL = {
  name: 'sessions',
  description: 'Training sessions or appointments found in the image.',
  input_schema: {
    type: 'object',
    properties: {
      sessions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            client: { type: 'string', description: 'The person the session is with, matched to one of the known client names when possible, else as written ("" if none).' },
            title: { type: 'string', description: 'Short title, e.g. "PT session" or "Consult".' },
            date: { type: 'string', description: 'YYYY-MM-DD. Resolve weekday names and relative dates ("tomorrow", "next Tue") from today.' },
            time: { type: 'string', description: '24-hour HH:MM start time.' },
            minutes: { type: 'number', description: 'Length in minutes (60 if not stated).' },
            location: { type: 'string', description: 'Where, if stated, else "".' },
          },
          required: ['date', 'time'],
        },
      },
    },
    required: ['sessions'],
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  const url = Deno.env.get('SUPABASE_URL'), adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !adminKey) return reply(503, { error: 'unavailable' });
  const aiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!aiKey) return reply(501, { error: 'not_configured' });
  const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: me } = await admin.auth.getUser((req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''));
  if (!me?.user) return reply(401, { error: 'sign_in_required' });
  const { data: tr } = await admin.from('coach_trainers').select('user_id, display_name, business_name').eq('user_id', me.user.id).maybeSingle();
  if (!tr) return reply(403, { error: 'trainers_only' });

  let body: { image?: unknown; today?: unknown; clients?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: 'bad_request' }); }
  const image = typeof body.image === 'string' ? body.image.replace(/^data:image\/\w+;base64,/, '') : '';
  if (!image || image.length > MAX_IMAGE || !/^[A-Za-z0-9+/=\s]+$/.test(image)) return reply(400, { error: 'bad_image' });
  const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const clients = Array.isArray(body.clients) ? body.clients.filter((c) => typeof c === 'string').slice(0, 300).map((c: string) => c.slice(0, 80)) : [];

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin.from('coach_ai_calls').select('id', { count: 'exact', head: true }).eq('user_id', me.user.id).eq('kind', 'calendar').gte('at', since);
  if ((count ?? 0) >= DAILY_LIMIT) return reply(429, { error: 'daily_limit' });
  await admin.from('coach_ai_calls').insert({ user_id: me.user.id, kind: 'calendar' });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': aiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('AI_MODEL') ?? 'claude-sonnet-5-5',
      max_tokens: 1500,
      tools: [TOOL],
      // Newer models don't accept a forced tool, so ask for it and allow it
      tool_choice: { type: 'auto' },
      system: 'Answer only by calling the sessions tool exactly once. Do not reply with plain text.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: `A personal trainer took this picture: a screenshot or a phone photo (possibly at an angle) of text messages, a paper planner, or a calendar or booking system on a computer screen. List every training session or appointment it shows, agrees to or schedules. Ignore cancelled ones and blocked time.
The trainer is ${JSON.stringify(tr.display_name ?? '')}${tr.business_name ? ` (business: ${JSON.stringify(tr.business_name)})` : ''}. If the picture shows several trainers' schedules (e.g. a gym booking system with columns or labels like "PL: <name>"), list only this trainer's sessions; if one appointment's details are open, list that one.
Today is ${today}; when no date is visible, use today. Known clients: ${JSON.stringify(clients)}. The client is the person being trained, not the trainer or organizer. If there are none, return an empty list.` },
        ],
      }],
    }),
  });
  if (!res.ok) { console.error('ai error', res.status, await res.text()); return reply(502, { error: 'ai_unavailable' }); }
  const out = await res.json();
  const found = (out.content ?? []).find((c: { type: string }) => c.type === 'tool_use')?.input?.sessions ?? [];
  const sessions = (Array.isArray(found) ? found : []).slice(0, 40).filter((s: any) => /^\d{4}-\d{2}-\d{2}$/.test(s?.date) && /^\d{1,2}:\d{2}$/.test(s?.time)).map((s: any) => ({
    client: String(s.client ?? '').slice(0, 80), title: String(s.title || 'Session').slice(0, 120), date: s.date, time: s.time.padStart(5, '0'),
    minutes: Math.min(Math.max(Math.round(Number(s.minutes) || 60), 5), 720), location: String(s.location ?? '').slice(0, 200),
  }));
  return reply(200, { sessions });
});
