// coach-machine-scan: name the gym machine or equipment in a photo and the exercises done on it, so the exercise picker can
// show the matching library moves (with their demo videos) to someone who doesn't know what the machine is called.
//
// POST { image: base64 JPEG, gear: string[] }  (Authorization: a Dragonfly session; trainers and active clients only)
//   gear: the app's equipment list, so the answer uses the same names
// → { machine, brand, gear: string[], exercises: string[] }  (machine '' when no equipment is in view). Nothing is saved.
// Needs the ANTHROPIC_API_KEY secret (answers { error: 'not_configured' } without it). DAILY_LIMIT scans per person per day.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const DAILY_LIMIT = 60;
const MAX_IMAGE = 2_000_000; // base64 characters (about 1.5 MB)
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dragonfly-trainer, x-dragonfly-edit',
  'Access-Control-Max-Age': '86400',
};
const headers = { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });

const TOOL = {
  name: 'identify_equipment',
  description: 'Record the gym machine or piece of equipment the photo is pointed at and the exercises done on it.',
  input_schema: {
    type: 'object',
    properties: {
      machine: { type: 'string', description: 'Common name of the main machine or equipment in view, e.g. "Seated leg curl machine". Empty when there is none.' },
      brand: { type: 'string', description: 'Brand or model if printed on it, else empty.' },
      gear: { type: 'array', items: { type: 'string' }, description: 'The equipment it is, chosen only from the allowed list.' },
      exercises: { type: 'array', items: { type: 'string' }, description: 'Up to 15 standard exercise names done on exactly this equipment, most common first: its main exercise, its common variations (stance, foot position, grip, single-limb) and other moves people commonly do on it, e.g. for a leg press: "Leg Press", "High Foot Leg Press", "Single-Leg Leg Press", "Leg Press Calf Raise".' },
    },
    required: ['machine', 'gear', 'exercises'],
  },
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

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
  const uid = me.user.id;
  const [{ data: trainer }, { data: client }] = await Promise.all([
    admin.from('coach_trainers').select('user_id').eq('user_id', uid).maybeSingle(),
    admin.from('coach_clients').select('id').eq('user_id', uid).eq('status', 'active').limit(1).maybeSingle(),
  ]);
  if (!trainer && !client) return reply(403, { error: 'not_allowed' });

  let body: { image?: unknown; gear?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: 'bad_request' }); }
  const image = typeof body.image === 'string' ? body.image.replace(/^data:image\/\w+;base64,/, '') : '';
  if (!image || image.length > MAX_IMAGE || !/^[A-Za-z0-9+/=\s]+$/.test(image)) return reply(400, { error: 'bad_image' });
  const allowed = Array.isArray(body.gear) ? body.gear.filter((g): g is string => typeof g === 'string').slice(0, 120).map((g) => g.slice(0, 40)) : [];

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin.from('coach_ai_calls').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('kind', 'machine').gte('at', since);
  if ((count ?? 0) >= DAILY_LIMIT) return reply(429, { error: 'daily_limit' });
  await admin.from('coach_ai_calls').insert({ user_id: uid, kind: 'machine' });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': aiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('AI_MODEL') ?? 'claude-sonnet-5-5',
      max_tokens: 800,
      tools: [TOOL],
      // Newer models don't accept a forced tool, so ask for it and allow it
      tool_choice: { type: 'auto' },
      system: 'Answer only by calling the identify_equipment tool exactly once. Do not reply with plain text.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: `Someone in a gym pointed their phone at a machine or piece of equipment they want to use, possibly not knowing its name. Identify the main equipment in the centre of the photo (use any printed name, brand, placard or exercise diagram on it). List the exercises done on exactly that equipment, most common first: its main exercise, its usual variations (stance, foot position, grip, facing the other way, single-limb) and other moves people commonly use it for (e.g. calf raises on a leg press or hack squat). Use plain standard names a trainer would use. Allowed equipment names for "gear": ${JSON.stringify(allowed)}. If no gym equipment is in view, set machine to "" and both lists empty.` },
        ],
      }],
    }),
  });
  if (!res.ok) { console.error('ai error', res.status, await res.text()); return reply(502, { error: 'ai_unavailable' }); }
  const out = await res.json();
  const got = (out.content ?? []).find((c: { type: string }) => c.type === 'tool_use')?.input ?? {};
  const list = (v: unknown, n: number) => (Array.isArray(v) ? v.map((x) => str(x, 80)).filter(Boolean).slice(0, n) : []);
  const ok = new Set(allowed.map((g) => g.toLowerCase()));
  return reply(200, {
    machine: str(got.machine, 80), brand: str(got.brand, 60),
    gear: list(got.gear, 6).filter((g) => !ok.size || ok.has(g.toLowerCase())),
    exercises: list(got.exercises, 15),
  });
});
