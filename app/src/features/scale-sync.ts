// Pulling weigh-ins from Health Connect into the Scale (Android). Turned on per device; syncs when the Scale opens.
import { Platform } from 'react-native';
import { mergeHealth, type Weighin } from '@/lib/scale';
import { recall, sb, store } from '@/lib/supabase';
import { readHealth, readHeight } from './health-connect';
import { checkHealthConsent } from './health-consent';
import { deviceSync } from './health-sync';

const KEY = (uid: string) => `scale.hc.${uid}`;
type State = { on: boolean; last: string | null };
/** On when weigh-in sync was switched on here, or Health Connect was connected on the Connected apps screen */
export const healthSync = (uid: string): State => recall<State | null>(KEY(uid), null) ?? { on: deviceSync(uid).on, last: null };
export const setHealthSync = (uid: string, s: State) => store(KEY(uid), s);

/** Reads Health Connect since the last sync (or `from`) and saves new weigh-ins. Returns how many were added. */
export async function syncHealth(uid: string, existing: Weighin[], from?: Date): Promise<number> {
  if (Platform.OS !== 'android' || !checkHealthConsent(uid)) return 0;
  const st = healthSync(uid);
  // First sync: two years back, so their latest weigh-in comes in even if it's been a while
  const since = from ?? (st.last ? new Date(new Date(st.last).getTime() - 2 * 86_400_000) : new Date(Date.now() - 730 * 86_400_000));
  const rows = mergeHealth(await readHealth(since), existing);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('coach_weighins').upsert(rows.slice(i, i + 500).map((r) => ({ ...r, user_id: uid, source: 'health_connect' })), { onConflict: 'user_id,measured_at', ignoreDuplicates: true });
    if (error) throw error;
  }
  setHealthSync(uid, { on: true, last: new Date().toISOString() });
  // Height for BMI, if they haven't entered one
  const { data: set } = await sb.from('coach_scale_settings').select('height_cm').eq('user_id', uid).maybeSingle();
  if (!set?.height_cm) {
    const cm = await readHeight();
    if (cm && cm >= 80 && cm <= 260) await sb.from('coach_scale_settings').upsert({ user_id: uid, height_cm: cm, updated_at: new Date().toISOString() });
  }
  return rows.length;
}
