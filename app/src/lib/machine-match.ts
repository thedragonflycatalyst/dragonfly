// Turns what the AI saw in a gym-equipment photo into exercises from the library, so a trainer or client can scan a machine
// they don't know the name of and pick the move (with its demo video).
import { MACHINES } from '../data/machines';
import { search, uses, type LibExercise } from './library';

/** What the machine scanner reads from one photo. id: the closest machine in MACHINES, or '' when none is close. */
export type MachineRead = { id?: string; machine: string; brand: string; gear: string[]; exercises: string[] };

/** The machine list the scanner's AI chooses from */
export const machineChoices = () => MACHINES.map((m) => `${m.id}: ${m.name}${m.aliases.length ? ` (also: ${m.aliases.join(', ')})` : ''}`);

/** Equipment too common to say much about the machine on its own */
const BROAD = new Set(['bodyweight', 'machine', 'bench', 'weight plate', 'mat', 'wall', 'other', 'dumbbell', 'barbell']);
const FILLER = /\b(machine|the|a|an|with|using|on|exercise)\b/gi;

/** The library exercise a name the AI gave refers to: the same name or another name it goes by (ignoring "machine" etc.) */
function best(all: LibExercise[], name: string): LibExercise | undefined {
  const norm = (x: string) => x.toLowerCase().replace(FILLER, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const want = norm(name);
  if (!want) return undefined;
  return all.find((e) => norm(e.name) === want)
    ?? all.find((e) => (e.aliases ?? []).some((x) => norm(x) === want))
    ?? search(all, { q: want }).find((e) => norm(e.name).split(' ').length - want.split(' ').length <= 1);
}

/**
 * Library exercises for the scanned equipment, best first. For a machine in MACHINES: every exercise listed for it, then any
 * other ones the AI named. Otherwise: the exercises the AI named, then variations of the machine's name, then (only when
 * that found little) other moves on the same specific equipment. At most `n`.
 */
export function matchMachine(read: MachineRead, all: LibExercise[], n = 60): LibExercise[] {
  return machineMatches(read, all, n).list;
}

/** Same as matchMachine, plus the moves the AI named that the library doesn't have yet (shown as text, no demo) */
export function machineMatches(read: MachineRead, all: LibExercise[], n = 60): { list: LibExercise[]; extra: string[] } {
  const out = new Map<string, LibExercise>();
  const extra: string[] = [];
  const add = (e: LibExercise | undefined) => { if (e && out.size < n) out.set(e.ref, e); };
  // A known machine: its whole list of exercises and variations
  const known = MACHINES.find((m) => m.id === read.id);
  if (known) {
    for (const name of known.ex) add(all.find((e) => e.name === name));
    const more = known.more;
    if (more) for (const e of all) if (uses(e, more.gear) && (!more.named || more.named.test(e.name))) add(e);
  }
  for (const name of read.exercises) { const e = best(all, name); if (e) add(e); else if (!extra.includes(name)) extra.push(name); }
  // Variations of the machine itself ("Leg Press" → narrow, wide, high-foot leg press…)
  const core = known ? '' : read.machine.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  if (core) for (const e of search(all, { q: core })) add(e);
  // Still little to go on: other moves on the same specific equipment
  const specific = read.gear.filter((g) => !BROAD.has(g.toLowerCase()));
  if (!known && out.size < 4 && specific.length) for (const e of all) if (specific.some((g) => uses(e, g))) add(e);
  return { list: [...out.values()], extra };
}
