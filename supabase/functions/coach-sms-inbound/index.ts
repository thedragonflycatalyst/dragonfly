// coach-sms-inbound: replies to Dragonfly texts (Twilio webhook, form-encoded). Verifies Twilio's signature, finds the
// client by phone number and the message they're answering, then acts:
//   STOP / START / HELP   consent changes; Twilio Advanced Opt-Out sends the confirmation and HELP texts
//   CONFIRM / RESCHEDULE  confirm, or get the link to move the session in the latest reminder (the trainer is told)
//   CANCEL APPOINTMENT    cancel that session (inside the notice period it still counts as a session) and reply with the policy
//   YES / NO              take or pass on the latest slot offer
//   1–5                   answer the latest survey
//   IN                    join the group session in the latest invite
//   anything else         goes to the app chat, pushes to the trainer's phone, one courtesy reply a day
// Webhook URL (owner sets it in Twilio): https://<project>.supabase.co/functions/v1/coach-sms-inbound
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';
import { cancelReplyText, CONFIRM_REPLY, e164, parseReply, relayText, rescheduleText } from '../_shared/messaging.ts';
import { safeEqual, twilioSignature } from '../_shared/twilio.ts';

const WEB = (Deno.env.get('DRAGONFLY_WEB_URL') ?? 'https://thedragonflycatalyst.github.io/dragonfly/').replace(/\/?$/, '/');

const twiml = (msg?: string) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg.replace(/[<&>]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]!))}</Message>` : ''}</Response>`,
  { status: 200, headers: { 'Content-Type': 'text/xml' } });

type Client = { id: string; trainer_id: string; first_name: string; phone: string | null };

async function latest(admin: SupabaseClient, clientIds: string[], kinds: string[]) {
  const { data } = await admin.from('coach_outbox').select('id, client_id, trainer_id, kind, related, sent_at').in('client_id', clientIds)
    .in('kind', kinds).eq('status', 'sent').order('sent_at', { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !url || !key) return new Response('not configured', { status: 501 });
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  // The public URL Twilio signed (the function sits behind a proxy, so rebuild it from the configured address)
  const publicUrl = Deno.env.get('SMS_INBOUND_URL') ?? `${url}/functions/v1/coach-sms-inbound`;
  const expected = await twilioSignature(token, publicUrl, params);
  if (!safeEqual(expected, req.headers.get('x-twilio-signature') ?? '')) return new Response('forbidden', { status: 403 });

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const from = e164(params.From ?? '');
  const text = (params.Body ?? '').slice(0, 2000);
  if (!from) return twiml();
  // Phone numbers are stored as typed; compare by digits
  const digits = from.replace(/\D/g, '').slice(-10);
  const { data: candidates } = await admin.from('coach_clients').select('id, trainer_id, first_name, phone').ilike('phone', `%${digits.slice(-4)}%`).limit(50);
  const clients = ((candidates ?? []) as Client[]).filter((c) => (e164(c.phone) ?? '').replace(/\D/g, '').endsWith(digits));
  const ids = clients.map((c) => c.id);
  const reply = parseReply(text);
  const log = async (parsed: Record<string, unknown>, c?: { id: string; trainer_id: string } | null, outbox?: string | null) => {
    await admin.from('coach_inbox').insert({ trainer_id: c?.trainer_id ?? null, client_id: c?.id ?? null, channel: 'sms', body: text || '(empty)', parsed, outbox_id: outbox ?? null, handled: parsed.handled === true });
  };
  if (!ids.length) { await log({ kind: reply.kind, unknown_sender: true }); return twiml(); }

  if (reply.kind === 'stop' || reply.kind === 'start') {
    const purposes = reply.kind === 'stop' ? ['reminders', 'offers', 'surveys', 'marketing'] : ['reminders', 'offers'];
    await admin.from('coach_contact_consents').insert(ids.flatMap((id) => purposes.map((purpose) => ({ client_id: id, purpose, channel: 'sms', granted: reply.kind === 'start', source: 'reply' }))));
    for (const c of clients) await log({ kind: reply.kind, handled: true }, c);
    // Twilio sends the carrier's own STOP/START confirmation; don't add a second message
    return twiml();
  }
  if (reply.kind === 'help') {
    // Twilio Advanced Opt-Out (Dragonfly messaging service) sends the registered HELP text; don't send a second one
    for (const c of clients) await log({ kind: 'help', handled: true }, c);
    return twiml();
  }
  if (reply.kind === 'confirm' || reply.kind === 'reschedule') {
    const m = await latest(admin, ids, ['reminder']);
    const c = clients.find((x) => x.id === m?.client_id) ?? clients[0];
    await log({ kind: reply.kind, booking_id: m?.related?.booking_id ?? null, day: m?.related?.day ?? null, handled: reply.kind === 'confirm' }, c, m?.id);
    // Rescheduling is done in the app: another free time, and within 24 hours of the session only the same day
    // The link opens the scheduler with this session ready to move (same day when it's within 24 hours)
    const move = m?.related?.booking_id && m.related.day ? `${WEB}calendar?move=${m.related.booking_id}&day=${m.related.day}` : `${WEB}calendar`;
    // Inside 24 hours the move is same-day only; further out, any open time
    const within24h = !m?.related?.starts || new Date(m.related.starts).getTime() - Date.now() < 24 * 3600_000;
    return twiml(reply.kind === 'confirm' ? CONFIRM_REPLY : rescheduleText(move, within24h));
  }
  if (reply.kind === 'cancel_session') {
    const m = await latest(admin, ids, ['reminder']);
    const c = clients.find((x) => x.id === m?.client_id) ?? clients[0];
    const { data: t } = await admin.from('coach_trainers').select('display_name, business_name, cancel_hours').eq('user_id', c.trainer_id).maybeSingle();
    const hours = t?.cancel_hours ?? 24, trainer = (t?.business_name || t?.display_name || 'your trainer').trim();
    type Cancel = 'cancelled' | 'late_cancelled' | 'not_allowed' | 'no_session';
    let status = 'no_session' as Cancel;
    if (m?.related?.booking_id && m.related.day) {
      const { data: r, error } = await admin.rpc('coach_cancel_by_text', { p_booking: m.related.booking_id, p_on: m.related.day, p_client: c.id });
      const res = (r ?? {}) as { status?: Cancel; starts_at?: string };
      if (!error && res.status) status = res.status;
    }
    await log({ kind: reply.kind, booking_id: m?.related?.booking_id ?? null, day: m?.related?.day ?? null, result: status, handled: status === 'cancelled' || status === 'late_cancelled' }, c, m?.id);
    return twiml(cancelReplyText({ status, hours, link: `${WEB}calendar`, trainer }));
  }
  if (reply.kind === 'yes' || reply.kind === 'no') {
    const m = await latest(admin, ids, ['slot_offer']);
    const tokenId = m?.related?.offer_token as string | undefined;
    if (m && tokenId) {
      const { data: state, error } = await admin.rpc('coach_answer_slot_offer', { p_token: tokenId, p_accept: reply.kind === 'yes' });
      const c = clients.find((x) => x.id === m.client_id) ?? null;
      await log({ kind: reply.kind, offer_state: state ?? null, error: error?.message ?? null, handled: !error }, c, m.id);
      if (error) return twiml('Sorry, something went wrong. Your trainer will follow up.');
      return twiml(state === 'yours' ? 'It’s yours! The session is on your calendar.' : state === 'declined' ? 'No problem, maybe next time.' : 'Sorry, that spot has already been filled.');
    }
  }
  if (reply.kind === 'in') {
    const m = await latest(admin, ids, ['group_invite']);
    const eventId = m?.related?.event_id as string | undefined;
    if (m && eventId) {
      const { data: state, error } = await admin.rpc('coach_event_join_for', { p_event: eventId, p_client: m.client_id });
      await log({ kind: 'in', event_state: state ?? null, error: error?.message ?? null, handled: !error }, clients.find((x) => x.id === m.client_id) ?? null, m.id);
      const words: Record<string, string> = { booked: 'You’re in! See you there.', already: 'You’re already signed up.', waitlist: 'It’s full, so you’re on the waiting list. We’ll tell you if a spot opens.',
        pay: 'Almost there: open the Dragonfly app to pay and confirm your spot.', no_credits: 'You’re out of session credits; your trainer will be in touch.', full: 'Sorry, it’s full.', closed: 'Sorry, that session isn’t open any more.' };
      return twiml(error ? 'Sorry, something went wrong. Your trainer will follow up.' : words[state as string] ?? 'Thanks!');
    }
  }
  if (reply.kind === 'rating') {
    const m = await latest(admin, ids, ['survey']);
    if (m) {
      const c = clients.find((x) => x.id === m.client_id) ?? null;
      const { error } = await admin.rpc('coach_survey_answer', { p_outbox: m.id, p_rating: reply.value, p_comment: null });
      await log({ kind: 'rating', value: reply.value, handled: !error }, c, m.id);
      return twiml('Thank you! Reply with a comment anytime if you’d like to say more.');
    }
  }
  // Anything else (a message meant for the trainer): posted into the client's app chat with the trainer (and kept in the
  // replies list), pushed to the trainer's phone, and one courtesy reply a day says the number is automated (owner 2026-11-08)
  const m = await latest(admin, ids, ['reminder', 'slot_offer', 'survey', 'testimonial_ask', 'referral_ask', 'group_invite', 'note']);
  const c = clients.find((x) => x.id === m?.client_id) ?? clients[0];
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count: recent } = await admin.from('coach_inbox').select('id', { count: 'exact', head: true }).eq('client_id', c.id).eq('channel', 'sms').contains('parsed', { relayed: true }).gte('received_at', since);
  await log({ kind: reply.kind, relayed: true }, c, m?.id ?? null);
  const { data: inChat } = await admin.rpc('coach_sms_to_chat', { p_client: c.id, p_body: text });
  const { data: full } = await admin.from('coach_clients').select('name').eq('id', c.id).maybeSingle();
  try {
    await fetch(`${url}/functions/v1/dragonfly-push`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', user_id: c.trainer_id, app: 'coach', kind: 'reply', title: `💬 Text from ${full?.name || c.first_name}`, body: text.slice(0, 200) || '(empty)', url: `${WEB}chat` }),
    });
  } catch { /* the message is still in the app */ }
  return twiml(recent ? undefined : relayText(c.first_name, inChat === true));
});
