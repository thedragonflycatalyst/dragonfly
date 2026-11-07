// Health Connect consent, stored per person on this device. Nothing is read from the phone's health store
// until they say yes on the consent screen (app/health-consent.tsx); withdrawing stops reads at once.
import { hasConsent, noConsent, type HealthConsent } from '@/lib/health-consent';
import { recall, store } from '@/lib/supabase';
import { allowReads } from './health-connect';

const KEY = (uid: string) => `health.consent.${uid}`;
export const healthConsent = (uid: string): HealthConsent => recall<HealthConsent>(KEY(uid), noConsent());
export function setHealthConsent(uid: string, c: HealthConsent) { store(KEY(uid), c); allowReads(hasConsent(c)); }
/** True if they've consented; also arms (or disarms) the reader for this person. Call before any read. */
export function checkHealthConsent(uid: string): boolean { const ok = hasConsent(healthConsent(uid)); allowReads(ok); return ok; }
