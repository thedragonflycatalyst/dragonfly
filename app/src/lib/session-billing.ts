// What pays for each session (coach_session_charges), in plain words. Pure, so the wording can be tested.
import { fmtMoney } from './business';

export type ChargeStatus = 'package' | 'pending' | 'paid' | 'due' | 'waived' | 'cancelled' | 'credit';
export type SessionCharge = {
  id: string; client_id: string; booking_id: string | null; on_date: string; starts_at: string; status: ChargeStatus;
  client_package_id: string | null; amount_cents: number | null; currency: string; attempts: number; last_error: string | null; note: string | null;
};
export type Card = { brand: string | null; last4: string | null; exp_month: number | null; exp_year: number | null };

/** How a session is (or will be) paid, from the client's side */
export function chargeText(c: SessionCharge, hasCard: boolean, now = new Date()): string {
  const money = c.amount_cents != null ? fmtMoney(c.amount_cents, c.currency) : null;
  switch (c.status) {
    case 'package': return 'Covered by your package';
    case 'paid': return money ? `Paid · ${money}` : 'Paid';
    case 'due': return money ? `Not paid yet · ${money}` : 'Not paid yet';
    case 'waived': return 'No charge';
    case 'cancelled': return 'Cancelled';
    case 'credit': return 'Paid, then cancelled: covers your next session';
    case 'pending':
      if (!money) return 'Single session';
      if (c.attempts > 0 && c.last_error) return `Card didn’t go through · ${money}`;
      if (hasCard) return `Single session · ${money}, charged to your card`;
      return new Date(c.starts_at) > now ? `Single session · ${money}, pay after or buy a package` : `Single session · ${money}`;
  }
}

/** True when this counts against booking more sessions */
export const blocksBooking = (c: SessionCharge) => c.status === 'due';

export const cardText = (k: Card) =>
  `${(k.brand ?? 'Card').replace(/^\w/, (x) => x.toUpperCase())} ending ${k.last4 ?? '••••'}${k.exp_month && k.exp_year ? ` · expires ${String(k.exp_month).padStart(2, '0')}/${String(k.exp_year).slice(-2)}` : ''}`;
