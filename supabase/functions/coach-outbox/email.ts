// Email adapter (Resend). Off unless these secrets are set (owner-only): RESEND_API_KEY and COACH_EMAIL_FROM
// (for example "Dragonfly Coach <coach@thedragonflycatalyst.org>", on a domain verified in Resend).
export function emailConfigured(): boolean {
  return !!(Deno.env.get('RESEND_API_KEY') && Deno.env.get('COACH_EMAIL_FROM'));
}

const SUBJECT: Record<string, string> = {
  reminder: 'Session reminder', slot_offer: 'A training spot opened up', survey: 'Quick question from your trainer',
  testimonial_ask: 'Would you share your experience?', referral_ask: 'Know someone who’d enjoy training?', group_invite: 'Group session invite', workout_reminder: 'Workout reminder', note: 'A message from your trainer',
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Sends one email; returns the provider's id, or null if it couldn't be sent */
export async function deliverEmail(to: string | null, kind: string, body: string): Promise<string | null> {
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to) || !emailConfigured()) return null;
  const html = `<p style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5">${esc(body).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`
    + '<p style="font-family:system-ui,sans-serif;font-size:12px;color:#666">You can change how you get these in the Dragonfly app: Me → Messages from your trainer.</p>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('COACH_EMAIL_FROM'), to: [to], subject: SUBJECT[kind] ?? 'A message from your trainer', text: body, html }),
  });
  if (!res.ok) { console.error('email', res.status, (await res.text()).slice(0, 200)); return null; }
  return ((await res.json()) as { id?: string }).id ?? null;
}
