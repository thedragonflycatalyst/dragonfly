// dragonfly-push: phone notifications for every Dragonfly app (one system: Firebase for Android, Apple for iPhone).
// POST { action: 'send', user_id, app?, title, body, url?, kind? } + service-role key   any app's server code
// POST { action: 'reschedule', request_id } + x-cron-secret   called by the database the moment a client moves (or asks to move) a session
// POST { action: 'followup', followup_id } + x-cron-secret   a to-do that stays until done (e.g. update ClubAutomation)
// POST { action: 'test' } + trainer session                   "Send a test alert" in Settings
// Deploy with --no-verify-jwt (it checks the cron secret or the user's session itself). Android needs FCM_SERVICE_ACCOUNT;
// iPhone needs APNS_KEY, APNS_KEY_ID and APNS_TEAM_ID.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';
import { type Device, FOLLOWUP_TITLE, followupBody, movedAlertText, pushConfigured, rescheduleAlertText, sendUrgent } from '../_shared/push.ts';

const WEB = (Deno.env.get('DRAGONFLY_WEB_URL') ?? 'https://thedragonflycatalyst.github.io/dragonfly/').replace(/\/?$/, '/');
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json(503, { error: 'unavailable' });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: 'bad_request' }); }
  if (!pushConfigured()) return json(501, { error: 'not_configured' });

  const send = async (userId: string, title: string, text: string, link: string, kind = 'reschedule', app = 'coach') => {
    const { data: toks } = await admin.from('dragonfly_push_tokens').select('token, platform').eq('user_id', userId).eq('app', app);
    const r = await sendUrgent((toks ?? []) as Device[], title, text, link, kind);
    if (r.dead.length) await admin.from('dragonfly_push_tokens').delete().in('token', r.dead);
    return r.sent;
  };

  if (body.action === 'reschedule') {
    const { data: ok } = await admin.rpc('coach_cron_ok', { p: req.headers.get('x-cron-secret') ?? '' });
    if (ok !== true) return json(403, { error: 'forbidden' });
    if (!UUID.test(String(body.request_id ?? ''))) return json(400, { error: 'bad_request' });
    const { data: r } = await admin.from('coach_reschedule_requests').select('trainer_id, client_id, old_start, new_start, status').eq('id', body.request_id).maybeSingle();
    if (!r || (r.status !== 'pending' && r.status !== 'moved')) return json(200, { sent: 0 });
    const [{ data: c }, { data: t }] = await Promise.all([
      admin.from('coach_clients').select('name, first_name').eq('id', r.client_id).maybeSingle(),
      admin.from('coach_trainers').select('timezone').eq('user_id', r.trainer_id).maybeSingle(),
    ]);
    const who = c?.name || c?.first_name || 'A client', tz = t?.timezone || 'America/New_York';
    // Moved by the client into an open time: already done, just let the trainer know
    if (r.status === 'moved') return json(200, { sent: await send(r.trainer_id, '📅 Session moved', movedAlertText(who, new Date(r.old_start), new Date(r.new_start), tz), `${WEB}calendar`, 'moved') });
    const text = rescheduleAlertText(who, new Date(r.old_start), new Date(r.new_start), tz);
    return json(200, { sent: await send(r.trainer_id, '🚨 Reschedule request', `${text} Tap to approve or decline.`, `${WEB}reschedule/${body.request_id}`) });
  }
  if (body.action === 'send') {
    // Server-to-server only: the caller presents the service-role key (other apps' edge functions have it)
    if ((req.headers.get('Authorization') ?? '') !== `Bearer ${key}`) return json(403, { error: 'forbidden' });
    const app = String(body.app ?? 'coach'), title = String(body.title ?? '').slice(0, 100), text = String(body.body ?? '').slice(0, 300);
    if (!UUID.test(String(body.user_id ?? '')) || !/^[a-z][a-z0-9-]{1,30}$/.test(app) || !title || !text) return json(400, { error: 'bad_request' });
    const link = typeof body.url === 'string' && /^https:\/\//.test(body.url) ? body.url : WEB;
    return json(200, { sent: await send(String(body.user_id), title, text, link, String(body.kind ?? 'notice').slice(0, 30), app) });
  }
  if (body.action === 'followup') {
    const { data: ok } = await admin.rpc('coach_cron_ok', { p: req.headers.get('x-cron-secret') ?? '' });
    if (ok !== true) return json(403, { error: 'forbidden' });
    if (!UUID.test(String(body.followup_id ?? ''))) return json(400, { error: 'bad_request' });
    const { data: f } = await admin.from('coach_followups').select('trainer_id, title, status, alerts').eq('id', body.followup_id).maybeSingle();
    if (!f || f.status !== 'open') return json(200, { sent: 0 });
    const sent = await send(f.trainer_id, FOLLOWUP_TITLE, followupBody(f.title), `${WEB}followups`, 'followup');
    await admin.from('coach_followups').update({ alerts: (f.alerts ?? 0) + 1, last_alert_at: new Date().toISOString() }).eq('id', body.followup_id);
    return json(200, { sent });
  }
  if (body.action === 'test') {
    const { data: me } = await admin.auth.getUser((req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''));
    if (!me?.user) return json(401, { error: 'sign_in_required' });
    return json(200, { sent: await send(me.user.id, '🚨 Reschedule request', 'Test: this is how reschedule requests will reach you.', `${WEB}calendar`) });
  }
  return json(400, { error: 'bad_request' });
});
