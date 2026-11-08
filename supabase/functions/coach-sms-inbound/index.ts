// coach-sms-inbound: replies to Dragonfly texts (Twilio webhook, form-encoded). Verifies Twilio's signature, finds the
// client by phone number and the message they're answering, then acts:
//   STOP / START / HELP   consent changes (carrier keywords always win)
//   C / R                 confirm, or get the link to move the session in the latest reminder (the trainer is told)
//   YES / NO              take or pass on the latest slot offer
//   1–5                   answer the latest survey
//   IN                    join the group session in the latest invite
//   anything else         lands in the trainer's replies for them to answer
// Webhook URL (owner sets it in Twilio): https://<project>.supabase.co/functions/v1/coach-sms-inbound
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';
import { e164, parseReply } from '../_shared/messaging.ts';
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
    const { data: t } = await admin.from('coach_trainers').select('display_name').eq('user_id', clients[0].trainer_id).maybeSingle();
    return twiml(`Training messages from ${t?.display_name ?? 'your trainer'} (Dragonfly). Reply STOP to opt out, START to opt back in. Msg & data rates may apply.`);
  }
  if (reply.kind === 'confirm' || reply.kind === 'reschedule') {
    const m = await latest(admin, ids, ['reminder']);
    const c = clients.find((x) => x.id === m?.client_id) ?? clients[0];
    await log({ kind: reply.kind, booking_id: m?.related?.booking_id ?? null, day: m?.related?.day ?? null, handled: reply.kind === 'confirm' }, c, m?.id);
    // Rescheduling is done in the app: another free time, and within 24 hours of the session only the same day
    return twiml(reply.kind === 'confirm' ? 'Thanks, you’re confirmed. See you then!'
      : `To move it, pick a new free time in the app: ${WEB}calendar (within 24 hours of the session, same day only). Your trainer has been told.`);
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
  // Anything else goes to the trainer of the most recent conversation
  const m = await latest(admin, ids, ['reminder', 'slot_offer', 'survey', 'testimonial_ask', 'referral_ask', 'group_invite', 'note']);
  await log({ kind: reply.kind }, clients.find((x) => x.id === m?.client_id) ?? clients[0], m?.id ?? null);
  return twiml();
});
