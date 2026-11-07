// Health Connect on Android: RENPHO, Libra, Samsung Health, Fitbit, Withings and others share weigh-ins here.
import { ExerciseType, getGrantedPermissions, getSdkStatus, initialize, openHealthConnectSettings, readRecords, requestPermission, SdkAvailabilityStatus, SleepStageType } from 'react-native-health-connect';
import { appName } from '@/lib/apps';
import { emptyHealth, mealName, type DeviceHealth } from '@/lib/health';
import type { HealthReadings } from '@/lib/scale';

export type HealthStatus = 'unsupported' | 'not_installed' | 'update_needed' | 'ready';

// Off until the person consents (features/health-consent.ts). While off, nothing is requested or read.
let allowed = false;
export function allowReads(on: boolean) { allowed = on; }
const TYPES = ['Weight', 'Height', 'BodyFat', 'LeanBodyMass', 'BoneMass', 'BodyWaterMass', 'BasalMetabolicRate',
  'Steps', 'ActiveCaloriesBurned', 'Distance', 'SleepSession', 'RestingHeartRate', 'HeartRateVariabilityRmssd', 'Hydration', 'ExerciseSession', 'Nutrition'] as const;

export async function healthStatus(): Promise<HealthStatus> {
  try {
    const s = await getSdkStatus();
    if (s === SdkAvailabilityStatus.SDK_AVAILABLE) return 'ready';
    if (s === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update_needed';
    return 'not_installed';
  } catch { return 'unsupported'; }
}

/** Asks for read access to everything Dragonfly uses (and older history). True if anything was allowed. */
export async function connectHealth(): Promise<boolean> {
  if (!allowed || !(await initialize())) return false;
  const granted = await requestPermission([
    ...TYPES.map((recordType) => ({ accessType: 'read' as const, recordType })),
    { accessType: 'read', recordType: 'ReadHealthDataHistory' } as never,
  ]);
  return granted.length > 0;
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
  if (!allowed) return { weight: [], bodyFat: [], leanMass: [], boneMass: [], bodyWater: [], bmr: [] };
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

/** Their most recent height in Health Connect (cm), if any app shared one */
export async function readHeight(): Promise<number | null> {
  if (!allowed) return null;
  try {
    await initialize();
    const ok = new Set(((await getGrantedPermissions()) as { recordType?: string }[]).map((g) => g.recordType));
    if (!ok.has('Height')) return null;
    const list = await all<{ time: string; height: { inMeters: number } }>('Height', new Date(Date.now() - 20 * 365 * 864e5));
    const last = list.sort((a, b) => b.time.localeCompare(a.time))[0];
    return last ? Math.round(last.height.inMeters * 1000) / 10 : null;
  } catch { return null; }
}

const EXERCISE_NAMES = Object.fromEntries(Object.entries(ExerciseType).map(([k, v]) => [v, k.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())]));
const AWAKE = new Set<number>([SleepStageType.AWAKE, SleepStageType.OUT_OF_BED]);

/** Activity, sleep, heart, water, workouts and food shared since a date */
export async function readDevice(since: Date): Promise<DeviceHealth> {
  if (!allowed) return emptyHealth();
  await initialize();
  const ok = new Set(((await getGrantedPermissions()) as { recordType?: string }[]).map((g) => g.recordType));
  const get = <T>(t: (typeof TYPES)[number]) => (ok.has(t) ? all<T>(t, since).catch(() => [] as T[]) : Promise.resolve([] as T[]));
  type I = { startTime: string; endTime: string; metadata?: { id?: string; dataOrigin?: string } };
  type Mass = { inGrams: number } | undefined;
  const [steps, kcal, dist, sleep, rhr, hrv, water, ex, food] = await Promise.all([
    get<I & { count: number }>('Steps'), get<I & { energy: { inKilocalories: number } }>('ActiveCaloriesBurned'), get<I & { distance: { inMeters: number } }>('Distance'),
    get<I & { stages?: { startTime: string; endTime: string; stage: number }[] }>('SleepSession'), get<{ time: string; beatsPerMinute: number }>('RestingHeartRate'),
    get<{ time: string; heartRateVariabilityMillis: number }>('HeartRateVariabilityRmssd'), get<I & { volume: { inMilliliters: number } }>('Hydration'),
    get<I & { exerciseType: number; title?: string }>('ExerciseSession'),
    get<I & { name?: string; mealType?: number; energy?: { inKilocalories: number }; protein?: Mass; totalCarbohydrate?: Mass; totalFat?: Mass; sugar?: Mass; dietaryFiber?: Mass; sodium?: { inMilligrams: number } }>('Nutrition'),
  ]);
  const h = emptyHealth();
  h.steps = steps.map((x) => ({ start: x.startTime, end: x.endTime, count: x.count }));
  h.activeKcal = kcal.map((x) => ({ start: x.startTime, end: x.endTime, kcal: x.energy.inKilocalories }));
  h.distance = dist.map((x) => ({ start: x.startTime, end: x.endTime, m: x.distance.inMeters }));
  h.sleep = sleep.map((x) => {
    const asleep = x.stages?.length ? x.stages.filter((st) => !AWAKE.has(st.stage)).reduce((a, st) => a + (new Date(st.endTime).getTime() - new Date(st.startTime).getTime()) / 60_000, 0) : undefined;
    return { start: x.startTime, end: x.endTime, asleepMin: asleep };
  });
  h.restingHr = rhr.map((x) => ({ time: x.time, bpm: x.beatsPerMinute }));
  h.hrv = hrv.map((x) => ({ time: x.time, ms: x.heartRateVariabilityMillis }));
  h.water = water.map((x) => ({ start: x.startTime, ml: x.volume.inMilliliters }));
  h.workouts = ex.map((x) => ({ id: x.metadata?.id ?? `${x.startTime}-${x.exerciseType}`, kind: EXERCISE_NAMES[x.exerciseType] ?? 'Workout', title: x.title, start: x.startTime, end: x.endTime, app: appName(x.metadata?.dataOrigin) }));
  h.food = food.filter((x) => x.energy).map((x) => ({
    id: x.metadata?.id ?? `${x.startTime}-${x.name}`, start: x.startTime, meal: mealName(x.mealType), name: x.name || 'Food', kcal: x.energy!.inKilocalories,
    protein: x.protein?.inGrams, carbs: x.totalCarbohydrate?.inGrams, fat: x.totalFat?.inGrams, sugar: x.sugar?.inGrams, fibre: x.dietaryFiber?.inGrams, sodium: x.sodium?.inMilligrams,
    app: appName(x.metadata?.dataOrigin),
  }));
  // Dragonfly's own entries never come back in
  h.food = h.food.filter((f) => !/dragonfly/i.test(f.app ?? ''));
  return h;
}
