import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, Field, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { confirmWithCode, recoverWithCode, resendVerification, sendRecoveryCode } from '@/lib/account';
import { usePalette } from '@/lib/theme';

export default function SignIn() {
  const p = usePalette();
  const toast = useToast();
  const { signIn, signUp } = useApp();
  const [mode, setMode] = useState<'in' | 'up' | 'sent' | 'reset'>('in');
  const [code, setCode] = useState('');
  const [id, setId] = useState('');
  const [email, setEmail] = useState('');
  const [uname, setUname] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Back to wherever they came from (e.g. an invite link), else home
  const done = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      if (mode === 'in') {
        if (!id.trim() || !pw) throw new Error('Enter your username or email and password.');
        await signIn(id.trim(), pw);
        toast('Signed in'); done();
      } else {
        if (!email.includes('@')) throw new Error('Enter your email.');
        if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,29}$/.test(uname)) throw new Error('dragonfly_username_invalid');
        if (pw.length < 8) throw new Error('Use at least 8 characters for your password.');
        const r = await signUp(email.trim(), uname.trim(), pw);
        if (r === 'signed-in') { toast('Welcome!'); done(); } else setMode('sent');
      }
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  // Password reset by emailed code, same as the Dragonfly Uploader
  const forgot = async () => {
    if (!id.includes('@')) return setErr('Enter your account email above, then tap Forgot password.');
    setErr(''); setBusy(true);
    try { await sendRecoveryCode(id.trim()); setPw(''); setMode('reset'); toast('We emailed you a code'); }
    catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const reset = async () => {
    setErr(''); setBusy(true);
    try { await recoverWithCode(id.trim(), code, pw); toast('Password changed. You’re signed in.'); done(); }
    catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };

  if (mode === 'reset') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: p.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingTop: 32 }}>
          <Txt v="display">Reset password</Txt>
          <Txt v="small" style={{ fontSize: 16, marginTop: 8, marginBottom: 24 }}>Enter the code we emailed to {id.trim()} and choose a new password. It changes your password in every Dragonfly app.</Txt>
          <Field label="Code from the email" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" autoFocus />
          <Field label="New password" hint="(8+ characters)" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" onSubmitEditing={reset} />
          {err ? <Txt v="bold" color={p.danger} style={{ marginBottom: 12 }} accessibilityLiveRegion="polite">{err}</Txt> : null}
          <Button title="Save new password" busy={busy} onPress={reset} />
          <Button kind="ghost" title="Send a new code" style={{ marginTop: 10 }} onPress={forgot} />
          <Button kind="quiet" small title="Back to sign in" style={{ alignSelf: 'center', marginTop: 16 }} onPress={() => { setErr(''); setMode('in'); }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (mode === 'sent') {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, padding: 24, paddingTop: 40, gap: 12 }}>
        <Txt v="display">Check your email</Txt>
        <Txt>We sent a code to <Txt v="bold">{email}</Txt>. Enter it here to finish creating your account.</Txt>
        <Field label="Code from the email" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" autoFocus />
        {err ? <Txt v="bold" color={p.danger} accessibilityLiveRegion="polite">{err}</Txt> : null}
        <Button title="Confirm account" busy={busy} onPress={async () => {
          setErr(''); setBusy(true);
          try { await confirmWithCode(email.trim(), code, 'signup'); toast('Welcome!'); done(); }
          catch (e) { setErr(errText(e)); } finally { setBusy(false); }
        }} />
        <Button kind="ghost" title="Send a new code" onPress={async () => { try { await resendVerification(email.trim()); toast('New code sent'); } catch (e) { setErr(errText(e)); } }} />
        <Button kind="quiet" small title="Back to sign in" style={{ alignSelf: 'center' }} onPress={() => setMode('in')} />
      </View>
    );
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingTop: 32 }}>
        <Txt v="display">{mode === 'in' ? 'Welcome back' : 'Create your account'}</Txt>
        <Txt v="small" style={{ fontSize: 16, marginTop: 8, marginBottom: 24 }}>
          {mode === 'in' ? 'Use the same account you use for the Dragonfly Uploader and other Dragonfly apps.' : 'Already have a Dragonfly account from another Dragonfly app? Sign in with it instead.'}
        </Txt>
        {mode === 'in' ? (
          <>
            <Field label="Username or email" value={id} onChangeText={setId} autoCapitalize="none" autoComplete="username" autoCorrect={false} />
            <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry autoComplete="current-password" onSubmitEditing={submit} />
          </>
        ) : (
          <>
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Field label="Username" hint="(no spaces, can’t be changed later)" value={uname} onChangeText={(t) => setUname(t.replace(/\s+/g, ''))} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" placeholder="TheDragonflyCatalyst" />
            <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" />
          </>
        )}
        {err ? <Txt v="bold" color={p.danger} style={{ marginBottom: 12 }} accessibilityLiveRegion="polite">{err}</Txt> : null}
        <Button title={mode === 'in' ? 'Sign in' : 'Create account'} busy={busy} onPress={submit} />
        <Button kind="ghost" title={mode === 'in' ? 'Create an account' : 'I have an account'} style={{ marginTop: 10 }} onPress={() => { setErr(''); setMode(mode === 'in' ? 'up' : 'in'); }} />
        {mode === 'in' && <Button kind="quiet" small title="Forgot password" style={{ alignSelf: 'center', marginTop: 16 }} onPress={forgot} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
