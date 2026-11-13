// The rest countdown in the Android notification shade. A no-op on iPhone and the web (iPhone gets the scheduled
// "Rest is over" alert only), and on an app build made before this module existed.
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type Native = { show(untilMs: number, title: string, body: string): void; finished(title: string, body: string): void; clear(): void };
const native = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('RestNotification') : null;

export function showRestCountdown(untilMs: number, title: string, body: string) { try { native?.show(untilMs, title, body); } catch { /* the in-app timer still works */ } }
export function showRestFinished(title: string, body: string) { try { native?.finished(title, body); } catch { /* nothing to show */ } }
export function clearRestNotification() { try { native?.clear(); } catch { /* nothing to clear */ } }
