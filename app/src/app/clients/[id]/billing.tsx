import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Badge } from '@/components/shell';
import { Sheet } from '@/components/sheet';
import { Button, Card, Empty, Field, Txt, useToast } from '@/components/ui';
import { sendAdjustmentNotice } from '@/features/payment-adjust';
import { callFn, fnText } from '@/lib/fn';
import { useClientRecord } from '@/features/common';
import { confirm } from '@/lib/ask';
import { creditsLeft, fmtMoney, packageLive, type ClientPackage, type Payment } from '@/lib/business';
import { errText } from '@/lib/model';
import { canRefund, chargeText, refundPlan, type SessionCharge } from '@/lib/session-billing';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

/** One client's packages (with credits) and payments */
export default function ClientBilling() {
  const p = usePalette();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { client } = useClientRecord(id);
  const [pkgs, setPkgs] = useState<ClientPackage[] | null>(null);
  const [pays, setPays] = useState<Payment[]>([]);
  const [charges, setCharges] = useState<SessionCharge[]>([]);
  const [refunding, setRefunding] = useState<SessionCharge | null>(null);
  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([sb.from('coach_client_packages').select('*').eq('client_id', id).order('created_at', { ascending: false }), sb.from('coach_payments').select('*').eq('client_id', id).order('paid_at', { ascending: false }),
      sb.from('coach_session_charges').select('*').eq('client_id', id).in('status', ['due', 'pending', 'package', 'paid', 'credit', 'refunded'])
        .gte('starts_at', new Date(Date.now() - 90 * 86_400_000).toISOString()).order('starts_at', { ascending: false }).limit(60)]);
    setPkgs((a.data as ClientPackage[]) ?? []); setPays((b.data as Payment[]) ?? []); setCharges((c.data as SessionCharge[]) ?? []);
  }, [id]);
  const settle = async (x: SessionCharge, status: 'paid' | 'waived') => {
    const what = status === 'paid' ? 'Record this session as paid (cash or card at the desk)?' : 'Let this session go without payment?';
    if (!(await confirm(status === 'paid' ? 'Mark paid?' : 'Waive this session?', what, status === 'paid' ? 'Mark paid' : 'Waive'))) return;
    const { error } = await sb.rpc('coach_charge_settle', { p_charge: x.id, p_status: status, p_method: 'cash' });
    if (error) toast(errText(error), false); else load();
  };
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const unpaid = charges.filter((x) => x.status === 'due' || x.status === 'pending').reverse();
  const settled = charges.filter((x) => x.status !== 'due' && x.status !== 'pending' && new Date(x.starts_at).getTime() <= Date.now() + 14 * 86_400_000);
  const adjust = async (x: ClientPackage, d: number) => {
    const used = x.credits_used - d;
    if (used < 0 || (x.credits_total != null && used > x.credits_total)) return;
    const { error } = await sb.from('coach_client_packages').update({ credits_used: used }).eq('id', x.id);
    if (error) toast(errText(error), false); else load();
  };
  const cancel = async (x: ClientPackage) => {
    if (!(await confirm(`End ${x.name}?`, 'Remaining credits can’t be used any more. Payments aren’t refunded automatically.', 'End package', true))) return;
    await sb.from('coach_client_packages').update({ status: 'cancelled' }).eq('id', x.id); load();
  };
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: client ? `${client.first_name}: packages` : 'Packages' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          {pkgs === null ? <ActivityIndicator color={p.ink} /> : pkgs.length === 0 ? <Empty emoji="🎁" title="No packages yet" body="Give them one from Packages, or they can buy one in their app." action={<Button title="Go to Packages" onPress={() => router.push('/packages')} />} />
            : pkgs.map((x) => {
              const left = creditsLeft(x), live = packageLive(x);
              return (
                <Card key={x.id} style={{ gap: 6, opacity: live ? 1 : 0.6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Txt v="h3" style={{ flex: 1 }}>{x.name}</Txt><Badge text={live ? 'Active' : x.status === 'cancelled' ? 'Ended' : 'Expired'} color={live ? p.good : p.muted} /></View>
                  <Txt v="small">Started {new Date(`${x.starts_on}T12:00:00`).toLocaleDateString()}{x.expires_on ? ` · use by ${new Date(`${x.expires_on}T12:00:00`).toLocaleDateString()}` : ''}</Txt>
                  {left != null && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Txt v="bold" style={{ flex: 1 }}>{left} of {x.credits_total} credits left</Txt>
                    {live && <><Button small kind="ghost" title="Use one" onPress={() => adjust(x, -1)} /><Button small kind="quiet" title="Give one back" onPress={() => adjust(x, 1)} /></>}
                  </View>}
                  {live && <Button small kind="danger" title="End package" onPress={() => cancel(x)} style={{ alignSelf: 'flex-start' }} />}
                </Card>
              );
            })}
          {unpaid.length > 0 && <>
            <SectionLabel>Sessions not paid yet</SectionLabel>
            <Card style={{ padding: 0 }}>{unpaid.map((x, i) => (
              <View key={x.id} style={{ padding: 14, gap: 6, borderBottomWidth: i === unpaid.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                <Txt v="bold">{new Date(x.starts_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Txt>
                <Txt v="small">{chargeText(x, false).replace('your', 'their')}</Txt>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button small kind="ghost" title="Mark paid" onPress={() => settle(x, 'paid')} />
                  <Button small kind="quiet" title="Waive" onPress={() => settle(x, 'waived')} />
                </View>
              </View>))}</Card>
          </>}
          {settled.length > 0 && <>
            <SectionLabel>Sessions (last 90 days)</SectionLabel>
            <Card style={{ padding: 0 }}>{settled.map((x, i) => (
              <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, borderBottomWidth: i === settled.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="bold">{new Date(x.starts_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Txt>
                  <Txt v="small">{chargeText(x, false).replace('your', 'their')}{x.note && x.status !== 'refunded' ? ` · ${x.note}` : ''}</Txt>
                  {x.refund_reason ? <Txt v="small" color={p.muted}>Reason: {x.refund_reason}</Txt> : null}
                </View>
                {canRefund(x) && <Button small kind="ghost" icon="undo" title="Refund" onPress={() => setRefunding(x)} />}
              </View>))}</Card>
          </>}
          <SectionLabel>Payments</SectionLabel>
          {pays.length === 0 ? <Txt v="small">No payments recorded.</Txt> : <Card style={{ padding: 0 }}>{pays.map((x, i) => (
            <View key={x.id} style={{ flexDirection: 'row', padding: 14, gap: 10, borderBottomWidth: i === pays.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
              <View style={{ flex: 1 }}><Txt v="bold">{x.description}</Txt><Txt v="small">{new Date(x.paid_at).toLocaleDateString()} · {x.method === 'stripe' ? 'Card (Stripe)' : x.method}{x.status !== 'paid' ? ` · ${x.status}` : ''}</Txt></View>
              <Txt v="bold">{fmtMoney(x.amount_cents, x.currency)}</Txt>
            </View>))}</Card>}
          <Button kind="ghost" icon="payments" title="Record a payment" onPress={() => router.push('/financials')} style={{ alignSelf: 'flex-start' }} />
        </View>
      </ScrollView>
      <RefundSession charge={refunding} method={refunding?.payment_id ? pays.find((x) => x.id === refunding.payment_id)?.method ?? null : null}
        clientName={client?.first_name ?? 'them'} onClose={() => setRefunding(null)} onDone={() => { setRefunding(null); load(); }} />
    </View>
  );
}

/** Refund one session: back on the package, let go, back to the card, or recorded as given back. A reason is required. */
function RefundSession({ charge, method, clientName, onClose, onDone }: { charge: SessionCharge | null; method: string | null; clientName: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setReason(''); }, [charge?.id]);
  if (!charge) return null;
  const go = async () => {
    if (reason.trim().length < 3) return toast('Give a reason (it’s kept with the session)', false);
    setBusy(true);
    try {
      const { data, error } = await sb.rpc('coach_charge_refund', { p_charge: charge.id, p_reason: reason.trim() });
      let paymentId: string | null = null;
      if (error && /card_refund/.test(error.message)) {
        const out = await callFn<{ payment_id: string }>('coach-pay', { action: 'refund_session', charge_id: charge.id, reason: reason.trim() });
        paymentId = out.payment_id;
      } else if (error) throw error;
      else paymentId = (data as { payment_id?: string | null } | null)?.payment_id ?? null;
      const notice = paymentId ? ` ${await sendAdjustmentNotice(paymentId)}` : '';
      toast(`Refunded for ${clientName}.${notice}`); onDone();
    } catch (e) { toast(e instanceof Error && /^[a-z_]+$/.test(e.message) ? fnText(e) : errText(e), false); } finally { setBusy(false); }
  };
  return (
    <Sheet visible onClose={onClose} title="Refund this session">
      <View style={{ gap: 10 }}>
        <Txt v="bold">{new Date(charge.starts_at).toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Txt>
        <Txt>{refundPlan(charge, method)}</Txt>
        <Txt v="small">Your policy is no refunds, so this is your exception. It’s recorded with the reason and can’t be undone here.</Txt>
        <Field label="Reason *" value={reason} onChangeText={setReason} multiline placeholder="e.g. gym closed, my scheduling mistake" />
        <Button title="Refund" icon="undo" busy={busy} onPress={go} />
      </View>
    </Sheet>
  );
}
