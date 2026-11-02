// Lapis sound settings inside Dragonfly. Voice, music mode, voice level/speed and vibration are the same settings the
// Lapis app keeps on your Dragonfly account (lapis_sync), so changing them in either app changes both.
// Rest-timer extras (say "Rest", countdown, bell, default rest...) belong to Dragonfly and stay on this device.
import { useEffect, useSyncExternalStore } from 'react';
import { recall, sb, store } from '@/lib/supabase';

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
const SHARED = ['voice', 'music', 'voiceLevel', 'voiceSpeed', 'haptics', 'bell'] as const;

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
    if (prefs && uid === userId) { current = fromLapis(prefs, current); store(KEY(userId), current); emit(); }
  } catch { /* offline: this device's copy is fine */ }
}

/** Change settings here; shared ones are written back to the account so Lapis picks them up too */
export async function setPrefs(patch: Partial<LapisPrefs>) {
  current = { ...current, ...patch };
  emit();
  if (!uid) return;
  store(KEY(uid), current);
  if (!SHARED.some((k) => k in patch)) return;
  try {
    const { data } = await sb.from('lapis_sync').select('doc').eq('user_id', uid).maybeSingle();
    if (!data) return; // Not using the Lapis app yet: nothing to keep in step
    const doc = (data.doc ?? {}) as { prefs?: { data?: Record<string, unknown> } };
    const next = { ...doc, prefs: { at: new Date().toISOString(), data: { ...(doc.prefs?.data ?? {}), ...toLapis(current) } } };
    await sb.from('lapis_sync').update({ doc: next, updated_at: new Date().toISOString() }).eq('user_id', uid);
  } catch { /* kept on this device; tries again next change */ }
}

export function useLapisPrefs(userId?: string | null): LapisPrefs {
  useEffect(() => { if (userId) void loadPrefs(userId); }, [userId]);
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, getPrefs, getPrefs);
}
