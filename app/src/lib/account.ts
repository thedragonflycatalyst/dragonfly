// Dragonfly account features shared by every Dragonfly app (same storage and server as the Uploader).
import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { sb, SUPABASE_URL } from './supabase';

const AVATAR_BUCKET = 'dragonfly-avatars';
const AVATAR_PIXELS = 256;
const AVATAR_MAX_BYTES = 30000; // bucket limit
const ACCOUNT_FN = `${SUPABASE_URL}/functions/v1/dragonfly-account`;
export const avatarPath = (uid: string) => `${uid}/avatar.jpg`;

/** Signed link to the person's own profile picture, or null when they have none. */
export async function avatarUrl(uid: string): Promise<string | null> {
  const { data, error } = await sb.storage.from(AVATAR_BUCKET).createSignedUrl(avatarPath(uid), 3600);
  if (error || !data?.signedUrl) return null;
  // Signed URLs exist for missing files too, so confirm the picture is there
  const head = await fetch(data.signedUrl, { method: 'HEAD' }).catch(() => null);
  return head?.ok ? data.signedUrl : null;
}

/** Squares, shrinks and uploads a picture as the shared Dragonfly avatar (256px JPEG under 30 KB). */
export async function uploadAvatar(uid: string, uri: string, width: number, height: number) {
  const side = Math.min(width, height);
  const crop = { originX: Math.round((width - side) / 2), originY: Math.round((height - side) / 2), width: side, height: side };
  let bytes: ArrayBuffer | null = null;
  for (const compress of [0.85, 0.75, 0.65, 0.55, 0.45, 0.35]) {
    const out = await ImageManipulator.manipulateAsync(uri, [{ crop }, { resize: { width: AVATAR_PIXELS, height: AVATAR_PIXELS } }], { compress, format: ImageManipulator.SaveFormat.JPEG });
    const b = await new File(out.uri).arrayBuffer();
    if (b.byteLength <= AVATAR_MAX_BYTES) { bytes = b; break; }
  }
  if (!bytes) throw new Error('That picture is too detailed to save. Try another one.');
  const { error } = await sb.storage.from(AVATAR_BUCKET).upload(avatarPath(uid), bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
}
export async function removeAvatar(uid: string) {
  const { error } = await sb.storage.from(AVATAR_BUCKET).remove([avatarPath(uid)]);
  if (error) throw error;
}

/** Confirms the current password before sensitive changes, like the Uploader does. */
async function reauthenticate(email: string, password: string) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Your current password didn’t match.');
}
export async function changePassword(email: string, current: string, next: string) {
  if (next.length < 8) throw new Error('Use at least 8 characters for your new password.');
  await reauthenticate(email, current);
  const { error } = await sb.auth.updateUser({ password: next });
  if (error) throw error;
}
export async function changeEmail(email: string, current: string, nextEmail: string) {
  if (!/^\S+@\S+\.\S+$/.test(nextEmail)) throw new Error('Enter a valid email address.');
  await reauthenticate(email, current);
  const { error } = await sb.auth.updateUser({ email: nextEmail });
  if (error) throw error;
}
export async function resendVerification(email: string) {
  const { error } = await sb.auth.resend({ type: 'signup', email });
  if (error) throw error;
}
export async function setUsername(wanted: string) {
  const { error } = await sb.rpc('dragonfly_set_username', { wanted });
  if (error) throw error;
}

/** Password recovery by emailed code (no links needed), same as the Uploader. */
export async function sendRecoveryCode(email: string) {
  const { error } = await sb.auth.resetPasswordForEmail(email);
  if (error) throw error;
}
export async function recoverWithCode(email: string, code: string, newPassword: string) {
  if (newPassword.length < 8) throw new Error('Use at least 8 characters for your new password.');
  const { error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: 'recovery' });
  if (error) throw new Error('That code didn’t work. Check the newest email and try again.');
  const { error: e2 } = await sb.auth.updateUser({ password: newPassword });
  if (e2) throw e2;
}

/** Confirms a new account or email change with the 6-digit code from the email. */
export async function confirmWithCode(email: string, code: string, type: 'signup' | 'email_change') {
  const { error } = await sb.auth.verifyOtp({ email, token: code.trim(), type });
  if (error) throw new Error('That code didn’t work. Check the newest email and try again.');
}

/** Server operations from the shared dragonfly-account function. */
async function accountCall(path: string, init: RequestInit = {}) {
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first.');
  const res = await fetch(`${ACCOUNT_FN}/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (res.status === 403) throw new Error('Your current password didn’t match.');
  if (!res.ok) throw new Error(body.error === 'confirmation_required' ? 'Type DELETE MY ACCOUNT exactly to confirm.' : 'The account service couldn’t do that right now. Try again.');
  return body;
}
export type DeviceSession = { session_id: string; created_at: string; updated_at: string };
export const listSessions = async () => ((await accountCall('sessions')).sessions ?? []) as DeviceSession[];
export const revokeSession = (id: string) => accountCall(`sessions/${id}`, { method: 'DELETE' });
export const exportData = () => accountCall('export');
export const deleteAccount = (currentPassword: string, confirmation: string) =>
  accountCall('delete', { method: 'POST', body: JSON.stringify({ currentPassword, confirmation }) });
export async function currentSessionId(): Promise<string | null> {
  const { data } = await sb.auth.getSession();
  try { return JSON.parse(atob((data.session?.access_token ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id ?? null; } catch { return null; }
}
