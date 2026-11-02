import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ambient } from '@/components/ambient';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { JoinDone, PENDING_KEY } from '@/features/join-done';
import { useApp } from '@/lib/app-state';
import { e164 } from '@/lib/contact';
import { errText } from '@/lib/model';
import { storage } from '@/lib/storage';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

type Pending = { code: string; first: string; last: string; phone: string; email: string };
const remembered = () => { try { return storage.getItem(PENDING_KEY); } catch { return null; } };

/**
 * The link in the sign-up text message: tapping it confirms the phone number, finishes joining the trainer, and shows
 * the app download. Usually opens in the same browser as the sign-up page; if not, it asks for the phone number once.
 */
export default function VerifyLink() {
  const p = usePalette();
  const app = useApp();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { otp } = useLocalSearchParams<{ otp: string }>();
  const [phone, setPhone] = useState(remembered() ?? '');
  const [state, setState] = useState<'working' | 'ask' | 'done' | 'error'>(remembered() ? 'working' : 'ask');
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const started = useRef(false);

  const finish = useCallback(async (raw: string) => {
    setState('working'); setErr('');
    try {
      const ph = e164(raw);
      if (!ph) throw new Error('Enter the phone number you signed up with.');
      if (!/^\d{4,10}$/.test(otp ?? '')) throw new Error('This link is incomplete. Enter the code from the text on the sign-up page.');
      const { data, error } = await sb.auth.verifyOtp({ phone: ph, token: otp!, type: 'sms' });
      if (error || !data.user) throw new Error('This link has expired or was already used. Ask for a new text on the sign-up page.');
      const j = data.user.user_metadata?.join as Pending | undefined;
      if (j?.email) await sb.auth.updateUser({ email: j.email }).catch(() => {});
      if (j?.code) {
        const { error: je } = await sb.rpc('coach_join', { p_code: j.code, p_first: j.first, p_last: j.last, p_phone: j.phone, p_email: j.email });
        if (je && !/confirm_email_to_link/.test(je.message)) throw je;
        if (je) toast('Your trainer already invited this email: open the confirmation email we sent to finish linking.', false);
        const { data: who } = await sb.rpc('coach_join_info', { p_code: j.code });
        const w = (who as { trainer_name: string; business_name: string | null }[] | null)?.[0];
        setName(w ? w.business_name || w.trainer_name : '');
      }
      try { storage.removeItem(PENDING_KEY); } catch { /* private window */ }
      await app.reloadMe();
      setState('done');
    } catch (e) { setErr(errText(e)); setState('error'); }
  }, [otp, app, toast]);

  useEffect(() => { if (!started.current && state === 'working' && phone) { started.current = true; finish(phone); } }, [state, phone, finish]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Ambient />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 28, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 460, gap: 14 }}>
          {state === 'done' ? <JoinDone name={name} /> : state === 'working' ? (
            <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 30 }}><ActivityIndicator color={p.focus} /><Txt>Confirming your phone…</Txt></Card>
          ) : (
            <Card style={{ gap: 12 }}>
              <Txt v="h2">{state === 'error' ? 'That didn’t work' : 'Almost there'}</Txt>
              {state === 'error' ? <Txt color={p.danger}>{err}</Txt> : <Txt>Enter the phone number you signed up with to finish.</Txt>}
              <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
              <Button title="Finish" onPress={() => finish(phone)} />
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
