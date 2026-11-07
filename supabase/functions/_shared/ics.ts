// iCalendar (.ics) reading and writing for coach-calendar. Pure functions, tested in app/src/lib/ics.test.ts.

/** UTC instant for a wall-clock time in an IANA time zone */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let off = 0;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(new Date(guess)).reduce<Record<string, number>>((a, p) => (p.type === 'literal' ? a : { ...a, [p.type]: Number(p.value) }), {});
    off = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - guess;
  } catch { off = 0; }
  return new Date(guess - off);
}
/** Wall-clock parts of an instant in a time zone */
export function utcToZoned(t: Date, tz: string) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(t).reduce<Record<string, string>>((a, x) => ({ ...a, [x.type]: x.value }), {});
  return `${p.year}${p.month}${p.day}T${p.hour}${p.minute}${p.second}`;
}

// Outlook and Exchange feeds name zones the Windows way ("Eastern Standard Time"); map the common ones to IANA names.
const WINDOWS_TZ: Record<string, string> = {
  'Eastern Standard Time': 'America/New_York', 'US Eastern Standard Time': 'America/Indiana/Indianapolis', 'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver', 'US Mountain Standard Time': 'America/Phoenix', 'Pacific Standard Time': 'America/Los_Angeles',
  'Alaskan Standard Time': 'America/Anchorage', 'Hawaiian Standard Time': 'Pacific/Honolulu', 'Atlantic Standard Time': 'America/Halifax',
  'GMT Standard Time': 'Europe/London', 'Greenwich Standard Time': 'Atlantic/Reykjavik', 'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris', 'Central Europe Standard Time': 'Europe/Budapest', 'E. Europe Standard Time': 'Europe/Chisinau',
  'UTC': 'UTC', 'Coordinated Universal Time': 'UTC',
};
/** An IANA zone for a TZID (Windows names mapped); unknown zones fall back to the calendar's own zone. */
export function ianaZone(tz: string, fallback: string): string {
  const t = WINDOWS_TZ[tz] ?? tz;
  try { new Intl.DateTimeFormat('en-US', { timeZone: t }); return t; } catch { return fallback; }
}

function parseStamp(v: string, params: string, fallbackTz: string): { at: Date; allDay: boolean } | null {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const tz = ianaZone(params.match(/TZID=([^;:]+)/)?.[1]?.replace(/^"|"$/g, '') ?? fallbackTz, fallbackTz);
  if (!m[4]) return { at: zonedToUtc(y, mo, d, 0, 0, 0, fallbackTz), allDay: true };
  if (m[7]) return { at: new Date(Date.UTC(y, mo - 1, d, +m[4], +m[5], +m[6])), allDay: false };
  return { at: zonedToUtc(y, mo, d, +m[4], +m[5], +m[6], tz), allDay: false };
}

export type Busy = { starts_at: string; ends_at: string; title: string | null };
/**
 * Busy blocks from a calendar feed between `from` and `to`. Expands simple repeats (daily, weekly with days, monthly,
 * yearly; interval, count, until, exceptions). Skips events marked free/transparent, cancelled ones and all-day events.
 */
export function busyFromIcs(text: string, from: Date, to: Date, tz = 'UTC', max = 2000): Busy[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const out: Busy[] = [];
  const overrides = new Map<string, Set<number>>(); // UID → RECURRENCE-ID instants replaced by their own VEVENT
  type Ev = Record<string, { params: string; value: string }[]>;
  const events: Ev[] = [];
  let cur: Ev | null = null;
  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (l === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = l.indexOf(':'); if (i < 0) continue;
    const [name, ...rest] = l.slice(0, i).split(';');
    (cur[name.toUpperCase()] ??= []).push({ params: rest.join(';'), value: l.slice(i + 1) });
  }
  const one = (e: Ev, k: string) => e[k]?.[0];
  for (const e of events) {
    const rid = one(e, 'RECURRENCE-ID'), uid = one(e, 'UID')?.value;
    if (rid && uid) { const s = parseStamp(rid.value, rid.params, tz); if (s) (overrides.get(uid) ?? overrides.set(uid, new Set()).get(uid)!).add(s.at.getTime()); }
  }
  for (const e of events) {
    if (one(e, 'STATUS')?.value === 'CANCELLED' || one(e, 'TRANSP')?.value === 'TRANSPARENT') continue;
    const ds = one(e, 'DTSTART'); if (!ds) continue;
    const start = parseStamp(ds.value, ds.params, tz); if (!start || start.allDay) continue;
    const de = one(e, 'DTEND');
    let dur = 3600_000;
    const end = de ? parseStamp(de.value, de.params, tz) : null;
    if (end) dur = end.at.getTime() - start.at.getTime();
    else { const d = one(e, 'DURATION')?.value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/); if (d) dur = ((+(d[1] ?? 0) * 24 + +(d[2] ?? 0)) * 60 + +(d[3] ?? 0)) * 60_000; }
    if (!(dur > 0) || dur > 7 * 86_400_000) continue;
    const title = one(e, 'SUMMARY')?.value.replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' ').slice(0, 200) ?? null;
    const push = (t: number) => { if (t + dur > from.getTime() && t < to.getTime() && out.length < max) out.push({ starts_at: new Date(t).toISOString(), ends_at: new Date(t + dur).toISOString(), title }); };
    const rr = one(e, 'RRULE')?.value;
    if (!rr || one(e, 'RECURRENCE-ID')) { push(start.at.getTime()); continue; }
    const r = Object.fromEntries(rr.split(';').map((kv) => kv.split('=') as [string, string]));
    const freq = r.FREQ, interval = Math.max(1, +(r.INTERVAL ?? 1)), count = r.COUNT ? +r.COUNT : Infinity;
    const until = r.UNTIL ? parseStamp(r.UNTIL, '', tz)?.at.getTime() ?? Infinity : Infinity;
    const uid = one(e, 'UID')?.value;
    const skip = new Set<number>(overrides.get(uid ?? '') ?? []);
    for (const x of e.EXDATE ?? []) for (const v of x.value.split(',')) { const s = parseStamp(v, x.params, tz); if (s) skip.add(s.at.getTime()); }
    // Walk the repeats in the event's own time zone so they keep their clock time across daylight saving
    const ezone = ianaZone(ds.params.match(/TZID=([^;:]+)/)?.[1]?.replace(/^"|"$/g, '') ?? (ds.value.endsWith('Z') ? 'UTC' : tz), tz);
    const w = utcToZoned(start.at, ezone);
    const [y0, m0, d0, hh, mm, ss] = [+w.slice(0, 4), +w.slice(4, 6), +w.slice(6, 8), +w.slice(9, 11), +w.slice(11, 13), +w.slice(13, 15)];
    const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const byDay = r.BYDAY ? r.BYDAY.split(',').map((x) => days.indexOf(x.replace(/^[+-]?\d+/, ''))).filter((x) => x >= 0) : null;
    let n = 0;
    const limit = Math.min(to.getTime(), until);
    for (let step = 0; step < 5000 && n < count; step++) {
      let cands: number[] = [];
      if (freq === 'DAILY') cands = [Date.UTC(y0, m0 - 1, d0 + step * interval)];
      else if (freq === 'WEEKLY') {
        const base = Date.UTC(y0, m0 - 1, d0 + step * 7 * interval);
        const wd0 = new Date(Date.UTC(y0, m0 - 1, d0)).getUTCDay();
        cands = (byDay ?? [wd0]).map((wd) => base + (((wd - wd0 + 7) % 7)) * 86_400_000).sort((a, b) => a - b);
      } else if (freq === 'MONTHLY') { const t = Date.UTC(y0, m0 - 1 + step * interval, d0); if (new Date(t).getUTCDate() === d0) cands = [t]; }
      else if (freq === 'YEARLY') { const t = Date.UTC(y0 + step * interval, m0 - 1, d0); if (new Date(t).getUTCDate() === d0) cands = [t]; }
      else { push(start.at.getTime()); break; }
      let past = false;
      for (const c of cands) {
        const dd = new Date(c);
        const at = zonedToUtc(dd.getUTCFullYear(), dd.getUTCMonth() + 1, dd.getUTCDate(), hh, mm, ss, ezone).getTime();
        if (at < start.at.getTime()) continue;
        if (at > limit || n >= count) { past = true; break; }
        n++;
        if (!skip.has(at)) push(at);
      }
      if (past) break;
    }
  }
  return out.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (l: string) => { const parts: string[] = []; let s = l; while (s.length > 74) { parts.push(s.slice(0, 74)); s = ` ${s.slice(74)}`; } parts.push(s); return parts.join('\r\n'); };
const utc = (t: Date) => t.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export type FeedItem = { uid: string; title: string; start: Date; minutes: number; location?: string | null; notes?: string | null; repeat?: string; until?: string | null; skipped?: string[] };
/** A calendar feed Google, Outlook or Apple Calendar can subscribe to. Repeats keep their clock time in the trainer's zone. */
export function buildIcs(name: string, tz: string, items: FeedItem[]): string {
  const rule: Record<string, string> = { daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', biweekly: 'FREQ=WEEKLY;INTERVAL=2', monthly: 'FREQ=MONTHLY' };
  const now = utc(new Date());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dragonfly//Coaching//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`, `X-WR-TIMEZONE:${tz}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  for (const it of items) {
    const local = utcToZoned(it.start, tz);
    lines.push('BEGIN:VEVENT', `UID:${it.uid}@dragonfly`, `DTSTAMP:${now}`, `DTSTART;TZID=${tz}:${local}`, `DTEND;TZID=${tz}:${utcToZoned(new Date(it.start.getTime() + it.minutes * 60_000), tz)}`, `SUMMARY:${esc(it.title)}`);
    if (it.location) lines.push(`LOCATION:${esc(it.location)}`);
    if (it.notes) lines.push(`DESCRIPTION:${esc(it.notes)}`);
    if (it.repeat && rule[it.repeat]) {
      lines.push(`RRULE:${rule[it.repeat]}${it.until ? `;UNTIL=${utc(zonedToUtc(+it.until.slice(0, 4), +it.until.slice(5, 7), +it.until.slice(8, 10), 23, 59, 59, tz))}` : ''}`);
      for (const d of it.skipped ?? []) lines.push(`EXDATE;TZID=${tz}:${d.replace(/-/g, '')}T${local.slice(9)}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Only fetch calendar links from the big calendar services (stops the server being pointed at anything else) */
export function calendarUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim().replace(/^webcals?:\/\//i, 'https://')); } catch { return null; }
  if (u.protocol !== 'https:' || u.port || u.username || u.password) return null;
  const ok = /^(calendar\.google\.com|outlook\.office365\.com|outlook\.live\.com|outlook\.office\.com|[a-z0-9-]+\.icloud\.com|calendar\.zoho\.(com|eu)|calendar\.proton\.me|calendar\.yahoo\.com|export\.calendar\.yandex\.com|calendar\.fastmail\.com|ical\.mac\.com|[a-z0-9-]+\.clubautomation\.com)$/i;
  return ok.test(u.hostname) ? u.toString() : null;
}
