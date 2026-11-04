// Health Connect → Scale: opt-in foreground sync with source/status diagnostics.
// Uses the local permission state per user; never replaces an existing weigh-in.
import { Platform } from 'react-native';
import { appName } from '@/lib/apps';
import { mergeHealth, type Weighin } from '@/lib/scale';
import { recall, sb, store } from '@/lib/supabase';
import { readHealth, readHeight, scalePermissions } from './health-connect';
import { deviceSync } from './health-sync';

const KEY = (uid: string) => `scale.hc.${uid}`;
export type ScaleSyncState = {
  on: boolean;
  last: string | null;
  lastAdded?: number;
  lastSkipped?: number;
  sources?: string[];
  lastError?: string | null;
  historyImportedAt?: string | null;
};
export const healthSync = (uid: string): ScaleSyncState =>
  recall<ScaleSyncState | null>(KEY(uid), null) ?? { on: deviceSync(uid).on, last: null };
export const setHealthSync = (uid: string, s: ScaleSyncState) => store(KEY(uid), s);

/** Check all already stored weigh-ins in the read window, not just the UI's most recent 5000.
 * Query failures abort the sync rather than accidentally importing duplicates.
 */
async function existingWindow(uid: string, from: Date, until: Date): Promise<Pick<Weighin, 'measured_at'>[]> {
  const results: Pick<Weighin, 'measured_at'>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.from('coach_weighins').select('measured_at')
      .eq('user_id', uid).gte('measured_at', from.toISOString()).lte('measured_at', until.toISOString())
      .order('measured_at', { ascending: true }).range(offset, offset + 999);
    if (error) throw error;
    const page = (data ?? []) as Pick<Weighin, 'measured_at'>[];
    results.push(...page);
    if (page.length < 1000) break;
  }
  return results;
}

/** Foreground sync: results are also stored locally for the guided Scale status card.
 * Manual history requests should pass a from date and permission-verify first.
 */
export async function syncHealth(uid: string, _visible: Weighin[], from?: Date): Promise<number> {
  if (Platform.OS !== 'android') return 0;
  const before = healthSync(uid);
  const perms = await scalePermissions();
  if (!perms.weight) throw new Error('Weight permission is not granted in Health Connect.');
  const since = from ?? (before.last ? new Date(new Date(before.last).getTime() - 2 * 86_400_000)
    : new Date(Date.now() - 30 * 86_400_000));
  const until = new Date();
  try {
    const health = await readHealth(since);
    const origins = [...new Set(health.weight.map((w) => appName(w.origin) ?? 'Unknown source'))].sort();
    const already = await existingWindow(uid, since, until);
    const rows = mergeHealth(health, already);
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await sb.from('coach_weighins').upsert(rows.slice(i, i + 200)
        .map((r) => ({ ...r, user_id: uid, source: 'health_connect' })),
        { onConflict: 'user_id,measured_at', ignoreDuplicates: true });
      if (error) throw error;
    }
    const done = new Date().toISOString();
    setHealthSync(uid, { ...before, on: true, last: done, lastAdded: rows.length,
      lastSkipped: health.weight.length - rows.length, sources: origins, lastError: null,
      historyImportedAt: from ? done : before.historyImportedAt ?? null });
    // Height remains optional. A failed read must not invalidate saved weigh-ins.
    try {
      const { data: settings, error } = await sb.from('coach_scale_settings')
        .select('height_cm').eq('user_id', uid).maybeSingle();
      if (!error && !settings?.height_cm) {
        const cm = await readHeight();
        if (cm && cm >= 80 && cm <= 260) await sb.from('coach_scale_settings').upsert({
          user_id: uid, height_cm: cm, updated_at: new Date().toISOString(),
        });
      }
    } catch { /* height is best-effort */ }
    return rows.length;
  } catch (e) {
    setHealthSync(uid, { ...before, lastError: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
