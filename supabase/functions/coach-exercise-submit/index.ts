// coach-exercise-submit: a trainer suggests an exercise for the shared Dragonfly library. An AI compares it with the most
// similar library exercises (sent by the app) and decides, straight away:
//   same         -> another name for an existing move: the name becomes a search name for it (coach_library_aliases)
//   add          -> a distinct, well-explained variation: written up in the library's style and added (coach_library_extra)
//   needs_detail -> might be new, but too thin to tell or to write up: says exactly what to add, so the trainer can resubmit
//   reject       -> not a real, safe exercise
// Every review is kept in coach_exercise_submissions. A trainer who can't get past the AI on something that needs a person
// escalates it (coach_escalate_submission) to a Dragonfly admin; people report or hide bad entries.
//
// POST { exercise: { name, aliases?, category, gear[], main[], other[], description, video? },
//        candidates: [{ ref, name, aliases[], category, pattern, gear[], main[], setup, move }],
//        lists: { categories[], gear[], muscles[], patterns[] } }   (Authorization: a trainer's session)
// → { id, outcome: 'alias' | 'added' | 'already_listed' | 'needs_detail' | 'rejected', ref?, name?, reason }
// Needs ANTHROPIC_API_KEY (answers { error: 'not_configured' } without it). DAILY_LIMIT reviews per trainer per day.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const DAILY_LIMIT = 20;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dragonfly-trainer, x-dragonfly-edit',
  'Access-Control-Max-Age': '86400',
};
const headers = { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strs = (v: unknown, n: number, max = 80) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 118);

const TOOL = {
  name: 'review_exercise',
  description: 'Record the decision about a suggested library exercise, and the library entry when it should be added.',
  input_schema: {
    type: 'object',
    properties: {
      decision: { type: 'string', enum: ['same', 'add', 'needs_detail', 'reject'] },
      match_ref: { type: 'string', description: 'For "same": the ref of the library exercise it duplicates.' },
      reason: { type: 'string', description: 'One or two plain sentences to the trainer explaining the decision (for needs_detail: what to add).' },
      entry: {
        type: 'object',
        description: 'For "add" (and for "needs_detail" when you can draft it): the library entry, written in the same style as the library (plain, specific, safe).',
        properties: {
          name: { type: 'string', description: 'Standard name in Title Case, e.g. "EZ-Bar Close-Grip Bench Press"' },
          aliases: { type: 'array', items: { type: 'string' }, description: 'Other names people search for, including the trainer\'s name if different' },
          category: { type: 'string' }, kind: { type: 'string', description: 'Strength, Hypertrophy, Power, Mobility, Conditioning, etc.' },
          pattern: { type: 'string' }, main: { type: 'array', items: { type: 'string' } }, other: { type: 'array', items: { type: 'string' } },
          gear: { type: 'array', items: { type: 'string' } },
          setup: { type: 'string', description: 'SETUP: 1-3 sentences' }, move: { type: 'string', description: 'MOVEMENT & RETURN: 1-3 sentences' },
          cues: { type: 'string', description: 'KEY CUES: 2-4 short sentences, including what makes it different and why to use it' },
        },
      },
    },
    required: ['decision', 'reason'],
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
  const { data: tr } = await admin.from('coach_trainers').select('user_id').eq('user_id', me.user.id).maybeSingle();
  if (!tr) return reply(403, { error: 'trainers_only' });

  let body: { exercise?: Record<string, unknown>; candidates?: unknown; lists?: Record<string, unknown> };
  try { body = await req.json(); } catch { return reply(400, { error: 'bad_request' }); }
  const x = body.exercise ?? {};
  const ex = { name: str(x.name, 120), aliases: strs(x.aliases, 10), category: str(x.category, 40), gear: strs(x.gear, 10), main: strs(x.main, 6),
    other: strs(x.other, 10), description: str(x.description, 4000), video: str(x.video, 500) };
  if (ex.name.length < 3) return reply(400, { error: 'bad_request' });
  const cands = (Array.isArray(body.candidates) ? body.candidates : []).slice(0, 40).map((c: any) => ({
    ref: str(c?.ref, 130), name: str(c?.name, 120), aliases: strs(c?.aliases, 12), category: str(c?.category, 40), pattern: str(c?.pattern, 40),
    gear: strs(c?.gear, 8), main: strs(c?.main, 6), setup: str(c?.setup, 300), move: str(c?.move, 300),
  })).filter((c) => /^lib:[a-z0-9-]+$/.test(c.ref) && c.name);
  const lists = body.lists ?? {};
  const allow = { categories: strs(lists.categories, 60, 40), gear: strs(lists.gear, 120, 40), muscles: strs(lists.muscles, 80, 40), patterns: strs(lists.patterns, 80, 40) };

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin.from('coach_ai_calls').select('id', { count: 'exact', head: true }).eq('user_id', me.user.id).eq('kind', 'exercise_submit').gte('at', since);
  if ((count ?? 0) >= DAILY_LIMIT) return reply(429, { error: 'daily_limit' });
  await admin.from('coach_ai_calls').insert({ user_id: me.user.id, kind: 'exercise_submit' });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': aiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('AI_MODEL') ?? 'claude-sonnet-5-5',
      max_tokens: 1500,
      tools: [TOOL],
      // Newer models don't accept a forced tool, so ask for it and allow it
      tool_choice: { type: 'auto' },
      system: 'You curate a professional exercise library for personal trainers. Answer only by calling the review_exercise tool exactly once.',
      messages: [{ role: 'user', content: `A trainer suggests adding this exercise to the shared library:
${JSON.stringify(ex)}

The most similar exercises already in the library:
${JSON.stringify(cands)}

Decide:
- "same": it is the same movement as one listed above, with the same equipment and essentially the same setup, just under another name. Give match_ref. Its name becomes another search name for that exercise.
- "add": it is genuinely distinct from everything listed (different equipment, grip, stance, body position, range or tempo that changes what it trains or who it suits), it is a real and safe exercise, and the suggestion explains it well enough to write a clear entry. Write the entry: name, aliases, category from ${JSON.stringify(allow.categories)}, pattern from ${JSON.stringify(allow.patterns)}, main and other muscles from ${JSON.stringify(allow.muscles)}, gear from ${JSON.stringify(allow.gear)}, setup, move and cues (say in the cues what makes it different and why to use it).
- "needs_detail": it might be distinct, but the description is too thin to tell what makes it different or to write it up. Say exactly what to add.
- "reject": not a real exercise, unsafe, a joke, or not an exercise at all.
Be strict: small wording differences, brand names and "machine"/"exercise" suffixes are "same". A different piece of equipment (e.g. an EZ bar instead of a straight bar) is a variation worth adding only if the suggestion shows how it changes the movement or why it helps.` }],
    }),
  });
  if (!res.ok) { console.error('ai error', res.status, await res.text()); return reply(502, { error: 'ai_unavailable' }); }
  const out = await res.json();
  const got = (out.content ?? []).find((c: { type: string }) => c.type === 'tool_use')?.input ?? {};
  const reason = str(got.reason, 600) || 'Reviewed.';
  const decision = ['same', 'add', 'needs_detail', 'reject'].includes(got.decision) ? got.decision : 'needs_detail';
  let sid: string | null = null;
  const save = async (outcome: string, match_ref: string | null, r = reason, proposal: Record<string, unknown> | null = null) => {
    const { data, error } = await admin.from('coach_exercise_submissions').insert({ trainer_id: me.user!.id, exercise: ex, ai_decision: decision, outcome, match_ref, reason: r, proposal }).select('id').single();
    if (error) console.error('submission insert', error.message);
    sid = (data?.id as string | undefined) ?? null;
    return !error;
  };
  const answer = (b: Record<string, unknown>) => reply(200, { id: sid, ...b });
  const lower = (s: string) => s.toLowerCase();

  if (decision === 'same') {
    const c = cands.find((k) => k.ref === str(got.match_ref, 130));
    if (!c) { const r = 'It looks like an exercise we already have, but the match was unclear. Add a little more detail and try again.'; await save('needs_detail', null, r); return answer({ outcome: 'needs_detail', reason: r }); }
    const names = new Set([c.name, ...c.aliases].map(lower));
    const { data: had } = await admin.from('coach_library_aliases').select('alias').eq('ref', c.ref);
    for (const h of had ?? []) names.add(lower(h.alias));
    const fresh = [ex.name, ...ex.aliases].filter((n, i, a) => !names.has(lower(n)) && a.findIndex((m) => lower(m) === lower(n)) === i).slice(0, 5);
    if (!fresh.length) { await save('already_listed', c.ref); return answer({ outcome: 'already_listed', ref: c.ref, name: c.name, reason }); }
    if (!(await save('alias', c.ref, reason, { kind: 'alias', ref: c.ref, names: fresh }))) return reply(502, { error: 'unavailable' });
    // One at a time: a name someone else added a moment ago is simply skipped (unique per exercise, any case)
    for (const alias of fresh) await admin.from('coach_library_aliases').insert({ ref: c.ref, alias, submission_id: sid });
    return answer({ outcome: 'alias', ref: c.ref, name: c.name, reason });
  }

  if ((decision === 'add' || decision === 'needs_detail') && got.entry) {
    const e = got.entry;
    const name = str(e.name, 120) || ex.name;
    const pick = (v: unknown, from: string[], n: number) => { const ok = new Map(from.map((f) => [lower(f), f])); return strs(v, n).map((m) => ok.get(lower(m))).filter((m): m is string => !!m); };
    const main = pick(e.main, allow.muscles, 4), gear = pick(e.gear, allow.gear, 6);
    const setup = str(e.setup, 800), move = str(e.move, 800), cues = str(e.cues, 800);
    if (decision === 'add' && (!main.length || !gear.length || !setup || !move || !cues)) {
      const r = 'It may be worth adding, but it needs clearer muscles, equipment and how-to before it can go in. Add more detail and try again.';
      await save('needs_detail', null, r); return answer({ outcome: 'needs_detail', reason: r });
    }
    const id = `x-${slug(name)}`, ref = `lib:${id}`;
    if (decision === 'add' && (cands.some((c) => lower(c.name) === lower(name)) || (await admin.from('coach_library_extra').select('ref').eq('ref', ref).maybeSingle()).data)) {
      await save('already_listed', ref, 'An exercise with that name is already in the library.'); return answer({ outcome: 'already_listed', ref, name, reason: 'An exercise with that name is already in the library.' });
    }
    const aliases = [...new Set([ex.name, ...ex.aliases, ...strs(e.aliases, 10)].filter((a) => lower(a) !== lower(name)))].slice(0, 12);
    const category = pick([e.category], allow.categories, 1)[0] ?? (ex.category || 'Bodyweight');
    const pattern = pick([e.pattern], allow.patterns, 1)[0] ?? '';
    const row = [id, name, aliases, category, str(e.kind, 30) || 'Strength', pattern, main, pick(e.other, allow.muscles, 6).filter((m) => !main.includes(m)), gear, setup, move, cues, '', 'Community additions'];
    // A draft for a thin suggestion is kept with the review, so a person can use it if the trainer escalates
    if (decision === 'needs_detail') { await save('needs_detail', null, reason, { kind: 'add', ref, row }); return answer({ outcome: 'needs_detail', reason }); }
    if (!(await save('added', ref, reason, { kind: 'add', ref, row }))) return reply(502, { error: 'unavailable' });
    const { error } = await admin.from('coach_library_extra').insert({ ref, data: row, submission_id: sid });
    if (error) { console.error('extra insert', error.message); return reply(502, { error: 'unavailable' }); }
    return answer({ outcome: 'added', ref, name, reason });
  }

  const outcome = decision === 'reject' ? 'rejected' : 'needs_detail';
  await save(outcome, null);
  return answer({ outcome, reason });
});
