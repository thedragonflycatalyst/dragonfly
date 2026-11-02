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
