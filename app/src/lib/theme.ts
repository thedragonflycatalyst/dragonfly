import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from './storage';

// Dragonfly: the Uploader's look. Deep ink with a violet accent (dark, the default), and a matching light version.
const dark = {
  bg: '#0b0b10', surface: '#14141d', raise: '#1a1a26', ink: '#f3f2ff', muted: '#a9a6bd', line: '#2a2a3c', soft: '#1f1f2e',
  focus: '#7c5cff', gold: '#f5b041', danger: '#e86a6a', good: '#2ecc71', onAccent: '#ffffff',
  glow: 'rgba(124,92,255,0.18)', art: ['#7c5cff', '#4da3ff', '#b47cff'] as [string, string, string],
};
const light: typeof dark = {
  bg: '#f6f5fb', surface: '#ffffff', raise: '#faf9fe', ink: '#14121f', muted: '#5e5a73', line: '#e2dfee', soft: '#eeebfa',
  focus: '#5e46d3', gold: '#9a6a00', danger: '#c23a3a', good: '#1e8a4c', onAccent: '#ffffff',
  glow: 'rgba(94,70,211,0.12)', art: ['#7c5cff', '#4da3ff', '#b47cff'] as [string, string, string],
};
export type Palette = typeof dark;

/* ---------- appearance: dark (default), light, or follow the phone ---------- */
export type Appearance = 'dark' | 'light' | 'system';
const KEY = 'dragonfly.appearance';
const read = (): Appearance => { try { const v = storage.getItem(KEY); return v === 'light' || v === 'system' ? v : 'dark'; } catch { return 'dark'; } };
let current: Appearance = read();
const subs = new Set<() => void>();
export const getAppearance = () => current;
export function setAppearance(a: Appearance) {
  current = a;
  try { storage.setItem(KEY, a); } catch { /* private window */ }
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useAppearance = () => useSyncExternalStore(subscribe, getAppearance, getAppearance);

export function usePalette(): Palette & { scheme: 'light' | 'dark' } {
  const sys = useColorScheme();
  const a = useAppearance();
  const s = a === 'system' ? (sys === 'light' ? 'light' : 'dark') : a;
  return { ...(s === 'dark' ? dark : light), scheme: s };
}

export const F = {
  display: 'Inter_700Bold',
  displayBold: 'Inter_600SemiBold',
  body: 'Inter_400Regular',
  bodyBold: 'Inter_600SemiBold',
};

/** Corners: cards 18, controls 12, small 8 (as in the Uploader) */
export const R = { lg: 18, md: 12, sm: 8, pill: 999 };

/** Content column width on wide screens (the web dashboard) */
export const MAX_W = 980;
/** Wide enough for the permanent sidebar (web dashboard, tablets) */
export const WIDE = 1000;
