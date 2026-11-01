import type { User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { avatarUrl } from './account';
import type { Client, Trainer } from './model';
import { recall, sb, store, SUPABASE_KEY, USERNAME_LOGIN_FN } from './supabase';

export type Mode = 'coach' | 'client';

type Ctx = {
  ready: boolean; user: User | null; username: string | null;
  /** Shared Dragonfly profile picture (same in every Dragonfly app) */
  avatar: string | null; refreshAvatar: () => Promise<void>;
  /** The signed-in person's trainer profile, when they coach */
  trainer: Trainer | null;
  /** Client records linking this person to their trainer(s) */
  memberships: Client[];
  /** Which side of the app they're using, for people who are both */
  mode: Mode | null; setMode: (m: Mode) => void;
  signIn: (id: string, password: string) => Promise<void>;
  signUp: (email: string, username: string, password: string) => Promise<'signed-in' | 'confirm-email'>;
  signOut: () => Promise<void>;
  /** Makes the signed-in account a trainer (named after their Dragonfly username). Safe to call twice. */
  becomeTrainer: () => Promise<void>;
  /** Reloads profile, trainer and client links; returns how many trainers this person trains with */
  reloadMe: () => Promise<number>;
};
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error('AppProvider missing'); return c; };

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [memberships, setMemberships] = useState<Client[]>([]);
  const [modeChoice, setModeChoice] = useState<Mode | null>(() => recall<Mode | null>('coach.mode', null));
  const lastUid = useRef<string | null | undefined>(undefined);

  const loadFor = useCallback(async (u: User | null): Promise<number> => {
    setUser(u);
    if (!u) { setUsername(null); setAvatar(null); setTrainer(null); setMemberships([]); return 0; }
    avatarUrl(u.id).then(setAvatar).catch(() => setAvatar(null));
    // Attach any client records a trainer made for this email (My PT Hub-style onboarding)
    await sb.rpc('coach_link_me').then(() => {}, () => {});
    const [p, t, m] = await Promise.all([
      sb.from('dragonfly_profiles').select('username').eq('user_id', u.id).maybeSingle(),
      sb.from('coach_trainers').select('*').eq('user_id', u.id).maybeSingle(),
      sb.from('coach_clients').select('*').eq('user_id', u.id).neq('status', 'archived'),
    ]);
    setUsername(p.data?.username ?? u.email ?? null);
    setTrainer((t.data as Trainer) ?? null);
    setMemberships((m.data as Client[]) ?? []);
    return m.data?.length ?? 0;
  }, []);

  useEffect(() => {
    sb.auth.getSession().then(async ({ data }) => {
      lastUid.current = data.session?.user.id ?? null;
      await loadFor(data.session?.user ?? null).catch(() => {});
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user.id ?? null;
      if (uid !== lastUid.current) { lastUid.current = uid; setTimeout(() => loadFor(session?.user ?? null).catch(() => {}), 0); }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadFor]);

  const signIn = useCallback(async (id: string, password: string) => {
    if (id.includes('@')) {
      const { error } = await sb.auth.signInWithPassword({ email: id, password });
      if (error) throw error;
      return;
    }
    const res = await fetch(USERNAME_LOGIN_FN, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ username: id, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'invalid_credentials');
    const { error } = await sb.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, uname: string, password: string) => {
    const { data: free } = await sb.rpc('dragonfly_username_available', { wanted: uname });
    if (free === false) throw new Error('dragonfly_username_taken');
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username: uname } } });
    if (error) throw error;
    // Supabase answers a sign-up for an email that already has an account with no identities and sends no email
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('email_already_registered');
    return data.session ? 'signed-in' : 'confirm-email';
  }, []);

  // A trainer lands in the coach side, a client in theirs; someone who is both keeps their last choice
  const mode: Mode | null = trainer && memberships.length ? (modeChoice ?? 'coach') : trainer ? 'coach' : memberships.length ? 'client' : null;

  const value = useMemo<Ctx>(() => ({
    ready, user, username, avatar, trainer, memberships, mode,
    setMode: (m) => { setModeChoice(m); store('coach.mode', m); },
    refreshAvatar: async () => { setAvatar(user ? await avatarUrl(user.id) : null); },
    signIn, signUp,
    signOut: async () => { await sb.auth.signOut(); },
    becomeTrainer: async () => {
      const { data } = await sb.auth.getUser();
      const u = data.user;
      if (!u) throw new Error('Sign in first.');
      const { data: prof } = await sb.from('dragonfly_profiles').select('username').eq('user_id', u.id).maybeSingle();
      const { error } = await sb.from('coach_trainers').upsert({
        user_id: u.id, display_name: (prof?.username ?? u.email?.split('@')[0] ?? 'Trainer').slice(0, 80),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (error) throw error;
      setModeChoice('coach'); store('coach.mode', 'coach');
      await loadFor(u);
    },
    reloadMe: async () => { const { data } = await sb.auth.getUser(); return loadFor(data.user ?? null); },
  }), [ready, user, username, avatar, trainer, memberships, mode, signIn, signUp, loadFor]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
