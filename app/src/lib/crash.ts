// Crash reports without personal data. Pure so it can be tested; the handler lives in features/crash-reporter.ts.
// A report carries only: error type, a scrubbed message, scrubbed stack frames, the route pattern, platform and
// app version. Never names, emails, phone numbers, ids, tokens, health or payment values.

export type CrashReport = { body: string; app: 'coach'; context: { kind: 'crash'; sig: string; fatal: boolean; platform: string; version: string; screen: string } };

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]*/g;
const KEYISH = /\b(sk|pk|rk|whsec|pi|ch|cus|re|in|sub|acct)_(test_|live_)?[A-Za-z0-9]{8,}\b/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const QUERY = /\?[^\s)]*?(?=:\d+:\d+|[\s)]|$)/g;
const LONG_DIGITS = /\+?\d[\d\s().-]{6,}\d/g;
const QUOTED = /(["'`“‘])(?:(?!\1).){1,200}\1/g;
const NUMBER = /\b\d+([.,]\d+)?\b/g;

/** Identifiers, links and secrets anywhere in the text. */
function scrubCommon(s: string): string {
  return s.replace(JWT, '<token>').replace(KEYISH, '<key>').replace(EMAIL, '<email>').replace(UUID, '<id>').replace(QUERY, '?<q>');
}

/** The error message: also drops quoted text (could be a name or a note) and every number (weights, amounts, phones). */
export function scrubMessage(msg: string): string {
  return scrubCommon(msg).replace(QUOTED, '$1…$1').replace(LONG_DIGITS, '#').replace(NUMBER, '#').slice(0, 300);
}

const FRAME = /^\s*(at\s.+|[\w$.<>\s[\]/-]*@.+:\d+:\d+|.+:\d+:\d+\)?)\s*$/;
/** Stack frames only (function + file:line:col); any line that isn't a frame is dropped. */
export function scrubStack(stack: string | undefined, message = '', max = 25): string[] {
  if (!stack) return [];
  const msg = message.trim();
  return stack.split('\n')
    // V8 repeats the raw message as the first line(s) of the stack: never keep those
    .filter((l) => FRAME.test(l) && !(msg && (l.includes(msg) || msg.includes(l.trim()))))
    .slice(0, max)
    .map((l) => scrubCommon(l.trim()).replace(QUOTED, '$1…$1').slice(0, 200));
}

/** /clients/3f…-…/scale → /clients/[id]/scale; drops the query and anything that isn't a path. */
export function scrubRoute(route: string | undefined): string {
  if (!route) return '';
  return route.split(/[?#]/)[0].split('/').map((seg) => (/[0-9a-f]{8}-[0-9a-f]{4}-|\d{3,}|@/i.test(seg) ? '[id]' : seg)).join('/').slice(0, 120);
}

/** Same error in the same place → same signature, so repeats are sent once a day. */
export function signature(name: string, frames: string[]): string {
  const key = `${name}|${frames[0] ?? ''}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function crashReport(err: unknown, meta: { fatal: boolean; platform: string; version: string; route?: string }): CrashReport {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Non-error thrown');
  const name = /^[A-Za-z]\w{0,40}$/.test(e.name) ? e.name : 'Error';
  const frames = scrubStack(e.stack, e.message);
  const msg = scrubMessage(e.message ?? '');
  const body = [`[crash] ${name}: ${msg}`, ...frames].join('\n').slice(0, 3900);
  return { body, app: 'coach', context: { kind: 'crash', sig: signature(name, frames), fatal: meta.fatal, platform: meta.platform.slice(0, 20), version: meta.version.slice(0, 20), screen: scrubRoute(meta.route) } };
}

export type SentLog = { sig: string; at: string }[];
export const DAILY_LIMIT = 5;
/** At most 5 reports a day per device, and each signature once a day. Returns the log to keep, or null to skip. */
export function admit(sig: string, log: SentLog, now = new Date()): SentLog | null {
  const day = now.getTime() - 86_400_000;
  const recent = log.filter((x) => new Date(x.at).getTime() > day);
  if (recent.length >= DAILY_LIMIT || recent.some((x) => x.sig === sig)) return null;
  return [...recent, { sig, at: now.toISOString() }];
}
