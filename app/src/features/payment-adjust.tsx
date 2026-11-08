// Refund or void a payment (owner decision, Nov 6 2026: payments are never deleted). A reason is always required; the client
// is emailed a refund / void notice by the website (server side, never from the device).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Field, Txt, useToast } from '@/components/ui';
import { fmtMoney, type Payment } from '@/lib/business';
import { callFn, fnText } from '@/lib/fn';
import { cleanReason, postNotice, runAdjustment, type AdjustKind } from '@/lib/adjust';
import { errText } from '@/lib/model';
import { quoteText, toCentsInput, type RefundQuote } from '@/lib/refunds';
import { sb } from '@/lib/supabase';

/** Asks the website to email the client a refund or void notice (Charlie's coach-adjust endpoint; no resend guard there, so the
 *  app calls it once per adjustment and again only on an explicit "Email the receipt again"). Resolves to a short status line. */
export async function sendAdjustmentNotice(paymentId: string): Promise<string> {
  return (await postNotice(paymentId, await currentToken(), fetch)).text;
}

async function currentToken() {
  const { data } = await sb.auth.getSession();
  return data.session?.access_token;
}

export type { AdjustKind };

/** Refund (money given back) or void (recorded by mistake), with a required reason */
export function AdjustPayment({ payment, kind, clientName, onClose, onDone }: {
  payment: Payment | null; kind: AdjustKind; clientName: string; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<RefundQuote | null>(null);
  const [amount, setAmount] = useState('');
  useEffect(() => {
    setReason(''); setQuote(null); setAmount('');
    if (!payment || kind !== 'refund') return;
    void sb.rpc('coach_refund_quote', { p_payment: payment.id }).then(({ data }) => {
      const q = data as RefundQuote | null;
      setQuote(q);
      if (q) setAmount(((q.refundable ? q.suggested_cents : 0) / 100).toFixed(2));
    });
  }, [payment, kind]);
  if (!payment) return null;
  const card = payment.method === 'stripe' && kind === 'refund';
  const cents = toCentsInput(amount);
  const outside = kind === 'refund' && !!quote && (!quote.refundable || (cents ?? 0) > quote.suggested_cents);
  const go = async () => {
    if (!cleanReason(reason)) return toast('Give a reason (it goes on the client’s receipt)', false);
    setBusy(true);
    try {
      const r = await runAdjustment(payment, kind, reason, {
        refundCard: async (id, why, amountCents) => { await callFn('coach-pay', { action: 'refund', payment_id: id, reason: why, amount_cents: amountCents }); },
        setStatus: async (id, status, why, refundedCents) => {
          const patch = status === 'refunded' ? { status, status_reason: why, refunded_cents: refundedCents } : { status, status_reason: why };
          const { error } = await sb.from('coach_payments').update(patch).eq('id', id);
          if (error) throw error;
        },
        getToken: currentToken,
        fetchFn: fetch,
      }, kind === 'refund' ? { cents, maxCents: quote?.max_cents ?? payment.amount_cents, outsidePolicy: outside } : undefined);
      if (r.ok) { toast(`${kind === 'refund' ? 'Refunded' : 'Voided'}. ${r.notice.text}`); onDone(); }
      else if (r.problem === 'amount') toast(`Enter an amount up to ${fmtMoney(quote?.max_cents ?? payment.amount_cents, payment.currency)}`, false);
      else if (r.problem === 'policy_reason') toast('This is outside your refund policy. Say why in the reason.', false);
      else if (r.problem === 'not_allowed') toast(kind === 'refund' ? 'Only a paid payment can be refunded.' : 'Card payments are refunded, not voided. Only a pending or hand-recorded payment can be voided.', false);
      else toast(card ? fnText(r.error) : errText(r.error), false);
    } finally { setBusy(false); }
  };
  return (
    <Sheet visible onClose={onClose} title={kind === 'refund' ? `Refund (paid ${fmtMoney(payment.amount_cents, payment.currency)})` : 'Void this payment'}>
      <View style={{ gap: 10 }}>
        <Txt>{kind === 'refund'
          ? card ? `${clientName} gets the money back on their card.` : `Record that you gave ${clientName} the money back (by ${payment.method}). This doesn’t move money for you.`
          : `Use this when the payment was recorded by mistake. It stays in your records, marked void.`}</Txt>
        <Txt v="small">Payments are kept for 7 years and can’t be deleted. A refund closes the package it bought (sessions already used stay on record).</Txt>
        {kind === 'refund' && quote && <Txt v="smallBold">{quoteText(quote, payment.currency)}</Txt>}
        {kind === 'refund' && <Field label="Amount to refund" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />}
        {outside && <Txt v="small">This is more than your refund policy allows. You can still go ahead, but say why below; it’s recorded.</Txt>}
        <Field label="Reason *" hint="(on the client’s receipt)" value={reason} onChangeText={setReason} multiline
          placeholder={kind === 'refund' ? 'Session cancelled, injury, changed plans…' : 'Entered twice, wrong client, wrong amount…'} />
        <Button title={kind === 'refund' ? 'Refund and email receipt' : 'Void and email notice'} busy={busy} onPress={go} />
      </View>
    </Sheet>
  );
}
