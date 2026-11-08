// Trainer: how sessions are paid. Session billing in the app (packages first, then a single-session price) or handled
// elsewhere (e.g. a club like Columbia Association), and the trainer's own Stripe account for card payments.
// Prices for packages, group classes and class sizes are set on each package and event.
import * as WebBrowser from 'expo-web-browser';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Button, Card, Chip, Field, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { fmtMoney } from '@/lib/business';
import { callFn, fnText } from '@/lib/fn';
import { errText } from '@/lib/model';
import { toCentsInput } from '@/lib/refunds';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

type Status = { connected: boolean; charges_enabled: boolean; details_submitted: boolean; team?: boolean };

export default function PaymentSettings() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const tid = app.trainer?.user_id;
  const [mode, setMode] = useState<'app' | 'external'>('app');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!tid) return;
    const { data } = await sb.from('coach_trainers').select('session_billing, single_session_cents, session_currency').eq('user_id', tid).maybeSingle();
    if (data) { setMode(data.session_billing); setPrice(data.single_session_cents ? (data.single_session_cents / 100).toFixed(2) : ''); }
    try { setStatus(await callFn<Status>('coach-pay', { action: 'connect_status' })); } catch { setStatus(null); }
  }, [tid]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const { connect } = useLocalSearchParams<{ connect?: string }>();
  useEffect(() => { if (connect) { load(); router.replace('/settings/payments'); } }, [connect, load]);

  const save = async () => {
    const cents = price.trim() ? toCentsInput(price) : null;
    if (price.trim() && (cents == null || cents < 50)) return toast('Enter a price like 80 or 80.00', false);
    const { error } = await sb.from('coach_trainers').update({ session_billing: mode, single_session_cents: cents }).eq('user_id', tid!);
    if (error) toast(errText(error), false); else toast('Saved');
  };
  const connectStripe = async () => {
    setBusy(true);
    try {
      const r = await callFn<{ url: string }>('coach-pay', { action: 'connect' });
      if (Platform.OS === 'web') { window.location.href = r.url; return; }
      await WebBrowser.openBrowserAsync(r.url);
      load();
    } catch (e) { toast(/connect_unavailable/.test(String(e)) ? 'Stripe connections aren’t switched on for Dragonfly yet. Try again later.' : fnText(e), false); } finally { setBusy(false); }
  };
  const cents = toCentsInput(price);
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Session payments' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <SectionLabel>How clients pay for sessions</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip label="In this app" selected={mode === 'app'} onPress={() => setMode('app')} />
            <Chip label="Handled elsewhere" selected={mode === 'external'} onPress={() => setMode('external')} />
          </View>
          <Txt v="small">{mode === 'app'
            ? 'Every session uses the client’s package first. With no package left, it becomes a single session: charged to their card when it’s booked, or owed after it happens. A client who owes for a session can’t book another until it’s paid. A package bought later covers what they owe.'
            : 'Your club or gym (for example Columbia Association) takes payment. The app doesn’t attach packages or charge for sessions.'}</Txt>
          {mode === 'app' && <Field label="Single-session price ($)" keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="e.g. 80"
            hint={cents ? `Clients without a package pay ${fmtMoney(cents)} per session` : 'Leave empty to only use packages'} />}
          <Button title="Save" onPress={save} style={{ alignSelf: 'flex-start' }} />

          <SectionLabel>Card payments (Stripe)</SectionLabel>
          <Card style={{ gap: 8 }}>
            {status?.charges_enabled ? <Txt>Your Stripe account is connected. Card payments for your packages, classes and sessions go straight to it, at the prices you set.</Txt>
              : status?.connected ? <Txt>Stripe needs a few more details before you can take payments.</Txt>
              : status?.team ? <Txt>You’re paid through the Dragonfly team account. You can connect your own Stripe account instead.</Txt>
              : <Txt>Connect your own Stripe account to take card payments at your own prices. Stripe handles cards and payouts to your bank; Dragonfly never sees card numbers.</Txt>}
            {!status?.charges_enabled && <Button small title={status?.connected ? 'Finish Stripe setup' : 'Connect Stripe'} icon="link" busy={busy} onPress={connectStripe} style={{ alignSelf: 'flex-start' }} />}
          </Card>
          <Txt v="small">Package prices are set in Packages; group class prices and sizes on each event.</Txt>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button small kind="ghost" title="Packages" onPress={() => router.push('/packages')} />
            <Button small kind="ghost" title="Events and classes" onPress={() => router.push('/events')} />
            <Button small kind="ghost" title="Refund policy" onPress={() => router.push('/settings/refunds')} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
