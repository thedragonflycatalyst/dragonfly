// Pulling weigh-ins from Health Connect into the Scale (Android). Turned on per device; syncs when the Scale opens.
import { Platform } from 'react-native';
import { mergeHealth, type Weighin } from '@/lib/scale';
import { recall, sb, store } from '@/lib/supabase';
import { readHealth } from './health-connect';

const KEY = (uid: string) => `scale.hc.${uid}`;
type State = { on: boolean; last: string | null };
export const healthSync = (uid: string): State => recall<State>(KEY(uid), { on: false, last: null });
export const setHealthSync = (uid: string, s: State) => store(KEY(uid), s);

/** Reads Health Connect since the last sync (or `from`) and saves new weigh-ins. Returns how many were added. */
export async function syncHealth(uid: string, existing: Weighin[], from?: Date): Promise<number> {
  if (Platform.OS !== 'android') return 0;
  const st = healthSync(uid);
  const since = from ?? (st.last ? new Date(new Date(st.last).getTime() - 2 * 86_400_000) : new Date(Date.now() - 30 * 86_400_000));
  const rows = mergeHealth(await readHealth(since), existing);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('coach_weighins').upsert(rows.slice(i, i + 500).map((r) => ({ ...r, user_id: uid, source: 'health_connect' })), { onConflict: 'user_id,measured_at', ignoreDuplicates: true });
    if (error) throw error;
  }
  setHealthSync(uid, { on: true, last: new Date().toISOString() });
  return rows.length;
}
