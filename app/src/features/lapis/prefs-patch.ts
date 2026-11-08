/** Pure, narrow Lapis preference patch builder.
 * The cloud document contains timers, sessions and history: never send those
 * collections from the Coach client when changing a sound setting.
 */
export const SHARED_PREF_KEYS = ['voice', 'music', 'voiceLevel', 'voiceSpeed', 'haptics', 'bell'] as const;
export type SharedPrefKey = typeof SHARED_PREF_KEYS[number];

export function selectChangedPrefs(
  changed: Record<string, unknown>,
  serialized: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of SHARED_PREF_KEYS) {
    if (Object.prototype.hasOwnProperty.call(changed, k)) out[k] = serialized[k];
  }
  return out;
}
