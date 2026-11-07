// coach-outbox: plans and delivers automatic messages.
//
// POST { action: 'send_now' } + trainer session  delivers that trainer's due messages right away
// POST { action: 'run' } + x-cron-secret   pg_cron every 15 minutes: plan reminders (and, when switched on, surveys,
//                                          testimonial and referral asks), then deliver queued messages that are due.
// Delivery rules, checked again at send time: the client's consent for that purpose and channel, the trainer's quiet
// hours (in the trainer's time zone), a weekly cap on non-essential messages, and no health details in the text.
// Channels (the client picks; default text): 'sms' (texting service, only when the owner has switched it on and it's
// configured), 'manual' (a text that waits in the trainer's "To send" list), 'email' (when configured), 'app' (chat).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';
import { healthWord, nextSendable, occurrences, reminderText, type BookingRow } from '../_shared/messaging.ts';
import { allowed, ESSENTIAL, pickChannel, skipCa, type ClientRow, type Settings } from './common.ts';
import { planEngagement } from './engagement.ts';
import { processOpenSlots } from './waitlist.ts';
import { deliverEmail } from './email.ts';
import { deliverSms, smsConfigured } from './sms.ts';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function planReminders(admin: SupabaseClient, s: Settings, tz: string, trainerName: string, now: Date): Promise<number> {
  if (!s.reminders_on || !s.reminder_hours.length) return 0;
  const horizon = new Date(now.getTime() + (Math.max(...s.reminder_hours) + 1) * 3600_000);
  const { data: bookings } = await admin.from('coach_bookings').select('id, starts_at, duration_min, repeat, repeat_until, skipped, client_id, title, kind, location')
    .eq('trainer_id', s.trainer_id).not('client_id', 'is', null).in('kind', ['session', 'consult']);
  const ids = [...new Set((bookings ?? []).map((b: BookingRow) => b.client_id!))];
  if (!ids.length) return 0;
  const { data: clients } = await admin.from('coach_clients').select('*').in('id', ids);
  const byId = new Map(((clients ?? []) as ClientRow[]).map((c) => [c.id, c]));
  let n = 0;
  for (const b of (bookings ?? []) as BookingRow[]) {
    const c = byId.get(b.client_id!);
    if (!c || c.status !== 'active' && c.status !== 'invited' || skipCa(s, c)) continue;
    for (const o of occurrences(b, now, horizon, tz)) {
      for (const h of s.reminder_hours) {
        const at = new Date(o.start.getTime() - h * 3600_000);
        // Due within this run's window (runs are 15 minutes apart; allow a little overlap, dedupe_key prevents repeats)
        if (at.getTime() < now.getTime() - 20 * 60_000 || at.getTime() > now.getTime() + 15 * 60_000) continue;
        const channel = await pickChannel(admin, s, c, 'reminders');
        if (!channel) continue;
        const body = reminderText({ first: c.first_name, trainer: trainerName, start: o.start, tz, now, sms: channel === 'sms', location: b.location });
        const { error } = await admin.from('coach_outbox').insert({
          trainer_id: s.trainer_id, client_id: c.id, purpose: 'reminders', kind: 'reminder', channel, body: body.slice(0, 480),
          send_after: at.toISOString(), dedupe_key: `rem:${b.id}:${o.day}:${h}`, related: { booking_id: b.id, day: o.day, hours: h },
        });
        if (!error) n++;
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
    return json(200, { delivered: await deliver(admin, new Date(), me.user.id) });
  }
  if (body.action !== 'run') return json(400, { error: 'bad_request' });
  const { data: ok } = await admin.rpc('coach_cron_ok', { p: req.headers.get('x-cron-secret') ?? '' });
  if (ok !== true) return json(401, { error: 'unauthorized' });

  const now = new Date();
  const { data: all } = await admin.from('coach_message_settings').select('*');
  const planned: Record<string, number> = {};
  for (const s of (all ?? []) as Settings[]) {
    const { data: t } = await admin.from('coach_trainers').select('display_name, timezone').eq('user_id', s.trainer_id).maybeSingle();
    if (!t) continue;
    const tz = t.timezone || 'America/New_York';
    const name = (t.display_name || 'your trainer').split(' ')[0];
    try {
      planned[s.trainer_id] = await planReminders(admin, s, tz, name, now) + await planEngagement(admin, s, tz, name, now);
    } catch (e) { console.error('plan', s.trainer_id, e instanceof Error ? e.message : e); }
  }
  try { planned.waitlist = await processOpenSlots(admin, (all ?? []) as Settings[], now); } catch (e) { console.error('waitlist', e instanceof Error ? e.message : e); }
  const delivered = await deliver(admin, now);
  return json(200, { planned, delivered });
});
