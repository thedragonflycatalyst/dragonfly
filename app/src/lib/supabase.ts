import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import { storage } from './storage';

const extra = Constants.expoConfig?.extra as { supabaseUrl: string; supabaseKey: string; webUrl: string };
export const SUPABASE_URL = extra.supabaseUrl;
export const SUPABASE_KEY = extra.supabaseKey;
export const WEB_URL = extra.webUrl;
export const USERNAME_LOGIN_FN = `${SUPABASE_URL}/functions/v1/dragonfly-username-login`;

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

/** Link a client opens to join their trainer (web page, or the app when installed). */
export const inviteLink = (code: string) => `${WEB_URL}join?code=${encodeURIComponent(code)}`;

export function store<T>(key: string, val: T) { try { storage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ } }
export function recall<T>(key: string, fallback: T): T {
  try { const v = storage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
