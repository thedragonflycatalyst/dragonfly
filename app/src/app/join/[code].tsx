import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ambient } from '@/components/ambient';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { confirmWithCode, resendVerification } from '@/lib/account';
import { useApp } from '@/lib/app-state';
import { errText, isEmail } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

export const APK_URL = 'https://github.com/thedragonflycatalyst/dragonfly/releases/download/android-preview/dragonfly.apk';
const JOIN_TEXT: Record<string, string> = {
  bad_code: 'This sign-up code isn’t valid any more. Ask your trainer to show it again.',
  own_code: 'That’s your own sign-up code.', email_in_use: 'Your trainer already has a different account for this email.',
  name_required: 'Enter your first name.', phone_required: 'Enter your phone number.', confirm_email_first: 'Confirm your email first.',
};
const joinErr = (e: unknown) => { const m = errText(e); return Object.entries(JOIN_TEXT).find(([k]) => m.includes(k))?.[1] ?? m; };
const phoneOk = (s: string) => { const n = s.replace(/\D/g, '').length; return n >= 7 && n <= 15; };
const device = () => (Platform.OS !== 'web' ? Platform.OS : /android/i.test(navigator.userAgent) ? 'android' : /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : 'desktop');

/**
 * In-person sign-up: the page a trainer's QR code opens. Name, email and password, the code from the email, and
 * they're the trainer's client. Then: get the app.
 */
export default function Join() {
  const p = usePalette();
  const app = useApp();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [who, setWho] = useState<{ trainer_name: string; business_name: string | null } | null | undefined>(undefined);
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [f, setF] = useState({ first: '', last: '', phone: '', email: '', uname: '', pw: '' });
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    sb.rpc('coach_join_info', { p_code: code ?? '' }).then(({ data }) => setWho((data as { trainer_name: string; business_name: string | null }[] | null)?.[0] ?? null));
  }, [code]);
  const name = who ? who.business_name || who.trainer_name : '';
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: k === 'uname' ? v.replace(/\s+/g, '') : v, ...(k === 'first' && (!x.uname || x.uname.startsWith(x.first.toLowerCase().replace(/[^a-z0-9]/g, ''))) ? { uname: `${v.toLowerCase().replace(/[^a-z0-9]/g, '')}${v ? Math.floor(100 + Math.random() * 900) : ''}` } : {}) }));
  const run = async (fn: () => Promise<void>) => { setErr(''); setBusy(true); try { await fn(); } catch (e) { setErr(joinErr(e)); } finally { setBusy(false); } };
  const join = async () => {
    const { error } = await sb.rpc('coach_join', { p_code: code, p_first: f.first, p_last: f.last, p_phone: f.phone });
    if (error) throw error;
    await app.reloadMe();
    setStep('done');
  };

  const signUp = () => run(async () => {
    if (!f.first.trim()) throw new Error('Enter your first name.');
    if (!phoneOk(f.phone)) throw new Error('Enter your phone number.');
    if (!isEmail(f.email.trim())) throw new Error('Enter a valid email address.');
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,29}$/.test(f.uname)) throw new Error('Pick a username: 3–30 letters or numbers, no spaces.');
    if (f.pw.length < 8) throw new Error('Use a password with at least 8 characters.');
    const r = await app.signUp(f.email.trim().toLowerCase(), f.uname, f.pw);
    if (r === 'signed-in') await join(); else setStep('confirm');
  });

  const dev = device();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Ambient />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 28, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 460, gap: 14 }}>
            {who === undefined ? null : who === null ? (
              <Card style={{ gap: 8 }}><Txt v="h2">This code doesn’t work</Txt><Txt>Ask your trainer to show their sign-up QR code again.</Txt></Card>
            ) : step === 'done' ? (
              <Card style={{ gap: 12 }}>
                <Txt v="kicker" color={p.focus} style={{ textTransform: 'uppercase' }}>You’re in</Txt>
                <Txt v="h1">Welcome to {name}</Txt>
                {dev === 'android' ? <>
                  <Txt>Get the Dragonfly app for your workouts, food diary, scale and chat. Tap below, then open the download and tap Install (allow installing from your browser if your phone asks).</Txt>
                  <Button title="Download the app" icon="download" onPress={() => Linking.openURL(APK_URL)} />
                </> : dev === 'ios' ? (
                  <Txt>The iPhone app is on the way. For now Dragonfly works right here: tap the Share button, then “Add to Home Screen” to keep it one tap away.</Txt>
                ) : <Txt>Open this page on your phone to download the app, or keep going here.</Txt>}
                <Button kind={dev === 'android' ? 'ghost' : 'solid'} title="Continue" onPress={() => router.replace('/')} />
              </Card>
            ) : app.user && step === 'form' ? (
              <Card style={{ gap: 12 }}>
                <Txt v="h2">Join {name}</Txt>
                <Txt>You’re signed in as {app.username ?? app.user.email}. Join as {who.trainer_name}’s client?</Txt>
                <Field label="First name" value={f.first} onChangeText={set('first')} autoComplete="given-name" />
                <Field label="Last name" value={f.last} onChangeText={set('last')} autoComplete="family-name" />
                <Field label="Phone number" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
                {err ? <Txt color={p.danger}>{err}</Txt> : null}
                <Button title="Join" busy={busy} onPress={() => run(async () => { if (!phoneOk(f.phone)) throw new Error('Enter your phone number.'); await join(); })} />
              </Card>
            ) : step === 'confirm' ? (
              <Card style={{ gap: 12 }}>
                <Txt v="h2">Check your email</Txt>
                <Txt>We sent a code to <Txt v="bold">{f.email.trim()}</Txt>. Enter it to finish.</Txt>
                <Field label="Code from the email" value={otp} onChangeText={setOtp} keyboardType="number-pad" autoComplete="one-time-code" autoFocus />
                {err ? <Txt color={p.danger}>{err}</Txt> : null}
                <Button title="Finish" busy={busy} onPress={() => run(async () => { await confirmWithCode(f.email.trim().toLowerCase(), otp, 'signup'); await join(); })} />
                <Button kind="ghost" title="Send a new code" onPress={() => run(async () => { await resendVerification(f.email.trim().toLowerCase()); toast('New code sent'); })} />
              </Card>
            ) : (
              <Card style={{ gap: 4 }}>
                <Txt v="kicker" color={p.focus} style={{ textTransform: 'uppercase' }}>Train with {who.trainer_name}</Txt>
                <Txt v="h1" style={{ marginBottom: 10 }}>Join {name}</Txt>
                <Field label="First name" value={f.first} onChangeText={set('first')} autoComplete="given-name" autoFocus />
                <Field label="Last name" value={f.last} onChangeText={set('last')} autoComplete="family-name" />
                <Field label="Phone number" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
                <Field label="Email" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
                <Field label="Username" hint="(can’t be changed later)" value={f.uname} onChangeText={set('uname')} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" />
                <Field label="Password" hint="(8+ characters)" value={f.pw} onChangeText={set('pw')} secureTextEntry autoComplete="new-password" />
                {err ? <Txt color={p.danger} style={{ marginBottom: 8 }}>{err}</Txt> : null}
                <Button title="Create my account" busy={busy} onPress={signUp} />
                <Button kind="ghost" title="I already have an account" style={{ marginTop: 8 }} onPress={() => router.push({ pathname: '/sign-in', params: { next: `/join/${code}` } })} />
              </Card>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
