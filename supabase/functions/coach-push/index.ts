// coach-push: urgent phone notifications through Dragonfly's own Firebase project.
// POST { action: 'reschedule', request_id } + x-cron-secret   called by the database the moment a client asks to move a session
// POST { action: 'test' } + trainer session                   "Send a test alert" in Settings
// Deploy with --no-verify-jwt (it checks the cron secret or the user's session itself). Needs FCM_SERVICE_ACCOUNT.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';
import { pushConfigured, rescheduleAlertText, sendUrgent } from '../_shared/push.ts';

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

  const send = async (userId: string, title: string, text: string, link: string) => {
    const { data: toks } = await admin.from('coach_push_tokens').select('token').eq('user_id', userId);
    const r = await sendUrgent((toks ?? []).map((t) => t.token as string), title, text, link);
    if (r.dead.length) await admin.from('coach_push_tokens').delete().in('token', r.dead);
    return r.sent;
  };

  if (body.action === 'reschedule') {
    const { data: ok } = await admin.rpc('coach_cron_ok', { p: req.headers.get('x-cron-secret') ?? '' });
    if (ok !== true) return json(403, { error: 'forbidden' });
    if (!UUID.test(String(body.request_id ?? ''))) return json(400, { error: 'bad_request' });
    const { data: r } = await admin.from('coach_reschedule_requests').select('trainer_id, client_id, old_start, new_start, status').eq('id', body.request_id).maybeSingle();
    if (!r || r.status !== 'pending') return json(200, { sent: 0 });
    const [{ data: c }, { data: t }] = await Promise.all([
      admin.from('coach_clients').select('name, first_name').eq('id', r.client_id).maybeSingle(),
      admin.from('coach_trainers').select('timezone').eq('user_id', r.trainer_id).maybeSingle(),
    ]);
    const text = rescheduleAlertText(c?.name || c?.first_name || 'A client', new Date(r.old_start), new Date(r.new_start), t?.timezone || 'America/New_York');
    return json(200, { sent: await send(r.trainer_id, '🚨 Reschedule request', `${text} Tap to approve or decline.`, `${WEB}reschedule/${body.request_id}`) });
  }
  if (body.action === 'test') {
    const { data: me } = await admin.auth.getUser((req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''));
    if (!me?.user) return json(401, { error: 'sign_in_required' });
    return json(200, { sent: await send(me.user.id, '🚨 Reschedule request', 'Test: this is how reschedule requests will reach you.', `${WEB}calendar`) });
  }
  return json(400, { error: 'bad_request' });
});
