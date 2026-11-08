// Stripe REST with form encoding (nested keys like line_items[0][price_data][currency]).
// `account` makes the call on a trainer's connected account (Stripe-Account header); omit it for the platform account.
export function form(obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v as Record<string, unknown>, key, out); else out.append(key, String(v));
  }
  return out;
}

export class StripeError extends Error {
  constructor(public code: string, public status: number, public decline?: string) { super(code); }
}

export async function stripe(path: string, method = 'GET', body?: Record<string, unknown>, idempotencyKey?: string, account?: string | null) {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new StripeError('not_configured', 501);
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...(account ? { 'Stripe-Account': account } : {}),
    },
    body: body ? form(body) : undefined,
  });
  const out = await res.json();
  if (!res.ok) {
    console.error('stripe', path, res.status, out?.error?.code ?? out?.error?.type);
    throw new StripeError(out?.error?.code || 'stripe_error', res.status, out?.error?.decline_code);
  }
  return out;
}
