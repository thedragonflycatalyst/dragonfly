// Open times (cancellations recorded by the database) go to the slot waitlist, first come first served:
// someone who asked to be booked automatically is booked in (if the trainer lets clients book themselves) and told;
// otherwise everyone waiting gets an offer link and the first to accept gets it. Times the trainer is already
// filling by hand (an offer exists for that start) are left alone; new cancellations wait 10 minutes for that.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';
import { timeText } from '../_shared/messaging.ts';
import { pickChannel, skipCa, type ClientRow, type Settings } from './common.ts';

const WEB = (Deno.env.get('DRAGONFLY_WEB_URL') ?? 'https://thedragonflycatalyst.github.io/dragonfly/').replace(/\/?$/, '/');
type Open = { id: string; trainer_id: string; starts_at: string; duration_min: number };
type Wait = { id: string; client_id: string; mode: string };

export const bookedText = (first: string, trainer: string, when: string) =>
  `Good news ${first}: a spot opened ${when} and you're booked in with ${trainer} (from your waitlist). Can't make it? Cancel in the app.`;
export const openText = (first: string, trainer: string, when: string, link: string) =>
  `Hi ${first}, the time you're waiting for with ${trainer} opened up: ${when}. First to grab it gets it: ${link}`;

const defaults = (trainer_id: string): Settings => ({
  trainer_id, quiet_start: '21:00', quiet_end: '08:00', max_per_week: 3, reminders_on: false, reminder_hours: [24], surveys_on: false, survey_every: 4,
  survey_min_days: 14, testimonials_on: false, referrals_on: false, referral_every_days: 90, include_ca_clients: false, sms_enabled: false,
});

export async function processOpenSlots(admin: SupabaseClient, settings: Settings[], now: Date): Promise<number> {
  const { data: open } = await admin.from('coach_open_slots').select('id, trainer_id, starts_at, duration_min').is('processed_at', null)
    .lte('created_at', new Date(now.getTime() - 10 * 60_000).toISOString()).order('created_at').limit(100);
  let n = 0;
  for (const o of (open ?? []) as Open[]) {
    const done = (result: string) => admin.from('coach_open_slots').update({ processed_at: new Date().toISOString(), result }).eq('id', o.id);
    const start = new Date(o.starts_at);
    if (start.getTime() < now.getTime() + 3600_000) { await done('too_soon'); continue; }
    // The waitlist works even if the trainer hasn't set up automatic messages (conservative defaults)
    const s = settings.find((x) => x.trainer_id === o.trainer_id) ?? defaults(o.trainer_id);
    const { count } = await admin.from('coach_slot_offers').select('id', { count: 'exact', head: true }).eq('trainer_id', o.trainer_id).eq('starts_at', o.starts_at);
    if (count) { await done('trainer_offered'); continue; }
    const { data: w } = await admin.rpc('coach_waitlist_for', { p_trainer: o.trainer_id, p_starts: o.starts_at, p_minutes: o.duration_min });
    const waiting = (w ?? []) as Wait[];
    if (!waiting.length) { await done('no_waitlist'); continue; }
    const [{ data: t }, { data: cs }, { data: canBook }] = await Promise.all([
      admin.from('coach_trainers').select('display_name, timezone').eq('user_id', o.trainer_id).maybeSingle(),
      admin.from('coach_clients').select('*').in('id', waiting.map((x) => x.client_id)),
      admin.rpc('coach_perm', { p_trainer: o.trainer_id, p_key: 'book_sessions' }),
    ]);
    const tz = t?.timezone || 'America/New_York', trainer = (t?.display_name || 'your trainer').split(' ')[0];
    const when = timeText(start, tz, now);
    const byId = new Map(((cs ?? []) as ClientRow[]).map((c) => [c.id, c]));
    // 1) First person who asked to be booked automatically
    const auto = canBook === true ? waiting.find((x) => x.mode === 'auto_book' && byId.get(x.client_id)?.status === 'active') : undefined;
    if (auto) {
      const c = byId.get(auto.client_id)!;
      const { error } = await admin.rpc('coach_waitlist_book', { p_entry: auto.id, p_starts: o.starts_at });
      if (!error) {
        const channel = await pickChannel(admin, s, c, 'offers');
        if (channel) await admin.from('coach_outbox').insert({ trainer_id: o.trainer_id, client_id: c.id, purpose: 'offers', kind: 'note', channel, body: bookedText(c.first_name, trainer, when), dedupe_key: `waitbook:${o.id}` });
        await done(`booked:${c.id}`); n++; continue;
      }
      if (/slot_taken/.test(error.message)) { await done('slot_taken'); continue; }
    }
    // 2) Everyone waiting gets an offer link
    const people = waiting.map((x) => byId.get(x.client_id)).filter((c): c is ClientRow => !!c && c.status === 'active' && !skipCa(s, c));
    if (!people.length) { await done('no_one_reachable'); continue; }
    const { data: offer, error: oe } = await admin.from('coach_slot_offers').insert({
      trainer_id: o.trainer_id, starts_at: o.starts_at, duration_min: o.duration_min, title: 'Training session',
      expires_at: new Date(Math.max(now.getTime() + 15 * 60_000, start.getTime() - 3600_000)).toISOString(),
    }).select('id').single();
    if (oe || !offer) { await done('offer_failed'); continue; }
    const { data: rec } = await admin.from('coach_slot_offer_recipients').insert(people.map((c) => ({ offer_id: offer.id, client_id: c.id }))).select('client_id, token');
    for (const r of (rec ?? []) as { client_id: string; token: string }[]) {
      const c = byId.get(r.client_id)!;
      const channel = await pickChannel(admin, s, c, 'offers');
      if (!channel) continue;
      await admin.from('coach_outbox').insert({ trainer_id: o.trainer_id, client_id: c.id, purpose: 'offers', kind: 'slot_offer', channel,
        body: openText(c.first_name, trainer, when, `${WEB}o/${r.token}`), related: { offer_token: r.token, offer_id: offer.id }, dedupe_key: `waitoffer:${o.id}:${c.id}` });
      await admin.from('coach_slot_offer_recipients').update({ sent_at: new Date().toISOString(), channel: channel === 'manual' ? 'sms' : channel }).eq('token', r.token);
      n++;
    }
    await done(`offered:${people.length}`);
  }
  return n;
}
