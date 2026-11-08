// Session billing (owner rules 2026-11-07). The database attaches a package or a single-session charge to every
// client session (coach_session_charges). Here, every 15 minutes:
//   1. coach_session_charges_tick: attach the next two weeks of sessions; sessions that happened unpaid become outstanding
//   2. single sessions for clients with a card on file are charged straight away (off-session, idempotent per attempt)
// A failed card leaves the session outstanding (the client pays in the app or the trainer records it).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';
import { stripe, StripeError } from '../_shared/stripe.ts';

type Charge = { id: string; trainer_id: string; client_id: string; on_date: string; amount_cents: number; currency: string; attempts: number };
type Card = { client_id: string; stripe_account: string | null; stripe_customer: string; payment_method: string };

export const chargeDescription = (onDate: string, trainer: string) => {
  const d = new Date(`${onDate}T12:00:00Z`);
  return `Training session ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} with ${trainer}`.slice(0, 200);
};
export const MAX_ATTEMPTS = 3;

export async function processCharges(admin: SupabaseClient, now: Date): Promise<{ due: number; charged: number; failed: number }> {
  const { data: tick, error } = await admin.rpc('coach_session_charges_tick');
  if (error) throw error;
  const out = { due: (tick as { due?: number } | null)?.due ?? 0, charged: 0, failed: 0 };
  if (!Deno.env.get('STRIPE_SECRET_KEY')) return out;
  const { data: rows } = await admin.from('coach_session_charges').select('id, trainer_id, client_id, on_date, amount_cents, currency, attempts')
    .eq('status', 'pending').not('amount_cents', 'is', null).lt('attempts', MAX_ATTEMPTS).order('starts_at').limit(50);
  const charges = (rows ?? []) as Charge[];
  if (!charges.length) return out;
  const [{ data: cards }, { data: trainers }] = await Promise.all([
    admin.from('coach_client_cards').select('client_id, stripe_account, stripe_customer, payment_method').in('client_id', charges.map((c) => c.client_id)),
    admin.from('coach_trainers').select('user_id, display_name, stripe_account, stripe_charges_enabled').in('user_id', [...new Set(charges.map((c) => c.trainer_id))]),
  ]);
  for (const c of charges) {
    const card = ((cards ?? []) as Card[]).find((k) => k.client_id === c.client_id);
    const t = (trainers ?? []).find((x) => x.user_id === c.trainer_id);
    if (!card || !t) continue;
    // The card must live on the account the trainer is paid through now
    const acct = t.stripe_account && t.stripe_charges_enabled ? t.stripe_account : null;
    if ((card.stripe_account ?? null) !== acct || c.amount_cents < 50) continue;
    const description = chargeDescription(c.on_date, (t.display_name || 'your trainer').split(' ')[0]);
    try {
      const pi = await stripe('payment_intents', 'POST', {
        amount: c.amount_cents, currency: c.currency, customer: card.stripe_customer, payment_method: card.payment_method,
        off_session: 'true', confirm: 'true', description, metadata: { charge_id: c.id, trainer_id: c.trainer_id, client_id: c.client_id },
      }, `session-charge:${c.id}:${c.attempts}`, acct);
      if (pi.status !== 'succeeded') throw new StripeError(pi.status ?? 'not_succeeded', 402);
      const { data: pay, error: pe } = await admin.from('coach_payments').insert({
        trainer_id: c.trainer_id, client_id: c.client_id, description, amount_cents: c.amount_cents, currency: c.currency,
        status: 'paid', method: 'stripe', stripe_payment_intent: pi.id, stripe_account: acct, paid_at: now.toISOString(),
      }).select('id').single();
      if (pe) throw pe;
      await admin.from('coach_session_charges').update({ status: 'paid', payment_id: pay.id, settled_at: now.toISOString(), attempts: c.attempts + 1, last_error: null })
        .eq('id', c.id).eq('status', 'pending');
      out.charged++;
    } catch (e) {
      const code = e instanceof StripeError ? (e.decline ?? e.code) : 'error';
      await admin.from('coach_session_charges').update({ attempts: c.attempts + 1, last_error: String(code).slice(0, 200) }).eq('id', c.id);
      out.failed++;
    }
  }
  return out;
}
