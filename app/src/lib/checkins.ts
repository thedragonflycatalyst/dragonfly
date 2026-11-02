// Personal check-ins: who's due, and what's worth asking about. Pure functions (tested).
import { addDays, dayKey, fromKey } from './dates';

export type Channel = 'text' | 'call' | 'in_person' | 'message' | 'email' | 'video';
export const CHANNELS: [Channel, string][] = [['text', 'Text'], ['call', 'Call'], ['in_person', 'In person'], ['message', 'App message'], ['email', 'Email'], ['video', 'Video call']];
export type CheckinPlan = { client_id: string; every_days: number; channel: Channel; paused: boolean; notes: string | null };
export type Checkin = { id: string; client_id: string; done_on: string; channel: Channel; note: string | null; mood: number | null; follow_up_on: string | null; created_at: string };
export const MOODS = ['', 'Struggling', 'Low', 'Okay', 'Good', 'Thriving'];

export type DueStatus = 'overdue' | 'today' | 'soon' | 'later' | 'paused';
export type Due = { due: string; status: DueStatus; days: number };

const between = (a: string, b: string) => Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);

/** When the next check-in is due: the follow-up date if one was set, else the last check-in (or the start) plus the rhythm */
export function nextDue(opts: { last: Pick<Checkin, 'done_on' | 'follow_up_on'> | null; started: string; plan: Pick<CheckinPlan, 'every_days' | 'paused'> | null; defaultDays: number; today?: string }): Due {
  const today = opts.today ?? dayKey(new Date());
  const every = opts.plan?.every_days ?? opts.defaultDays;
  const due = opts.last?.follow_up_on ?? dayKey(addDays(fromKey(opts.last?.done_on ?? opts.started), every));
  const days = between(today, due);
  if (opts.plan?.paused) return { due, status: 'paused', days };
  return { due, days, status: days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 3 ? 'soon' : 'later' };
}

/** Things worth noticing before a check-in, from the last two weeks */
export type Activity = { scheduled: { scheduled_on: string; status: string }[]; lastWorkout: string | null; lastFood: string | null; lastWeigh: string | null };
export function signals(a: Activity, today = dayKey(new Date())): { text: string; level: 'warn' | 'good' }[] {
  const out: { text: string; level: 'warn' | 'good' }[] = [];
  const past = a.scheduled.filter((s) => s.scheduled_on < today);
  const missed = past.filter((s) => s.status === 'scheduled').length;
  const done = past.filter((s) => s.status === 'done').length;
  if (missed >= 2) out.push({ text: `Missed ${missed} workouts`, level: 'warn' });
  else if (past.length >= 3 && done === past.length) out.push({ text: `Did all ${done} workouts`, level: 'good' });
  const since = (d: string | null) => (d ? between(d, today) : null);
  const w = since(a.lastWorkout);
  if (a.scheduled.length && (w === null || w > 10)) out.push({ text: w === null ? 'No workouts logged yet' : `No workout in ${w} days`, level: 'warn' });
  const f = since(a.lastFood);
  if (f !== null && f > 4) out.push({ text: `No food logged in ${f} days`, level: 'warn' });
  else if (f !== null && f <= 1) out.push({ text: 'Logging food', level: 'good' });
  const m = since(a.lastWeigh);
  if (m !== null && m > 30) out.push({ text: `Last weigh-in ${m} days ago`, level: 'warn' });
  return out;
}

/** Sort for the Due list: most overdue first, then by date; paused last */
export const byUrgency = (a: Due, b: Due) => (a.status === 'paused' ? 1 : 0) - (b.status === 'paused' ? 1 : 0) || a.days - b.days;
export const dueLabel = (d: Due) => d.status === 'paused' ? 'Paused'
  : d.status === 'overdue' ? `${-d.days} day${d.days === -1 ? '' : 's'} overdue` : d.status === 'today' ? 'Due today' : `Due in ${d.days} day${d.days === 1 ? '' : 's'}`;
