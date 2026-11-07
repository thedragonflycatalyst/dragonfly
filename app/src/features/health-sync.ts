// Brings steps, sleep, heart rate, water, workouts and food from the phone's health store (Health Connect) into
// Dragonfly. Turned on per device; runs when the app opens and from the Connections screen.
import { Platform } from 'react-native';
import { dailyTotals, foodRows, mergeDaily, type Daily } from '@/lib/health';
import { recall, sb, store } from '@/lib/supabase';
import { readDevice } from './health-connect';
import { checkHealthConsent } from './health-consent';

const KEY = (uid: string) => `health.hc.${uid}`;
export type DeviceSync = { on: boolean; food: boolean; last: string | null };
export const deviceSync = (uid: string): DeviceSync => recall<DeviceSync>(KEY(uid), { on: false, food: true, last: null });
export const setDeviceSync = (uid: string, s: DeviceSync) => store(KEY(uid), s);

type Member = { id: string; trainer_id: string; status?: string } | null | undefined;

/** Reads the phone since the last sync (or `from`) and saves it. Returns how many days, workouts and foods changed. */
export async function syncDevice(uid: string, client: Member, from?: Date): Promise<{ days: number; workouts: number; food: number }> {
  if (Platform.OS !== 'android' || !checkHealthConsent(uid)) return { days: 0, workouts: 0, food: 0 };
  const st = deviceSync(uid);
  const since = from ?? (st.last ? new Date(new Date(st.last).getTime() - 2 * 86_400_000) : new Date(Date.now() - 30 * 86_400_000));
  const h = await readDevice(since);

  // Daily totals, combined with what other sources (Oura, Whoop…) already saved for those days
  const days = dailyTotals(h);
  if (days.length) {
    const { data: old } = await sb.from('coach_health_daily').select('*').eq('user_id', uid).in('day', days.map((d) => d.day));
    const byDay = new Map(((old ?? []) as (Daily & { sources: string[] })[]).map((o) => [o.day, o]));
    const rows = days.map((d) => {
      const o = byDay.get(d.day);
      return { ...mergeDaily(o, d), user_id: uid, sources: [...new Set([...(o?.sources ?? []), 'health_connect'])], updated_at: new Date().toISOString() };
    });
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await sb.from('coach_health_daily').upsert(rows.slice(i, i + 200), { onConflict: 'user_id,day' });
      if (error) throw error;
    }
  }

  // Workouts from any app that writes to Health Connect (Garmin, Samsung Health, Fitbit, Peloton…)
  const acts = h.workouts.map((w) => ({
    user_id: uid, source: 'health_connect', external_id: w.id.slice(0, 200), kind: w.kind.slice(0, 60), name: w.title?.slice(0, 200) ?? null, started_at: w.start,
    duration_s: Math.max(0, Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / 1000)),
    distance_m: w.m != null ? Math.round(w.m) : null, kcal: w.kcal != null ? Math.round(w.kcal) : null, app: w.app?.slice(0, 120) ?? null,
  }));
  for (let i = 0; i < acts.length; i += 200) {
    const { error } = await sb.from('coach_activities').upsert(acts.slice(i, i + 200), { onConflict: 'user_id,source,external_id', ignoreDuplicates: true });
    if (error) throw error;
  }

  // Clients: water into the diary, and food from their own tracker (MyFitnessPal, Cronometer, MacroFactor…)
  let food = 0;
  if (client && client.status !== 'frozen' && client.status !== 'archived') {
    for (const d of days.filter((x) => x.water_ml)) {
      const { data: w } = await sb.from('coach_water_logs').select('ml').eq('client_id', client.id).eq('day', d.day).maybeSingle();
      if ((w?.ml ?? 0) < d.water_ml!) await sb.from('coach_water_logs').upsert({ client_id: client.id, trainer_id: client.trainer_id, day: d.day, ml: d.water_ml, updated_at: new Date().toISOString() });
    }
    if (st.food) food = await saveFood(client, foodRows(h, 'hc'), 'health_connect');
  }
  setDeviceSync(uid, { ...st, on: true, last: new Date().toISOString() });
  return { days: days.length, workouts: acts.length, food };
}

/** Adds food entries that aren't in the diary yet (matched by their id from the other app) */
export async function saveFood(client: NonNullable<Member>, rows: ReturnType<typeof foodRows>, source: 'health_connect' | 'import'): Promise<number> {
  if (!rows.length) return 0;
  const have = new Set<string>();
  const ids = rows.map((r) => r.external_id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await sb.from('coach_food_logs').select('external_id').eq('client_id', client.id).in('external_id', ids.slice(i, i + 150));
    for (const r of (data ?? []) as { external_id: string }[]) have.add(r.external_id);
  }
  const fresh = rows.filter((r, i) => !have.has(r.external_id) && ids.indexOf(r.external_id) === i)
    .map((r) => ({ ...r, client_id: client.id, trainer_id: client.trainer_id, source }));
  for (let i = 0; i < fresh.length; i += 200) {
    const { error } = await sb.from('coach_food_logs').insert(fresh.slice(i, i + 200));
    if (error) throw error;
  }
  return fresh.length;
}
