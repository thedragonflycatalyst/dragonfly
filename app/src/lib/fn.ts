// Calling Dragonfly's edge functions with the right headers, and reading their error codes.
import { actingHeaders, sb } from './supabase';

export class FnError extends Error { constructor(public code: string) { super(code); } }
/** POST to an edge function; throws FnError with the function's `error` code on failure */
export async function callFn<T = Record<string, unknown>>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.functions.invoke(name, { body, headers: actingHeaders() });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const code = await ctx?.json?.().then((j: { error?: string }) => j.error).catch(() => null);
    throw new FnError(code || 'unavailable');
  }
  if ((data as { error?: string })?.error) throw new FnError((data as { error: string }).error);
  return data as T;
}
const FN_TEXT: Record<string, string> = {
  not_configured: 'Online payments aren’t switched on yet (the Stripe key needs adding in Supabase).',
  online_payments_off: 'Online payments aren’t set up for this trainer yet. Ask them how to pay.',
  voucher_invalid: 'That code isn’t valid for this package.',
  sold_out: 'Sorry, that’s sold out.', event_full: 'That event is full.', not_available: 'That isn’t available right now.',
  price_too_low: 'Card payments need to be at least 50¢.', daily_limit: 'That’s today’s limit. Try again tomorrow.',
  stripe_error: 'Stripe didn’t accept that. Try again in a moment.', not_refundable: 'That payment can’t be refunded here.',
  bad_image: 'That image couldn’t be read. Try another.', ai_unavailable: 'The AI couldn’t read that right now. Try again.',
  unavailable: 'Couldn’t reach the server. Try again.',
};
export const fnText = (e: unknown) => (e instanceof FnError ? FN_TEXT[e.code] ?? e.code.replace(/_/g, ' ') : String((e as Error)?.message ?? e));
