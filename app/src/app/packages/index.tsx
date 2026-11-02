import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { Cover } from '@/components/cover';
import { DateField } from '@/components/date-field';
import { Fab, matches, SearchBox, Toggle } from '@/components/pickers';
import { Badge } from '@/components/shell';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Txt, useToast } from '@/components/ui';
import { confirm } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { fmtMoney, priceLabel, toCents, voucherCode, voucherState, type Package, type Voucher } from '@/lib/business';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, R, usePalette } from '@/lib/theme';

/** Packages (what clients buy: session packs, memberships, programs) and voucher codes */
export default function Packages() {
  const p = usePalette();
  const toast = useToast();
  const [tab, setTab] = useState<'packages' | 'vouchers'>('packages');
  const [shelf, setShelf] = useState<'current' | 'archived'>('current');
  const [pkgs, setPkgs] = useState<Package[] | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[] | null>(null);
  const [q, setQ] = useState('');
  const [voucher, setVoucher] = useState<Voucher | 'new' | null>(null);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([sb.from('coach_packages').select('*').order('created_at', { ascending: false }), sb.from('coach_vouchers').select('*').order('created_at', { ascending: false })]);
    if (a.error) toast(errText(a.error), false);
    setPkgs((a.data as Package[]) ?? []); setVouchers((b.data as Voucher[]) ?? []);
  }, [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = (pkgs ?? []).filter((x) => x.archived === (shelf === 'archived') && matches(q, x.name, x.description));
  const vlist = (vouchers ?? []).filter((v) => (shelf === 'archived') === (voucherState(v) !== 'active') && matches(q, v.code, v.description));
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Packages' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <Segmented value={tab} onChange={setTab} options={[['packages', 'Packages'], ['vouchers', 'Vouchers']]} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Current" selected={shelf === 'current'} onPress={() => setShelf('current')} />
            <Chip label={tab === 'packages' ? 'Archived' : 'Expired or off'} selected={shelf === 'archived'} onPress={() => setShelf('archived')} />
          </View>
          <SearchBox value={q} onChange={setQ} placeholder={tab === 'packages' ? 'Search packages' : 'Search codes'} />
          {pkgs === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : tab === 'packages' ? (
            list.length === 0 ? <Empty emoji="🎁" title={shelf === 'archived' ? 'Nothing archived' : 'Create your first package'}
              body="A package is anything clients pay for: 10 PT sessions, a monthly membership, an 8-week program with nutrition. Clients can buy it in their app, or you give it to them and record the payment." />
              : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {list.map((x) => (
                  <Pressable key={x.id} accessibilityRole="link" accessibilityLabel={x.name} onPress={() => router.push({ pathname: '/packages/[id]', params: { id: x.id } })}
                    style={({ pressed }) => ({ flexGrow: 1, flexBasis: 160, maxWidth: 320, gap: 8, opacity: pressed ? 0.8 : 1 })}>
                    <View style={{ aspectRatio: 16 / 10, borderRadius: R.md, overflow: 'hidden', alignItems: 'stretch' }}><Cover name={x.name} cover={x.cover} size={320} /></View>
                    <View style={{ gap: 2 }}>
                      <Txt v="bold" numberOfLines={2}>{x.name}</Txt>
                      <Txt v="small">{priceLabel(x)}{x.credits ? ` · ${x.credits} credit${x.credits === 1 ? '' : 's'}` : ''} · {x.sold} sold</Txt>
                      {!x.visible && <Badge text="Hidden from clients" />}
                    </View>
                  </Pressable>
                ))}
              </View>
          ) : (
            vlist.length === 0 ? <Empty emoji="🏷️" title={shelf === 'archived' ? 'None here' : 'No voucher codes yet'} body="Codes take money or a percentage off packages at checkout, like WELCOME10 for new clients." />
              : <Card style={{ padding: 0 }}>
                {vlist.map((v, i) => (
                  <Pressable key={v.id} onPress={() => setVoucher(v)} accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i === vlist.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt v="h3">{v.code}</Txt>
                      <Txt v="small">{v.percent_off ? `${v.percent_off}% off` : `${fmtMoney(v.amount_off_cents ?? 0)} off`} · used {v.uses}{v.max_uses ? ` of ${v.max_uses}` : ''}{v.expires_on ? ` · until ${v.expires_on}` : ''}</Txt>
                    </View>
                    <Badge text={voucherState(v)} color={voucherState(v) === 'active' ? p.good : p.muted} />
                  </Pressable>
                ))}
              </Card>
          )}
        </View>
      </ScrollView>
      <Fab title={tab === 'packages' ? 'Create package' : 'Create voucher'} onPress={() => tab === 'packages' ? router.push({ pathname: '/packages/[id]', params: { id: 'new' } }) : setVoucher('new')} />
      <VoucherSheet v={voucher} packages={pkgs ?? []} onClose={() => setVoucher(null)} onSaved={() => { setVoucher(null); load(); }} />
    </View>
  );
}

function VoucherSheet({ v, packages, onClose, onSaved }: { v: Voucher | 'new' | null; packages: Package[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const app = useApp();
  const ed = v && v !== 'new' ? v : null;
  const [open, setOpen] = useState<typeof v>(null);
  const [code, setCode] = useState(''); const [desc, setDesc] = useState(''); const [kind, setKind] = useState<'pct' | 'amt'>('pct');
  const [amount, setAmount] = useState(''); const [max, setMax] = useState(''); const [until, setUntil] = useState<string | null>(null);
  const [only, setOnly] = useState<string[]>([]); const [active, setActive] = useState(true); const [busy, setBusy] = useState(false);
  if (v !== open) {
    setOpen(v);
    setCode(ed?.code ?? ''); setDesc(ed?.description ?? ''); setKind(ed?.amount_off_cents ? 'amt' : 'pct');
    setAmount(ed ? String(ed.percent_off ?? (ed.amount_off_cents ?? 0) / 100) : ''); setMax(ed?.max_uses ? String(ed.max_uses) : '');
    setUntil(ed?.expires_on ?? null); setOnly(ed?.package_ids ?? []); setActive(ed?.active ?? true);
  }
  const save = async () => {
    const c = voucherCode(code);
    if (c.length < 3) return toast('Codes need at least 3 letters or numbers', false);
    const pct = kind === 'pct' ? Number(amount) : null, cents = kind === 'amt' ? toCents(amount) : null;
    if (kind === 'pct' && !(Number.isInteger(pct) && pct! >= 1 && pct! <= 100)) return toast('Use 1 to 100 percent', false);
    if (kind === 'amt' && !cents) return toast('Enter an amount', false);
    const m = max ? Number(max) : null;
    if (m != null && !(Number.isInteger(m) && m > 0)) return toast('Uses must be a whole number', false);
    setBusy(true);
    const row = { trainer_id: app.trainer?.user_id, code: c, description: desc.trim() || null, percent_off: pct, amount_off_cents: cents, max_uses: m, expires_on: until, package_ids: only, active };
    const { error } = ed ? await sb.from('coach_vouchers').update(row).eq('id', ed.id) : await sb.from('coach_vouchers').insert(row);
    setBusy(false);
    if (error) return toast(/duplicate|unique/.test(error.message) ? 'You already have that code' : errText(error), false);
    toast('Voucher saved'); onSaved();
  };
  const remove = async () => {
    if (!ed || !(await confirm(`Delete ${ed.code}?`, 'Clients won’t be able to use it.', 'Delete', true))) return;
    await sb.from('coach_vouchers').delete().eq('id', ed.id); onSaved();
  };
  return (
    <Sheet visible={!!v} onClose={onClose} title={ed ? 'Edit voucher' : 'New voucher'}>
      <Field label="Code" value={code} onChangeText={(t) => setCode(voucherCode(t))} autoCapitalize="characters" placeholder="WELCOME10" />
      <Field label="Description" hint="(optional)" value={desc} onChangeText={setDesc} placeholder="New client offer" />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <Chip label="Percent off" selected={kind === 'pct'} onPress={() => setKind('pct')} />
        <Chip label="Amount off" selected={kind === 'amt'} onPress={() => setKind('amt')} />
      </View>
      <Field label={kind === 'pct' ? 'Percent' : 'Amount ($)'} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Field label="Maximum uses" hint="(optional)" value={max} onChangeText={setMax} keyboardType="number-pad" />
      <DateField label="Expires" optional value={until} onChange={setUntil} />
      {packages.filter((x) => !x.archived).length > 0 && <>
        <Txt v="bold" style={{ marginBottom: 6 }}>Works on</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <Chip label="All packages" selected={!only.length} onPress={() => setOnly([])} />
          {packages.filter((x) => !x.archived).map((x) => <Chip key={x.id} label={x.name} selected={only.includes(x.id)} onPress={() => setOnly((o) => (o.includes(x.id) ? o.filter((y) => y !== x.id) : [...o, x.id]))} />)}
        </View>
      </>}
      <Toggle label="Active" value={active} onChange={setActive} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Button title="Save" icon="check" busy={busy} onPress={save} />
        {ed && <Button kind="danger" icon="delete" title="Delete" onPress={remove} />}
      </View>
    </Sheet>
  );
}
