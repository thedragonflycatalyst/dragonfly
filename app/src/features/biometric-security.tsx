import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, Platform } from 'react-native';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { useApp } from '@/lib/app-state';
import { storage } from '@/lib/storage';

const PREFIX = 'dragonfly.biometric-lock.';
const REMEMBER = 'dragonfly.remember-login';
export function rememberLogin() { return storage.getItem(REMEMBER) !== 'false'; }
export function setRememberLogin(enabled: boolean) {
  storage.setItem(REMEMBER, enabled ? 'true' : 'false');
}
const lockKey = (uid: string) => PREFIX + uid;
const mobile = Platform.OS === 'ios' || Platform.OS === 'android';

type Security = {
  available: boolean;
  enabled: boolean;
  locked: boolean;
  checking: boolean;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  unlock: () => Promise<boolean>;
};
const Context = createContext<Security | null>(null);
export function useBiometricSecurity() {
  const value = useContext(Context);
  if (!value) throw new Error('BiometricSecurityProvider required');
  return value;
}

/** Biometrics unlock the already-authenticated Dragonfly session on this
 * device. They never replace server login or persist passwords/tokens.
 */
export function BiometricSecurityProvider({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const uid = user?.id ?? null;
  const uidRef = useRef(uid);
  uidRef.current = uid;
  const authenticating = useRef(false);
  const awayAt = useRef<number | null>(null);
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(!!uid);

  useEffect(() => {
    let mounted = true;
    setAvailable(false);
    setEnabledState(false);
    setLocked(false);
    setChecking(!!uid);
    awayAt.current = null;
    if (!uid) return;
    void (async () => {
      let enrolled = false;
      if (mobile) {
        try {
          enrolled = await LocalAuthentication.hasHardwareAsync() &&
            await LocalAuthentication.isEnrolledAsync();
        } catch { /* face/fingerprint unavailable */ }
      }
      if (!mounted || uidRef.current !== uid) return;
      const on = storage.getItem(lockKey(uid)) === 'true';
      setAvailable(enrolled);
      setEnabledState(on);
      setLocked(on);
      setChecking(false);
    })();
    return () => { mounted = false; };
  }, [uid]);

  useEffect(() => {
    if (!mobile || !uid) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (authenticating.current) return;
      if (state === 'active') {
        if (enabled && awayAt.current !== null &&
            Date.now() - awayAt.current >= 30000) setLocked(true);
        awayAt.current = null;
      } else if (awayAt.current === null) {
        awayAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [uid, enabled]);

  const authenticate = useCallback(async (prompt: string) => {
    if (!mobile || authenticating.current) return false;
    authenticating.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: prompt,
        cancelLabel: 'Cancel',
        disableDeviceFallback: true,
        biometricsSecurityLevel: 'weak',
      });
      return result.success;
    } catch { return false; }
    finally { authenticating.current = false; awayAt.current = null; }
  }, []);

  const setEnabled = useCallback(async (next: boolean): Promise<boolean> => {
    if (!uid || uidRef.current !== uid) return false;
    if (next && (!available || !await authenticate('Enable biometric unlock for Dragonfly')))
      return false;
    if (uidRef.current !== uid) return false;
    if (next) storage.setItem(lockKey(uid), 'true');
    else storage.removeItem(lockKey(uid));
    setEnabledState(next);
    setLocked(false);
    return true;
  }, [uid, available, authenticate]);

  const unlock = useCallback(async () => {
    if (!locked) return true;
    if (!uid || !await authenticate('Unlock Dragonfly')) return false;
    if (uidRef.current !== uid) return false;
    setLocked(false);
    return true;
  }, [uid, locked, authenticate]);

  const value = useMemo<Security>(() => ({
    available, enabled, locked, checking, setEnabled, unlock,
  }), [available, enabled, locked, checking, setEnabled, unlock]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
