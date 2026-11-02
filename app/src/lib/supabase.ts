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

// Team owners can open one of their trainers' accounts. Every request then says whose account it's about,
// and the database answers with that trainer's data (see coach_acting() in the teams migration).
// Viewing is read-only unless the owner switches on emergency editing; changes are stopped here first.
let acting: { id: string; edit: boolean } | null = null;
export const setActing = (a: { id: string; edit: boolean } | null) => { acting = a; };
export const actingHeaders = (): Record<string, string> => (acting ? { 'x-dragonfly-trainer': acting.id, ...(acting.edit ? { 'x-dragonfly-edit': '1' } : {}) } : {});
const READ_ONLY_RPC = /\/rpc\/(coach_people|dragonfly_username_available)$/;
const teamFetch: typeof fetch = async (input, init) => {
  if (!acting) return fetch(input, init);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/auth/v1/')) return fetch(input, init);
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
  const path = url.split('?')[0];
  const write = method !== 'GET' && method !== 'HEAD' && !READ_ONLY_RPC.test(path) && !path.includes('/storage/v1/object/sign/');
  if (write && !acting.edit) return new Response(JSON.stringify({ message: 'view_only', error: 'view_only' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  const headers = new Headers(init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined));
  for (const [k, v] of Object.entries(actingHeaders())) headers.set(k, v);
  return fetch(input, { ...init, headers });
};

// Shared Dragonfly account system (same project as the Uploader, Lapis and Phoenix).
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  global: { fetch: teamFetch },
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
export const inviteClient = (clientId: string) => invite({ client_id: clientId });
/** Same email for a trainer added to your team */
export const inviteTrainer = (memberId: string) => invite({ member_id: memberId });
async function invite(body: Record<string, string>): Promise<InviteResult> {
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first.');
  if (acting && !acting.edit && body.client_id) throw new Error('view_only');
  const res = await fetch(COACH_INVITE_FN, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json', ...(body.client_id ? actingHeaders() : {}) },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'The email couldn’t be sent right now. Try again.');
  return out.status as InviteResult;
}

export function store<T>(key: string, val: T) { try { storage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ } }
export function recall<T>(key: string, fallback: T): T {
  try { const v = storage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
