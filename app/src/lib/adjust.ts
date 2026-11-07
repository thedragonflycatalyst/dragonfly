// Refund / void flow for coach payments, kept free of React and Supabase so it can be tested (coach-003).
// Owner decision, Nov 6 2026: payments are never deleted; they are refunded or voided with a reason, and the client is
// emailed a notice by the website's coach-adjust endpoint (server side, never from the device).
import type { Payment } from './business';

export type AdjustKind = 'refund' | 'void';

/** The website endpoint that emails the refund / void notice (allowed origin: the trainer dashboard) */
export const NOTICE_URL = 'https://thedragonflycatalyst.org/api/account/coach-adjust';

/** A usable reason, trimmed, or null. The database (23514) and the endpoint (409) both reject a blank one. */
export function cleanReason(s: string | null | undefined): string | null {
  const t = (s ?? '').trim().replace(/\s+/g, ' ');
  return t.length >= 3 ? t.slice(0, 500) : null;
}

/** Card refunds go through Stripe (coach-pay); everything else is a status change on the row, never a delete */
export function adjustRoute(p: Pick<Payment, 'method' | 'status'>, kind: AdjustKind): 'stripe' | 'record' | null {
  // Refund a paid payment. Void a pending one, or a paid one that wasn't taken by card: voiding a captured Stripe charge would
  // leave the money with the trainer while the client is told it's cancelled, so card payments are refunded instead (L-022).
  if (kind === 'refund' ? p.status !== 'paid' : !voidable(p)) return null;
  return p.method === 'stripe' && kind === 'refund' ? 'stripe' : 'record';
}

/** Whether Void is offered: pending payments, or paid ones recorded by hand (cash, card machine, transfer…) */
export const voidable = (p: Pick<Payment, 'method' | 'status'>) => p.status === 'pending' || (p.status === 'paid' && p.method !== 'stripe');

export const statusFor = (kind: AdjustKind): 'refunded' | 'void' => (kind === 'refund' ? 'refunded' : 'void');

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/** One POST to coach-adjust; resolves to a short line for the trainer. The endpoint has no resend guard, so callers send once
 *  per adjustment and again only on an explicit "Email the receipt again". */
export async function postNotice(paymentId: string, token: string | null | undefined, fetchFn: FetchLike): Promise<{ sent: boolean; text: string }> {
  if (!token) return { sent: false, text: 'Sign in again to email the receipt.' };
  try {
    const r = await fetchFn(NOTICE_URL, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ payment_id: paymentId }) });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
    if (r.ok && j?.ok !== false) return { sent: true, text: j?.message ?? 'Receipt emailed to the client.' };
    if (r.status === 502) return { sent: false, text: 'Receipt not emailed: the email service didn’t answer. Try “Email the receipt again” later.' };
    if (r.status === 401) return { sent: false, text: 'Receipt not emailed: sign in again.' };
    if (r.status === 404) return { sent: false, text: 'Receipt not emailed: that payment isn’t one of yours.' };
    return { sent: false, text: `Receipt not emailed: ${j?.message ?? j?.error ?? `error ${r.status}`}` };
  } catch { return { sent: false, text: 'Receipt not emailed: can’t reach the website.' }; }
}

export type AdjustDeps = {
  refundCard: (paymentId: string, reason: string) => Promise<void>;
  setStatus: (paymentId: string, status: 'refunded' | 'void', reason: string) => Promise<void>;
  getToken: () => Promise<string | null | undefined>;
  fetchFn: FetchLike;
};
export type AdjustResult = { ok: true; notice: { sent: boolean; text: string } } | { ok: false; problem: 'reason' | 'not_allowed' | 'failed'; error?: unknown };

/** Refund or void, then ask for the notice exactly once. No notice if the change itself failed. */
export async function runAdjustment(p: Pick<Payment, 'id' | 'method' | 'status'>, kind: AdjustKind, reason: string, deps: AdjustDeps): Promise<AdjustResult> {
  const why = cleanReason(reason);
  if (!why) return { ok: false, problem: 'reason' };
  const route = adjustRoute(p, kind);
  if (!route) return { ok: false, problem: 'not_allowed' };
  try {
    if (route === 'stripe') await deps.refundCard(p.id, why);
    else await deps.setStatus(p.id, statusFor(kind), why);
  } catch (error) { return { ok: false, problem: 'failed', error }; }
  return { ok: true, notice: await postNotice(p.id, await deps.getToken(), deps.fetchFn) };
}
