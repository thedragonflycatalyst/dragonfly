// Pure helpers for automatic messages (no I/O): time zones, quiet hours, booking occurrences, message text,
// a health-detail check and reply parsing. Tested by messaging.test.ts (deno test).

export type Wall = { y: number; m: number; d: number; h: number; mi: number; weekday: number };

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
    fmtCache.set(tz, f);
  }
  return f;
}
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** The wall-clock time in a time zone */
export function wall(date: Date, tz: string): Wall {
  const parts = Object.fromEntries(fmt(tz).formatToParts(date).map((p) => [p.type, p.value]));
  return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour % 24, mi: +parts.minute, weekday: WD[parts.weekday] };
}
export const dayKey = (w: { y: number; m: number; d: number }) => `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;

/** The instant when the wall clock in `tz` shows y-m-d h:mi (DST-safe to within the skipped/duplicated hour) */
export function zoned(y: number, m: number, d: number, h: number, mi: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess;
  for (let i = 0; i < 3; i++) {
    const w = wall(new Date(t), tz);
    const shown = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi);
    const diff = guess - shown;
    if (diff === 0) break;
    t += diff;
  }
  return new Date(t);
}

export type BookingRow = {
  id: string; starts_at: string; duration_min: number; repeat: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  repeat_until: string | null; skipped: string[]; client_id: string | null; title: string; kind: string; location: string | null;
};

/** Start times of a booking between two instants, following the trainer's wall clock (so 7:00 stays 7:00 across DST) */
export function occurrences(b: BookingRow, from: Date, to: Date, tz: string): { start: Date; day: string }[] {
  const out: { start: Date; day: string }[] = [];
  const first = wall(new Date(b.starts_at), tz);
  const push = (y: number, m: number, d: number) => {
    const s = zoned(y, m, d, first.h, first.mi, tz);
    const w = wall(s, tz);
    const k = dayKey(w);
    if (s < from || s > to || b.skipped.includes(k) || (b.repeat_until && k > b.repeat_until)) return;
    out.push({ start: s, day: k });
  };
  if (b.repeat === 'none') { push(first.y, first.m, first.d); return out; }
  if (b.repeat === 'monthly') {
    for (let i = 0; i < 240; i++) {
      const dt = new Date(Date.UTC(first.y, first.m - 1 + i, first.d));
      if (dt.getUTCDate() !== first.d) continue;
      const s = zoned(dt.getUTCFullYear(), dt.getUTCMonth() + 1, first.d, first.h, first.mi, tz);
      if (s > to) break;
      push(dt.getUTCFullYear(), dt.getUTCMonth() + 1, first.d);
    }
    return out;
  }
  const step = b.repeat === 'daily' ? 1 : b.repeat === 'weekly' ? 7 : 14;
  const base = Date.UTC(first.y, first.m - 1, first.d);
  let i = Math.max(0, Math.floor((from.getTime() - new Date(b.starts_at).getTime()) / (step * 86_400_000)) - 1);
  for (; i < 5000; i++) {
    const dt = new Date(base + i * step * 86_400_000);
    const s = zoned(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), first.h, first.mi, tz);
    if (s > to) break;
    push(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  return out;
}

const minutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };

/** True during quiet hours (e.g. 21:00–08:00, which wraps midnight) in the given time zone */
export function isQuiet(at: Date, tz: string, start: string, end: string): boolean {
  const w = wall(at, tz);
  const now = w.h * 60 + w.mi, s = minutes(start), e = minutes(end);
  return s <= e ? now >= s && now < e : now >= s || now < e;
}
/** The first moment at or after `at` that is outside quiet hours */
export function nextSendable(at: Date, tz: string, start: string, end: string): Date {
  if (!isQuiet(at, tz, start, end)) return at;
  const w = wall(at, tz);
  const e = minutes(end);
  const today = zoned(w.y, w.m, w.d, Math.floor(e / 60), e % 60, tz);
  if (today > at) return today;
  const tomorrow = new Date(Date.UTC(w.y, w.m - 1, w.d + 1));
  return zoned(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), Math.floor(e / 60), e % 60, tz);
}

/** Words that would reveal health details in a text or notification; messages containing them are not sent */
const HEALTH = /\b(injur\w*|surger\w*|diagnos\w*|medication\w*|pregnan\w*|diabet\w*|blood pressure|cholesterol|therap\w*|rehab\w*|pain\w*|bmi|body fat|weight loss|condition|doctor|physio\w*|disorder\w*|anxiety|depress\w*)\b/i;
export function healthWord(body: string): string | null {
  const m = HEALTH.exec(body);
  return m ? m[0] : null;
}

export function timeText(start: Date, tz: string, now: Date): string {
  const s = wall(start, tz), n = wall(now, tz);
  const t = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(start);
  const tomorrow = wall(new Date(now.getTime() + 86_400_000), tz);
  if (dayKey(s) === dayKey(n)) return `today at ${t}`;
  if (dayKey(s) === dayKey(tomorrow)) return `tomorrow at ${t}`;
  const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric' }).format(start);
  return `${day} at ${t}`;
}

/** Session reminder. By text, it says how to reply; in chat, the client can just answer. */
export function reminderText(o: { first: string; trainer: string; start: Date; tz: string; now: Date; sms: boolean; location?: string | null }): string {
  const where = o.location ? ` at ${o.location}` : '';
  const base = `Hi ${o.first}, reminder: training with ${o.trainer} ${timeText(o.start, o.tz, o.now)}${where}.`;
  // Whole words, not letters (owner 2026-11-07). "CANCEL" alone is a carrier opt-out keyword, so cancelling is "CANCEL SESSION".
  return o.sms ? `${base} Reply CONFIRM, RESCHEDULE or CANCEL SESSION. Reply STOP to opt out.` : `${base} See you there!`;
}

export type Reply =
  | { kind: 'stop' } | { kind: 'start' } | { kind: 'help' } | { kind: 'confirm' } | { kind: 'reschedule' } | { kind: 'cancel_session' }
  | { kind: 'yes' } | { kind: 'no' } | { kind: 'rating'; value: number } | { kind: 'in' } | { kind: 'other' };

/** What a text reply means. Carrier keywords (STOP, START, HELP) always win. */
export function parseReply(text: string): Reply {
  const t = text.trim().toUpperCase().replace(/[.!?]+$/, '');
  if (/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT|OPTOUT|OPT OUT|REVOKE)$/.test(t)) return { kind: 'stop' };
  if (/^(START|UNSTOP|SUBSCRIBE|OPTIN|OPT IN)$/.test(t)) return { kind: 'start' };
  if (/^(HELP|INFO)$/.test(t)) return { kind: 'help' };
  if (/^(C|CONFIRM|CONFIRMED|👍)$/.test(t)) return { kind: 'confirm' };
  if (/^(R|RESCHEDULE|MOVE( IT| MY SESSION)?)$/.test(t)) return { kind: 'reschedule' };
  if (/^CANCEL (MY |THE |THIS )?(SESSION|APPOINTMENT|APPT|TRAINING)$/.test(t)) return { kind: 'cancel_session' };
  if (/^(Y|YES|YEP|YEAH|SURE|I'?LL TAKE IT)$/.test(t)) return { kind: 'yes' };
  if (/^(N|NO|NOPE|NOT THIS TIME)$/.test(t)) return { kind: 'no' };
  if (/^IN$/.test(t)) return { kind: 'in' };
  const n = /^([1-5])(\s*\/\s*5)?$/.exec(t);
  if (n) return { kind: 'rating', value: Number(n[1]) };
  return { kind: 'other' };
}

/** The cancellation policy in one sentence (from the trainer's notice period) */
export const cancelPolicyText = (hours: number) =>
  `Sessions can be cancelled up to ${hours} hour${hours === 1 ? '' : 's'} before they start; later cancellations count as a session.`;

/** Replies to a text asking to cancel */
export function cancelReplyText(o: { status: 'cancelled' | 'too_late' | 'not_allowed' | 'no_session'; when?: string; hours: number; link: string; trainer: string }): string {
  const policy = cancelPolicyText(o.hours);
  switch (o.status) {
    case 'cancelled': return `Your session${o.when ? ` ${o.when}` : ''} is cancelled. ${policy} Book a new time here: ${o.link}`;
    case 'too_late': return `It's too close to your session to cancel by text. ${policy} You can still move it to another time today: ${o.link}`;
    case 'not_allowed': return `Please message ${o.trainer} to cancel. ${policy}`;
    default: return `We couldn't find an upcoming session to cancel. Your sessions are here: ${o.link}`;
  }
}

/** Normalize a US-style phone number to E.164 (+1XXXXXXXXXX); other countries must already include + */
export function e164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/[^\d+]/g, '');
  if (d.startsWith('+') && d.length >= 9) return d;
  const digits = d.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}
