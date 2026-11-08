// coach-outbox: plans and delivers automatic messages.
//
// POST { action: 'send_now' } + trainer session  delivers that trainer's due messages right away (and reschedule decisions)
// POST { action: 'run' } + x-cron-secret   pg_cron every 15 minutes: plan reminders (and, when switched on, surveys,
//                                          testimonial and referral asks), then deliver queued messages that are due.
// Delivery rules, checked again at send time: the client's consent for that purpose and channel, the trainer's quiet
// hours (in the trainer's time zone), a weekly cap on non-essential messages, and no health details in the text.
// Channels (the client picks; default text): 'sms' (texting service, only when the owner has switched it on and it's
// configured), 'manual' (a text that waits in the trainer's "To send" list), 'email' (when configured), 'app' (chat).
// Also each run: session billing (attach packages / single-session charges, charge cards on file; see billing.ts).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';
import { healthWord, nextSendable, occurrences, reminderAt, reminderText, type BookingRow, type Stage } from '../_shared/messaging.ts';
import { allowed, ESSENTIAL, pickChannel, skipCa, type ClientRow, type Settings } from './common.ts';
import { planEngagement } from './engagement.ts';
import { processOpenSlots } from './waitlist.ts';
import { processCharges } from './billing.ts';
import { processReschedules } from './reschedule.ts';
import { processFollowups } from './followups.ts';
import { deliverEmail } from './email.ts';
import { deliverSms, smsConfigured } from './sms.ts';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Reminder plan (see reminderText): 'booked' note, 'main' ~48 h ask (8 AM), 'nudge' at 24 h only if not confirmed,
// 'dayof' 8 AM see-you-today. Trainer settings reminder_hours switch them: 48 = main, 24 = nudge, 2 = morning-of.
const STAGE_HOURS: Record<Exclude<Stage, 'booked'>, number> = { main: 48, nudge: 24, dayof: 2 };
async function planReminders(admin: SupabaseClient, s: Settings, tz: string, brand: string, now: Date): Promise<number> {
  if (!s.reminders_on) return 0;
  const horizon = new Date(now.getTime() + 3 * 86_400_000);
  const { data: bookings } = await admin.from('coach_bookings').select('id, starts_at, duration_min, repeat, repeat_until, skipped, client_id, title, kind, location, created_at')
    .eq('trainer_id', s.trainer_id).not('client_id', 'is', null).in('kind', ['session', 'consult']);
  const ids = [...new Set((bookings ?? []).map((b: BookingRow) => b.client_id!))];
  if (!ids.length) return 0;
  const [{ data: clients }, { data: confirms }] = await Promise.all([
    admin.from('coach_clients').select('*').in('id', ids),
    admin.from('coach_inbox').select('parsed').eq('trainer_id', s.trainer_id).eq('parsed->>kind', 'confirm').gte('received_at', new Date(now.getTime() - 4 * 86_400_000).toISOString()),
  ]);
  const confirmed = new Set(((confirms ?? []) as { parsed: { booking_id?: string; day?: string } }[]).map((r) => `${r.parsed.booking_id}:${r.parsed.day}`));
  const byId = new Map(((clients ?? []) as ClientRow[]).map((c) => [c.id, c]));
  const inWindow = (at: Date) => at.getTime() >= now.getTime() - 20 * 60_000 && at.getTime() <= now.getTime() + 15 * 60_000;
  let n = 0;
  for (const b of (bookings ?? []) as (BookingRow & { created_at: string })[]) {
    const c = byId.get(b.client_id!);
    if (!c || c.status !== 'active' && c.status !== 'invited' || skipCa(s, c)) continue;
    const created = new Date(b.created_at);
    const occ = occurrences(b, now, horizon, tz);
    const queue = async (stage: Stage, o: { start: Date; day: string }, at: Date, key: string) => {
      const channel = await pickChannel(admin, s, c, 'reminders');
      if (!channel) return;
      if (stage === 'nudge' && channel !== 'sms') return;   // only a text can be answered with CONFIRM
      const body = reminderText({ stage, first: c.first_name, brand, start: o.start, tz, now, sms: channel === 'sms', location: b.location });
      const { error } = await admin.from('coach_outbox').insert({
        trainer_id: s.trainer_id, client_id: c.id, purpose: 'reminders', kind: 'reminder', channel, body: body.slice(0, 480),
        send_after: (at > now ? at : now).toISOString(), dedupe_key: key, related: { booking_id: b.id, day: o.day, stage, starts: o.start.toISOString() },
      });
      if (!error) n++;
    };
    // Just booked: one note for the first upcoming session (only for bookings made in the last 6 hours)
    if (occ[0] && now.getTime() - created.getTime() < 6 * 3600_000 && occ[0].start.getTime() - now.getTime() > 2 * 3600_000) {
      await queue('booked', occ[0], now, `booked:${b.id}`);
    }
    for (const o of occ) {
      const isConfirmed = confirmed.has(`${b.id}:${o.day}`);
      for (const stage of ['main', 'nudge', 'dayof'] as const) {
        if (!s.reminder_hours.includes(STAGE_HOURS[stage])) continue;
        if (stage === 'nudge' && isConfirmed) continue;
        const at = reminderAt(stage, o.start, tz);
        if (!at) continue;
        // A session booked after its main-reminder time (but still over 25 hours out) gets the main reminder now
        const late = stage === 'main' && at < now && created > at && o.start.getTime() - now.getTime() > 25 * 3600_000;
        if (!inWindow(at) && !late) continue;
        await queue(stage, o, at, `rem:${b.id}:${o.day}:${stage}`);
      }
    }
  }
  return n;
}

async function deliver(admin: SupabaseClient, now: Date, onlyTrainer?: string): Promise<Record<string, number>> {
  const out: Record<string, number> = { sent: 0, skipped: 0, failed: 0, deferred: 0 };
  let q = admin.from('coach_outbox').select('*').eq('status', 'queued').not('channel', 'in', '(manual,manual_email)').lte('send_after', now.toISOString());
  if (onlyTrainer) q = q.eq('trainer_id', onlyTrainer);
  const { data: due } = await q.order('send_after').limit(200);
  const settings = new Map<string, Settings & { tz: string }>();
  for (const m of due ?? []) {
    if (!settings.has(m.trainer_id)) {
      const [{ data: s }, { data: t }] = await Promise.all([
        admin.from('coach_message_settings').select('*').eq('trainer_id', m.trainer_id).maybeSingle(),
        admin.from('coach_trainers').select('timezone').eq('user_id', m.trainer_id).maybeSingle(),
      ]);
      if (s) settings.set(m.trainer_id, { ...(s as Settings), tz: t?.timezone || 'America/New_York' });
    }
    const s = settings.get(m.trainer_id);
    const skip = async (reason: string) => { await admin.from('coach_outbox').update({ status: 'skipped', skip_reason: reason }).eq('id', m.id); out.skipped++; };
    if (!s) { await skip('messaging_off'); continue; }
    if (!(await allowed(admin, m.client_id, m.purpose, m.channel))) { await skip('no_consent'); continue; }
    const hw = healthWord(m.body);
    if (hw) { await skip(`health_word:${hw}`); continue; }
    const when = nextSendable(now, s.tz, s.quiet_start, s.quiet_end);
    if (when > now) { await admin.from('coach_outbox').update({ send_after: when.toISOString() }).eq('id', m.id); out.deferred++; continue; }
    if (!ESSENTIAL.includes(m.purpose)) {
      const { count } = await admin.from('coach_outbox').select('id', { count: 'exact', head: true }).eq('client_id', m.client_id).eq('status', 'sent')
        .not('purpose', 'in', '(reminders,offers)').gte('sent_at', new Date(now.getTime() - 7 * 86400_000).toISOString());
      if ((count ?? 0) >= s.max_per_week) { await skip('weekly_cap'); continue; }
    }
    // Reminders are pointless once the session has started
    if (m.kind === 'reminder' && m.related?.day && now.getTime() - new Date(m.send_after).getTime() > 6 * 3600_000) { await skip('too_late'); continue; }
    try {
      let ok = false, provider: string | null = null;
      if (m.channel === 'app') ok = (await admin.rpc('coach_outbox_deliver_app', { p_outbox: m.id })).data === true;
      else if (m.channel === 'sms') {
        if (!s.sms_enabled || !smsConfigured()) { await skip('sms_not_available'); continue; }
        const { data: c } = await admin.from('coach_clients').select('phone').eq('id', m.client_id).maybeSingle();
        provider = await deliverSms(c?.phone ?? null, m.body);
        ok = !!provider;
      } else if (m.channel === 'email') {
        const { data: c } = await admin.from('coach_clients').select('email').eq('id', m.client_id).maybeSingle();
        provider = await deliverEmail(c?.email ?? null, m.kind, m.body);
        ok = !!provider;
      } else { await skip('channel_not_available'); continue; }
      await admin.from('coach_outbox').update(ok ? { status: 'sent', sent_at: new Date().toISOString(), provider_id: provider, attempts: m.attempts + 1 }
        : { status: m.attempts >= 2 ? 'failed' : 'queued', attempts: m.attempts + 1, send_after: new Date(now.getTime() + 15 * 60_000).toISOString() }).eq('id', m.id);
      if (ok) out.sent++; else out.failed++;
    } catch (e) {
      console.error('deliver', m.id, e instanceof Error ? e.message : e);
      await admin.from('coach_outbox').update({ status: m.attempts >= 2 ? 'failed' : 'queued', attempts: m.attempts + 1, skip_reason: 'error' }).eq('id', m.id);
      out.failed++;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json(503, { error: 'unavailable' });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: 'bad_request' }); }
  // A trainer who just queued something urgent (an open-slot offer, a group invite) delivers their own queue now
  if (body.action === 'send_now') {
    const { data: me } = await admin.auth.getUser((req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''));
    if (!me?.user) return json(401, { error: 'sign_in_required' });
    const { data: tr } = await admin.from('coach_trainers').select('user_id').eq('user_id', me.user.id).maybeSingle();
    if (!tr) return json(403, { error: 'trainers_only' });
    // A just-decided reschedule request is told to the client right away
    const { data: mine } = await admin.from('coach_message_settings').select('*').eq('trainer_id', me.user.id);
    try { await processReschedules(admin, (mine ?? []) as Settings[], new Date(), me.user.id); } catch (e) { console.error('reschedule', e instanceof Error ? e.message : e); }
    return json(200, { delivered: await deliver(admin, new Date(), me.user.id) });
  }
  if (body.action !== 'run') return json(400, { error: 'bad_request' });
  const { data: ok } = await admin.rpc('coach_cron_ok', { p: req.headers.get('x-cron-secret') ?? '' });
  if (ok !== true) return json(401, { error: 'unauthorized' });

  const now = new Date();
  const { data: all } = await admin.from('coach_message_settings').select('*');
  const planned: Record<string, number> = {};
  for (const s of (all ?? []) as Settings[]) {
    const { data: t } = await admin.from('coach_trainers').select('display_name, business_name, timezone').eq('user_id', s.trainer_id).maybeSingle();
    if (!t) continue;
    const tz = t.timezone || 'America/New_York';
    // Texts are signed with the business, never a personal name (owner 2026-11-07)
    const brand = (t.business_name || t.display_name || 'your trainer').trim();
    const name = brand;
    try {
      planned[s.trainer_id] = await planReminders(admin, s, tz, brand, now) + await planEngagement(admin, s, tz, name, now);
    } catch (e) { console.error('plan', s.trainer_id, e instanceof Error ? e.message : e); }
  }
  try { planned.waitlist = await processOpenSlots(admin, (all ?? []) as Settings[], now); } catch (e) { console.error('waitlist', e instanceof Error ? e.message : e); }
  try { planned.reschedules = (await processReschedules(admin, (all ?? []) as Settings[], now)).told; } catch (e) { console.error('reschedule', e instanceof Error ? e.message : e); }
  try { planned.followups = await processFollowups(admin, now); } catch (e) { console.error('followups', e instanceof Error ? e.message : e); }
  let billing: Record<string, number> = {};
  try { billing = await processCharges(admin, now); } catch (e) { console.error('billing', e instanceof Error ? e.message : e); }
  const delivered = await deliver(admin, now);
  return json(200, { planned, delivered, billing });
});
