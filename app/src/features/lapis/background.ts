import { Platform } from 'react-native';

/** Schedule a single native completion reminder when a linked timer goes into
 * the background. No permission prompts are shown implicitly. If permission
 * isn't granted, the in-app timer still computes the correct elapsed time.
 */
export async function scheduleLapisCompletion(secondsLeft: number, name: string): Promise<string | null> {
  if (Platform.OS === 'web' || !Number.isFinite(secondsLeft) || secondsLeft < 1) return null;
  try {
    const N = await import('expo-notifications');
    const permission = await N.getPermissionsAsync();
    if (!permission.granted) return null;
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('lapis-complete', {
        name: 'Lapis timer completions',
        importance: N.AndroidImportance.HIGH,
        sound: 'bell_ring2.wav',
        vibrationPattern: [0, 250, 120, 250],
      });
    }
    return await N.scheduleNotificationAsync({
      content: {
        title: 'Lapis timer finished',
        body: name.length > 100 ? name.slice(0, 100) : name,
        sound: 'bell_ring2.wav',
        data: { kind: 'lapis-linked-complete' },
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.ceil(secondsLeft)),
        ...(Platform.OS === 'android' ? { channelId: 'lapis-complete' } : {}),
      },
    });
  } catch { return null; }
}
export async function cancelLapisCompletion(notificationId: string | null) {
  if (!notificationId || Platform.OS === 'web') return;
  try {
    const N = await import('expo-notifications');
    await N.cancelScheduledNotificationAsync(notificationId);
  } catch { /* old notification may already have fired */ }
}
