// coach-invite: a trainer onboards a client by email, like My PT Hub.
//
// POST { client_id }  (Authorization: the trainer's Dragonfly session)
//   - no Dragonfly account for that email yet → creates one (no password) and emails a
//     6-digit code to set their password (the shared "reset password" email)
//   - account exists but has never signed in → sends the code again
//   - account exists and is in use → nothing to send; they sign in with it and are linked automatically
// The client record is linked to the account by coach_link_me() when the client signs in.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};
const headers = { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !adminKey || !publicKey) return reply(503, { error: 'unavailable' });
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, adminKey, opts);
  const pub = createClient(url, publicKey, opts);

  // Who is calling
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: me, error: meErr } = await admin.auth.getUser(jwt);
  if (meErr || !me.user) return reply(401, { error: 'sign_in_required' });

  let body: { client_id?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: 'bad_request' }); }
  const clientId = body.client_id;
  if (typeof clientId !== 'string' || !/^[0-9a-f-]{36}$/i.test(clientId)) return reply(400, { error: 'bad_request' });

  // Must be this trainer's own, current client
  const { data: client } = await admin.from('coach_clients')
    .select('id, trainer_id, user_id, email, status').eq('id', clientId).maybeSingle();
  if (!client || client.trainer_id !== me.user.id) return reply(404, { error: 'not_your_client' });
  if (client.status === 'archived') return reply(409, { error: 'client_archived' });
  if (client.user_id) return reply(200, { status: 'linked' });
  const email = String(client.email).trim().toLowerCase();
  if (email === (me.user.email ?? '').toLowerCase()) return reply(409, { error: 'own_email' });

  const { data: rows, error: lookErr } = await admin.rpc('coach_account_for_email', { p_email: email });
  if (lookErr) return reply(503, { error: 'unavailable' });
  const account = (rows as { user_id: string; signed_in: boolean }[] | null)?.[0];

  if (account?.signed_in) return reply(200, { status: 'existing' });

  if (!account) {
    // No password and unconfirmed: confirming the emailed code sets their password and confirms the email
    const { error } = await admin.auth.admin.createUser({ email, email_confirm: false });
    if (error && !/already been registered|already exists/i.test(error.message)) return reply(503, { error: 'create_failed' });
  }
  const { error: sendErr } = await pub.auth.resetPasswordForEmail(email);
  if (sendErr) {
    const limited = sendErr.status === 429 || /rate limit|security purposes/i.test(sendErr.message);
    return reply(limited ? 429 : 503, { error: limited ? 'rate_limited' : 'send_failed' });
  }
  return reply(200, { status: 'sent' });
});
