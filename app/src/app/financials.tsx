import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Segmented, SectionLabel } from '@/components/bits';
import { Bars } from '@/components/charts';
import { DateField } from '@/components/date-field';
import { ClientPicker, Fab, matches, SearchBox, useClientList } from '@/components/pickers';
import { Badge } from '@/components/shell';
import { AdjustPayment, sendAdjustmentNotice, type AdjustKind } from '@/features/payment-adjust';
import { voidable } from '@/lib/adjust';
import { ActionMenu, Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Txt, useToast } from '@/components/ui';
import { confirm } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { byMonth, fmtMoney, monthShort, toCents, type Payment } from '@/lib/business';
import { dayKey } from '@/lib/dates';
import { callFn, fnText } from '@/lib/fn';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

type Tab = 'analytics' | 'payments' | 'subscriptions' | 'balance' | 'transfers';
type Sub = { id: string; status: string; client_id: string; package_id: string; amount_cents: number; interval: string | null; currency: string; current_period_end: number | null; cancel_at_period_end: boolean; created: number };
type Overview = { online: boolean; subscriptions?: Sub[]; balance?: { available: { amount: number; currency: string }[]; pending: { amount: number; currency: string }[] }; payouts?: { id: string; amount_cents: number; currency: string; status: string; arrival_date: number; created: number }[] };

/** Money: analytics, every payment (Stripe and recorded by hand), subscriptions, the Stripe balance and bank transfers */
export default function Financials() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const [tab, setTab] = useState<Tab>('analytics');
  const [pays, setPays] = useState<Payment[] | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [ovErr, setOvErr] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [q, setQ] = useState('');
  const [recording, setRecording] = useState(false);
  const [menu, setMenu] = useState<Payment | null>(null);
  const { clients } = useClientList();
  const name = useCallback((id: string | null) => (clients ?? []).find((c) => c.id === id)?.name ?? (id ? 'Client' : '—'), [clients]);

  const load = useCallback(async () => {
    const { data, error } = await sb.from('coach_payments').select('*').order('paid_at', { ascending: false }).limit(2000);
    if (error) toast(errText(error), false);
    setPays((data as Payment[]) ?? []);
  }, [toast]);
  const loadStripe = useCallback(async () => {
    try { setOv(await callFn<Overview>('coach-pay', { action: 'overview' })); setOvErr(null); } catch (e) { setOvErr(fnText(e)); }
  }, []);
  useFocusEffect(useCallback(() => { load(); loadStripe(); }, [load, loadStripe]));

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await callFn<{ recorded: number; online: boolean }>('coach-pay', { action: 'sync' });
      toast(r.online ? (r.recorded ? `${r.recorded} new Stripe payment${r.recorded === 1 ? '' : 's'} added` : 'Up to date with Stripe') : 'Online payments aren’t set up for this account');
      load(); loadStripe();
    } catch (e) { toast(fnText(e), false); } finally { setSyncing(false); }
  };

  const months = useMemo(() => byMonth(pays ?? [], 12), [pays]);
  const now = new Date(); const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const paid = (pays ?? []).filter((x) => x.status === 'paid');
  const total = paid.reduce((a, x) => a + x.amount_cents, 0);
  const month = months.find((m) => m.month === thisMonth)?.gross ?? 0;
  const subs = (ov?.subscriptions ?? []).filter((s) => s.status === 'active' || s.status === 'trialing');
  const mrr = subs.reduce((a, s) => a + (s.interval === 'year' ? s.amount_cents / 12 : s.interval === 'week' ? (s.amount_cents * 52) / 12 : s.amount_cents), 0);
  const list = (pays ?? []).filter((x) => matches(q, x.description, name(x.client_id), x.method, x.note));

  const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <Card style={{ flexGrow: 1, flexBasis: 150, gap: 2 }}><Txt v="small">{label}</Txt><Txt v="h2">{value}</Txt>{sub ? <Txt v="small">{sub}</Txt> : null}</Card>
  );
  const [adjust, setAdjust] = useState<{ p: Payment; kind: AdjustKind } | null>(null);
  const cancelSub = async (s: Sub) => {
    if (!(await confirm('Cancel this subscription?', `${name(s.client_id)} keeps access until the end of the period they’ve paid for, then it stops renewing.`, 'Cancel subscription', true))) return;
    try { await callFn('coach-pay', { action: 'cancel_subscription', subscription_id: s.id }); toast('Won’t renew'); loadStripe(); } catch (e) { toast(fnText(e), false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Financials', headerRight: () => <Button small kind="ghost" icon="sync" title="Sync Stripe" busy={syncing} onPress={sync} /> }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Segmented<Tab> value={tab} onChange={setTab} options={[['analytics', 'Analytics'], ['payments', 'Payments'], ['subscriptions', 'Subscriptions'], ['balance', 'Balance'], ['transfers', 'Transfers']]} />
          </ScrollView>
          {pays === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : tab === 'analytics' ? <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Stat label="This month" value={fmtMoney(month)} />
              <Stat label="All time" value={fmtMoney(total)} sub={`${paid.length} payment${paid.length === 1 ? '' : 's'}`} />
              <Stat label="Subscribers" value={ov?.online ? String(subs.length) : '–'} sub={ov?.online ? `${fmtMoney(Math.round(mrr))}/mo recurring` : undefined} />
            </View>
            <SectionLabel>Gross volume · last 12 months</SectionLabel>
            <Card><Bars label="Gross volume by month" data={months.map((m) => ({ label: monthShort(m.month)[0], v: m.gross / 100 }))} fmt={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)))} /></Card>
            <SectionLabel>Transactions</SectionLabel>
            <Card><Bars label="Transactions by month" color={p.gold} data={months.map((m) => ({ label: monthShort(m.month)[0], v: m.count }))} fmt={(v) => String(v)} /></Card>
            {paid.length === 0 && <Txt v="small" center>Payments show here when clients buy packages in their app, or when you record one.</Txt>}
          </> : tab === 'payments' ? <>
            <SearchBox value={q} onChange={setQ} placeholder="Search payments" />
            {list.length === 0 ? <Empty emoji="💳" title="No payments yet" body="Card payments through Stripe appear here automatically. Record cash, Venmo or other payments with the button below." />
              : <Card style={{ padding: 0 }}>
                {list.map((x, i) => (
                  <Pressable key={x.id} onPress={() => setMenu(x)} accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt v="bold">{x.description}</Txt>
                      <Txt v="small">{name(x.client_id)} · {new Date(x.paid_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {x.method === 'stripe' ? 'Card (Stripe)' : x.method}</Txt>
                      {x.status_reason ? <Txt v="small">{x.status === 'void' ? 'Voided' : x.status === 'refunded' ? 'Refunded' : 'Note'}: {x.status_reason}</Txt> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Txt v="h3" color={x.status === 'refunded' || x.status === 'void' ? p.muted : p.ink} style={x.status === 'refunded' || x.status === 'void' ? { textDecorationLine: 'line-through' } : undefined}>{fmtMoney(x.amount_cents, x.currency)}</Txt>
                      {x.status !== 'paid' && <Badge text={x.status} color={x.status === 'failed' ? p.danger : p.muted} />}
                    </View>
                  </Pressable>
                ))}
              </Card>}
          </> : !ov ? (ovErr ? <Empty emoji="🔌" title="Stripe isn’t connected" body={ovErr} /> : <ActivityIndicator color={p.ink} />)
            : !ov.online ? <Empty emoji="🔌" title="Online payments are off" body="This account records payments by hand. Card payments through Stripe are available to the Dragonfly owner’s team." />
            : tab === 'subscriptions' ? (
              (ov.subscriptions ?? []).length === 0 ? <Empty emoji="🔁" title="No subscriptions yet" body="Packages with a weekly, monthly or yearly price become subscriptions when clients buy them." />
                : <Card style={{ padding: 0 }}>
                  {(ov.subscriptions ?? []).map((s, i, a) => (
                    <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i === a.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt v="bold">{name(s.client_id)}</Txt>
                        <Txt v="small">{fmtMoney(s.amount_cents, s.currency)}/{s.interval ?? 'period'} · since {new Date(s.created * 1000).toLocaleDateString()}{s.current_period_end ? ` · ${s.cancel_at_period_end ? 'ends' : 'renews'} ${new Date(s.current_period_end * 1000).toLocaleDateString()}` : ''}</Txt>
                      </View>
                      <Badge text={s.cancel_at_period_end ? 'ending' : s.status} color={s.status === 'active' && !s.cancel_at_period_end ? p.good : p.muted} />
                      {s.status === 'active' && !s.cancel_at_period_end && <Button small kind="ghost" title="Cancel" onPress={() => cancelSub(s)} />}
                    </View>
                  ))}
                </Card>
            ) : tab === 'balance' ? (
              !ov.balance ? <Empty emoji="🔒" title="Only the account owner sees this" body="The Stripe balance and bank payouts belong to the business owner." />
                : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <Stat label="Available" value={ov.balance.available.map((b) => fmtMoney(b.amount, b.currency)).join(' + ') || fmtMoney(0)} sub="Ready to pay out" />
                  <Stat label="On the way" value={ov.balance.pending.map((b) => fmtMoney(b.amount, b.currency)).join(' + ') || fmtMoney(0)} sub="Still processing" />
                </View>
            ) : (
              !ov.payouts ? <Empty emoji="🔒" title="Only the account owner sees this" body="Bank transfers belong to the business owner." />
                : ov.payouts.length === 0 ? <Empty emoji="🏦" title="No transfers yet" body="Stripe sends your balance to your bank on a schedule. Transfers show here." />
                : <Card style={{ padding: 0 }}>
                  {ov.payouts.map((x, i, a) => (
                    <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i === a.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                      <View style={{ flex: 1 }}><Txt v="bold">To your bank</Txt><Txt v="small">Arrives {new Date(x.arrival_date * 1000).toLocaleDateString()}</Txt></View>
                      <Badge text={x.status.replace('_', ' ')} color={x.status === 'paid' ? p.good : x.status === 'failed' ? p.danger : p.muted} />
                      <Txt v="h3">{fmtMoney(x.amount_cents, x.currency)}</Txt>
                    </View>
                  ))}
                </Card>
            )}
        </View>
      </ScrollView>
      {(tab === 'payments' || tab === 'analytics') && <Fab title="Record a payment" onPress={() => setRecording(true)} />}
      <RecordSheet visible={recording} onClose={() => setRecording(false)} trainerId={app.trainer?.user_id ?? ''} onSaved={() => { setRecording(false); load(); }} />
      <ActionMenu visible={!!menu} onClose={() => setMenu(null)} title={menu ? `${menu.description} · ${fmtMoney(menu.amount_cents, menu.currency)}` : ''} items={menu ? [
        { label: menu.method === 'stripe' ? 'Refund to their card' : 'Record a refund', icon: 'undo', onPress: () => setAdjust({ p: menu, kind: 'refund' }), hidden: menu.status !== 'paid' },
        { label: 'Void (recorded by mistake)', icon: 'block', danger: true, onPress: () => setAdjust({ p: menu, kind: 'void' }), hidden: !voidable(menu) },
        { label: 'Email the receipt again', icon: 'mail', onPress: () => { void sendAdjustmentNotice(menu.id).then((m) => toast(m)); }, hidden: menu.status !== 'refunded' && menu.status !== 'void' },
      ] : []} />
      <AdjustPayment payment={adjust?.p ?? null} kind={adjust?.kind ?? 'refund'} clientName={adjust ? name(adjust.p.client_id) : ''}
        onClose={() => setAdjust(null)} onDone={() => { setAdjust(null); load(); }} />
    </View>
  );
}

function RecordSheet({ visible, onClose, trainerId, onSaved }: { visible: boolean; onClose: () => void; trainerId: string; onSaved: () => void }) {
  const toast = useToast();
  const { clients } = useClientList();
  const [client, setClient] = useState<string | null>(null);
  const [pick, setPick] = useState(false);
  const [desc, setDesc] = useState('Personal training');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer' | 'other'>('cash');
  const [day, setDay] = useState<string | null>(dayKey(new Date()));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const cents = toCents(amount);
    if (!cents) return toast('Enter the amount', false);
    if (!desc.trim()) return toast('Say what it was for', false);
    setBusy(true);
    const { error } = await sb.from('coach_payments').insert({ trainer_id: trainerId, client_id: client, description: desc.trim(), amount_cents: cents, method, note: note.trim() || null,
      paid_at: new Date(`${day ?? dayKey(new Date())}T12:00:00`).toISOString() });
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast(`${fmtMoney(cents)} recorded`); setAmount(''); setNote(''); onSaved();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Record a payment">
      <Button kind="ghost" icon="person" title={(clients ?? []).find((c) => c.id === client)?.name ?? 'Choose a client (optional)'} onPress={() => setPick(true)} style={{ alignSelf: 'flex-start', marginBottom: 14 }} />
      <Field label="What for" value={desc} onChangeText={setDesc} />
      <Field label="Amount ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {(['cash', 'card', 'transfer', 'other'] as const).map((m) => <Chip key={m} label={m === 'transfer' ? 'Bank / Venmo / Zelle' : m[0].toUpperCase() + m.slice(1)} selected={method === m} onPress={() => setMethod(m)} />)}
      </View>
      <DateField label="Date" value={day} onChange={setDay} max={dayKey(new Date())} />
      <Field label="Note" hint="(optional)" value={note} onChangeText={setNote} />
      <Button title="Save payment" icon="check" busy={busy} onPress={save} />
      <ClientPicker visible={pick} onClose={() => setPick(false)} single value={client ? [client] : []} onDone={(ids) => setClient(ids[0] ?? null)} />
    </Sheet>
  );
}
