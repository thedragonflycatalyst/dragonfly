// Refund or void a payment (owner decision, Nov 6 2026: payments are never deleted). A reason is always required; the client
// is emailed a refund / void notice by the website (server side, never from the device).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Field, Txt, useToast } from '@/components/ui';
import { fmtMoney, type Payment } from '@/lib/business';
import { callFn, fnText } from '@/lib/fn';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';

/** The website endpoint that emails the refund / void notice (same format as the website's own receipts) */
const NOTICE_URL = 'https://thedragonflycatalyst.org/api/account/coach-adjust';

/** Asks the website to email the client a refund or void notice. Resolves to a short status line for the toast. */
export async function sendAdjustmentNotice(paymentId: string): Promise<string> {
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return 'Sign in again to email the receipt.';
    const r = await fetch(NOTICE_URL, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ payment_id: paymentId }) });
    if (r.ok) return 'Receipt emailed to the client.';
    if (r.status === 404) return 'The client’s receipt couldn’t be emailed yet (the email service isn’t set up for this).';
    const j = (await r.json().catch(() => null)) as { error?: string } | null;
    return `Receipt not emailed: ${j?.error ?? `error ${r.status}`}`;
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
  useEffect(() => { setReason(''); }, [payment, kind]);
  if (!payment) return null;
  const card = payment.method === 'stripe' && kind === 'refund';
  const go = async () => {
    const why = reason.trim();
    if (why.length < 3) return toast('Give a reason (it goes on the client’s receipt)', false);
    setBusy(true);
    try {
      if (card) await callFn('coach-pay', { action: 'refund', payment_id: payment.id, reason: why });
      else {
        const { error } = await sb.from('coach_payments').update({ status: kind === 'refund' ? 'refunded' : 'void', status_reason: why }).eq('id', payment.id);
        if (error) throw error;
      }
      const note = await sendAdjustmentNotice(payment.id);
      toast(`${kind === 'refund' ? 'Refunded' : 'Voided'}. ${note}`);
      onDone();
    } catch (e) { toast(card ? fnText(e) : errText(e), false); } finally { setBusy(false); }
  };
  return (
    <Sheet visible onClose={onClose} title={kind === 'refund' ? `Refund ${fmtMoney(payment.amount_cents, payment.currency)}` : 'Void this payment'}>
      <View style={{ gap: 10 }}>
        <Txt>{kind === 'refund'
          ? card ? `${clientName} gets the money back on their card.` : `Record that you gave ${clientName} the money back (by ${payment.method}). This doesn’t move money for you.`
          : `Use this when the payment was recorded by mistake. It stays in your records, marked void.`}</Txt>
        <Txt v="small">Payments are kept for 7 years and can’t be deleted. Credits they bought aren’t removed automatically.</Txt>
        <Field label="Reason *" hint="(on the client’s receipt)" value={reason} onChangeText={setReason} multiline
          placeholder={kind === 'refund' ? 'Session cancelled, injury, changed plans…' : 'Entered twice, wrong client, wrong amount…'} />
        <Button title={kind === 'refund' ? 'Refund and email receipt' : 'Void and email notice'} busy={busy} onPress={go} />
      </View>
    </Sheet>
  );
}
