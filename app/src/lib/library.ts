// The exercise library: the Dragonfly Coach Exercise Library (1,700+ exercises with alternate names, muscles, equipment and
// how-to and demo videos), bundled with the app, plus approved trainer submissions loaded online (setLibraryExtras).
// Trainers' own exercises (coach_exercises) are merged in at search time.
import coach from '../data/coach-library.json';

export type LibExercise = {
  ref: string;            // 'lib:<id>' or 'my:<uuid>'
  name: string; category: string; equipment: string;
  primary: string[]; secondary: string[]; level: string; mechanic: string; steps: string[];
  images: string[];       // full image URLs (start and end position)
  video?: string | null;  // YouTube/Vimeo link or (trainer's own) a storage path in coach-media
  mine?: boolean;
  alts?: string[];        // trainer's own: exercises a client may swap to
  metric?: 'reps' | 'time' | 'distance'; // trainer's own: how it's measured (time = Lapis timer)
  aliases?: string[];     // other names it goes by; search finds it by any of them
  gear?: string[];        // every piece of equipment it needs
  kind?: string;          // training type (Strength, Hypertrophy, Mobility...)
  pattern?: string;       // movement pattern (Squat, Hinge, Horizontal push...)
  group?: string;         // library section
  how?: { setup: string; move: string; cues: string };
};

type CoachRow = [id: string, name: string, aliases: string[], category: string, kind: string, pattern: string, main: string[], other: string[],
  gear: string[], setup: string, move: string, cues: string, video: string, group: string];
const fromCoach = (r: CoachRow): LibExercise => ({
  ref: `lib:${r[0]}`, name: r[1], aliases: r[2], category: r[3], kind: r[4], pattern: r[5], primary: r[6], secondary: r[7],
  gear: r[8], equipment: r[8].join(', '), how: { setup: r[9], move: r[10], cues: r[11] }, video: r[12] || null, group: r[13],
  level: '', mechanic: '', steps: [], images: [],
});

let cache: LibExercise[] | null = null;
let byId: Map<string, LibExercise> | null = null;
/** Approved additions from trainers' submissions (stored online) and extra names for existing exercises */
let extraRows: CoachRow[] = [];
let extraNames: { ref: string; alias: string }[] = [];
/** Adds the approved community additions and extra names to the library (call after loading them) */
export function setLibraryExtras(rows: unknown[], aliases: { ref: string; alias: string }[]) {
  extraRows = rows.filter((r): r is CoachRow => Array.isArray(r) && r.length >= 14 && typeof r[0] === 'string' && typeof r[1] === 'string');
  extraNames = aliases;
  cache = null; byId = null;
}
/** Every library exercise, A to Z */
export function builtIn(): LibExercise[] {
  if (!cache) {
    const all = [...(coach as unknown as { rows: CoachRow[] }).rows, ...extraRows].map(fromCoach);
    const byRef = new Map(all.map((e) => [e.ref, e]));
    for (const { ref, alias } of extraNames) {
      const e = byRef.get(ref);
      if (e && !same(e.name, alias) && !(e.aliases ?? []).some((a) => same(a, alias))) e.aliases = [...(e.aliases ?? []), alias];
    }
    cache = [...byRef.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  return cache;
}
function index(): Map<string, LibExercise> {
  if (!byId) {
    byId = new Map(builtIn().map((e) => [e.ref, e] as const));
  }
  return byId;
}
export function byRef(ref: string, mine: LibExercise[] = []): LibExercise | undefined {
  return ref.startsWith('my:') ? mine.find((m) => m.ref === ref) : index().get(ref);
}

/** Body parts as trainers think of them. Muscle names from the library (and older lowercase names) map to each. */
export const BODY_PARTS: { key: string; label: string; muscles: string[] }[] = [
  { key: 'chest', label: 'Chest', muscles: ['chest', 'upper chest'] },
  { key: 'back', label: 'Back', muscles: ['lats', 'upper back', 'lower back', 'traps', 'middle back'] },
  { key: 'shoulders', label: 'Shoulders', muscles: ['front delts', 'side delts', 'rear delts', 'rotator cuff', 'serratus', 'shoulders'] },
  { key: 'arms', label: 'Arms', muscles: ['biceps', 'triceps', 'forearms', 'grip'] },
  { key: 'core', label: 'Core', muscles: ['abs', 'obliques', 'deep core', 'abdominals'] },
  { key: 'glutes', label: 'Glutes and hips', muscles: ['glutes', 'side glutes', 'hip flexors', 'inner thighs', 'abductors', 'adductors'] },
  { key: 'legs', label: 'Legs', muscles: ['quads', 'hamstrings', 'calves', 'shins', 'feet and ankles', 'quadriceps'] },
  { key: 'neck', label: 'Neck', muscles: ['neck'] },
  { key: 'full', label: 'Full body', muscles: ['full body'] },
];
/** Muscles a trainer can pick for their own exercises (the library's names) */
export const MUSCLES = ['Chest', 'Upper chest', 'Front delts', 'Side delts', 'Rear delts', 'Rotator cuff', 'Traps', 'Upper back', 'Lats',
  'Lower back', 'Serratus', 'Neck', 'Biceps', 'Triceps', 'Forearms', 'Grip', 'Abs', 'Obliques', 'Deep core', 'Hip flexors', 'Glutes',
  'Side glutes', 'Inner thighs', 'Quads', 'Hamstrings', 'Calves', 'Shins', 'Feet and ankles', 'Full body'];
export const EQUIPMENT = ['Bodyweight', 'Barbell', 'Dumbbell', 'Kettlebell', 'EZ bar', 'Trap bar', 'Safety squat bar', 'Specialty bar', 'Weight plate',
  'Cable machine', 'Machine', 'Plate-loaded machine', 'Smith machine', 'Bench', 'Incline bench', 'Decline bench', 'Preacher bench', 'Pull-up bar',
  'Dip bars', 'Rings', 'Parallettes', 'Suspension trainer (TRX)', 'Resistance band', 'Mini band', 'Landmine', 'Sled', 'Medicine ball', 'Slam ball',
  'Wall ball', 'Stability ball', 'BOSU', 'Sandbag', 'Plyo box', 'Step', 'Sliders', 'Ab wheel', 'GHD', 'Back extension bench', 'Battle ropes',
  'Climbing rope', 'Jump rope', 'Weighted vest', 'Chains', 'Mace', 'Indian clubs', 'Strongman implement', 'Tire', 'Sledgehammer', 'Foam roller',
  'Massage ball', 'Yoga block', 'Strap', 'Wall', 'Mat', 'Treadmill', 'Rower', 'Exercise bike', 'Air bike', 'Ski erg', 'Stair climber',
  'Elliptical', 'Incline trainer (Total Gym)', 'Agility ladder', 'Cones', 'Hurdles', 'Pool', 'Other'];
export const CATEGORIES = ['Barbell', 'Dumbbell', 'Kettlebell', 'Cable', 'Machine', 'Bodyweight', 'Calisthenics', 'Suspension (TRX)', 'Bands',
  'Landmine', 'Medicine ball', 'Stability ball', 'Sandbag', 'Plates', 'Sled', 'Strongman', 'Powerlifting', 'Olympic lifting', 'Plyometrics',
  'Speed and agility', 'Cardio', 'Conditioning', 'Abs and core', 'Stretching', 'Mobility', 'Yoga', 'Pilates', 'Corrective'];
/** Categories a trainer can give their own exercises */
export const MY_CATEGORIES = CATEGORIES;

const low = (s: string) => s.toLowerCase();
const same = (a: string, b: string) => low(a) === low(b);
/** True when the exercise works one of these muscles as a main muscle */
const worksAny = (e: LibExercise, muscles: string[]) => e.primary.some((m) => muscles.includes(low(m)));
/** True when the exercise uses this piece of equipment */
export const uses = (e: LibExercise, item: string) => (e.gear?.length ? e.gear : [e.equipment]).some((g) => same(g, item));

/** Exercises a client could swap to: the trainer's chosen alternatives first, then similar library moves
 *  (same main muscle and movement pattern, or the same kind of exercise; different equipment preferred). */
export function alternativesFor(ex: LibExercise, mine: LibExercise[] = [], n = 6): LibExercise[] {
  const chosen = (ex.alts ?? []).map((r) => byRef(r, mine)).filter((e): e is LibExercise => !!e && e.ref !== ex.ref);
  if (chosen.length >= n || !ex.primary.length) return chosen.slice(0, n);
  const seen = new Set([ex.ref, ...chosen.map((e) => e.ref)]);
  const main = ex.primary.map(low);
  const alike = (e: LibExercise) => (ex.pattern ? e.pattern === ex.pattern : same(e.category, ex.category));
  const similar = builtIn()
    .filter((e) => !seen.has(e.ref) && worksAny(e, main) && alike(e))
    .map((e) => [(same(e.equipment, ex.equipment) ? 1 : 0) + (same(e.primary[0] ?? '', ex.primary[0]) ? 0 : 2) + e.name.length / 100, e] as const)
    .sort((a, b) => a[0] - b[0]).map(([, e]) => e);
  return [...chosen, ...similar].slice(0, n);
}

export type Filter = { q?: string; part?: string | null; equipment?: string | null; category?: string | null };

/** Search: every word must match the name, another name it goes by, or its equipment or muscles.
 *  Exact and name-start matches rank first, then matches on another name. */
export function search(all: LibExercise[], f: Filter): LibExercise[] {
  const words = low(f.q ?? '').split(/\s+/).filter(Boolean);
  const part = f.part ? BODY_PARTS.find((b) => b.key === f.part) : null;
  const hits = all.filter((e) => {
    if (part && !worksAny(e, part.muscles)) return false;
    if (f.equipment && !uses(e, f.equipment)) return false;
    if (f.category && !same(e.category, f.category)) return false;
    if (!words.length) return true;
    const hay = low(`${e.name} ${(e.aliases ?? []).join(' ')} ${e.equipment} ${e.primary.join(' ')}`);
    return words.every((w) => hay.includes(w));
  });
  if (!words.length) return hits;
  const q = words.join(' ');
  const rank = (n: string) => { const s = low(n); return s === q ? 0 : s.startsWith(q) ? 1 : s.includes(q) ? 2 : 3; };
  const score = (e: LibExercise) => Math.min(rank(e.name), ...(e.aliases ?? []).map((a) => rank(a) + 0.5));
  return hits.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}

/** Capitalizes older lowercase names ("middle back" → "Middle Back"); names already written in case stay as they are */
export const titleCase = (s: string) => (/[A-Z]/.test(s) ? s : s.replace(/\b\w/g, (c) => c.toUpperCase()));

/** YouTube link → thumbnail image, or null */
export function youTubeThumb(url: string | null | undefined): string | null {
  const m = (url ?? '').match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}
export const isLink = (v: string | null | undefined) => !!v && /^https?:\/\//i.test(v);

/** A trainer's suggested exercise, as sent for review */
export type Suggestion = { name: string; gear: string[]; main: string[] };
const STOP = new Set(['the', 'a', 'an', 'with', 'and', 'on', 'of', 'to', 'exercise', 'machine']);
/**
 * Library exercises most like a suggested one (shared name words first, then equipment and main muscle), for the AI review to
 * compare against. Only exercises sharing at least one name word or both equipment and a main muscle are returned.
 */
export function similarTo(s: Suggestion, all: LibExercise[], n = 40): LibExercise[] {
  const words = (x: string) => low(x).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w));
  const want = new Set(words(s.name));
  const score = (e: LibExercise) => {
    const names = new Set([e.name, ...(e.aliases ?? [])].flatMap(words));
    const shared = [...want].filter((w) => names.has(w)).length;
    const gear = s.gear.some((g) => uses(e, g)) ? 1 : 0;
    const muscle = e.primary.some((m) => s.main.some((x) => same(x, m))) ? 1 : 0;
    return shared ? shared * 3 + gear * 2 + muscle : gear && muscle ? 2 : 0;
  };
  return all.map((e) => [score(e), e] as const).filter(([k]) => k > 0).sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name))
    .slice(0, n).map(([, e]) => e);
}

/** Equipment words that make an equipment version of a move ("Dumbbell Push Press" is the dumbbell version of "Push Press") */
const GEAR_WORDS = ['plate-loaded', 'smith machine', 'ez-bar', 'ez bar', 'trap bar', 'hex bar', 'safety squat bar', 'resistance band', 'mini band', 'medicine ball',
  'med ball', 'slam ball', 'stability ball', 'swiss ball', 'barbell', 'dumbbells?', 'kettlebells?', 'cable', 'banded', 'band', 'landmine', 'sandbag', 'plate',
  'trx', 'suspension', 'machine', 'bodyweight'];
const VERSION_NAME: Record<string, string> = { 'ez-bar': 'EZ bar', 'ez bar': 'EZ bar', trx: 'TRX', suspension: 'TRX', banded: 'Band', 'resistance band': 'Band',
  dumbbells: 'Dumbbell', kettlebells: 'Kettlebell', 'swiss ball': 'Stability ball', 'med ball': 'Medicine ball', 'hex bar': 'Trap bar', 'plate-loaded': 'Plate-loaded machine' };
const GEAR_RE = new RegExp(`(^|[\\s(/-])(${GEAR_WORDS.join('|')})(?=$|[\\s)/-])`, 'gi');
/** The move an exercise is a version of, and which version it is: "Kettlebell Push Press" → push press / Kettlebell */
export function familyOf(e: Pick<LibExercise, 'name' | 'gear'>): { key: string; name: string; version: string } {
  const found: string[] = [];
  const name = e.name.replace(GEAR_RE, (_m, pre: string, w: string) => { found.push(w); return pre === '(' ? pre : ' '; })
    .replace(/\(\s*\)/g, '').replace(/\s*-\s*(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  const version = found.length ? found.map((w) => VERSION_NAME[low(w)] ?? w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' + ')
    : e.gear?.find((g) => !/bench|mat|step|wall/i.test(g)) ?? 'Bodyweight';
  return { key: low(name).replace(/[^a-z0-9]+/g, ' ').trim(), name, version };
}

export type ListItem = { kind: 'one'; e: LibExercise } | { kind: 'family'; key: string; name: string; members: { e: LibExercise; version: string }[] };
/** Folds equipment versions of the same move into one line (in the order they first appear), so a search isn't flooded */
export function groupFamilies(list: LibExercise[]): ListItem[] {
  const fam = new Map<string, { name: string; members: { e: LibExercise; version: string }[] }>();
  const order: string[] = [];
  for (const e of list) {
    const f = familyOf(e);
    const k = f.key || e.ref;
    if (!fam.has(k)) { fam.set(k, { name: f.name, members: [] }); order.push(k); }
    const g = fam.get(k)!;
    g.members.push({ e, version: f.version });
    if (same(e.name, f.name)) g.name = e.name; // the plain version names the move
  }
  return order.map((k) => {
    const g = fam.get(k)!;
    const versions = new Set(g.members.map((m) => low(m.version)));
    return g.members.length > 1 && versions.size > 1 ? [{ kind: 'family', key: k, name: g.name, members: g.members } as ListItem] : g.members.map((m): ListItem => ({ kind: 'one', e: m.e }));
  }).flat();
}
