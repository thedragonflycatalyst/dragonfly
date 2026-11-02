import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ambient } from '@/components/ambient';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { resetRedirect } from '@/lib/account';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

/**
 * Where a password-reset email link lands, for every Dragonfly app (they share one account). Reads the sign-in from the
 * link, then asks for the new password. An expired or already-used link says so and offers a fresh email.
 */
export default function ResetPassword() {
  const p = usePalette();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<'checking' | 'ready' | 'bad' | 'done'>('checking');
  const [why, setWhy] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const hash = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
      const q = new URLSearchParams(hash);
      if (q.get('error')) {
        setWhy(q.get('error_code') === 'otp_expired'
          ? 'This link has expired or was already used. Email apps sometimes open links to scan them, which uses them up.'
          : (q.get('error_description') ?? 'This link didn’t work.').replace(/\+/g, ' '));
        return setState('bad');
      }
      const access = q.get('access_token'), refresh = q.get('refresh_token');
      if (access && refresh) {
        const { error } = await sb.auth.setSession({ access_token: access, refresh_token: refresh });
        if (Platform.OS === 'web') window.history.replaceState(null, '', window.location.pathname);
        if (error) { setWhy('This link has expired or was already used.'); return setState('bad'); }
        return setState('ready');
      }
      // Opened without a link: only useful if already signed in
      const { data } = await sb.auth.getSession();
      if (data.session) setState('ready'); else { setWhy('Open this page from the link in your password-reset email.'); setState('bad'); }
    })();
  }, []);

  const save = async () => {
    if (pw.length < 8) return toast('Use at least 8 characters', false);
    if (pw !== pw2) return toast('The two passwords don’t match', false);
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast(error.message, false);
    setState('done');
  };
  const resend = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast('Enter your email', false);
    setBusy(true);
    const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: resetRedirect() });
    setBusy(false);
    if (error) return toast(error.message, false);
    toast('Check your email for a new link (and code)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Ambient />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 28, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 460 }}>
          <Card style={{ gap: 12 }}>
            <Txt v="kicker" color={p.focus} style={{ textTransform: 'uppercase' }}>Your Dragonfly account</Txt>
            {state === 'checking' ? <Txt>One moment…</Txt> : state === 'done' ? <>
              <Txt v="h2">Password changed</Txt>
              <Txt>Your new password works in every Dragonfly app: the coaching app, Lapis, the Uploader and the Phoenix app.</Txt>
              <Button title="Continue" onPress={() => router.replace('/')} />
            </> : state === 'ready' ? <>
              <Txt v="h2">Choose a new password</Txt>
              <Field label="New password" hint="(8+ characters)" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" autoFocus />
              <Field label="Type it again" value={pw2} onChangeText={setPw2} secureTextEntry autoComplete="new-password" />
              <Button title="Save password" busy={busy} onPress={save} />
            </> : <>
              <Txt v="h2">That link didn’t work</Txt>
              <Txt>{why}</Txt>
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
              <Button title="Send a new reset email" busy={busy} onPress={resend} />
              <Txt v="small">Tip: if your email also shows a code, you can type it in the app instead of tapping the link.</Txt>
            </>}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
