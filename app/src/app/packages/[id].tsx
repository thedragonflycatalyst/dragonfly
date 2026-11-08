import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { DateField } from '@/components/date-field';
import { ClientPicker, Toggle, useClientList } from '@/components/pickers';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Field, Txt, useToast } from '@/components/ui';
import { CoverPicker } from '@/features/cover-picker';
import { confirm } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { BILLING, fmtMoney, priceLabel, toCents, type Billing, type Package } from '@/lib/business';
import { addDays, dayKey } from '@/lib/dates';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

type Tab = 'details' | 'included' | 'availability' | 'pricing';
const blank = (trainer: string): Package => ({ id: '', trainer_id: trainer, name: '', description: null, cover: null, price_cents: 0, currency: 'usd', billing: 'once', credits: null,
  valid_days: null, program_ids: [], plan_ids: [], visible: true, client_ids: [], available_from: null, available_until: null, max_sales: null, sold: 0, archived: false, created_at: '' });

/** Create or edit a package: details, what's included, who can buy it and when, and the price */
export default function PackageEditor() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [pkg, setPkg] = useState<Package | null>(isNew ? blank(app.trainer?.user_id ?? '') : null);
  const [tab, setTab] = useState<Tab>('details');
  const [price, setPrice] = useState('');
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState(false);
  const [give, setGive] = useState(false);
  const { clients } = useClientList();

  useEffect(() => {
    (async () => {
      const [a, b, c] = await Promise.all([
        isNew ? Promise.resolve({ data: null }) : sb.from('coach_packages').select('*').eq('id', id).maybeSingle(),
        sb.from('coach_programs').select('id,name').eq('archived', false).order('name'),
        sb.from('coach_nutrition_plans').select('id,name').eq('archived', false).order('name'),
      ]);
      if (!isNew) { const x = a.data as Package | null; setPkg(x); setPrice(x ? String(x.price_cents / 100) : ''); }
      setPrograms((b.data as { id: string; name: string }[]) ?? []); setPlans((c.data as { id: string; name: string }[]) ?? []);
    })();
  }, [id, isNew]);

  if (!pkg) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}>{pkg === null && !isNew ? <ActivityIndicator color={p.ink} /> : null}</View>;
  const set = (patch: Partial<Package>) => setPkg({ ...pkg, ...patch });
  const intOrNull = (s: string, lo: number, hi: number) => { if (!s.trim()) return null; const n = Number(s); return Number.isInteger(n) && n >= lo && n <= hi ? n : NaN; };

  const save = async () => {
    if (!pkg.name.trim()) { setTab('details'); return toast('Name the package', false); }
    const cents = price.trim() ? toCents(price) : 0;
    if (cents == null) { setTab('pricing'); return toast('Enter a price like 120 or 99.50', false); }
    if ([pkg.credits, pkg.valid_days, pkg.max_sales].some((n) => Number.isNaN(n))) return toast('Check the numbers: whole numbers only', false);
    setBusy(true);
    const row = { ...pkg, price_cents: cents, name: pkg.name.trim() } as Partial<Package>;
    delete row.id; delete row.created_at; delete row.sold;
    const { data, error } = isNew ? await sb.from('coach_packages').insert(row).select('id').single() : await sb.from('coach_packages').update(row).eq('id', pkg.id).select('id').single();
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast('Package saved');
    if (isNew) router.replace({ pathname: '/packages/[id]', params: { id: data.id } }); else setPkg({ ...pkg, price_cents: cents });
  };
  const archive = async () => {
    const { error } = await sb.from('coach_packages').update({ archived: !pkg.archived }).eq('id', pkg.id);
    if (error) return toast(errText(error), false);
    toast(pkg.archived ? 'Back in your packages' : 'Archived. Clients who bought it keep their credits.'); router.back();
  };
  const remove = async () => {
    if (!(await confirm(`Delete ${pkg.name}?`, 'Clients who bought it keep their credits and payment records.', 'Delete', true))) return;
    const { error } = await sb.from('coach_packages').delete().eq('id', pkg.id);
    if (error) return toast(errText(error), false);
    router.back();
  };
  const toggleIn = (key: 'program_ids' | 'plan_ids', v: string) => set({ [key]: pkg[key].includes(v) ? pkg[key].filter((x) => x !== v) : [...pkg[key], v] } as Partial<Package>);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: isNew ? 'New package' : pkg.name, headerRight: () => <Button small title="Save" busy={busy} onPress={save} /> }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 720, gap: 12 }}>
          <Segmented<Tab> value={tab} onChange={setTab} options={[['details', 'Details'], ['included', 'Included'], ['availability', 'Availability'], ['pricing', 'Pricing']]} />
          {tab === 'details' && <Card>
            <Field label="Name" value={pkg.name} onChangeText={(name) => set({ name })} placeholder="10 PT sessions" />
            <Field label="Description" hint="(what clients see)" value={pkg.description ?? ''} onChangeText={(d) => set({ description: d || null })} multiline placeholder="Ten 60-minute sessions, use within 3 months." />
            <Txt v="bold" style={{ marginBottom: 8 }}>Cover art</Txt>
            <CoverPicker name={pkg.name || 'Package'} value={pkg.cover} trainerId={pkg.trainer_id} onChange={(cover) => set({ cover })} />
          </Card>}
          {tab === 'included' && <>
            <Card>
              <Txt v="h3">Session or class credits</Txt>
              <Txt v="small" style={{ marginBottom: 10 }}>Each credit books one session or class. Leave blank for none (e.g. a program-only package).</Txt>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="Credits" value={pkg.credits == null ? '' : String(pkg.credits)} onChangeText={(t) => set({ credits: intOrNull(t, 1, 1000) })} keyboardType="number-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Use within (days)" value={pkg.valid_days == null ? '' : String(pkg.valid_days)} onChangeText={(t) => set({ valid_days: intOrNull(t, 1, 3650) })} keyboardType="number-pad" placeholder="No limit" /></View>
              </View>
              {pkg.billing !== 'once' && <Txt v="small">With a recurring price, clients get these credits each {pkg.billing}.</Txt>}
              <Txt v="smallBold">Refunds</Txt>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {([[null, 'My refund policy'], ['none', 'Non-refundable'], ['unused_only', 'Only if unused'], ['prorated', 'Unused sessions']] as [Package['refund_mode'], string][]).map(([m, label]) => (
                  <Chip key={label} label={label} selected={(pkg.refund_mode ?? null) === m} onPress={() => set({ refund_mode: m })} />
                ))}
              </View>
              <Txt v="small">Shown to clients before they buy. Set your usual policy in Settings → Refund policy.</Txt>
            </Card>
            <Card>
              <Txt v="h3">Programs</Txt>
              <Txt v="small" style={{ marginBottom: 10 }}>Assigned automatically, starting the Monday after they buy.</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {programs.length ? programs.map((x) => <Chip key={x.id} label={x.name} selected={pkg.program_ids.includes(x.id)} onPress={() => toggleIn('program_ids', x.id)} />) : <Txt v="small">No programs yet.</Txt>}
              </View>
            </Card>
            <Card>
              <Txt v="h3">Nutrition plans</Txt>
              <Txt v="small" style={{ marginBottom: 10 }}>Shared with them when they buy.</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {plans.length ? plans.map((x) => <Chip key={x.id} label={x.name} selected={pkg.plan_ids.includes(x.id)} onPress={() => toggleIn('plan_ids', x.id)} />) : <Txt v="small">No nutrition plans yet.</Txt>}
              </View>
            </Card>
          </>}
          {tab === 'availability' && <Card>
            <Toggle label="Clients can see and buy it" sub="Off: only you can give it to clients" value={pkg.visible} onChange={(visible) => set({ visible })} />
            {pkg.visible && <>
              <Txt v="bold" style={{ marginTop: 10, marginBottom: 6 }}>Who can see it</Txt>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <Chip label="All my clients" selected={!pkg.client_ids.length} onPress={() => set({ client_ids: [] })} />
                <Chip label={pkg.client_ids.length ? `${pkg.client_ids.length} chosen` : 'Only some clients'} selected={!!pkg.client_ids.length} onPress={() => setWho(true)} />
              </View>
              <DateField label="On sale from" optional value={pkg.available_from} onChange={(d) => set({ available_from: d })} />
              <DateField label="On sale until" optional value={pkg.available_until} onChange={(d) => set({ available_until: d })} min={pkg.available_from ?? undefined} />
              <Field label="Maximum sold" hint="(optional, e.g. 12 spots)" value={pkg.max_sales == null ? '' : String(pkg.max_sales)} onChangeText={(t) => set({ max_sales: intOrNull(t, 1, 100000) })} keyboardType="number-pad" />
            </>}
          </Card>}
          {tab === 'pricing' && <Card>
            <Field label="Price ($)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0 for free" />
            <Txt v="bold" style={{ marginBottom: 8 }}>Billing</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {(Object.keys(BILLING) as Billing[]).map((b) => <Chip key={b} label={BILLING[b]} selected={pkg.billing === b} onPress={() => set({ billing: b })} />)}
            </View>
            <Txt v="small">Clients pay by card through Stripe in their app. Recurring packages renew automatically until cancelled. You can also give a package and record cash, Venmo or card payments yourself.</Txt>
          </Card>}

          {!isNew && <>
            <Button kind="accent" icon="person_add" title="Give to a client" onPress={() => setGive(true)} />
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Button kind="ghost" icon="archive" title={pkg.archived ? 'Restore' : 'Archive'} onPress={archive} />
              <Button kind="danger" icon="delete" title="Delete" onPress={remove} />
            </View>
            <Txt v="small">{pkg.sold} sold · {priceLabel({ ...pkg, price_cents: toCents(price) ?? pkg.price_cents })}</Txt>
          </>}
          {isNew && <Button title="Create package" icon="check" busy={busy} onPress={save} />}
        </View>
      </ScrollView>
      <ClientPicker visible={who} onClose={() => setWho(false)} title="Who can see it" value={pkg.client_ids} onDone={(ids) => set({ client_ids: ids })} />
      <GiveSheet visible={give} onClose={() => setGive(false)} pkg={pkg} clients={clients ?? []} />
    </View>
  );
}

/** Give a package to a client and (optionally) record how they paid */
function GiveSheet({ visible, onClose, pkg, clients }: { visible: boolean; onClose: () => void; pkg: Package; clients: { id: string; name: string }[] }) {
  const toast = useToast();
  const [client, setClient] = useState<string | null>(null);
  const [pick, setPick] = useState(false);
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer' | 'other' | 'free'>('cash');
  const [amount, setAmount] = useState(String(pkg.price_cents / 100));
  const [starts, setStarts] = useState<string | null>(dayKey(new Date()));
  const [busy, setBusy] = useState(false);
  const name = clients.find((c) => c.id === client)?.name;
  const go = async () => {
    if (!client) return toast('Choose a client', false);
    const cents = method === 'free' ? 0 : toCents(amount);
    if (cents == null) return toast('Enter the amount paid', false);
    setBusy(true);
    try {
      let payment: string | null = null;
      if (method !== 'free') {
        const { data, error } = await sb.from('coach_payments').insert({ trainer_id: pkg.trainer_id, client_id: client, package_id: pkg.id, description: pkg.name, amount_cents: cents, method }).select('id').single();
        if (error) throw error; payment = data.id;
      }
      const s = starts ?? dayKey(new Date());
      const { error } = await sb.from('coach_client_packages').insert({ trainer_id: pkg.trainer_id, client_id: client, package_id: pkg.id, name: pkg.name, credits_total: pkg.credits,
        starts_on: s, expires_on: pkg.valid_days ? dayKey(addDays(new Date(`${s}T12:00:00`), pkg.valid_days)) : null, billing: pkg.billing, payment_id: payment });
      if (error) throw error;
      for (const prog of pkg.program_ids) await sb.rpc('coach_assign_program', { p_program: prog, p_client: client, p_start: s });
      for (const plan of pkg.plan_ids) await sb.from('coach_nutrition_plan_clients').upsert({ plan_id: plan, client_id: client, trainer_id: pkg.trainer_id }, { onConflict: 'plan_id,client_id' });
      toast(`${pkg.name} given to ${name}${method !== 'free' ? ` · ${fmtMoney(cents)} recorded` : ''}`); onClose();
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Give to a client">
      <Button kind="ghost" icon="person" title={name ?? 'Choose a client'} onPress={() => setPick(true)} style={{ alignSelf: 'flex-start', marginBottom: 14 }} />
      <Txt v="bold" style={{ marginBottom: 8 }}>How they paid</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {(['cash', 'card', 'transfer', 'other', 'free'] as const).map((m) => <Chip key={m} label={m === 'transfer' ? 'Bank / Venmo / Zelle' : m === 'free' ? 'No charge' : m[0].toUpperCase() + m.slice(1)} selected={method === m} onPress={() => setMethod(m)} />)}
      </View>
      {method !== 'free' && <Field label="Amount ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />}
      <DateField label="Starts" value={starts} onChange={setStarts} />
      <Button title="Give package" icon="check" busy={busy} onPress={go} />
      <ClientPicker visible={pick} onClose={() => setPick(false)} single value={client ? [client] : []} onDone={(ids) => setClient(ids[0] ?? null)} />
    </Sheet>
  );
}
