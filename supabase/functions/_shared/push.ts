// Push notifications, our own sender: Android through the owner's Firebase project (FCM HTTP v1; secret FCM_SERVICE_ACCOUNT),
// iPhone straight to Apple (APNs; secrets APNS_KEY (.p8 text), APNS_KEY_ID, APNS_TEAM_ID, optional APNS_BUNDLE_ID, APNS_SANDBOX=true for development builds).
// Each side is off until its secrets are set.

/** "Susan Forbes, 3:00 PM wants to reschedule to 5:00 PM." (weekdays added when the day changes or isn't today) */
export function rescheduleAlertText(name: string, oldStart: Date, newStart: Date, tz: string, now = new Date()): string {
  const day = (d: Date) => d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
  const time = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  const today = day(now), sameDay = day(oldStart) === day(newStart);
  const from = day(oldStart) === today && sameDay ? time(oldStart) : `${day(oldStart)} ${time(oldStart)}`;
  const to = sameDay ? time(newStart) : `${day(newStart)} ${time(newStart)}`;
  return `${name}, ${from} wants to reschedule to ${to}.`;
}

/** "Susan Forbes moved 3:00 PM to 5:00 PM." (a client's move into an open time; nothing to approve) */
export function movedAlertText(name: string, oldStart: Date, newStart: Date, tz: string, now = new Date()): string {
  return rescheduleAlertText(name, oldStart, newStart, tz, now).replace(' wants to reschedule to ', ' moved to ');
}

type ServiceAccount = { project_id: string; client_email: string; private_key: string };
export const pushConfigured = () => !!Deno.env.get('FCM_SERVICE_ACCOUNT') || apnsConfigured();
const apnsConfigured = () => !!(Deno.env.get('APNS_KEY') && Deno.env.get('APNS_KEY_ID') && Deno.env.get('APNS_TEAM_ID'));
export type Device = { token: string; platform: 'android' | 'ios' };

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = ''; for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let cached: { token: string; exp: number } | null = null;
async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp > now + 60) return cached.token;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`fcm_auth_${res.status}`);
  const j = await res.json() as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: now + j.expires_in };
  return j.access_token;
}

/** The FCM message: top priority, the Android "approvals" channel (loud), time-sensitive on iPhone */
export const FOLLOWUP_TITLE = '📋 Update your calendar';
export const followupBody = (title: string) => `${title}. Tap Done when it's changed.`;
/** Hourly repeats for open follow-ups, only 8 AM–9 PM in the trainer's time zone */
export function followupDue(last: Date | null, now: Date, tz: string): boolean {
  const hour = Number(now.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false })) % 24;
  if (hour < 8 || hour >= 21) return false;
  return !last || now.getTime() - last.getTime() >= 3600_000;
}

export function urgentMessage(token: string, title: string, body: string, url: string, kind = 'reschedule') {
  const path = url.replace(/^https?:\/\/[^/]+\/(dragonfly\/)?/, '/');
  return {
    message: {
      token, notification: { title, body }, data: { kind, url, path },
      android: { priority: 'HIGH', notification: { channel_id: 'approvals', sound: 'default', default_vibrate_timings: true, notification_priority: 'PRIORITY_MAX', visibility: 'PUBLIC' } },
      apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default', 'interruption-level': 'time-sensitive' } } },
    },
  };
}

let apnsJwt: { token: string; at: number } | null = null;
async function apnsToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (apnsJwt && now - apnsJwt.at < 50 * 60) return apnsJwt.token;   // Apple wants a fresh one at least hourly
  const pem = Deno.env.get('APNS_KEY')!.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const unsigned = `${b64url(JSON.stringify({ alg: 'ES256', kid: Deno.env.get('APNS_KEY_ID') }))}.${b64url(JSON.stringify({ iss: Deno.env.get('APNS_TEAM_ID'), iat: now }))}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  apnsJwt = { token: `${unsigned}.${b64url(sig)}`, at: now };
  return apnsJwt.token;
}

/** The APNs payload: time-sensitive, sound, and the page to open */
export function apnsPayload(title: string, body: string, url: string, kind: string) {
  const path = url.replace(/^https?:\/\/[^/]+\/(dragonfly\/)?/, '/');
  return { aps: { alert: { title, body }, sound: 'default', 'interruption-level': 'time-sensitive' }, kind, url, path };
}

async function sendApns(tokens: string[], title: string, body: string, url: string, kind: string): Promise<{ sent: number; dead: string[] }> {
  if (!apnsConfigured() || !tokens.length) return { sent: 0, dead: [] };
  const jwt = await apnsToken();
  const topic = Deno.env.get('APNS_BUNDLE_ID') ?? 'com.thedragonflycatalyst.dragonfly';
  let sent = 0; const dead: string[] = [];
  for (const t of tokens) {
    const host = Deno.env.get('APNS_SANDBOX') === 'true' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';   // sandbox for development builds
    const res = await fetch(`https://${host}/3/device/${t}`, {
      method: 'POST', body: JSON.stringify(apnsPayload(title, body, url, kind)),
      headers: { authorization: `bearer ${jwt}`, 'apns-topic': topic, 'apns-push-type': 'alert', 'apns-priority': '10' },
    });
    if (res.ok) sent++;
    else if (res.status === 410 || res.status === 400) dead.push(t);
    else console.error('apns', res.status);
  }
  return { sent, dead };
}

/** Sends to each phone (Android via Firebase, iPhone via Apple); returns tokens the phones no longer accept */
export async function sendUrgent(devices: Device[], title: string, body: string, url: string, kind = 'reschedule'): Promise<{ sent: number; dead: string[] }> {
  const ios = await sendApns(devices.filter((d) => d.platform === 'ios').map((d) => d.token), title, body, url, kind);
  const android = await sendFcm(devices.filter((d) => d.platform === 'android').map((d) => d.token), title, body, url, kind);
  return { sent: ios.sent + android.sent, dead: [...ios.dead, ...android.dead] };
}

async function sendFcm(tokens: string[], title: string, body: string, url: string, kind: string): Promise<{ sent: number; dead: string[] }> {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!raw || !tokens.length) return { sent: 0, dead: [] };
  const sa = JSON.parse(raw) as ServiceAccount;
  const at = await accessToken(sa);
  let sent = 0; const dead: string[] = [];
  for (const t of tokens) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST', headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' }, body: JSON.stringify(urgentMessage(t, title, body, url, kind)),
    });
    if (res.ok) sent++;
    else if (res.status === 404 || res.status === 400) dead.push(t);
    else console.error('fcm', res.status);
  }
  return { sent, dead };
}
