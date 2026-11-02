import type { AndroidSymbol } from 'expo-symbols';

/** Everything in the trainer's Menu. `href` = built; otherwise `soon` explains what's coming. */
export type Feature = { key: string; title: string; icon: AndroidSymbol; group: 'Coaching' | 'Business' | 'Community' | 'Help' | 'Hidden'; href?: string; soon?: string };
export const FEATURES: Feature[] = [
  { key: 'hub', title: 'Hub', icon: 'home', group: 'Coaching', href: '/coach' },
  { key: 'contacts', title: 'Contacts', icon: 'group', group: 'Coaching', href: '/coach/clients' },
  { key: 'workouts', title: 'Workouts', icon: 'fitness_center', group: 'Coaching', href: '/coach/workouts' },
  { key: 'exercises', title: 'Exercises', icon: 'directions_run', group: 'Coaching', href: '/exercises' },
  { key: 'nutrition', title: 'Nutrition', icon: 'restaurant', group: 'Coaching', href: '/coach/nutrition' },
  { key: 'scale', title: 'Scale', icon: 'monitor_weight', group: 'Coaching', href: '/coach/scale' },
  { key: 'checkins', title: 'Check-ins', icon: 'inbox', group: 'Coaching', href: '/checkins' },
  { key: 'programs', title: 'Programs', icon: 'calendar_month', group: 'Coaching', href: '/programs' },
  { key: 'habits', title: 'Habits', icon: 'checklist', group: 'Coaching', href: '/habits' },
  { key: 'packages', title: 'Packages', icon: 'redeem', group: 'Business', href: '/packages' },
  { key: 'financials', title: 'Financials', icon: 'payments', group: 'Business', href: '/financials' },
  { key: 'calendar', title: 'Calendar', icon: 'event', group: 'Business', href: '/calendar' },
  { key: 'events', title: 'Events', icon: 'event_available', group: 'Business', href: '/events' },
  { key: 'chat', title: 'Chat', icon: 'chat_bubble', group: 'Community', href: '/chat' },
  { key: 'communities', title: 'Communities', icon: 'groups', group: 'Community', href: '/communities' },
  { key: 'resources', title: 'Resources', icon: 'storefront', group: 'Community', href: '/resources' },
  { key: 'files', title: 'Files', icon: 'description', group: 'Community', href: '/files' },
  { key: 'settings', title: 'Settings', icon: 'settings', group: 'Help', href: '/settings' },
  { key: 'support', title: 'Support', icon: 'support_agent', group: 'Help', href: '/support' },
  { key: 'notifications', title: 'Notifications', icon: 'notifications', group: 'Hidden', href: '/notifications' },
];
/** Team trainers only see Financials, Packages and Events when the owner allows it */
export function allowed(f: Feature, member: { perms?: { financials?: boolean; packages?: boolean; events?: boolean } } | null | undefined, isOwner: boolean) {
  if (isOwner || !member) return true;
  if (f.key === 'financials') return !!member.perms?.financials;
  if (f.key === 'packages') return member.perms?.packages ?? true;
  if (f.key === 'events') return member.perms?.events ?? true;
  return true;
}
export const GROUPS: Feature['group'][] = ['Coaching', 'Business', 'Community', 'Help'];
