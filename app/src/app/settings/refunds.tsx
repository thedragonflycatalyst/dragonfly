// Refund policy: one clear policy clients see before they buy. Packages can override it (non-refundable specials).
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Field, Txt, useToast } from '@/components/ui';
import { Page } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { DEFAULT_TERMS, policyText, toCentsInput, type RefundMode, type RefundTerms } from '@/lib/refunds';
import { sb } from '@/lib/supabase';

const MODES: [RefundMode, string, string][] = [
  ['none', 'No refunds (recommended)', 'All sales final; you can still override for an exceptional case, with a reason'],
  ['prorated', 'Unused sessions', 'Refund what wasn’t used, at the price per session paid'],
  ['unused_only', 'Only if unused', 'Full refund only before the first session'],
];

export default function RefundSettings() {
  const app = useApp();
  const toast = useToast();
  const [t, setT] = useState<RefundTerms>(DEFAULT_TERMS);
  const [fee, setFee] = useState('0.00');
  const [busy, setBusy] = useState(false);
  const tid = app.trainer?.user_id;
  useEffect(() => {
    if (!tid) return;
    void sb.from('coach_refund_policies').select('*').eq('trainer_id', tid).maybeSingle().then(({ data }) => {
      if (data) { setT(data as RefundTerms); setFee(((data as RefundTerms).fee_cents / 100).toFixed(2)); }
    });
  }, [tid]);
  const save = async () => {
    const cents = toCentsInput(fee);
    if (cents === null) return toast('Fee looks like 5 or 5.00', false);
    if (!Number.isInteger(t.window_days) || t.window_days < 0 || t.window_days > 365) return toast('Refund window is 0 to 365 days', false);
    setBusy(true);
    const { error } = await sb.from('coach_refund_policies').upsert({ ...t, fee_cents: cents, trainer_id: tid, updated_at: new Date().toISOString() }, { onConflict: 'trainer_id' });
    setBusy(false);
    if (error) toast(errText(error), false); else toast('Refund policy saved. New purchases use it; earlier ones keep the policy they were bought under.');
  };
  return (
    <Page title="Refund policy">
      <Stack.Screen options={{ title: 'Refund policy' }} />
      <View style={{ gap: 12 }}>
        <Card style={{ gap: 8 }}>
          <Txt v="bold">What can be refunded</Txt>
          {MODES.map(([k, label, hint]) => (
            <View key={k} style={{ gap: 2 }}>
              <Chip label={label} selected={t.mode === k} onPress={() => setT({ ...t, mode: k })} />
              <Txt v="small">{hint}</Txt>
            </View>
          ))}
        </Card>
        {t.mode !== 'none' && <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Field label="Refund window (days after purchase)" keyboardType="number-pad" value={String(t.window_days)} onChangeText={(v) => setT({ ...t, window_days: Number(v) || 0 })} style={{ flex: 1 }} />
            <Field label="Fee kept ($)" keyboardType="decimal-pad" value={fee} onChangeText={setFee} style={{ flex: 1 }} />
          </View>
          <Field label="Group sessions: refundable up to (hours before)" keyboardType="number-pad" value={String(t.event_cutoff_hours)} onChangeText={(v) => setT({ ...t, event_cutoff_hours: Number(v) || 0 })} />
          <Chip label="Expired packages can be refunded" selected={t.expired_refundable} onPress={() => setT({ ...t, expired_refundable: !t.expired_refundable })} />
        </Card>}
        <Field label="Anything else clients should know (optional)" value={t.extra_terms ?? ''} onChangeText={(v) => setT({ ...t, extra_terms: v })} multiline maxLength={1500} />
        <Card style={{ gap: 6 }}>
          <Txt v="bold">What clients see before they buy</Txt>
          {policyText({ ...t, fee_cents: toCentsInput(fee) ?? 0 }).map((l) => <Txt key={l} v="small">{l}</Txt>)}
        </Card>
        <Txt v="small">Changes apply to new purchases only. Have this checked against your state’s consumer rules before relying on it.</Txt>
        <Button title="Save" busy={busy} onPress={save} />
      </View>
    </Page>
  );
}
