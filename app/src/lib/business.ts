// Packages, vouchers, payments, calendar and events: shapes and the logic the screens share.
import { addDays, dayKey } from './dates';

export type Billing = 'once' | 'week' | 'month' | 'year';
export type Package = {
  id: string; trainer_id: string; name: string; description: string | null; cover: string | null; price_cents: number; currency: string;
  billing: Billing; credits: number | null; valid_days: number | null; program_ids: string[]; plan_ids: string[]; visible: boolean;
  client_ids: string[]; available_from: string | null; available_until: string | null; max_sales: number | null; sold: number; archived: boolean; created_at: string;
};
export type Voucher = { id: string; trainer_id: string; code: string; description: string | null; percent_off: number | null; amount_off_cents: number | null; package_ids: string[]; max_uses: number | null; uses: number; expires_on: string | null; active: boolean };
export type Payment = {
  id: string; trainer_id: string; client_id: string | null; package_id: string | null; event_id: string | null; description: string; amount_cents: number; currency: string;
  status: 'paid' | 'pending' | 'refunded' | 'failed'; method: 'stripe' | 'cash' | 'card' | 'transfer' | 'other'; stripe_subscription_id: string | null; note: string | null; paid_at: string;
};
export type ClientPackage = { id: string; trainer_id: string; client_id: string; package_id: string | null; name: string; credits_total: number | null; credits_used: number; starts_on: string; expires_on: string | null; status: 'active' | 'cancelled'; billing: Billing; created_at: string };
export type Booking = {
  id: string; trainer_id: string; client_id: string | null; group_id: string | null; title: string; kind: 'session' | 'consult' | 'class' | 'block' | 'other';
  location: string | null; starts_at: string; duration_min: number; repeat: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly'; repeat_until: string | null;
  skipped: string[]; done: string[]; notes: string | null; color: string | null; booked_by: 'trainer' | 'client';
};
export type Availability = { id: string; trainer_id: string; weekday: number; start_time: string; end_time: string };
export type CoachEvent = {
  id: string; trainer_id: string; title: string; description: string | null; cover: string | null; color: string | null; location: string | null; starts_at: string;
  duration_min: number; spaces: number | null; waitlist: boolean; price_cents: number | null; currency: string; credits: number | null; visible: boolean; cancelled: boolean; booked: number; waiting: number;
};
export type Signup = { event_id: string; client_id: string; status: 'booked' | 'waitlist' | 'cancelled'; paid: boolean; attended: boolean | null; created_at: string };

/* ---------------- money ---------------- */
export function fmtMoney(cents: number, currency = 'usd') {
  const whole = cents % 100 === 0;
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100); }
  catch { return `$${(cents / 100).toFixed(whole ? 0 : 2)}`; }
}
/** "12.50" or "$12.5" → 1250 cents; null when it isn't money */
export function toCents(s: string): number | null {
  const t = s.replace(/[$£€\s,]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}
export const BILLING: Record<Billing, string> = { once: 'One-off payment', week: 'Every week', month: 'Every month', year: 'Every year' };
export const per = (b: Billing) => (b === 'once' ? '' : `/${b === 'week' ? 'wk' : b === 'month' ? 'mo' : 'yr'}`);
export const priceLabel = (p: Pick<Package, 'price_cents' | 'currency' | 'billing'>) => (p.price_cents === 0 ? 'Free' : `${fmtMoney(p.price_cents, p.currency)}${per(p.billing)}`);
export function voucherPrice(price: number, v: Pick<Voucher, 'percent_off' | 'amount_off_cents'>) {
  return v.percent_off ? Math.round((price * (100 - v.percent_off)) / 100) : Math.max(price - (v.amount_off_cents ?? 0), 0);
}
export function voucherState(v: Voucher, today = dayKey(new Date())): 'active' | 'expired' | 'used up' | 'off' {
  if (!v.active) return 'off';
  if (v.expires_on && v.expires_on < today) return 'expired';
  if (v.max_uses && v.uses >= v.max_uses) return 'used up';
  return 'active';
}
export const voucherCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
export const creditsLeft = (cp: Pick<ClientPackage, 'credits_total' | 'credits_used'>) => (cp.credits_total == null ? null : cp.credits_total - cp.credits_used);
export const packageLive = (cp: Pick<ClientPackage, 'status' | 'expires_on'>, today = dayKey(new Date())) => cp.status === 'active' && (!cp.expires_on || cp.expires_on >= today);

/** Totals by month (YYYY-MM) of paid payments, minus refunds, for charts */
export function byMonth(payments: Pick<Payment, 'amount_cents' | 'status' | 'paid_at'>[], months = 12, now = new Date()) {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
  const sum = new Map(keys.map((k) => [k, { gross: 0, count: 0 }]));
  for (const p of payments) {
    const d = new Date(p.paid_at); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const s = sum.get(k); if (!s) continue;
    if (p.status === 'paid') { s.gross += p.amount_cents; s.count++; }
  }
  return keys.map((k) => ({ month: k, ...sum.get(k)! }));
}
export const monthShort = (k: string) => new Date(`${k}-15T12:00:00`).toLocaleDateString(undefined, { month: 'short' });

/* ---------------- calendar ---------------- */
export type Occurrence = { booking: Booking; day: string; start: Date; end: Date; done: boolean };
/** Every time a booking happens between two days (inclusive, local), skipping cancelled dates */
export function occurrences(bookings: Booking[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const b of bookings) {
    const first = new Date(b.starts_at);
    const step = b.repeat === 'daily' ? 1 : b.repeat === 'weekly' ? 7 : b.repeat === 'biweekly' ? 14 : 0;
    const until = b.repeat_until && b.repeat_until < to ? b.repeat_until : to;
    const push = (d: Date) => {
      const k = dayKey(d);
      if (k < from || k > until || b.skipped.includes(k)) return;
      out.push({ booking: b, day: k, start: d, end: new Date(d.getTime() + b.duration_min * 60_000), done: b.done.includes(k) });
    };
    if (b.repeat === 'none') { push(first); continue; }
    if (b.repeat === 'monthly') {
      for (let i = 0; i < 240; i++) {
        const d = new Date(first); d.setMonth(first.getMonth() + i);
        if (d.getDate() !== first.getDate()) continue;  // no 31st this month
        if (dayKey(d) > until) break; push(d);
      }
      continue;
    }
    // Jump close to `from` first so long-running series stay quick
    let i = Math.max(0, Math.floor((new Date(`${from}T00:00:00`).getTime() - first.getTime()) / (step * 86_400_000)) - 1);
    for (; i < 5000; i++) {
      const d = new Date(first); d.setDate(first.getDate() + i * step);
      if (dayKey(d) > until) break; push(d);
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
/** The seven days of the week containing `d`, Monday first */
export function weekOf(d: Date) {
  const monday = addDays(d, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(monday, i)));
}
export const REPEATS: [Booking['repeat'], string][] = [['none', 'Does not repeat'], ['daily', 'Every day'], ['weekly', 'Every week'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Every month']];
export const KINDS: [Booking['kind'], string][] = [['session', 'Session'], ['consult', 'Consultation'], ['class', 'Class'], ['block', 'Busy / blocked'], ['other', 'Other']];
export function fmtDuration(min: number) { const h = Math.floor(min / 60), m = min % 60; return h ? `${h} hr${m ? ` ${m} min` : ''}` : `${m} min`; }
/** Local date + "HH:MM" → Date */
export const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm.length === 5 ? hhmm : hhmm.padStart(5, '0')}:00`);
export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
/** Open slots of `minutes` in a day, every 30 minutes, inside availability and not clashing with bookings */
export function openSlots(day: string, minutes: number, avail: Availability[], busy: { start: Date; end: Date }[], now = new Date()) {
  const wd = new Date(`${day}T12:00:00`).getDay();
  const out: Date[] = [];
  for (const a of avail.filter((x) => x.weekday === wd)) {
    for (let s = at(day, a.start_time.slice(0, 5)); s.getTime() + minutes * 60_000 <= at(day, a.end_time.slice(0, 5)).getTime(); s = new Date(s.getTime() + 30 * 60_000)) {
      const e = new Date(s.getTime() + minutes * 60_000);
      if (s.getTime() < now.getTime() + 3_600_000) continue;
      if (busy.some((b) => b.start < e && b.end > s)) continue;
      out.push(s);
    }
  }
  return out;
}

/* ---------------- events ---------------- */
export function spotsText(e: Pick<CoachEvent, 'spaces' | 'booked' | 'waitlist' | 'waiting'>) {
  if (e.spaces == null) return `${e.booked} going`;
  const left = e.spaces - e.booked;
  if (left > 0) return `${left} of ${e.spaces} spaces left`;
  return e.waitlist ? `Full · ${e.waiting} on the waiting list` : 'Full';
}
export function eventCost(e: Pick<CoachEvent, 'price_cents' | 'currency' | 'credits'>) {
  const parts = [e.price_cents ? fmtMoney(e.price_cents, e.currency) : null, e.credits ? `${e.credits} credit${e.credits === 1 ? '' : 's'}` : null].filter(Boolean);
  return parts.length ? parts.join(' or ') : 'Free';
}
export const COLORS = ['#0a7a70', '#3a6ff7', '#8a4fd8', '#d64f8a', '#e0602a', '#c99a00', '#2a9d4b', '#5b6b70'];
