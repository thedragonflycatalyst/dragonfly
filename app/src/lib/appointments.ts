// Client appointments (issue #56): the 24-hour rules shown to clients, worded the way the server enforces them.
// The server is the authority (coach_cancel_session, coach_reschedule_session); these only decide what to show.

const HOUR = 3_600_000;

/** Inside the notice period, or exactly at it, a cancellation still counts as a session */
export const isLateCancel = (start: Date, now: Date, noticeHours: number) => start.getTime() - now.getTime() <= noticeHours * HOUR;

/** Within 24 hours (exactly 24 included) a session can only move to another time the same day */
export const sameDayOnly = (start: Date, now: Date) => start.getTime() - now.getTime() <= 24 * HOUR;

const hrs = (h: number) => `${h} hour${h === 1 ? '' : 's'}`;

/** The confirmation before cancelling: says plainly whether it will count as a session */
export function cancelPrompt(start: Date, now: Date, noticeHours: number, when: string): { title: string; body: string; action: string; late: boolean } {
  const late = isLateCancel(start, now, noticeHours);
  return late
    ? { late, title: 'Late cancellation', action: 'Cancel anyway',
        body: `${when} is less than ${hrs(noticeHours)} away, so cancelling now still counts as a session (it uses a package session or is charged at the single-session price). You can move it to another time today instead.` }
    : { late, title: 'Cancel this session?', action: 'Cancel session',
        body: `${when}. You're cancelling more than ${hrs(noticeHours)} ahead, so it won't count as a session.` };
}

export type LogAction = 'booked' | 'moved' | 'cancelled' | 'late_cancelled';
export type LogEntry = { id: string; action: LogAction; via: 'app' | 'text' | 'trainer'; old_start: string | null; new_start: string | null; created_at: string };

/** One line for the history list */
export function logLine(e: LogEntry, fmt: (d: Date) => string): string {
  const o = e.old_start ? fmt(new Date(e.old_start)) : '', n = e.new_start ? fmt(new Date(e.new_start)) : '';
  const by = e.via === 'trainer' ? ' by your trainer' : e.via === 'text' ? ' by text' : '';
  switch (e.action) {
    case 'booked': return `Booked ${n}`;
    case 'moved': return `Moved${by} from ${o} to ${n}`;
    case 'cancelled': return `Cancelled ${o}${by}`;
    case 'late_cancelled': return `Cancelled ${o}${by} (late, counts as a session)`;
  }
}

/** Status shown on an upcoming session: moved if its time was set by a move */
export function upcomingStatus(start: Date, log: LogEntry[]): 'Booked' | 'Moved' {
  return log.some((e) => e.action === 'moved' && e.new_start && new Date(e.new_start).getTime() === start.getTime()) ? 'Moved' : 'Booked';
}
