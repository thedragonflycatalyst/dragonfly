// The client pool: who to offer an open slot to. Pure functions so the ranking can be tested.
import { dayKey, isAwayOn, type AwayFields } from './client-away';
export type Tier = 'regular' | 'occasional' | 'on_call' | 'lapsed' | 'prospect';
export const TIERS: { key: Tier; label: string; hint: string }[] = [
  { key: 'regular', label: 'Regular', hint: 'Fixed weekly sessions' },
  { key: 'occasional', label: 'Occasional', hint: 'Comes in now and then' },
  { key: 'on_call', label: 'On call', hint: 'Happy to fill a cancellation' },
  { key: 'lapsed', label: 'Lapsed', hint: 'Hasn’t trained in a while' },
  { key: 'prospect', label: 'Prospect', hint: 'Not started yet' },
];
export const tierLabel = (t: Tier) => TIERS.find((x) => x.key === t)?.label ?? t;

export type PoolClient = {
  id: string; name: string; status: string; frequency_tier: Tier; short_notice_ok: boolean; client_of?: string; phone?: string | null;
} & AwayFields;
export type Window = { client_id: string; weekday: number; start_time: string; end_time: string };
export type Ranked = {
  client: PoolClient; tier: Tier; fits: boolean; lastAt: string | null; daysSince: number | null; credits: number | null; why: string[];
};

const mins = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };

/** The tier to show: a regular or occasional client who hasn't trained in `lapsedWeeks` counts as lapsed */
export function effectiveTier(c: PoolClient, lastAt: string | null, now: Date, lapsedWeeks = 4): Tier {
  if (c.frequency_tier === 'prospect' || c.frequency_tier === 'lapsed') return c.frequency_tier;
  if (!lastAt) return c.frequency_tier;
  return now.getTime() - new Date(lastAt).getTime() > lapsedWeeks * 7 * 86400_000 ? 'lapsed' : c.frequency_tier;
}

/** True when the whole slot sits inside one of the client's free windows (local time) */
export function fitsWindow(windows: Window[], start: Date, durationMin: number): boolean {
  const day = start.getDay();
  const s = start.getHours() * 60 + start.getMinutes();
  const e = s + durationMin;
  return windows.some((w) => w.weekday === day && mins(w.start_time) <= s && mins(w.end_time) >= e);
}

/**
 * Who to offer a slot to, best first: free at that time, opted in to short notice, longest since their last session,
 * most credits left. Regulars, inactive clients, anyone away that day and anyone already booked then are left out (regulars unless asked for).
 */
export function rankPool(opts: {
  clients: PoolClient[]; windows: Window[]; lastSeen: Record<string, string | null>; credits: Record<string, number | null>;
  start: Date; durationMin: number; now: Date; busy?: Set<string>; includeRegulars?: boolean; lapsedWeeks?: number;
}): Ranked[] {
  const out: Ranked[] = [];
  for (const c of opts.clients) {
    if (c.status !== 'active' || opts.busy?.has(c.id) || isAwayOn(c, dayKey(opts.start))) continue; // away that day: don't ask
    const lastAt = opts.lastSeen[c.id] ?? null;
    const tier = effectiveTier(c, lastAt, opts.now, opts.lapsedWeeks);
    if (tier === 'regular' && !opts.includeRegulars) continue;
    const mine = opts.windows.filter((w) => w.client_id === c.id);
    const fits = fitsWindow(mine, opts.start, opts.durationMin);
    const daysSince = lastAt ? Math.floor((opts.now.getTime() - new Date(lastAt).getTime()) / 86400_000) : null;
    const credits = opts.credits[c.id] ?? null;
    const why = [
      fits ? 'Usually free then' : mine.length ? 'Not usually free then' : 'No times saved',
      c.short_notice_ok ? 'Wants short-notice offers' : null,
      daysSince != null ? `Last session ${daysSince} day${daysSince === 1 ? '' : 's'} ago` : 'No sessions yet',
      credits != null ? `${credits} credit${credits === 1 ? '' : 's'} left` : null,
    ].filter((x): x is string => !!x);
    out.push({ client: c, tier, fits, lastAt, daysSince, credits, why });
  }
  return out.sort((a, b) =>
    Number(b.fits) - Number(a.fits)
    || Number(b.client.short_notice_ok) - Number(a.client.short_notice_ok)
    || (b.daysSince ?? 9999) - (a.daysSince ?? 9999)
    || (b.credits ?? -1) - (a.credits ?? -1)
    || a.client.name.localeCompare(b.client.name));
}

/** Default offer expiry: an hour before the slot, but never in the past */
export function offerExpiry(start: Date, now: Date): Date {
  const e = new Date(start.getTime() - 3600_000);
  return e > now ? e : new Date(Math.min(start.getTime(), now.getTime() + 15 * 60_000));
}

/** The text sent with an offer link */
export function offerText(first: string, trainer: string, start: Date, link: string): string {
  const when = start.toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  return `Hi ${first}, a training spot with ${trainer} opened ${when}. Want it? First to grab it gets it: ${link}`;
}
