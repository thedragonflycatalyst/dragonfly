// Push notifications through the owner's Firebase project (FCM HTTP v1). Off until the owner sets the secret
// FCM_SERVICE_ACCOUNT (the service-account JSON from Firebase → Project settings → Service accounts).

/** "Susan Forbes, 3:00 PM wants to reschedule to 5:00 PM." (weekdays added when the day changes or isn't today) */
export function rescheduleAlertText(name: string, oldStart: Date, newStart: Date, tz: string, now = new Date()): string {
  const day = (d: Date) => d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
  const time = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  const today = day(now), sameDay = day(oldStart) === day(newStart);
  const from = day(oldStart) === today && sameDay ? time(oldStart) : `${day(oldStart)} ${time(oldStart)}`;
  const to = sameDay ? time(newStart) : `${day(newStart)} ${time(newStart)}`;
  return `${name}, ${from} wants to reschedule to ${to}.`;
}

type ServiceAccount = { project_id: string; client_email: string; private_key: string };
export const pushConfigured = () => !!Deno.env.get('FCM_SERVICE_ACCOUNT');

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
export function urgentMessage(token: string, title: string, body: string, url: string) {
  const path = url.replace(/^https?:\/\/[^/]+\/(dragonfly\/)?/, '/');
  return {
    message: {
      token, notification: { title, body }, data: { kind: 'reschedule', url, path },
      android: { priority: 'HIGH', notification: { channel_id: 'approvals', sound: 'default', default_vibrate_timings: true, notification_priority: 'PRIORITY_MAX', visibility: 'PUBLIC' } },
      apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default', 'interruption-level': 'time-sensitive' } } },
    },
  };
}

/** Sends to each token; returns the tokens the phone no longer accepts (remove them) */
export async function sendUrgent(tokens: string[], title: string, body: string, url: string): Promise<{ sent: number; dead: string[] }> {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!raw || !tokens.length) return { sent: 0, dead: [] };
  const sa = JSON.parse(raw) as ServiceAccount;
  const at = await accessToken(sa);
  let sent = 0; const dead: string[] = [];
  for (const t of tokens) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST', headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' }, body: JSON.stringify(urgentMessage(t, title, body, url)),
    });
    if (res.ok) sent++;
    else if (res.status === 404 || res.status === 400) dead.push(t);
    else console.error('fcm', res.status);
  }
  return { sent, dead };
}
