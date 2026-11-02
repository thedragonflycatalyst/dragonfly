// Health Connect on Android: RENPHO, Libra, Samsung Health, Fitbit, Withings and others share weigh-ins here.
import { getGrantedPermissions, getSdkStatus, initialize, openHealthConnectSettings, readRecords, requestPermission, SdkAvailabilityStatus } from 'react-native-health-connect';
import type { HealthReadings } from '@/lib/scale';

export type HealthStatus = 'unsupported' | 'not_installed' | 'update_needed' | 'ready';
const TYPES = ['Weight', 'BodyFat', 'LeanBodyMass', 'BoneMass', 'BodyWaterMass', 'BasalMetabolicRate'] as const;

export async function healthStatus(): Promise<HealthStatus> {
  try {
    const s = await getSdkStatus();
    if (s === SdkAvailabilityStatus.SDK_AVAILABLE) return 'ready';
    if (s === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update_needed';
    return 'not_installed';
  } catch { return 'unsupported'; }
}

/** Asks for read access to weight and body composition (and older history). True if weight was allowed. */
export async function connectHealth(): Promise<boolean> {
  if (!(await initialize())) return false;
  const granted = await requestPermission([
    ...TYPES.map((recordType) => ({ accessType: 'read' as const, recordType })),
    { accessType: 'read', recordType: 'ReadHealthDataHistory' } as never,
  ]);
  return granted.some((g) => (g as { recordType?: string }).recordType === 'Weight');
}

async function all<T>(type: (typeof TYPES)[number], since: Date): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 50; i++) {
    const r = await readRecords(type, { timeRangeFilter: { operator: 'between', startTime: since.toISOString(), endTime: new Date().toISOString() }, pageSize: 1000, pageToken });
    out.push(...(r.records as unknown as T[]));
    pageToken = (r as { pageToken?: string }).pageToken;
    if (!pageToken) break;
  }
  return out;
}

/** Everything shared since a date. Types they didn't allow come back empty. */
export async function readHealth(since: Date): Promise<HealthReadings> {
  await initialize();
  const ok = new Set(((await getGrantedPermissions()) as { recordType?: string }[]).map((g) => g.recordType));
  const get = <T>(t: (typeof TYPES)[number]) => (ok.has(t) ? all<T>(t, since).catch(() => [] as T[]) : Promise.resolve([] as T[]));
  type M = { time: string; mass: { inKilograms: number } };
  const [w, bf, lean, bone, water, bmr] = await Promise.all([
    get<{ time: string; weight: { inKilograms: number }; metadata?: { dataOrigin?: string } }>('Weight'), get<{ time: string; percentage: number }>('BodyFat'),
    get<M>('LeanBodyMass'), get<M>('BoneMass'), get<M>('BodyWaterMass'), get<{ time: string; basalMetabolicRate: { inKilocaloriesPerDay: number } }>('BasalMetabolicRate'),
  ]);
  return {
    weight: w.map((x) => ({ time: x.time, kg: x.weight.inKilograms, origin: x.metadata?.dataOrigin })),
    bodyFat: bf.map((x) => ({ time: x.time, pct: x.percentage })),
    leanMass: lean.map((x) => ({ time: x.time, kg: x.mass.inKilograms })),
    boneMass: bone.map((x) => ({ time: x.time, kg: x.mass.inKilograms })),
    bodyWater: water.map((x) => ({ time: x.time, kg: x.mass.inKilograms })),
    bmr: bmr.map((x) => ({ time: x.time, kcal: x.basalMetabolicRate.inKilocaloriesPerDay })),
  };
}
export const openHealthSettings = () => openHealthConnectSettings();
