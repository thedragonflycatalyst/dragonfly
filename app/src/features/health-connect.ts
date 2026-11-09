// Health Connect only exists on Android; this is the stand-in for web and iPhone (see health-connect.android.ts).
import { emptyHealth, type DeviceHealth } from '@/lib/health';
import type { HealthReadings } from '@/lib/scale';

export type HealthStatus = 'unsupported' | 'not_installed' | 'update_needed' | 'ready';
export async function healthStatus(): Promise<HealthStatus> { return 'unsupported'; }
/** Non-Android stand-ins for Scale-specific Health Connect actions. */
export async function scalePermissions(): Promise<{ weight: boolean; history: 'unknown' }> { return { weight: false, history: 'unknown' }; }
export async function connectScaleHealth(): Promise<boolean> { return false; }
export async function requestScaleHistoryAccess(): Promise<void> { throw new Error('Historical Health Connect access requires Android'); }

export async function connectHealth(): Promise<boolean> { return false; }
export async function readHealth(_since: Date): Promise<HealthReadings> { return { weight: [], bodyFat: [], leanMass: [], boneMass: [], bodyWater: [], bmr: [] }; }
export function openHealthSettings() {}
export function allowReads(_on: boolean) {}
export async function readDevice(_since: Date): Promise<DeviceHealth> { return emptyHealth(); }
export async function readHeight(): Promise<number | null> { return null; }
