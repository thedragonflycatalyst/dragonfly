// Workout reminders (owner 2026-11-13): "work out Wednesday at 3 PM, doing Legs". The day before, the client gets a
// reminder on their usual channel (text, email or the app; their consent and the trainer's quiet hours apply) with a
// link that starts that routine, plus a phone alert. Once per workout time; weekly ones repeat.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';
import { dateTimeText } from '../_shared/messaging.ts';
import { pickChannel, type ClientRow, type Settings } from './common.ts';
import { defaults } from './waitlist.ts';

const WEB = (Deno.env.get('DRAGONFLY_WEB_URL') ?? 'https://thedragonflycatalyst.github.io/dragonfly/').replace(/\/?$/, '/');
const WEEK = 7 * 86_400_000, DAY = 86_400_000;

/** The next time to work out: the set time, or for weekly ones the first weekly repeat that hasn't passed */
export function nextOccurrence(at: Date, weekly: boolean, now: Date): Date | null {
  if (at > now) return at;
  if (!weekly) return null;
  const k = Math.ceil((now.getTime() - at.getTime()) / WEEK);
  const t = new Date(at.getTime() + k * WEEK);
  return t > now ? t : new Date(t.getTime() + WEEK);
}
/** Due when the workout is within a day and this time hasn't been reminded yet */
export const reminderDue = (occ: Date, lastFor: Date | null, now: Date) => occ.getTime() - now.getTime() <= DAY && occ > now && (!lastFor || lastFor.getTime() !== occ.getTime());

export const workoutReminderText = (first: string, brand: string, title: string, when: string, link: string) =>
  `Hi ${first}, a reminder from ${brand}: your workout "${title}" is ${when}. Start it here when you're ready: ${link}`;

type Row = { id: string; trainer_id: string; client_id: string; routine_id: string; at: string; weekly: boolean; last_notified_for: string | null };

export async function processWorkoutReminders(admin: SupabaseClient, settings: Settings[], now: Date): Promise<number> {
  const { data } = await admin.from('coach_workout_reminders').select('id, trainer_id, client_id, routine_id, at, weekly, last_notified_for').eq('active', true).limit(500);
  let n = 0;
  for (const r of (data ?? []) as Row[]) {
    const occ = nextOccurrence(new Date(r.at), r.weekly, now);
    if (!occ) { await admin.from('coach_workout_reminders').update({ active: false }).eq('id', r.id); continue; }   // a one-time reminder that passed
    if (!reminderDue(occ, r.last_notified_for ? new Date(r.last_notified_for) : null, now)) continue;
    const [{ data: c }, { data: rt }, { data: t }] = await Promise.all([
      admin.from('coach_clients').select('*').eq('id', r.client_id).maybeSingle(),
      admin.from('coach_client_routines').select('title, active').eq('id', r.routine_id).maybeSingle(),
      admin.from('coach_trainers').select('display_name, business_name, timezone').eq('user_id', r.trainer_id).maybeSingle(),
    ]);
    // Mark it first so a failure further on never sends twice
    await admin.from('coach_workout_reminders').update({ last_notified_for: occ.toISOString() }).eq('id', r.id);
    if (!c || !rt?.active || (c as ClientRow).status !== 'active') continue;
    const s = settings.find((x) => x.trainer_id === r.trainer_id) ?? defaults(r.trainer_id);
    const tz = t?.timezone || 'America/New_York', brand = (t?.business_name || t?.display_name || 'your trainer').trim();
    const link = `${WEB}start/${r.routine_id}`;
    const text = workoutReminderText((c as ClientRow).first_name, brand, rt.title, `tomorrow, ${dateTimeText(occ, tz)}`, link).replace('tomorrow, ', occ.getTime() - now.getTime() < 12 * 3_600_000 ? '' : 'tomorrow, ');
    const channel = await pickChannel(admin, s, c as ClientRow, 'reminders');
    if (channel) {
      await admin.from('coach_outbox').insert({ trainer_id: r.trainer_id, client_id: r.client_id, purpose: 'reminders', kind: 'workout_reminder', channel, body: text.slice(0, 480),
        dedupe_key: `wr:${r.id}:${occ.toISOString()}`, related: { routine_id: r.routine_id, starts: occ.toISOString() } });
    }
    // The phone alert opens the routine, ready to start
    if ((c as ClientRow).user_id) {
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/dragonfly-push`, {
          method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send', user_id: (c as ClientRow).user_id, app: 'coach', kind: 'workout', title: `🏋️ ${rt.title} ${occ.getTime() - now.getTime() < 12 * 3_600_000 ? 'today' : 'tomorrow'}`,
            body: `${dateTimeText(occ, tz)}. Tap to start it when you're ready.`, url: link }),
        });
      } catch { /* the outbox message still goes */ }
    }
    n++;
  }
  return n;
}
