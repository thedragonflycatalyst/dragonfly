// Reschedule requests (owner 2026-11-07: clients' moves need the trainer's approval).
//  - The trainer gets a text the moment a request comes in (when texting is on and their phone is saved), on top of
//    the in-app alert bar and pop-up.
//  - The client hears the decision (approved or declined) on their usual channel.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';
import { timeText } from '../_shared/messaging.ts';
import { movedAlertText, rescheduleAlertText } from '../_shared/push.ts';
import { pickChannel, type ClientRow, type Settings } from './common.ts';
import { deliverSms, smsConfigured } from './sms.ts';
import { defaults } from './waitlist.ts';

const WEB = (Deno.env.get('DRAGONFLY_WEB_URL') ?? 'https://thedragonflycatalyst.github.io/dragonfly/').replace(/\/?$/, '/');
type Req = { id: string; client_id: string; trainer_id: string; old_start: string; new_start: string; status: string; reason: string | null };

export const trainerAlertText = (summary: string, link: string) => `RESCHEDULE REQUEST: ${summary} Approve or decline: ${link}`;
/** A client moved their session into an open time (nothing to approve) */
export const trainerMovedText = (summary: string, link: string) => `SESSION MOVED: ${summary} Your calendar: ${link}`;
export const approvedText = (when: string) => `You're all set! Your session is now ${when}. See you then 😁`;
export const declinedText = (asked: string, stays: string, reason: string | null) =>
  `Sorry, ${asked} doesn't work on my end${reason ? ` (${reason})` : ''}. Your session stays ${stays}. Reply RESCHEDULE to look at other times.`;

export async function processReschedules(admin: SupabaseClient, settings: Settings[], now: Date, trainerId?: string): Promise<{ alerted: number; told: number }> {
  const out = { alerted: 0, told: 0 };
  let q = admin.from('coach_reschedule_requests').select('id, client_id, trainer_id, old_start, new_start, status, reason')
    .or('and(status.in.(pending,moved),trainer_alerted_at.is.null),and(status.in.(approved,declined),client_told_at.is.null)').limit(100);
  if (trainerId) q = q.eq('trainer_id', trainerId);
  const { data: rows } = await q;
  const reqs = (rows ?? []) as Req[];
  if (!reqs.length) return out;
  const [{ data: cs }, { data: ts }, { data: ds }] = await Promise.all([
    admin.from('coach_clients').select('*').in('id', [...new Set(reqs.map((r) => r.client_id))]),
    admin.from('coach_trainers').select('user_id, timezone').in('user_id', [...new Set(reqs.map((r) => r.trainer_id))]),
    admin.from('coach_trainer_details').select('user_id, phone').in('user_id', [...new Set(reqs.map((r) => r.trainer_id))]),
  ]);
  for (const r of reqs) {
    const c = ((cs ?? []) as (ClientRow & { name?: string })[]).find((x) => x.id === r.client_id);
    if (!c) continue;
    const tz = (ts ?? []).find((t) => t.user_id === r.trainer_id)?.timezone || 'America/New_York';
    const s = settings.find((x) => x.trainer_id === r.trainer_id) ?? defaults(r.trainer_id);
    const from = timeText(new Date(r.old_start), tz, now), to = timeText(new Date(r.new_start), tz, now);
    if (r.status === 'pending' || r.status === 'moved') {
      const phone = (ds ?? []).find((d) => d.user_id === r.trainer_id)?.phone ?? null;
      if (!s.sms_enabled || !smsConfigured() || !phone) continue;   // the in-app alert still shows
      const who = c.name ?? c.first_name, old = new Date(r.old_start), neu = new Date(r.new_start);
      const sid = await deliverSms(phone, r.status === 'moved' ? trainerMovedText(movedAlertText(who, old, neu, tz, now), `${WEB}calendar`)
        : trainerAlertText(rescheduleAlertText(who, old, neu, tz, now), `${WEB}reschedule/${r.id}`));
      if (sid) { await admin.from('coach_reschedule_requests').update({ trainer_alerted_at: now.toISOString() }).eq('id', r.id); out.alerted++; }
      continue;
    }
    const channel = await pickChannel(admin, s, c, 'reminders');
    if (channel) {
      await admin.from('coach_outbox').insert({ trainer_id: r.trainer_id, client_id: c.id, purpose: 'reminders', kind: 'note', channel,
        body: r.status === 'approved' ? approvedText(to) : declinedText(to, from, r.reason), dedupe_key: `reschedule:${r.id}` });
    }
    await admin.from('coach_reschedule_requests').update({ client_told_at: now.toISOString() }).eq('id', r.id);
    out.told++;
  }
  return out;
}
