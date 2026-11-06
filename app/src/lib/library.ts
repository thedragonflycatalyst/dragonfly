// The exercise library: the Dragonfly Coach Exercise Library (1,700+ exercises with alternate names, muscles, equipment and
// how-to), bundled with the app. Videos are added later. Trainers' own exercises (coach_exercises) are merged in at search time.
// The earlier public-domain set (Free Exercise DB) and suspension set stay loaded only so workouts saved with them still open.
import coach from '../data/coach-library.json';
import legacyData from '../data/library.json';
import { TRX, type Row } from '../data/trx';

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
  legacy?: boolean;       // from the earlier library: opens from old workouts, not listed
};

type CoachRow = [id: string, name: string, aliases: string[], category: string, kind: string, pattern: string, main: string[], other: string[],
  gear: string[], setup: string, move: string, cues: string, video: string, group: string];
const fromCoach = (r: CoachRow): LibExercise => ({
  ref: `lib:${r[0]}`, name: r[1], aliases: r[2], category: r[3], kind: r[4], pattern: r[5], primary: r[6], secondary: r[7],
  gear: r[8], equipment: r[8].join(', '), how: { setup: r[9], move: r[10], cues: r[11] }, video: r[12] || null, group: r[13],
  level: '', mechanic: '', steps: [], images: [],
});
const IMG_BASE = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${(legacyData as { commit: string }).commit}/exercises`;
const fromRow = (r: Row): LibExercise => ({
  ref: `lib:${r[0]}`, name: r[1], category: r[2], equipment: r[3], primary: r[4], secondary: r[5], level: r[6], mechanic: r[7], steps: r[8],
  images: Array.from({ length: r[9] }, (_, i) => `${IMG_BASE}/${r[0]}/${i}.jpg`), legacy: true,
});

let cache: LibExercise[] | null = null;
let byId: Map<string, LibExercise> | null = null;
/** Every library exercise, A to Z */
export function builtIn(): LibExercise[] {
  if (!cache) cache = (coach as unknown as { rows: CoachRow[] }).rows.map(fromCoach).sort((a, b) => a.name.localeCompare(b.name));
  return cache;
}
function index(): Map<string, LibExercise> {
  if (!byId) {
    byId = new Map([...(legacyData as unknown as { rows: Row[] }).rows, ...TRX].map((r) => [`lib:${r[0]}`, fromRow(r)] as const));
    for (const e of builtIn()) byId.set(e.ref, e);
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
  'Elliptical', 'Agility ladder', 'Cones', 'Hurdles', 'Pool', 'Other'];
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
