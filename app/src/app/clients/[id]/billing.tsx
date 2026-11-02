import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Badge } from '@/components/shell';
import { Button, Card, Empty, Txt, useToast } from '@/components/ui';
import { useClientRecord } from '@/features/common';
import { confirm } from '@/lib/ask';
import { creditsLeft, fmtMoney, packageLive, type ClientPackage, type Payment } from '@/lib/business';
import { errText } from '@/lib/model';
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
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([sb.from('coach_client_packages').select('*').eq('client_id', id).order('created_at', { ascending: false }), sb.from('coach_payments').select('*').eq('client_id', id).order('paid_at', { ascending: false })]);
    setPkgs((a.data as ClientPackage[]) ?? []); setPays((b.data as Payment[]) ?? []);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
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
          <SectionLabel>Payments</SectionLabel>
          {pays.length === 0 ? <Txt v="small">No payments recorded.</Txt> : <Card style={{ padding: 0 }}>{pays.map((x, i) => (
            <View key={x.id} style={{ flexDirection: 'row', padding: 14, gap: 10, borderBottomWidth: i === pays.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
              <View style={{ flex: 1 }}><Txt v="bold">{x.description}</Txt><Txt v="small">{new Date(x.paid_at).toLocaleDateString()} · {x.method === 'stripe' ? 'Card (Stripe)' : x.method}{x.status !== 'paid' ? ` · ${x.status}` : ''}</Txt></View>
              <Txt v="bold">{fmtMoney(x.amount_cents, x.currency)}</Txt>
            </View>))}</Card>}
          <Button kind="ghost" icon="payments" title="Record a payment" onPress={() => router.push('/financials')} style={{ alignSelf: 'flex-start' }} />
        </View>
      </ScrollView>
    </View>
  );
}
