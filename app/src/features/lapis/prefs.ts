// Lapis sound settings inside Dragonfly. Voice, music mode, voice level/speed and vibration are the same settings the
// Lapis app keeps on your Dragonfly account (lapis_sync), so changing them in either app changes both.
// Rest-timer extras (say "Rest", countdown, bell, default rest...) belong to Dragonfly and stay on this device.
import { useEffect, useSyncExternalStore } from 'react';
import { recall, sb, store } from '@/lib/supabase';
import { selectChangedPrefs, SHARED_PREF_KEYS } from './prefs-patch';

export type MusicMode = 'mix' | 'duck' | 'pause';
export type BellStyle = 'ring2' | 'ring1' | 'ring3';
export type StudioVoice = { id: string; label: string; accent: string; gender: 'Male' | 'Female' };

/** The studio voices Lapis offers, with Connor first (the default) */
export const VOICES: StudioVoice[] = [
  { id: 'en-IE-ConnorNeural', label: 'Connor', accent: 'Irish', gender: 'Male' },
  { id: 'en-US-AvaNeural', label: 'Ava', accent: 'American', gender: 'Female' },
  { id: 'en-US-AndrewNeural', label: 'Andrew', accent: 'American', gender: 'Male' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia', accent: 'British', gender: 'Female' },
  { id: 'en-GB-RyanNeural', label: 'Ryan', accent: 'British', gender: 'Male' },
  { id: 'en-AU-NatashaNeural', label: 'Natasha', accent: 'Australian', gender: 'Female' },
  { id: 'en-IE-EmilyNeural', label: 'Emily', accent: 'Irish', gender: 'Female' },
  { id: 'en-AU-WilliamNeural', label: 'William', accent: 'Australian', gender: 'Male' },
];
export const BELLS: Record<BellStyle, string> = { ring2: 'DING DING', ring1: 'Single DING', ring3: 'Triple' };
export const MUSIC: Record<MusicMode, { label: string; hint: string }> = {
  mix: { label: 'Play along', hint: 'Your music keeps playing at full volume; the voice plays on top.' },
  duck: { label: 'Lower', hint: 'Your music dips while the voice speaks.' },
  pause: { label: 'Pause', hint: 'Your music pauses while the voice speaks, then carries on.' },
};

export type LapisPrefs = {
  // Shared with the Lapis app
  voice: string; music: MusicMode; voiceLevel: number; voiceSpeed: number; haptics: boolean; bell: BellStyle;
  // Dragonfly's rest timer
  voiceOn: boolean; sayRest: boolean; countdown: boolean; bellOn: boolean; halfway: boolean; autoRest: boolean; defaultRest: number; keepAwake: boolean;
};
export const DEFAULTS: LapisPrefs = {
  voice: 'en-IE-ConnorNeural', music: 'duck', voiceLevel: 1, voiceSpeed: 1, haptics: true, bell: 'ring2',
  voiceOn: true, sayRest: true, countdown: true, bellOn: true, halfway: false, autoRest: true, defaultRest: 60, keepAwake: true,
};
const SHARED = SHARED_PREF_KEYS;

/** Build a narrow patch: never copy stale unrelated settings into Lapis's sync document. */
export function sharedPatch(patch: Partial<LapisPrefs>, next: LapisPrefs): Record<string, unknown> {
  return selectChangedPrefs(patch, toLapis(next));
}

const clamp = (n: unknown, lo: number, hi: number, d: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d);
/** Lapis's saved settings (its own JSON shape) → ours; anything missing or broken keeps what we had */
export function fromLapis(data: Record<string, unknown> | null | undefined, base: LapisPrefs): LapisPrefs {
  if (!data) return base;
  const v = data.voice as { name?: unknown } | null | undefined;
  const voice = v && typeof v.name === 'string' && VOICES.some((x) => x.id === v.name) ? v.name : v === null ? DEFAULTS.voice : base.voice;
  const music = data.music === 'mix' || data.music === 'duck' || data.music === 'pause' ? data.music : base.music;
  const bell = data.bell === 'ring1' || data.bell === 'ring2' || data.bell === 'ring3' ? data.bell : base.bell;
  return {
    ...base, voice, music, bell,
    voiceLevel: clamp(data.voiceLevel, 0, 1, base.voiceLevel), voiceSpeed: clamp(data.voiceSpeed, 0.7, 1.4, base.voiceSpeed),
    haptics: typeof data.haptics === 'boolean' ? data.haptics : base.haptics,
  };
}
/** Ours → the keys Lapis reads */
export function toLapis(p: LapisPrefs): Record<string, unknown> {
  const v = VOICES.find((x) => x.id === p.voice) ?? VOICES[0];
  return {
    music: p.music, voiceLevel: p.voiceLevel, voiceSpeed: p.voiceSpeed, haptics: p.haptics, bell: p.bell,
    voice: { name: v.id, locale: v.id.slice(0, 5), studio: true, label: v.label, offline: false, gender: v.gender, accent: v.accent },
  };
}

/* ---------- one shared copy for the whole app ---------- */
let current: LapisPrefs = DEFAULTS;
let uid: string | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const KEY = (u: string) => `lapis.prefs.${u}`;

export const getPrefs = () => current;

/** Load this person's settings: this device first, then whatever Lapis has on their account */
export async function loadPrefs(userId: string) {
  if (uid !== userId) { uid = userId; current = { ...DEFAULTS, ...recall<Partial<LapisPrefs>>(KEY(userId), {}) }; emit(); }
  try {
    const { data } = await sb.from('lapis_sync').select('doc').eq('user_id', userId).maybeSingle();
    const prefs = (data?.doc as { prefs?: { data?: Record<string, unknown> } } | undefined)?.prefs?.data;
    if (prefs && uid === userId) {
      const remote = fromLapis(prefs, current);
      current = { ...remote, ...pendingByUser.get(userId) };
      store(KEY(userId), current); emit();
    }
    if (uid === userId && pendingByUser.has(userId)) void flushShared(userId);
  } catch { /* offline: this device's copy is fine */ }
}

/** Shared changes are applied atomically on the server without replacing timers/sessions/history.
 * Offline or failed writes are retained locally and retried the next time the account loads.
 */
const pendingByUser = new Map<string, Partial<LapisPrefs>>();
const flushByUser = new Map<string, Promise<void>>();

async function flushShared(userId: string) {
  const active = flushByUser.get(userId);
  if (active) return active;
  const task = (async () => {
    while (pendingByUser.has(userId)) {
      const patch = pendingByUser.get(userId)!;
      pendingByUser.delete(userId);
      const snapshot = userId === uid ? current : { ...DEFAULTS, ...recall<Partial<LapisPrefs>>(KEY(userId), {}) };
      try {
        const { data, error } = await sb.rpc('coach_patch_lapis_prefs', { p_patch: sharedPatch(patch, snapshot) });
        if (error) throw error;
        if (data == null) throw new Error('Lapis sync document not yet available');
      } catch {
        // Keep only values not superseded by edits made while the request was running.
        pendingByUser.set(userId, { ...patch, ...pendingByUser.get(userId) });
        break;
      }
    }
  })();
  flushByUser.set(userId, task);
  try { await task; } finally { flushByUser.delete(userId); }
}

/** Change a setting locally immediately; sync just the changed keys safely. */
export async function setPrefs(patch: Partial<LapisPrefs>) {
  current = { ...current, ...patch };
  emit();
  if (!uid) return;
  const userId = uid;
  store(KEY(userId), current);
  const shared = Object.fromEntries(SHARED.filter((k) => Object.prototype.hasOwnProperty.call(patch, k))
    .map((k) => [k, patch[k]])) as Partial<LapisPrefs>;
  if (!Object.keys(shared).length) return;
  pendingByUser.set(userId, { ...pendingByUser.get(userId), ...shared });
  await flushShared(userId);
}

export function useLapisPrefs(userId?: string | null): LapisPrefs {
  useEffect(() => { if (userId) void loadPrefs(userId); }, [userId]);
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, getPrefs, getPrefs);
}
