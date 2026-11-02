import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JoinDone, PENDING_KEY } from '@/features/join-done';
import { storage } from '@/lib/storage';
import { Ambient } from '@/components/ambient';
import { Button, Card, Field, Icon, Txt, useToast } from '@/components/ui';
import { e164 } from '@/lib/contact';
import { confirmWithCode, resendVerification } from '@/lib/account';
import { useApp } from '@/lib/app-state';
import { errText, isEmail } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

const JOIN_TEXT: Record<string, string> = {
  bad_code: 'This sign-up code isn’t valid any more. Ask your trainer to show it again.',
  own_code: 'That’s your own sign-up code.', email_in_use: 'Your trainer already has a different account for this email.',
  name_required: 'Enter your first name.', dragonfly_username_taken: 'That username is taken. Try another.', confirm_email_to_link: 'Your trainer already invited this email. Verify by email instead (tap “Verify another way”).', email_required: 'Enter a valid email address.', phone_required: 'Enter your phone number.', confirm_email_first: 'Confirm your email first.',
};
const joinErr = (e: unknown) => { const m = errText(e); return Object.entries(JOIN_TEXT).find(([k]) => m.includes(k))?.[1] ?? m; };
/** "Verify another way": a small expandable choice under the main button */
function OtherWay({ open, onToggle, label, onPick }: { open: boolean; onToggle: () => void; label: string; onPick: () => void }) {
  const p = usePalette();
  return (
    <View style={{ marginTop: 6 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', padding: 6 }}>
        <Txt v="smallBold" color={p.focus}>Verify another way</Txt><Icon name={open ? 'expand_less' : 'expand_more'} size={18} color={p.focus} />
      </Pressable>
      {open && <Button kind="ghost" small title={label} onPress={onPick} />}
    </View>
  );
}
const phoneOk = (s: string) => { const n = s.replace(/\D/g, '').length; return n >= 7 && n <= 15; };

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
  const [step, setStep] = useState<'form' | 'sms' | 'confirm' | 'done'>('form');
  const [via, setVia] = useState<'sms' | 'email'>('sms');
  const [other, setOther] = useState(false);
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
    const { error } = await sb.rpc('coach_join', { p_code: code, p_first: f.first, p_last: f.last, p_phone: f.phone, p_email: f.email.trim().toLowerCase() });
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
    if (via === 'sms' && await textSignUp()) return;
    await emailSignUp();
  });
  // Backup: a code by email
  const emailSignUp = async () => {
    const r = await app.signUp(f.email.trim().toLowerCase(), f.uname, f.pw);
    setVia('email'); setOtp('');
    if (r === 'signed-in') await join(); else setStep('confirm');
  };
  // Default: a code by text message. Returns false when texting isn't set up yet (then email is used).
  const textSignUp = async () => {
    const phone = e164(f.phone);
    if (!phone) throw new Error('Enter your phone number with its area code.');
    const { data: free } = await sb.rpc('dragonfly_username_available', { wanted: f.uname });
    if (free === false) throw new Error('dragonfly_username_taken');
    // What to join is kept on the account, so the link in the text can finish it (even in another browser)
    const pending = { code, first: f.first.trim(), last: f.last.trim(), phone: f.phone.trim(), email: f.email.trim().toLowerCase() };
    const { data, error } = await sb.auth.signUp({ phone, password: f.pw, options: { data: { username: f.uname, join: pending } } });
    if (error) {
      if (/provider|phone sign|sms|disabled|unsupported/i.test(error.message)) { toast('Text codes aren’t set up yet, so we emailed you a code'); return false; }
      throw error;
    }
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('That phone number already has a Dragonfly account. Tap “I already have an account”.');
    if (data.session) { await afterText(); return true; }
    try { storage.setItem(PENDING_KEY, phone); } catch { /* private window */ }
    setOtp(''); setStep('sms'); return true;
  };
  const verifyText = (token: string) => run(async () => {
    const { error } = await sb.auth.verifyOtp({ phone: e164(f.phone)!, token: token.trim(), type: 'sms' });
    if (error) throw new Error('That code didn’t work. Check the newest text and try again.');
    await afterText();
  });
  // Signed in by phone: add their email to the account (they confirm it later, from the email we send) and join
  const afterText = async () => {
    await sb.auth.updateUser({ email: f.email.trim().toLowerCase() }).catch(() => {});
    try { await join(); } catch (e) {
      // Their trainer already invited this email: they confirm it (the email we just sent), then tap Join
      if (errText(e).includes('confirm_email_to_link')) { setStep('form'); throw new Error('Your trainer already invited this email. Open the confirmation email we just sent, tap the link, then come back and tap Join.'); }
      throw e;
    }
  };

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
              <JoinDone name={name} />
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
            ) : step === 'sms' ? (
              <Card style={{ gap: 12 }}>
                <Txt v="h2">Check your texts</Txt>
                <Txt>We texted <Txt v="bold">{f.phone.trim()}</Txt>. Tap the link in the message to finish, or enter the code from it here.</Txt>
                <Field label="Code from the text" value={otp} autoFocus keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode"
                  onChangeText={(v) => { const d = v.replace(/\D/g, '').slice(0, 8); setOtp(d); if (d.length === 6 && !busy) verifyText(d); }} />
                {err ? <Txt color={p.danger}>{err}</Txt> : null}
                <Button title="Finish" busy={busy} onPress={() => verifyText(otp)} />
                <Button kind="ghost" title="Text me a new code" onPress={() => run(async () => { const { error } = await sb.auth.resend({ type: 'sms', phone: e164(f.phone)! }); if (error) throw error; toast('New code sent'); })} />
                <OtherWay open={other} onToggle={() => setOther(!other)} label="Email me a code instead" onPick={() => { setVia('email'); setOther(false); setErr(''); setStep('form'); }} />
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
                <Button title={via === 'sms' ? 'Text me a code' : 'Email me a code'} icon={via === 'sms' ? 'sms' : 'mail'} busy={busy} onPress={signUp} />
                <OtherWay open={other} onToggle={() => setOther(!other)} label={via === 'sms' ? 'Verify by email instead' : 'Verify by text message instead'}
                  onPick={() => { setVia(via === 'sms' ? 'email' : 'sms'); setOther(false); }} />
                <Button kind="ghost" title="I already have an account" style={{ marginTop: 8 }} onPress={() => router.push({ pathname: '/sign-in', params: { next: `/join/${code}` } })} />
              </Card>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
