// Health Connect only exists on Android; this is the stand-in for web and iPhone (see health-connect.android.ts).
import { emptyHealth, type DeviceHealth } from '@/lib/health';
import type { HealthReadings } from '@/lib/scale';

export type HealthStatus = 'unsupported' | 'not_installed' | 'update_needed' | 'ready';
export async function healthStatus(): Promise<HealthStatus> { return 'unsupported'; }
export async function connectHealth(): Promise<boolean> { return false; }
export async function readHealth(_since: Date): Promise<HealthReadings> { return { weight: [], bodyFat: [], leanMass: [], boneMass: [], bodyWater: [], bmr: [] }; }
export function openHealthSettings() {}
export async function readDevice(_since: Date): Promise<DeviceHealth> { return emptyHealth(); }
