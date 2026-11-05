import { storage } from './storage';

/** Per-device preference only. Supabase stores and refreshes the actual
 * session; no password or token is stored here.
 */
const KEY = 'dragonfly.remember-login';
export function rememberLogin() {
  return storage.getItem(KEY) !== 'false';
}
export function setRememberLogin(value: boolean) {
  storage.setItem(KEY, value ? 'true' : 'false');
}
