import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import { storage } from './storage';

const extra = Constants.expoConfig?.extra as { supabaseUrl: string; supabaseKey: string; webUrl: string };
export const SUPABASE_URL = extra.supabaseUrl;
export const SUPABASE_KEY = extra.supabaseKey;
export const WEB_URL = extra.webUrl;
export const USERNAME_LOGIN_FN = `${SUPABASE_URL}/functions/v1/dragonfly-username-login`;
const COACH_INVITE_FN = `${SUPABASE_URL}/functions/v1/coach-invite`;

// Shared Dragonfly account system (same project as the Uploader, Lapis and Phoenix).
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') sb.auth.startAutoRefresh();
    else sb.auth.stopAutoRefresh();
  });
}

export type InviteResult = 'sent' | 'existing' | 'linked';
export const INVITE_MESSAGE: Record<InviteResult, (firstName: string) => string> = {
  sent: (n) => `We emailed ${n} a code to set their password`,
  existing: (n) => `${n} already has a Dragonfly account. They’ll see you when they sign in.`,
  linked: (n) => `${n} is already connected`,
};
/** Creates the client's Dragonfly account if needed and emails them a code to set their password. */
export async function inviteClient(clientId: string): Promise<InviteResult> {
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first.');
  const res = await fetch(COACH_INVITE_FN, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'The email couldn’t be sent right now. Try again.');
  return body.status as InviteResult;
}

export function store<T>(key: string, val: T) { try { storage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ } }
export function recall<T>(key: string, fallback: T): T {
  try { const v = storage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
