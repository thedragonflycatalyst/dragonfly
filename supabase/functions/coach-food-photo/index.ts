// coach-food-photo: estimate the foods, portions, calories and macros in a meal photo.
//
// POST { image: base64 JPEG, hint?: string }  (Authorization: a Dragonfly session; active clients and trainers only)
// → { items: [{ name, grams, kcal, protein, carbs, fat, sugar, fibre, sodium }], note }
// Needs the ANTHROPIC_API_KEY secret. Without it, answers { error: 'not_configured' } and the app hides the AI option.
// Each person gets DAILY_LIMIT estimates per 24 hours.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const DAILY_LIMIT = 30;
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
  name: 'record_meal',
  description: 'Record each food visible in the meal photo with an estimated portion and its nutrition for that portion.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Plain food name, e.g. "Grilled chicken breast"' },
            grams: { type: 'number', description: 'Estimated weight of this portion in grams' },
            kcal: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' },
            sugar: { type: 'number' }, fibre: { type: 'number' }, sodium: { type: 'number', description: 'milligrams' },
          },
          required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat'],
        },
      },
      note: { type: 'string', description: 'One short sentence on anything uncertain (hidden oil, sauces, portion size).' },
    },
    required: ['items'],
  },
};

const num = (v: unknown, max: number) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n * 10) / 10, max) : 0; };

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
  const uid = me.user.id;

  // Only Dragonfly coaching people: a trainer, or an active client
  const [{ data: trainer }, { data: client }] = await Promise.all([
    admin.from('coach_trainers').select('user_id').eq('user_id', uid).maybeSingle(),
    admin.from('coach_clients').select('id').eq('user_id', uid).eq('status', 'active').limit(1).maybeSingle(),
  ]);
  if (!trainer && !client) return reply(403, { error: 'not_allowed' });

  let body: { image?: unknown; hint?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: 'bad_request' }); }
  const image = typeof body.image === 'string' ? body.image.replace(/^data:image\/\w+;base64,/, '') : '';
  if (!image || image.length > MAX_IMAGE || !/^[A-Za-z0-9+/=\s]+$/.test(image)) return reply(400, { error: 'bad_image' });
  const hint = typeof body.hint === 'string' ? body.hint.slice(0, 300) : '';

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin.from('coach_ai_calls').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('at', since);
  if ((count ?? 0) >= DAILY_LIMIT) return reply(429, { error: 'daily_limit' });
  await admin.from('coach_ai_calls').insert({ user_id: uid, kind: 'food_photo' });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': aiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('AI_MODEL') ?? 'claude-sonnet-5-5',
      max_tokens: 1200,
      tools: [TOOL],
      // Newer models don't accept a forced tool, so ask for it and allow it
      tool_choice: { type: 'auto' },
      system: 'Answer only by calling the record_meal tool exactly once. Do not reply with plain text.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: `Estimate what is in this meal for a nutrition diary. List each separate food with a realistic portion weight and nutrition for that portion, using typical USDA values. Count visible oils, dressings and sauces. If the photo shows no food, return an empty list.${hint ? ` The person says: "${hint}"` : ''}` },
        ],
      }],
    }),
  });
  if (!res.ok) { console.error('ai error', res.status, await res.text()); return reply(502, { error: 'ai_unavailable' }); }
  const out = await res.json();
  const call = (out.content ?? []).find((c: { type: string }) => c.type === 'tool_use');
  const raw = (call?.input?.items ?? []) as Record<string, unknown>[];
  const items = raw.slice(0, 15).map((i) => ({
    name: String(i.name ?? 'Food').slice(0, 120), grams: num(i.grams, 5000), kcal: num(i.kcal, 5000), protein: num(i.protein, 500), carbs: num(i.carbs, 800),
    fat: num(i.fat, 500), sugar: num(i.sugar, 500), fibre: num(i.fibre, 200), sodium: num(i.sodium, 20000),
  }));
  return reply(200, { items, note: typeof call?.input?.note === 'string' ? call.input.note.slice(0, 300) : '' });
});
