/** Read-only compatibility adapter for Lapis's stamped sync document.
 * Never rewrite the Lapis document from Coach's workout builder.
 */
export type LapisTimer = {
  id: string;
  name: string;
  prepare: number;
  warmup: number;
  work: number;
  rest: number;
  rounds: number;
  cycles: number;
  restBetweenCycles: number;
  cooldown: number;
  slots: { exercise: string; work?: number; cues?: unknown[] }[];
  voice?: Record<string, unknown>;
  // The original Lapis template, preserved for forward compatibility.
  template: Record<string, unknown>;
};

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const whole = (v: unknown, fallback: number, min = 0, max = 86400): number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max ? v : fallback;

/** Accepts a v1 Lapis template; reject corrupt entries without rejecting the user's library. */
export function parseLapisTimer(value: unknown): LapisTimer | null {
  const data = object(value);
  if (!data || data.v !== 1 || typeof data.id !== 'string' || !data.id.trim() ||
      data.id.length > 150 || typeof data.name !== 'string' || !data.name.trim()) return null;
  if (data.rounds !== undefined && whole(data.rounds, -1, 1, 1000) < 1) return null;
  if (data.cycles !== undefined && whole(data.cycles, -1, 1, 100) < 1) return null;
  const rawSlots = Array.isArray(data.slots) ? data.slots.slice(0, 1000) : [];
  const slots = rawSlots.map((s) => {
    const v = object(s);
    return { exercise: typeof v?.exercise === 'string' ? v.exercise.slice(0, 160) : '',
      ...(v?.work === undefined ? {} : { work: whole(v.work, 30) }),
      cues: Array.isArray(v?.cues) ? v.cues.slice(0, 50) : [] };
  });
  return {
    id: data.id, name: data.name.trim().slice(0, 160),
    prepare: whole(data.prepare, 10), warmup: whole(data.warmup, 0),
    work: whole(data.work, 30), rest: whole(data.rest, 15),
    rounds: whole(data.rounds, 8, 1, 1000), cycles: whole(data.cycles, 1, 1, 100),
    restBetweenCycles: whole(data.restBetweenCycles, 0), cooldown: whole(data.cooldown, 0),
    slots, voice: object(data.voice) ?? undefined, template: { ...data },
  };
}

/** Sum actual per-slot work lengths, omitting rest after the last round. */
export function lapisTimerSeconds(t: LapisTimer): number {
  let works = 0;
  for (let i = 0; i < t.rounds; i++) works += t.slots[i]?.work ?? t.work;
  return t.prepare + t.warmup +
    (works + t.rest * Math.max(0, t.rounds - 1)) * t.cycles +
    t.restBetweenCycles * Math.max(0, t.cycles - 1) + t.cooldown;
}

/** Merge document identity and tombstones. Includes only active stamped timers. */
export function timersFromSyncDoc(doc: unknown): LapisTimer[] {
  const root = object(doc);
  const entries = object(root?.timers) ?? {};
  const deleted = object(root?.deleted) ?? {};
  const order = object(object(root?.order)?.timers);
  const ids = Array.isArray(order?.ids) ? order.ids.filter((id): id is string => typeof id === 'string') : [];
  const out: { timer: LapisTimer; at: number }[] = [];
  for (const [id, entry] of Object.entries(entries)) {
    const stamp = object(entry);
    const timer = parseLapisTimer(stamp?.data);
    if (!timer || timer.id !== id) continue;
    const at = Date.parse(typeof stamp?.at === 'string' ? stamp.at : '');
    const gone = deleted['timers:' + id];
    if (typeof gone === 'string' && Number.isFinite(Date.parse(gone)) &&
        Number.isFinite(at) && Date.parse(gone) >= at) continue;
    out.push({ timer, at: Number.isFinite(at) ? at : 0 });
  }
  const index = new Map(ids.map((id, i) => [id, i]));
  out.sort((a, b) => {
    const ai = index.get(a.timer.id), bi = index.get(b.timer.id);
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    return a.at - b.at || a.timer.name.localeCompare(b.timer.name);
  });
  return out.map((x) => x.timer);
}
