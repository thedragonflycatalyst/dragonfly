// Turns what the AI saw in a gym-equipment photo into exercises from the library, so a trainer or client can scan a machine
// they don't know the name of and pick the move (with its demo video).
import { search, uses, type LibExercise } from './library';

/** What the machine scanner reads from one photo */
export type MachineRead = { machine: string; brand: string; gear: string[]; exercises: string[] };

/** Equipment too common to say much about the machine on its own */
const BROAD = new Set(['bodyweight', 'machine', 'bench', 'weight plate', 'mat', 'wall', 'other', 'dumbbell', 'barbell']);
const FILLER = /\b(machine|the|a|an|with|using|on|exercise)\b/gi;

/** The library exercise a name the AI gave refers to: the same name or another name it goes by (ignoring "machine" etc.) */
function best(all: LibExercise[], name: string): LibExercise | undefined {
  const norm = (x: string) => x.toLowerCase().replace(FILLER, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const want = norm(name);
  if (!want) return undefined;
  return all.find((e) => !e.legacy && norm(e.name) === want)
    ?? all.find((e) => !e.legacy && (e.aliases ?? []).some((x) => norm(x) === want))
    ?? search(all, { q: want }).find((e) => !e.legacy && norm(e.name).split(' ').length - want.split(' ').length <= 1);
}

/**
 * Library exercises for the scanned equipment, best first: the exercises the AI named (in its order), then variations of the
 * machine itself, then (only when that found little) other moves on the same specific equipment. At most `n`.
 */
export function matchMachine(read: MachineRead, all: LibExercise[], n = 30): LibExercise[] {
  return machineMatches(read, all, n).list;
}

/** Same as matchMachine, plus the moves the AI named that the library doesn't have yet (shown as text, no demo) */
export function machineMatches(read: MachineRead, all: LibExercise[], n = 30): { list: LibExercise[]; extra: string[] } {
  const out = new Map<string, LibExercise>();
  const extra: string[] = [];
  const add = (e: LibExercise | undefined) => { if (e && !e.legacy && out.size < n) out.set(e.ref, e); };
  for (const name of read.exercises) { const e = best(all, name); if (e) add(e); else if (!extra.includes(name)) extra.push(name); }
  // Variations of the machine itself ("Leg Press" → narrow, wide, high-foot leg press…)
  const core = read.machine.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  if (core) for (const e of search(all, { q: core })) add(e);
  // Still little to go on: other moves on the same specific equipment
  const specific = read.gear.filter((g) => !BROAD.has(g.toLowerCase()));
  if (out.size < 4 && specific.length) for (const e of all) if (specific.some((g) => uses(e, g))) add(e);
  return { list: [...out.values()], extra };
}
