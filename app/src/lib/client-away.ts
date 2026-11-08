// Away notes on clients (out of the country, injured...) and the Clients list sections built from them. Pure, so tested.
// Dates are 'YYYY-MM-DD' in the trainer's local time.

export type AwayReason = 'travel' | 'injury' | 'illness' | 'personal' | 'other';
export const AWAY_REASONS: [AwayReason, string][] = [['travel', 'Traveling'], ['injury', 'Injured'], ['illness', 'Sick'], ['personal', 'Personal'], ['other', 'Other']];
export const awayLabel = (r: AwayReason | null | undefined) => AWAY_REASONS.find(([k]) => k === r)?.[1] ?? 'Away';

export type AwayFields = { away_reason?: AwayReason | null; away_from?: string | null; away_until?: string | null; away_note?: string | null };
export type ClientSection = 'active' | 'away' | 'inactive' | 'archived' | 'pool';
export const SECTIONS: [Exclude<ClientSection, 'pool'>, string][] = [['active', 'Active'], ['away', 'Away'], ['inactive', 'Inactive'], ['archived', 'Archived']];

/** How long after the return date a client is flagged "back" so you remember to reach out */
export const BACK_DAYS = 14;

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000);

/** Where the client stands on `day`: away now, going away later, just back, or nothing to note */
export function awayState(c: AwayFields, day: string): 'away' | 'upcoming' | 'back' | null {
  if (!c.away_reason) return null;
  if (c.away_from && c.away_from > day) return 'upcoming';
  if (!c.away_until || c.away_until >= day) return 'away';
  return daysBetween(c.away_until, day) <= BACK_DAYS ? 'back' : null;
}

export const isAwayOn = (c: AwayFields, day: string) => awayState(c, day) === 'away';

/** Which section of the Clients list a client goes in */
export function sectionOf(c: AwayFields & { status: string }, day: string): ClientSection {
  if (c.status === 'lead') return 'pool';
  if (c.status === 'archived') return 'archived';
  if (c.status === 'frozen') return 'inactive';
  return isAwayOn(c, day) ? 'away' : 'active';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;

/** One line for lists and the profile, e.g. "Injured until Dec 3", "Traveling from Dec 10 to Jan 4", "Back from traveling since Dec 3" */
export function awayLine(c: AwayFields, day: string): string | null {
  const s = awayState(c, day);
  if (!s) return null;
  const what = awayLabel(c.away_reason);
  if (s === 'back') return `Back from ${what.toLowerCase()} since ${short(c.away_until!)}`;
  if (s === 'upcoming') return `${what} from ${short(c.away_from!)}${c.away_until ? ` to ${short(c.away_until)}` : ''}`;
  return c.away_until ? `${what} until ${short(c.away_until)}` : `${what}, no return date yet`;
}

/** "Last session 9 days ago" */
export function lastSessionLine(lastAt: string | null | undefined, now: Date): string | null {
  if (!lastAt) return null;
  const d = Math.floor((now.getTime() - new Date(lastAt).getTime()) / 86400_000);
  return d <= 0 ? 'Last session today' : d === 1 ? 'Last session yesterday' : d < 14 ? `Last session ${d} days ago` : `Last session ${Math.floor(d / 7)} weeks ago`;
}
