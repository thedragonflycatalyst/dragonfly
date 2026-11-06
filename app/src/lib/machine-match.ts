// Turns what the AI saw in a gym-equipment photo into exercises from the library, so a trainer or client can scan a machine
// they don't know the name of and pick the move (with its demo video).
import { search, uses, type LibExercise } from './library';

/** What the machine scanner reads from one photo */
export type MachineRead = { machine: string; brand: string; gear: string[]; exercises: string[] };

/** Equipment too common to say much about the machine on its own */
const BROAD = new Set(['bodyweight', 'machine', 'bench', 'weight plate', 'mat', 'wall', 'other', 'dumbbell', 'barbell']);
const FILLER = /\b(machine|the|a|an|with|using|on|exercise)\b/gi;

/** First good library match for a name the AI gave, or undefined */
function best(all: LibExercise[], name: string): LibExercise | undefined {
  for (const q of [name, name.replace(FILLER, ' ').replace(/\s+/g, ' ').trim()]) {
    if (!q) continue;
    const hit = search(all, { q })[0];
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Library exercises for the scanned equipment, best first: the exercises the AI named (in its order), then variations of the
 * machine itself, then (only when that found little) other moves on the same specific equipment. At most `n`.
 */
export function matchMachine(read: MachineRead, all: LibExercise[], n = 20): LibExercise[] {
  const out = new Map<string, LibExercise>();
  const add = (e: LibExercise | undefined) => { if (e && !e.legacy && out.size < n) out.set(e.ref, e); };
  for (const name of read.exercises) add(best(all, name));
  // Variations of the machine itself ("Leg Press" → narrow, wide, high-foot leg press…)
  const core = read.machine.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  if (core) for (const e of search(all, { q: core })) add(e);
  // Still little to go on: other moves on the same specific equipment
  const specific = read.gear.filter((g) => !BROAD.has(g.toLowerCase()));
  if (out.size < 4 && specific.length) for (const e of all) if (specific.some((g) => uses(e, g))) add(e);
  return [...out.values()];
}
