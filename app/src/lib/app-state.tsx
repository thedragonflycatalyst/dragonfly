import type { User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { avatarUrl } from './account';
import type { Client, Team, TeamMember, Trainer, Units } from './model';
import { DEFAULT_PERMS, unitPrefs, type ClientPerms, type UnitPrefs } from './prefs';
import { e164 } from './contact';
import { recall, sb, setActing, store, SUPABASE_KEY, USERNAME_LOGIN_FN } from './supabase';
import { rememberLogin } from './remember-login';

export type Mode = 'coach' | 'client';

type Ctx = {
  ready: boolean; user: User | null; username: string | null;
  /** Shared Dragonfly profile picture (same in every Dragonfly app) */
  avatar: string | null; refreshAvatar: () => Promise<void>;
  /** The trainer profile in use: yours, or the team trainer whose account you're viewing */
  trainer: Trainer | null;
  /** Your own trainer profile (unchanged while viewing a team trainer) */
  ownTrainer: Trainer | null;
  /** Your team, if you're on one, and its members */
  team: Team | null; teamMembers: TeamMember[]; isOwner: boolean; reloadTeam: () => Promise<void>;
  /** Owner viewing one of their trainers' accounts (read-only unless emergency editing is on) */
  viewing: TeamMember | null; editing: boolean;
  startViewing: (m: TeamMember) => Promise<void>; stopViewing: () => void; setEditing: (on: boolean) => void;
  /** Client records linking this person to their trainer(s) */
  memberships: Client[];
  /** The client record in use (first active one, else the first) */
  membership: Client | null;
  /** The trainer of that client record, as the client sees them */
  myTrainer: { user_id: string; display_name: string; business_name: string | null; units: Units; unit_prefs?: Partial<UnitPrefs>; brand_color?: string | null; logo?: string | null; welcome?: string | null; client_perms?: Partial<ClientPerms>; cancel_hours?: number | null } | null;
  /** Detailed units (lifting weights, bodyweight, lengths, height, distance, number format) */
  prefs: UnitPrefs;
  /** What clients may do themselves (the trainer's settings) */
  perms: ClientPerms;
  /** Units to show in the current mode */
  units: Units;
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
  const [ownTrainer, setTrainer] = useState<Trainer | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [viewing, setViewing] = useState<{ member: TeamMember; trainer: Trainer } | null>(null);
  const [editing, setEditingState] = useState(false);
  const [memberships, setMemberships] = useState<Client[]>([]);
  const [myTrainer, setMyTrainer] = useState<Ctx['myTrainer']>(null);
  const [modeChoice, setModeChoice] = useState<Mode | null>(() => recall<Mode | null>('coach.mode', null));
  const lastUid = useRef<string | null | undefined>(undefined);

  const loadTeam = useCallback(async () => {
    const [t, m] = await Promise.all([sb.from('coach_teams').select('*').maybeSingle(), sb.from('coach_team_members').select('*').neq('status', 'removed').order('created_at')]);
    setTeam((t.data as Team) ?? null); setTeamMembers((m.data as TeamMember[]) ?? []);
  }, []);

  const loadFor = useCallback(async (u: User | null): Promise<number> => {
    setUser(u);
    setActing(null); setViewing(null); setEditingState(false);
    if (!u) { setUsername(null); setAvatar(null); setTrainer(null); setMemberships([]); setMyTrainer(null); setTeam(null); setTeamMembers([]); return 0; }
    avatarUrl(u.id).then(setAvatar).catch(() => setAvatar(null));
    // Attach any client records a trainer made for this email (My PT Hub-style onboarding)
    await sb.rpc('coach_link_me').then(() => {}, () => {});
    // …and join any team that invited this email as a trainer
    await sb.rpc('coach_join_team').then(() => {}, () => {});
    loadTeam();
    const [p, t, m] = await Promise.all([
      sb.from('dragonfly_profiles').select('username').eq('user_id', u.id).maybeSingle(),
      sb.from('coach_trainers').select('*').eq('user_id', u.id).maybeSingle(),
      sb.from('coach_clients').select('*').eq('user_id', u.id).neq('status', 'archived'),
    ]);
    setUsername(p.data?.username ?? u.email ?? null);
    setTrainer((t.data as Trainer) ?? null);
    const mine = (m.data as Client[]) ?? [];
    setMemberships(mine);
    const primary = mine.find((c) => c.status === 'active') ?? mine[0];
    if (primary) {
      const { data: tr } = await sb.from('coach_trainers').select('user_id,display_name,business_name,units,unit_prefs,brand_color,logo,welcome,client_perms,cancel_hours').eq('user_id', primary.trainer_id).maybeSingle();
      setMyTrainer((tr as Ctx['myTrainer']) ?? null);
    } else setMyTrainer(null);
    return mine.length;
  }, []);

  useEffect(() => {
    sb.auth.getSession().then(async ({ data }) => {
      let session = data.session;
      // Supabase persists and refreshes sessions by default. A user who
      // expressly opted out gets a device-local logout on next cold launch.
      if (!rememberLogin() && session) {
        await sb.auth.signOut({ scope: 'local' });
        session = null;
      }
      lastUid.current = session?.user.id ?? null;
      await loadFor(session?.user ?? null).catch(() => {});
      setReady(true);
    }).catch(() => setReady(true));
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
    // A phone number (accounts made by QR sign-up with a text-message code)
    const phone = /^[+\d\s().-]{7,20}$/.test(id.trim()) ? e164(id) : null;
    if (phone) {
      const { error } = await sb.auth.signInWithPassword({ phone, password });
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
  const mode: Mode | null = ownTrainer && memberships.length ? (modeChoice ?? 'coach') : ownTrainer ? 'coach' : memberships.length ? 'client' : null;

  const membership = memberships.find((c) => c.status === 'active') ?? memberships[0] ?? null;
  const trainer = viewing?.trainer ?? ownTrainer;
  const units: Units = (mode === 'coach' ? trainer?.units : myTrainer?.units) ?? 'imperial';
  const isOwner = !!team && !!user && team.owner_id === user.id;
  const prefs = unitPrefs(units, mode === 'coach' ? trainer?.unit_prefs : myTrainer?.unit_prefs);
  const perms: ClientPerms = { ...DEFAULT_PERMS, ...((mode === 'coach' ? trainer?.client_perms : myTrainer?.client_perms) ?? {}) };

  const value = useMemo<Ctx>(() => ({
    ready, user, username, avatar, trainer, ownTrainer, memberships, membership, myTrainer, units, prefs, perms, mode,
    team, teamMembers, isOwner, reloadTeam: loadTeam,
    viewing: viewing?.member ?? null, editing,
    startViewing: async (m) => {
      if (!m.trainer_id) throw new Error('That trainer hasn’t joined yet.');
      const { data, error } = await sb.from('coach_trainers').select('*').eq('user_id', m.trainer_id).maybeSingle();
      if (error || !data) throw error ?? new Error('Couldn’t open that account.');
      setActing({ id: m.trainer_id, edit: false }); setEditingState(false);
      setViewing({ member: m, trainer: data as Trainer });
    },
    stopViewing: () => { setActing(null); setEditingState(false); setViewing(null); },
    setEditing: (on) => { if (!viewing?.member.trainer_id) return; setActing({ id: viewing.member.trainer_id, edit: on }); setEditingState(on); },
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
  }), [ready, user, username, avatar, trainer, ownTrainer, memberships, membership, myTrainer, units, prefs, perms, mode, team, teamMembers, isOwner, loadTeam, viewing, editing, signIn, signUp, loadFor]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
