import * as WebBrowser from 'expo-web-browser';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Cover } from '@/components/cover';
import { Badge } from '@/components/shell';
import { RefundPolicyNote } from '@/features/refund-policy-note';
import { Sheet } from '@/components/sheet';
import { Button, Card, Empty, Field, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { creditsLeft, fmtMoney, packageLive, priceLabel, type ClientPackage, type Package, type Payment } from '@/lib/business';
import { callFn, fnText } from '@/lib/fn';
import { store } from '@/lib/supabase';
import { sb } from '@/lib/supabase';
import { MAX_W, R, usePalette } from '@/lib/theme';

/** Client: what their trainer sells, their credits, and their payments */
export default function MyPackages() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const c = app.membership;
  const [pkgs, setPkgs] = useState<Package[] | null>(null);
  const [mine, setMine] = useState<ClientPackage[]>([]);
  const [pays, setPays] = useState<Payment[]>([]);
  const [buying, setBuying] = useState<Package | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!c) return;
    const [a, b, d] = await Promise.all([
      sb.from('coach_packages').select('*').eq('trainer_id', c.trainer_id).order('price_cents'),
      sb.from('coach_client_packages').select('*').eq('client_id', c.id).order('created_at', { ascending: false }),
      sb.from('coach_payments').select('*').eq('client_id', c.id).order('paid_at', { ascending: false }),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    setPkgs(((a.data as Package[]) ?? []).filter((x) => (!x.available_from || x.available_from <= today) && (!x.available_until || x.available_until >= today) && (!x.max_sales || x.sold < x.max_sales)));
    setMine((b.data as ClientPackage[]) ?? []); setPays((d.data as Payment[]) ?? []);
  }, [c]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const buy = async () => {
    if (!buying) return;
    setBusy(true);
    try {
      const r = await callFn<{ url: string; id: string }>('coach-pay', { action: 'checkout', package_id: buying.id, voucher: code.trim() || undefined });
      store('coach.lastCheckout', r.id);
      if (Platform.OS === 'web') { window.location.href = r.url; return; }
      await WebBrowser.openBrowserAsync(r.url);
      const s = await callFn<{ status: string }>('coach-pay', { action: 'confirm', session_id: r.id });
      if (s.status === 'recorded' || s.status === 'already') { toast('Payment received. Thank you!'); setBuying(null); load(); }
    } catch (e) { toast(fnText(e), false); } finally { setBusy(false); }
  };

  if (!c) return null;
  const live = mine.filter((x) => packageLive(x));
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Packages' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          {live.length > 0 && <>
            <SectionLabel>Your credits</SectionLabel>
            <Card style={{ padding: 0 }}>
              {live.map((x, i) => (
                <View key={x.id} style={{ padding: 14, gap: 2, borderBottomWidth: i === live.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                  <Txt v="bold">{x.name}</Txt>
                  <Txt v="small">{creditsLeft(x) == null ? 'Active' : `${creditsLeft(x)} of ${x.credits_total} credits left`}{x.expires_on ? ` · use by ${new Date(`${x.expires_on}T12:00:00`).toLocaleDateString()}` : ''}{x.billing !== 'once' ? ` · renews every ${x.billing}` : ''}</Txt>
                </View>
              ))}
            </Card>
          </>}
          <SectionLabel>{`From ${app.myTrainer?.display_name ?? 'your trainer'}`}</SectionLabel>
          {pkgs === null ? <ActivityIndicator color={p.ink} /> : pkgs.length === 0 ? <Empty emoji="🎁" title="Nothing on offer right now" body="When your trainer adds session packs or memberships, you can buy them here." />
            : pkgs.map((x) => (
              <Card key={x.id} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <View style={{ width: 84, height: 84, borderRadius: R.md, overflow: 'hidden' }}><Cover name={x.name} cover={x.cover} size={84} /></View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt v="h3">{x.name}</Txt>
                  {x.description ? <Txt v="small" numberOfLines={3}>{x.description}</Txt> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Txt v="bold">{priceLabel(x)}</Txt>
                    {x.credits ? <Badge text={`${x.credits} credit${x.credits === 1 ? '' : 's'}`} color={p.focus} /> : null}
                  </View>
                </View>
                <Button small title={x.price_cents ? 'Buy' : 'Ask'} onPress={() => (x.price_cents ? (setCode(''), setBuying(x)) : toast(`Ask ${app.myTrainer?.display_name ?? 'your trainer'} to add it for you`))} />
              </Card>
            ))}
          {pays.length > 0 && <>
            <SectionLabel>Payments</SectionLabel>
            <Card style={{ padding: 0 }}>
              {pays.map((x, i) => (
                <View key={x.id} style={{ flexDirection: 'row', padding: 14, gap: 10, borderBottomWidth: i === pays.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                  <View style={{ flex: 1 }}><Txt v="bold">{x.description}</Txt><Txt v="small">{new Date(x.paid_at).toLocaleDateString()}{x.status !== 'paid' ? ` · ${x.status}` : ''}</Txt></View>
                  <Txt v="bold">{fmtMoney(x.amount_cents, x.currency)}</Txt>
                </View>
              ))}
            </Card>
          </>}
        </View>
      </ScrollView>
      <Sheet visible={!!buying} onClose={() => setBuying(null)} title={buying?.name}>
        {buying && <>
          <Txt v="h2" style={{ marginBottom: 6 }}>{priceLabel(buying)}</Txt>
          {buying.description ? <Txt style={{ marginBottom: 12 }}>{buying.description}</Txt> : null}
          <Field label="Voucher code" hint="(optional)" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" />
          <Button title="Pay by card" icon="payments" busy={busy} onPress={buy} />
          <RefundPolicyNote trainerId={buying.trainer_id} packageId={buying.id} currency={buying.currency} />
          <Txt v="small" style={{ marginTop: 10 }}>Secure checkout by Stripe. {buying.billing !== 'once' ? `Renews every ${buying.billing} until you or your trainer cancel.` : ''}</Txt>
        </>}
      </Sheet>
    </View>
  );
}
