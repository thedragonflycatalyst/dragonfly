// Refund or void a payment (owner decision, Nov 6 2026: payments are never deleted). A reason is always required; the client
// is emailed a refund / void notice by the website (server side, never from the device).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Field, Txt, useToast } from '@/components/ui';
import { fmtMoney, type Payment } from '@/lib/business';
import { callFn, fnText } from '@/lib/fn';
import { errText } from '@/lib/model';
import { quoteText, toCentsInput, type RefundQuote } from '@/lib/refunds';
import { sb } from '@/lib/supabase';

/** The website endpoint that emails the refund / void notice (same format as the website's own receipts) */
const NOTICE_URL = 'https://thedragonflycatalyst.org/api/account/coach-adjust';

/** Asks the website to email the client a refund or void notice (Charlie's coach-adjust endpoint; no resend guard there, so the
 *  app calls it once per adjustment and again only on an explicit "Email the receipt again"). Resolves to a short status line. */
export async function sendAdjustmentNotice(paymentId: string): Promise<string> {
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return 'Sign in again to email the receipt.';
    const r = await fetch(NOTICE_URL, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ payment_id: paymentId }) });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
    if (r.ok && j?.ok !== false) return j?.message ?? 'Receipt emailed to the client.';
    // 409: no client email, or the payment isn't refunded/voided with a reason; 404: not this trainer's payment; 502: email service
    if (r.status === 502) return 'Receipt not emailed: the email service didn’t answer. Try “Email the receipt again” later.';
    return `Receipt not emailed: ${j?.message ?? j?.error ?? `error ${r.status}`}`;
  } catch { return 'Receipt not emailed: can’t reach the website.'; }
}

export type AdjustKind = 'refund' | 'void';

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
    const why = reason.trim();
    if (why.length < 3) return toast('Give a reason (it goes on the client’s receipt)', false);
    if (kind === 'refund' && (cents === null || cents <= 0 || (quote && cents > quote.max_cents))) return toast(`Enter an amount up to ${fmtMoney(quote?.max_cents ?? payment.amount_cents, payment.currency)}`, false);
    if (outside && why.length < 5) return toast('This is outside your refund policy. Say why in the reason.', false);
    setBusy(true);
    try {
      if (card) await callFn('coach-pay', { action: 'refund', payment_id: payment.id, reason: why, amount_cents: cents });
      else {
        const patch = kind === 'refund' ? { status: 'refunded', status_reason: why, refunded_cents: cents } : { status: 'void', status_reason: why };
        const { error } = await sb.from('coach_payments').update(patch).eq('id', payment.id);
        if (error) throw error;
      }
      const note = await sendAdjustmentNotice(payment.id);
      toast(`${kind === 'refund' ? 'Refunded' : 'Voided'}. ${note}`);
      onDone();
    } catch (e) { toast(card ? fnText(e) : errText(e), false); } finally { setBusy(false); }
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
