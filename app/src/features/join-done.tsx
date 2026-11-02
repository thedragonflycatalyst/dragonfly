import { router } from 'expo-router';
import { Linking, Platform } from 'react-native';
import { Button, Card, Txt } from '@/components/ui';
import { usePalette } from '@/lib/theme';

export const APK_URL = 'https://github.com/thedragonflycatalyst/dragonfly/releases/download/android-preview/dragonfly.apk';
export const device = () => (Platform.OS !== 'web' ? Platform.OS : /android/i.test(navigator.userAgent) ? 'android' : /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : 'desktop');
/** Remembered between the sign-up page and the link in the text (same phone, same browser) */
export const PENDING_KEY = 'dragonfly.join.pending';

/** After joining: get the app (Android), add to Home Screen (iPhone), or keep going in the browser */
export function JoinDone({ name }: { name: string }) {
  const p = usePalette();
  const dev = device();
  return (
    <Card style={{ gap: 12 }}>
      <Txt v="kicker" color={p.focus} style={{ textTransform: 'uppercase' }}>You’re in</Txt>
      <Txt v="h1">Welcome{name ? ` to ${name}` : ''}</Txt>
      {dev === 'android' ? <>
        <Txt>Get the Dragonfly app for your workouts, food diary, scale and chat. Tap below, open the download and tap Install (allow installing from your browser if your phone asks). Then open Dragonfly and sign in with your phone number or email and your password.</Txt>
        <Button title="Download the app" icon="download" onPress={() => Linking.openURL(APK_URL)} />
      </> : dev === 'ios' ? (
        <Txt>The iPhone app is on the way. For now Dragonfly works right here: tap the Share button, then “Add to Home Screen” to keep it one tap away.</Txt>
      ) : <Txt>Open this page on your phone to download the app, or keep going here.</Txt>}
      <Button kind={dev === 'android' ? 'ghost' : 'solid'} title={dev === 'android' ? 'Continue in the browser' : 'Continue'} onPress={() => router.replace('/')} />
    </Card>
  );
}
