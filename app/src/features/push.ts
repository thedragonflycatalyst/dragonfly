// Dragonfly's own push notifications (trainers): this phone's token is saved so reschedule requests reach it even when
// the app is closed. Android uses a loud "Approvals" channel. Nothing happens on web or before Firebase is set up.
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { sb } from '@/lib/supabase';

let started = false;

export async function startPush(): Promise<'on' | 'denied' | 'unavailable'> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const N = await import('expo-notifications');
    N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }) });
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('approvals', { name: 'Approvals (reschedule requests)', importance: N.AndroidImportance.MAX, sound: 'default',
        vibrationPattern: [0, 500, 250, 500, 250, 500], lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC, bypassDnd: true });
    }
    const perm = await N.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: true } });
    if (!perm.granted) return 'denied';
    const tok = await N.getDevicePushTokenAsync();
    if (typeof tok.data !== 'string' || !tok.data) return 'unavailable';
    await sb.rpc('dragonfly_push_register', { p_token: tok.data, p_platform: Platform.OS === 'ios' ? 'ios' : 'android', p_app: 'coach' });
    if (!started) {
      started = true;
      // Tapping the alert opens that request: Approve / Decline
      N.addNotificationResponseReceivedListener((r) => {
        const d = r.notification.request.content.data as { kind?: string; path?: string } | undefined;
        if (d?.kind === 'reschedule') router.push((d.path && /^\/reschedule\/[0-9a-f-]{36}$/.test(d.path) ? d.path : '/calendar') as never);
        if (d?.kind === 'followup') router.push('/followups');
      });
    }
    return 'on';
  } catch { return 'unavailable'; }   // e.g. a build without Firebase
}
