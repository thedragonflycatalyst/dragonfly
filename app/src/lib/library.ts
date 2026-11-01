// The exercise library: 876 public-domain exercises (Free Exercise DB, Unlicense) + Dragonfly's suspension-trainer set,
// bundled with the app. Trainers' own exercises (coach_exercises) are merged in at search time.
import data from '../data/library.json';
import { TRX, type Row } from '../data/trx';

export type LibExercise = {
  ref: string;            // 'lib:<id>' or 'my:<uuid>'
  name: string; category: string; equipment: string;
  primary: string[]; secondary: string[]; level: string; mechanic: string; steps: string[];
  images: string[];       // full image URLs (start and end position)
  video?: string | null;  // trainer's own: YouTube/Vimeo link or a storage path in coach-media
  mine?: boolean;
};

const IMG_BASE = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${(data as { commit: string }).commit}/exercises`;
const fromRow = (r: Row): LibExercise => ({
  ref: `lib:${r[0]}`, name: r[1], category: r[2], equipment: r[3], primary: r[4], secondary: r[5], level: r[6], mechanic: r[7], steps: r[8],
  images: Array.from({ length: r[9] }, (_, i) => `${IMG_BASE}/${r[0]}/${i}.jpg`),
});

let cache: LibExercise[] | null = null;
/** Every built-in exercise, A to Z */
export function builtIn(): LibExercise[] {
  if (!cache) cache = [...(data as unknown as { rows: Row[] }).rows, ...TRX].map(fromRow).sort((a, b) => a.name.localeCompare(b.name));
  return cache;
}
export function byRef(ref: string, mine: LibExercise[] = []): LibExercise | undefined {
  return ref.startsWith('my:') ? mine.find((m) => m.ref === ref) : builtIn().find((e) => e.ref === ref);
}

/** Body parts as trainers think of them, mapped from the library's muscle names */
export const BODY_PARTS: { key: string; label: string; muscles: string[] }[] = [
  { key: 'chest', label: 'Chest', muscles: ['chest'] },
  { key: 'back', label: 'Back', muscles: ['lats', 'middle back', 'lower back', 'traps'] },
  { key: 'shoulders', label: 'Shoulders', muscles: ['shoulders'] },
  { key: 'arms', label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  { key: 'core', label: 'Core', muscles: ['abdominals'] },
  { key: 'legs', label: 'Legs', muscles: ['quadriceps', 'hamstrings', 'calves', 'adductors', 'abductors'] },
  { key: 'glutes', label: 'Glutes', muscles: ['glutes'] },
  { key: 'neck', label: 'Neck', muscles: ['neck'] },
];
export const EQUIPMENT = ['body only', 'suspension trainer', 'dumbbell', 'barbell', 'kettlebells', 'cable', 'machine', 'bands',
  'medicine ball', 'exercise ball', 'foam roll', 'e-z curl bar', 'other'];
export const CATEGORIES = ['strength', 'stretching', 'plyometrics', 'cardio', 'powerlifting', 'olympic weightlifting', 'strongman'];

export type Filter = { q?: string; part?: string | null; equipment?: string | null; category?: string | null };

/** Search: every word must match the name (or equipment/muscle); name-start matches rank first. */
export function search(all: LibExercise[], f: Filter): LibExercise[] {
  const words = (f.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const part = f.part ? BODY_PARTS.find((b) => b.key === f.part) : null;
  const hits = all.filter((e) => {
    if (part && !e.primary.some((m) => part.muscles.includes(m))) return false;
    if (f.equipment && e.equipment !== f.equipment) return false;
    if (f.category && e.category !== f.category) return false;
    if (!words.length) return true;
    const hay = `${e.name} ${e.equipment} ${e.primary.join(' ')}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  if (!words.length) return hits;
  const q = words.join(' ');
  const score = (e: LibExercise) => { const n = e.name.toLowerCase(); return n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 3; };
  return hits.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}

export const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** YouTube link → thumbnail image, or null */
export function youTubeThumb(url: string | null | undefined): string | null {
  const m = (url ?? '').match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}
export const isLink = (v: string | null | undefined) => !!v && /^https?:\/\//i.test(v);
