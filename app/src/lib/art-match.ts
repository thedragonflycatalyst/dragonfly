// Default cover art: picks a picture from a routine's (or group's) name, e.g. "Leg day" → the squat picture.
export const WORKOUT_ART = ['legs', 'glutes', 'chest', 'back', 'shoulders', 'arms', 'core', 'fullbody',
  'hiit', 'running', 'cycling', 'yoga', 'kettlebell', 'suspension', 'boxing', 'swimming'] as const;
export type ArtKey = (typeof WORKOUT_ART)[number];

const RULES: [RegExp, ArtKey][] = [
  [/\b(trx|suspension|strap)/, 'suspension'],
  [/\b(kettle ?bells?|kb|swings?)\b/, 'kettlebell'],
  [/\b(box(ing)?|kickbox|punch|mma|sparring|heavy bag)/, 'boxing'],
  [/\b(swim|pool|laps?)\b/, 'swimming'],
  [/\b(cycl|bike|biking|spin|peloton)/, 'cycling'],
  [/\b(run|running|jog|marathon|5k|10k|half|sprint|tempo|track)/, 'running'],
  [/\b(yoga|mobility|stretch|flexib|recovery|pilates|cool ?down)/, 'yoga'],
  [/\b(hiit|tabata|circuit|conditioning|metcon|cardio|burpee|bootcamp|emom|amrap)/, 'hiit'],
  [/\b(glute|booty|hip thrust|hips?)\b/, 'glutes'],
  [/\b(leg|legs|squat|quad|hamstring|calf|calves|lower)/, 'legs'],
  [/\b(chest|push|bench|press day|pecs?)\b/, 'chest'],
  [/\b(deadlifts?|rdls?|hinge|posterior)\b/, 'fullbody'],
  [/\b(back|pull|row|lats?)/, 'back'],
  [/\b(shoulder|delts?|overhead)/, 'shoulders'],
  [/\b(arm|arms|bicep|tricep|curl|guns)/, 'arms'],
  [/\b(core|abs?|plank|midsection)\b/, 'core'],
  [/\b(upper)/, 'back'],
  [/\b(full|total|whole|strength)/, 'fullbody'],
];

/** The picture that fits a name best, or null when nothing matches */
export function artFor(name: string): ArtKey | null {
  const s = name.toLowerCase();
  return RULES.find(([re]) => re.test(s))?.[1] ?? null;
}

export const GROUP_ART = ['crew', 'runclub', 'finish', 'trophy', 'bootcamp', 'circle', 'hike', 'team', 'dragonfly'] as const;
export type GroupKey = (typeof GROUP_ART)[number];
export type CoverKey = ArtKey | GroupKey;

const GROUP_RULES: [RegExp, GroupKey][] = [
  [/\b(challenge|compet|leaderboard|winners?|trophy|champion|league)/, 'trophy'],
  [/\b(race|marathon|5k|10k|half|finish|goal|milestone)/, 'finish'],
  [/\b(run|running|jog|club)\b/, 'runclub'],
  [/\b(hike|hiking|trail|outdoor|adventure|climb|walk)/, 'hike'],
  [/\b(yoga|mindful|medit|breath|stretch|mobility|calm|wellness|zen)/, 'circle'],
  [/\b(bootcamp|boot camp|hiit|circuit|park|crossfit|class)/, 'bootcamp'],
  [/\b(team|squad|tribe|family|crew|accountab|support)/, 'team'],
  [/\b(dragonfly|phoenix|catalyst|journey|transform)/, 'dragonfly'],
];

/** The group photo that fits a group's name best, or null */
export function groupArtFor(name: string): GroupKey | null {
  const s = name.toLowerCase();
  return GROUP_RULES.find(([re]) => re.test(s))?.[1] ?? null;
}

const ALL = new Set<string>([...WORKOUT_ART, ...GROUP_ART]);

/**
 * The cover photo to show: one the trainer picked ("art:legs"), or one that fits the name ("Leg day" → legs).
 * With `always`, anything else gets a default photo instead of a colour. Groups match group photos first.
 */
export function artCover(cover: string | null | undefined, name: string, always = false, group = false): CoverKey | null {
  const m = (cover ?? '').match(/^art:([a-z]+)$/);
  if (m && ALL.has(m[1])) return m[1] as CoverKey;
  if (cover && !/^(preset:|#|art:)/.test(cover)) return null;
  if (cover?.startsWith('preset:') && !always) return null;
  if (group) return groupArtFor(name) ?? artFor(name) ?? (always ? 'crew' : null);
  return artFor(name) ?? (always ? 'fullbody' : null);
}

/** Placeholder picture for an exercise that has no verified demo video yet: by its kind, then its main muscle, then its name */
export function exerciseArt(e: { name: string; category?: string; pattern?: string; primary?: string[]; gear?: string[] }): ArtKey {
  const c = (e.category ?? '').toLowerCase(), pat = (e.pattern ?? '').toLowerCase(), gear = (e.gear ?? []).join(' ').toLowerCase();
  if (c.includes('suspension') || gear.includes('suspension')) return 'suspension';
  if (c === 'kettlebell') return 'kettlebell';
  if (c === 'aquatics' || gear.includes('pool')) return 'swimming';
  if (['yoga', 'pilates', 'mobility', 'stretching', 'corrective'].includes(c)) return 'yoga';
  if (/bike|cycl/.test(gear) || /bike|cycl/i.test(e.name)) return 'cycling';
  if (/treadmill/.test(gear) || /\b(run|running|jog|sprint)/i.test(e.name)) return 'running';
  if (/speed bag|heavy bag|punch|box/i.test(e.name)) return 'boxing';
  if (['plyometrics', 'conditioning', 'cardio', 'speed and agility'].includes(c) || pat.includes('jump')) return 'hiit';
  const m = (e.primary ?? []).map((x) => x.toLowerCase());
  const has = (...xs: string[]) => m.some((x) => xs.includes(x));
  if (m[0] === 'glutes' || m[0] === 'side glutes') return 'glutes';
  if (has('quads', 'hamstrings', 'calves', 'inner thighs', 'shins')) return 'legs';
  if (has('chest', 'upper chest')) return 'chest';
  if (has('lats', 'upper back', 'lower back')) return 'back';
  if (has('front delts', 'side delts', 'rear delts', 'traps', 'rotator cuff', 'neck')) return 'shoulders';
  if (has('biceps', 'triceps', 'forearms', 'grip')) return 'arms';
  if (has('abs', 'obliques', 'deep core', 'hip flexors')) return 'core';
  return artFor(e.name) ?? 'fullbody';
}
