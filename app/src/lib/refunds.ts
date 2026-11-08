// Refund policy in plain words, and the quote shape from coach_refund_quote. Pure, so the wording can be tested.
import { fmtMoney } from './business';

export type RefundMode = 'prorated' | 'unused_only' | 'none';
export type RefundTerms = { mode: RefundMode; window_days: number; fee_cents: number; expired_refundable: boolean; event_cutoff_hours: number; extra_terms?: string | null };
export type RefundQuote = {
  refundable: boolean; reason: string | null; max_cents: number; suggested_cents: number;
  credits_total?: number | null; credits_unused?: number | null; fee_cents?: number; terms?: RefundTerms;
};
// Owner decision 2026-11-07: no refunds by default; the account owner can override for exceptional circumstances (with a reason)
export const DEFAULT_TERMS: RefundTerms = { mode: 'none', window_days: 30, fee_cents: 0, expired_refundable: false, event_cutoff_hours: 24, extra_terms: null };

/** The policy as clients read it before they buy (and on receipts) */
export function policyText(t: RefundTerms, currency = 'usd'): string[] {
  const fee = t.fee_cents ? ` A ${fmtMoney(t.fee_cents, currency)} processing fee is kept from any refund.` : '';
  const lines: string[] = [];
  if (t.mode === 'none') {
    lines.push('All sales are final: refunds aren’t given, except in exceptional circumstances at your trainer’s discretion.');
    lines.push('If your trainer cancels a session, it’s credited back to you.');
  }
  else {
    const window = t.window_days === 0 ? 'on the day of purchase only' : `within ${t.window_days} days of purchase`;
    lines.push(t.mode === 'prorated'
      ? `Session packages can be refunded ${window} for the sessions you haven’t used, at the price per session you paid.${fee}`
      : `Session packages can be refunded in full ${window} if no sessions have been used.${fee}`);
    lines.push('Not refundable: sessions already used (including late cancellations and no-shows counted as used), ' +
      `${t.expired_refundable ? '' : 'expired packages, '}and purchases after the refund window.`);
    lines.push(`Group sessions can be refunded up to ${t.event_cutoff_hours} hours before they start. If your trainer cancels, you get a full refund.`);
  }
  if (t.extra_terms?.trim()) lines.push(t.extra_terms.trim());
  return lines;
}

/** One line under the refund button: what the policy allows for this payment */
export function quoteText(q: RefundQuote, currency = 'usd'): string {
  if (!q.refundable) return `Not refundable under your policy: ${q.reason ?? 'outside the policy'}`;
  const parts = [`Policy refund: ${fmtMoney(q.suggested_cents, currency)}`];
  if (q.credits_total) parts.push(`${q.credits_unused ?? 0} of ${q.credits_total} sessions unused`);
  if (q.fee_cents) parts.push(`minus ${fmtMoney(q.fee_cents, currency)} fee`);
  return parts.join(' · ');
}

/** Dollars typed by the trainer → cents (null if not a valid amount) */
export function toCentsInput(v: string): number | null {
  const m = /^\s*\$?\s*(\d{1,6})(?:\.(\d{1,2}))?\s*$/.exec(v);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '0').padEnd(2, '0'));
}
