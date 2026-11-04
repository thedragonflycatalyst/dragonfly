import { Platform } from 'react-native';

/** Session-scoped native completion reminders.
 * Each mutation for the same timer is serialized; a delayed schedule cannot
 * race a later pause, reset, or unmount and leave a stray notification behind.
 */
const queues = new Map<string, Promise<void>>();
const known = new Map<string, string>();
const PREFIX = 'lapis-linked:';

function enqueue(key: string, work: () => Promise<void>): Promise<void> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(work);
  queues.set(key, next);
  void next.finally(() => { if (queues.get(key) === next) queues.delete(key); });
  return next;
}
async function notifications() {
  if (Platform.OS === 'web') return null;
  try { return await import('expo-notifications'); } catch { return null; }
}
async function cancelExisting(key: string) {
  const N = await notifications();
  if (!N) return;
  const existing = known.get(key);
  known.delete(key);
  if (existing) {
    try { await N.cancelScheduledNotificationAsync(existing); } catch { /* already fired */ }
  }
  // On reload, an earlier app process may have scheduled a notification.
  // Only inspect/cancel our own tagged records; never clear unrelated alerts.
  try {
    const all = await N.getAllScheduledNotificationsAsync();
    for (const request of all) {
      if (request.content.data?.lapisTimerKey === key && request.identifier !== existing) {
        await N.cancelScheduledNotificationAsync(request.identifier).catch(() => {});
      }
    }
  } catch { /* native notification API may be unavailable */ }
}
export async function reconcileLapisCompletion(key: string, secondsLeft: number | null, name: string) {
  if (!key || !key.startsWith(PREFIX)) return;
  await enqueue(key, async () => {
    await cancelExisting(key);
    if (secondsLeft === null || !Number.isFinite(secondsLeft) || secondsLeft <= 0) return;
    const N = await notifications();
    if (!N) return;
    try {
      const permission = await N.getPermissionsAsync();
      if (!permission.granted) return; // no surprise permission prompt
      if (Platform.OS === 'android') {
        await N.setNotificationChannelAsync('lapis-complete', {
          name: 'Lapis timer completions',
          importance: N.AndroidImportance.HIGH,
          sound: 'bell_ring2.wav',
          vibrationPattern: [0, 250, 120, 250],
        });
      }
      const id = await N.scheduleNotificationAsync({
        content: {
          title: 'Lapis timer finished',
          body: name.slice(0, 100),
          sound: 'bell_ring2.wav',
          data: { kind: 'lapis-linked-complete', lapisTimerKey: key },
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.ceil(secondsLeft)),
          ...(Platform.OS === 'android' ? { channelId: 'lapis-complete' } : {}),
        },
      });
      known.set(key, id);
    } catch { /* foreground clock remains authoritative */ }
  });
}
export async function clearLapisCompletion(key: string) {
  if (!key || !key.startsWith(PREFIX)) return;
  await enqueue(key, () => cancelExisting(key));
}
export function lapisReminderKey(sessionId: string, blockId: string): string {
  return PREFIX + encodeURIComponent(sessionId) + ':' + encodeURIComponent(blockId);
}
