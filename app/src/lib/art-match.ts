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
  [/\b(back|pull|row|lats?|deadlift)/, 'back'],
  [/\b(shoulder|delts?|overhead)/, 'shoulders'],
  [/\b(arm|arms|bicep|tricep|curl|guns)/, 'arms'],
  [/\b(core|abs?|plank|midsection)\b/, 'core'],
  [/\b(full|total|whole|strength|upper)/, 'fullbody'],
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
