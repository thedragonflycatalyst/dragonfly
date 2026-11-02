import type { AndroidSymbol } from 'expo-symbols';

/** One place in Dragonfly's navigation */
export type NavItem = { key: string; title: string; icon: AndroidSymbol; href: string };
export type NavSection = { title: string | null; items: NavItem[] };

/** Trainer: the bottom bar on phones (and the top of the sidebar on wide screens) */
export const COACH_TABS: NavItem[] = [
  { key: 'home', title: 'Home', icon: 'home', href: '/coach' },
  { key: 'clients', title: 'Clients', icon: 'group', href: '/coach/clients' },
  { key: 'chat', title: 'Chat', icon: 'chat_bubble', href: '/coach/chat' },
  { key: 'workouts', title: 'Workouts', icon: 'fitness_center', href: '/coach/workouts' },
  { key: 'scale', title: 'Scale', icon: 'monitor_weight', href: '/coach/scale' },
];

/** Trainer: the menu sidebar (top-left button on phones, always open on wide screens) */
export const COACH_SIDEBAR: NavSection[] = [
  { title: 'Coaching', items: [
    { key: 'routines', title: 'Routines', icon: 'list_alt', href: '/coach/workouts?tab=workouts' },
    { key: 'programs', title: 'Programs', icon: 'date_range', href: '/coach/workouts?tab=programs' },
    { key: 'exercises', title: 'Exercise library', icon: 'sports_gymnastics', href: '/exercises' },
    { key: 'reminders', title: 'Reminders', icon: 'checklist', href: '/habits' },
    { key: 'nutrition', title: 'Nutrition', icon: 'restaurant', href: '/coach/nutrition' },
    { key: 'calendar', title: 'Calendar', icon: 'calendar_month', href: '/calendar' },
  ] },
  { title: 'Together', items: [
    { key: 'social', title: 'Social', icon: 'groups', href: '/communities' },
  ] },
  { title: null, items: [
    { key: 'connections', title: 'Connected apps', icon: 'link', href: '/connections' },
    { key: 'settings', title: 'Settings', icon: 'settings', href: '/settings' },
    { key: 'support', title: 'Help & support', icon: 'support_agent', href: '/support' },
  ] },
];

/** Client: the menu sidebar */
export const CLIENT_SIDEBAR: NavSection[] = [
  { title: null, items: [
    { key: 'home', title: 'Home', icon: 'home', href: '/me' },
    { key: 'chat', title: 'Chat', icon: 'chat_bubble', href: '/chat' },
    { key: 'scale', title: 'Scale', icon: 'monitor_weight', href: '/me/scale' },
    { key: 'nutrition', title: 'Nutrition', icon: 'restaurant', href: '/me/nutrition' },
    { key: 'activity', title: 'Activity & sleep', icon: 'directions_walk', href: '/me/activity' },
    { key: 'reminders', title: 'Reminders', icon: 'checklist', href: '/me/habits' },
    { key: 'calendar', title: 'Sessions', icon: 'calendar_month', href: '/calendar' },
  ] },
  { title: 'Together', items: [
    { key: 'social', title: 'Social', icon: 'groups', href: '/communities' },
  ] },
  { title: null, items: [
    { key: 'packages', title: 'Packages & payments', icon: 'redeem', href: '/me/packages' },
    { key: 'connections', title: 'Connected apps', icon: 'link', href: '/connections' },
    { key: 'support', title: 'Help & support', icon: 'support_agent', href: '/support' },
  ] },
];

type Perms = { financials?: boolean; packages?: boolean; events?: boolean };
/** Team trainers only see Payments and Packages when the owner allows it */
export function canSee(key: 'financials' | 'packages' | 'events', member: { perms?: Perms } | null | undefined, isOwner: boolean) {
  if (isOwner || !member) return true;
  if (key === 'financials') return !!member.perms?.financials;
  return member.perms?.[key] ?? true;
}

/** Trainer Home: shortcut panels they choose (every one is also in the menu, or in Settings) */
export const SHORTCUTS: NavItem[] = [
  { key: 'add-client', title: 'Add client', icon: 'person_add', href: '/clients/new' },
  { key: 'qr', title: 'QR sign-up', icon: 'qr_code_2', href: '/join-qr' },
  { key: 'workout', title: 'Start a workout', icon: 'fitness_center', href: '/coach/workouts' },
  { key: 'book', title: 'Book a session', icon: 'event', href: '/calendar' },
  { key: 'message', title: 'Message a client', icon: 'chat_bubble', href: '/coach/chat' },
  { key: 'checkins', title: 'Check-ins', icon: 'inbox', href: '/checkins' },
  { key: 'clients', title: 'Clients', icon: 'group', href: '/coach/clients' },
  ...COACH_SIDEBAR.flatMap((s) => s.items).filter((i) => !['calendar'].includes(i.key)),
  { key: 'scale', title: 'Scale', icon: 'monitor_weight', href: '/coach/scale' },
  { key: 'packages', title: 'Packages', icon: 'redeem', href: '/packages' },
  { key: 'payments', title: 'Payments', icon: 'payments', href: '/financials' },
];
export const DEFAULT_SHORTCUTS = ['add-client', 'qr', 'workout', 'book', 'message', 'checkins'];
