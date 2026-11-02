import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { confirmWithCode, recoverWithCode, resendVerification, sendRecoveryCode } from '@/lib/account';
import { useApp } from '@/lib/app-state';
import { errText, isEmail } from '@/lib/model';
import { F, usePalette } from '@/lib/theme';

type Mode = 'in' | 'setup' | 'reset' | 'up' | 'confirm';

/**
 * The one sign-in screen for trainers and clients (like My PT Hub). What you see after signing in
 * depends on your account. Clients added by their trainer use "First time here?" to set a password
 * with the code that was emailed to them. "Create an account" is for trainers.
 */
export default function SignIn() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const app = useApp();
  const [mode, setMode] = useState<Mode>('in');
  const [id, setId] = useState('');        // username or email
  const [email, setEmail] = useState('');
  const [uname, setUname] = useState('');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Back to a join page (QR sign-up) after signing in; only our own paths
  const back = typeof next === 'string' && /^\/join\/[A-Za-z0-9]{16,64}$/.test(next) ? next : '/';
  if (app.user && !busy) return <Redirect href={back as '/'} />;
  const done = () => router.replace(back as '/');
  const go = (m: Mode) => { setErr(''); setCode(''); setPw(''); setMode(m); };
  const attempt = async (fn: () => Promise<void>) => {
    setErr(''); setBusy(true);
    try { await fn(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };

  const signIn = () => attempt(async () => {
    if (!id.trim() || !pw) throw new Error('Enter your email, username or phone, and your password.');
    await app.signIn(id.trim(), pw);
    toast('Signed in'); done();
  });
  const sendCode = (next: Mode) => attempt(async () => {
    const e = (mode === 'in' ? id : email).trim();
    if (!isEmail(e)) throw new Error('Enter the email address your account uses.');
    await sendRecoveryCode(e);
    setEmail(e); setMode(next); toast('We emailed you a code');
  });
  const setPassword = () => attempt(async () => {
    if (!/^\d{6,10}$/.test(code.trim())) throw new Error('Enter the code from the email.');
    await recoverWithCode(email.trim(), code, pw);
    toast(mode === 'setup' ? 'Password set. Welcome!' : 'Password changed. You’re signed in.'); done();
  });
  const createTrainer = () => attempt(async () => {
    if (!isEmail(email)) throw new Error('Enter your email.');
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,29}$/.test(uname)) throw new Error('dragonfly_username_invalid');
    if (pw.length < 8) throw new Error('Use at least 8 characters for your password.');
    const r = await app.signUp(email.trim(), uname.trim(), pw);
    if (r === 'signed-in') { await app.becomeTrainer(); toast('Welcome!'); done(); } else setMode('confirm');
  });

  const errLine = err ? <Txt v="bold" color={p.danger} style={{ marginBottom: 12 }} accessibilityLiveRegion="polite">{err}</Txt> : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }}>
        <View style={{ width: '100%', maxWidth: 440 }}>
          <Text style={{ fontFamily: F.display, fontSize: 40, letterSpacing: -1, color: p.ink, textAlign: 'center' }} accessibilityRole="header">Dragonfly</Text>
          <Txt v="small" center style={{ fontSize: 16, marginBottom: 22 }}>Personal training, together.</Txt>
          <Card style={{ padding: 20 }}>
            {mode === 'in' && (
              <>
                <Txt v="h2" style={{ marginBottom: 16 }}>Sign in</Txt>
                <Field label="Email, username or phone" value={id} onChangeText={setId} autoCapitalize="none" autoComplete="username" autoCorrect={false} keyboardType="email-address" />
                <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry autoComplete="current-password" onSubmitEditing={signIn} />
                {errLine}
                <Button title="Sign in" busy={busy} onPress={signIn} />
                <Button kind="quiet" small title="Forgot password" style={{ alignSelf: 'center', marginTop: 12 }}
                  onPress={() => (isEmail(id) ? sendCode('reset') : (setEmail(''), go('reset')))} />
              </>
            )}

            {(mode === 'setup' || mode === 'reset') && (
              <>
                <Txt v="h2" style={{ marginBottom: 6 }}>{mode === 'setup' ? 'Set up your password' : 'Reset your password'}</Txt>
                <Txt v="small" style={{ fontSize: 15, marginBottom: 16 }}>
                  {mode === 'setup'
                    ? 'Your trainer added you, and we emailed you a code. Enter it with the password you’d like to use.'
                    : 'Enter the code we emailed you and choose a new password. It changes your password in every Dragonfly app.'}
                </Txt>
                <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
                <Field label="Code from the email" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" />
                <Field label={mode === 'setup' ? 'Choose a password' : 'New password'} hint="(8+ characters)" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" onSubmitEditing={setPassword} />
                {errLine}
                <Button title={mode === 'setup' ? 'Set password and sign in' : 'Save new password'} busy={busy} onPress={setPassword} />
                <Button kind="ghost" title="Email me a new code" style={{ marginTop: 10 }} onPress={() => sendCode(mode)} />
              </>
            )}

            {mode === 'up' && (
              <>
                <Txt v="h2" style={{ marginBottom: 6 }}>Create a trainer account</Txt>
                <Txt v="small" style={{ fontSize: 15, marginBottom: 16 }}>
                  Training with a coach? You don’t need this. Your trainer adds you and you’ll get an email to set your password.
                </Txt>
                <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
                <Field label="Username" hint="(no spaces, can’t be changed later)" value={uname} onChangeText={(t) => setUname(t.replace(/\s+/g, ''))} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" />
                <Field label="Password" hint="(8+ characters)" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" onSubmitEditing={createTrainer} />
                {errLine}
                <Button title="Create account" busy={busy} onPress={createTrainer} />
                <Txt v="small" center style={{ marginTop: 10 }}>Already use another Dragonfly app? Sign in with that account instead.</Txt>
              </>
            )}

            {mode === 'confirm' && (
              <>
                <Txt v="h2" style={{ marginBottom: 6 }}>Check your email</Txt>
                <Txt style={{ marginBottom: 16 }}>We sent a code to <Txt v="bold">{email}</Txt>. Enter it to finish creating your account.</Txt>
                <Field label="Code from the email" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" autoFocus />
                {errLine}
                <Button title="Confirm account" busy={busy} onPress={() => attempt(async () => { await confirmWithCode(email.trim(), code, 'signup'); await app.becomeTrainer(); toast('Welcome!'); done(); })} />
                <Button kind="ghost" title="Send a new code" style={{ marginTop: 10 }} onPress={() => attempt(async () => { await resendVerification(email.trim()); toast('New code sent'); })} />
              </>
            )}
          </Card>

          <View style={{ marginTop: 18, gap: 8, alignItems: 'center' }}>
            {mode === 'in' ? (
              <>
                <Button kind="ghost" title="First time here? Set up your password" onPress={() => { setEmail(isEmail(id) ? id.trim() : ''); go('setup'); }} />
                <Button kind="quiet" small title="Create a trainer account" onPress={() => go('up')} />
              </>
            ) : (
              <Button kind="quiet" small title="Back to sign in" onPress={() => go('in')} />
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
