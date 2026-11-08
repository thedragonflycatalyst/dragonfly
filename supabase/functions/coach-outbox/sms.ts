// Texting service adapter (Twilio REST). Off unless the owner has approved a service and set these secrets:
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and either TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM (+1XXXXXXXXXX).
// US business texting also needs carrier (A2P 10DLC) registration, done by the owner in the Twilio console.
import { e164 } from '../_shared/messaging.ts';

export function smsConfigured(): boolean {
  return !!(Deno.env.get('TWILIO_ACCOUNT_SID') && Deno.env.get('TWILIO_AUTH_TOKEN') && (Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') || Deno.env.get('TWILIO_FROM')));
}

/** Sends one text; returns the provider's message id, or null if it couldn't be sent */
export async function deliverSms(phone: string | null, body: string): Promise<string | null> {
  const to = e164(phone);
  if (!to || !smsConfigured()) return null;
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')!, token = Deno.env.get('TWILIO_AUTH_TOKEN')!;
  const form = new URLSearchParams({ To: to, Body: body });
  const svc = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  if (svc) form.set('MessagingServiceSid', svc); else form.set('From', Deno.env.get('TWILIO_FROM')!);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
  });
  if (!res.ok) { console.error('sms', res.status, (await res.text()).slice(0, 200)); return null; }
  const j = await res.json() as { sid?: string };
  return j.sid ?? null;
}
