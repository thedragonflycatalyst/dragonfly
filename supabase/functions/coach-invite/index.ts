// coach-invite: a trainer onboards a client by email, like My PT Hub.
//
// POST { client_id }  (Authorization: the trainer's Dragonfly session)
//   - no Dragonfly account for that email yet → creates one (no password) and emails a
//     6-digit code to set their password (the shared "reset password" email)
//   - account exists but has never signed in → sends the code again
//   - account exists and is in use → nothing to send; they sign in with it and are linked automatically
// The client record is linked to the account by coach_link_me() when the client signs in.
//
// POST { member_id }  (team owner): the same email for a trainer added to the owner's team; they join with
// coach_join_team() when they sign in.
// A team owner viewing one of their trainers (x-dragonfly-trainer + x-dragonfly-edit: 1) can invite that trainer's clients.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dragonfly-trainer, x-dragonfly-edit',
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

  let body: { client_id?: unknown; member_id?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: 'bad_request' }); }
  const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

  if (body.member_id !== undefined) {
    if (!isId(body.member_id)) return reply(400, { error: 'bad_request' });
    const { data: member } = await admin.from('coach_team_members').select('id, email, status, trainer_id, team_id, coach_teams!inner(owner_id)').eq('id', body.member_id).maybeSingle();
    const owner = (member as unknown as { coach_teams?: { owner_id: string } } | null)?.coach_teams?.owner_id;
    if (!member || owner !== me.user.id) return reply(404, { error: 'not_your_team_member' });
    if (member.status === 'removed') return reply(409, { error: 'member_removed' });
    if (member.trainer_id) return reply(200, { status: 'linked' });
    return await sendSetup(String(member.email).trim().toLowerCase());
  }

  // Whose client: yours, or (for a team owner with emergency editing on) the trainer you're viewing
  let trainerId = me.user.id;
  const viewing = req.headers.get('x-dragonfly-trainer');
  if (viewing && viewing !== me.user.id) {
    if (req.headers.get('x-dragonfly-edit') !== '1') return reply(403, { error: 'view_only' });
    const { data: team } = await admin.from('coach_teams').select('id').eq('owner_id', me.user.id).maybeSingle();
    const { data: m } = team ? await admin.from('coach_team_members').select('id').eq('team_id', team.id).eq('trainer_id', viewing).eq('status', 'active').maybeSingle() : { data: null };
    if (!m) return reply(403, { error: 'not_your_team_member' });
    trainerId = viewing;
  }

  const clientId = body.client_id;
  if (!isId(clientId)) return reply(400, { error: 'bad_request' });

  // Must be this trainer's own, current client
  const { data: client } = await admin.from('coach_clients')
    .select('id, trainer_id, user_id, email, status').eq('id', clientId).maybeSingle();
  if (!client || client.trainer_id !== trainerId) return reply(404, { error: 'not_your_client' });
  if (client.status === 'archived') return reply(409, { error: 'client_archived' });
  if (client.user_id) return reply(200, { status: 'linked' });
  const email = String(client.email).trim().toLowerCase();
  if (email === (me.user.email ?? '').toLowerCase()) return reply(409, { error: 'own_email' });

  return await sendSetup(email);

  // Email a code to set a password (new or never-used accounts); in-use accounts just sign in
  async function sendSetup(email: string): Promise<Response> {
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
  }
});
