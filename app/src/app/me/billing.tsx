// The client's session payments: card on file, sessions not paid yet (pay now), and what pays for each coming session.
// Owner rules 2026-11-07: a package covers sessions first; otherwise a single session, paid by card when booked, or
// owed after it happens (and no more booking until it's paid).
import * as WebBrowser from 'expo-web-browser';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Button, Card, Txt, useToast } from '@/components/ui';
import { confirm } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { fmtMoney } from '@/lib/business';
import { callFn, fnText } from '@/lib/fn';
import { errText } from '@/lib/model';
import { cardText, chargeText, type Card as CardRow, type SessionCharge } from '@/lib/session-billing';
import { recall, sb, store } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

export default function MyBilling() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const c = app.membership;
  const [charges, setCharges] = useState<SessionCharge[] | null>(null);
  const [card, setCard] = useState<CardRow | null>(null);
  const [elsewhere, setElsewhere] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!c) return;
    const [a, k, t] = await Promise.all([
      sb.from('coach_session_charges').select('*').eq('client_id', c.id).in('status', ['due', 'pending', 'package', 'paid', 'credit']).order('starts_at').limit(60),
      sb.from('coach_client_cards').select('brand, last4, exp_month, exp_year').eq('client_id', c.id).maybeSingle(),
      sb.from('coach_trainers').select('session_billing').eq('user_id', c.trainer_id).maybeSingle(),
    ]);
    if (a.error) toast(errText(a.error), false);
    setCharges((a.data as SessionCharge[]) ?? []); setCard((k.data as CardRow | null) ?? null);
    setElsewhere((t.data as { session_billing?: string } | null)?.session_billing === 'external');
  }, [c, toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Back from Stripe (web): record the card or payment
  const { card: cardSession, paid, acct } = useLocalSearchParams<{ card?: string; paid?: string; acct?: string }>();
  useEffect(() => {
    const id = cardSession ?? paid ?? null;
    if (!id || !/^cs_/.test(id) || id !== recall<string | null>('coach.lastCheckout', null)) return;
    callFn<{ status: string }>('coach-pay', { action: 'confirm', session_id: id, account: acct || undefined })
      .then((r) => { if (r.status !== 'unpaid') toast(cardSession ? 'Card saved' : 'Payment received. Thank you!'); router.replace('/me/billing'); load(); })
      .catch((e) => toast(fnText(e), false));
  }, [cardSession, paid, acct, toast, load]);

  if (!c) return null;
  const go = async (action: 'save_card' | 'pay_due') => {
    setBusy(action);
    try {
      const r = await callFn<{ url: string; id: string }>('coach-pay', { action, trainer_id: c.trainer_id });
      store('coach.lastCheckout', r.id);
      if (Platform.OS === 'web') { window.location.href = r.url; return; }
      await WebBrowser.openBrowserAsync(r.url);
      const acctParam = /acct=(acct_[A-Za-z0-9]+)/.exec(r.url)?.[1];
      const s = await callFn<{ status: string }>('coach-pay', { action: 'confirm', session_id: r.id, account: acctParam });
      if (s.status !== 'unpaid') toast(action === 'save_card' ? 'Card saved' : 'Payment received. Thank you!');
      load();
    } catch (e) { toast(/online_payments_off/.test(String(e)) ? 'Your trainer doesn’t take card payments in the app yet. Pay them directly.' : fnText(e), false); } finally { setBusy(null); }
  };
  const removeCard = async () => {
    if (!(await confirm('Remove your card?', 'Single sessions won’t be charged automatically. You’ll pay for each one after it happens.', 'Remove card', true))) return;
    const { error } = await sb.from('coach_client_cards').delete().eq('client_id', c.id);
    if (error) toast(errText(error), false); else { setCard(null); toast('Card removed'); }
  };

  const due = (charges ?? []).filter((x) => x.status === 'due');
  const owed = due.reduce((t, x) => t + (x.amount_cents ?? 0), 0);
  const coming = (charges ?? []).filter((x) => x.status !== 'due' && new Date(x.starts_at) > new Date());
  const when = (x: SessionCharge) => new Date(x.starts_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Session payments' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          {charges === null ? <ActivityIndicator color={p.ink} /> : elsewhere ? (
            <Card><Txt>Your sessions are paid through {app.myTrainer?.display_name ?? 'your trainer'}’s club or gym, not in this app.</Txt></Card>
          ) : <>
            <Txt v="small">Sessions use your package first. Without one, each session is charged at your trainer’s single-session price: to your card when it’s booked, or paid after it happens. An unpaid session needs paying before you book another.</Txt>
            {due.length > 0 && (
              <Card style={{ gap: 8 }}>
                <Txt v="h3">Not paid yet · {fmtMoney(owed, due[0].currency)}</Txt>
                {due.map((x) => <Txt key={x.id} v="small">{when(x)}</Txt>)}
                <Button title="Pay now" icon="payments" busy={busy === 'pay_due'} onPress={() => go('pay_due')} />
                <Txt v="small">Buying a package also covers these.</Txt>
              </Card>
            )}
            <SectionLabel>Card on file</SectionLabel>
            <Card style={{ gap: 8 }}>
              {card ? <>
                <Txt v="bold">{cardText(card)}</Txt>
                <Txt v="small">Single sessions are charged to this card when they’re booked.</Txt>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button small kind="ghost" title="Replace card" busy={busy === 'save_card'} onPress={() => go('save_card')} />
                  <Button small kind="danger" title="Remove" onPress={removeCard} />
                </View>
              </> : <>
                <Txt v="small">Save a card so single sessions are paid when you book. Stripe keeps the card details, not this app.</Txt>
                <Button small title="Add a card" icon="credit_card" busy={busy === 'save_card'} onPress={() => go('save_card')} style={{ alignSelf: 'flex-start' }} />
              </>}
            </Card>
            <SectionLabel>Coming up</SectionLabel>
            {coming.length === 0 ? <Txt v="small">No sessions booked.</Txt> : (
              <Card style={{ padding: 0 }}>
                {coming.map((x, i) => (
                  <View key={x.id} style={{ padding: 14, borderBottomWidth: i === coming.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                    <Txt v="bold">{when(x)}</Txt>
                    <Txt v="small">{chargeText(x, !!card)}</Txt>
                  </View>
                ))}
              </Card>
            )}
            <Button kind="ghost" icon="redeem" title="Packages" onPress={() => router.push('/me/packages')} style={{ alignSelf: 'flex-start' }} />
          </>}
        </View>
      </ScrollView>
    </View>
  );
}
