// Unit of measurement preferences (Settings → Units), with sensible defaults from the older imperial/metric switch.
import type { BodyUnit } from './scale';

export type UnitPrefs = { weights: 'lb' | 'kg'; bodyweight: BodyUnit; length: 'in' | 'cm'; height: 'ft' | 'cm'; distance: 'mi' | 'km'; number: 'dot' | 'comma' };
export function unitPrefs(units: 'imperial' | 'metric', saved?: Partial<UnitPrefs> | null): UnitPrefs {
  const imp = units === 'imperial';
  const base: UnitPrefs = { weights: imp ? 'lb' : 'kg', bodyweight: imp ? 'lb' : 'kg', length: imp ? 'in' : 'cm', height: imp ? 'ft' : 'cm', distance: imp ? 'mi' : 'km', number: 'dot' };
  return { ...base, ...(saved ?? {}) };
}
export const UNIT_OPTIONS: { key: keyof UnitPrefs; label: string; options: [string, string][] }[] = [
  { key: 'weights', label: 'Weights (lifting)', options: [['lb', 'Lbs'], ['kg', 'Kg']] },
  { key: 'bodyweight', label: 'Bodyweight', options: [['lb', 'Lbs'], ['kg', 'Kg'], ['st', 'Stone']] },
  { key: 'length', label: 'Length (body measurements)', options: [['in', 'Inches'], ['cm', 'Centimeters']] },
  { key: 'height', label: 'Height', options: [['ft', 'Feet and inches'], ['cm', 'Centimeters']] },
  { key: 'distance', label: 'Distance', options: [['mi', 'Miles'], ['km', 'Kilometers']] },
  { key: 'number', label: 'Numeric format', options: [['dot', 'Dot decimal (1,200.50)'], ['comma', 'Comma decimal (1.200,50)']] },
];

export type Notify = Record<string, { push: boolean; email: boolean }>;
export const NOTIFY_KEYS: [key: string, label: string, sub: string][] = [
  ['messages', 'New messages', 'Chats and group chats'],
  ['checkins_due', 'Check-ins due', 'When a client is due a personal check-in'],
  ['workouts_done', 'Workouts completed', 'When a client finishes a workout'],
  ['workouts_missed', 'Missed workouts', 'The morning after a scheduled workout wasn’t done'],
  ['bookings', 'Bookings and cancellations', 'Clients booking or cancelling sessions and events'],
  ['payments', 'Payments', 'Purchases, renewals and failed payments'],
  ['community', 'Community activity', 'New posts and comments in your communities'],
  ['daily_summary', 'Daily summary', 'One email each morning with your day'],
];
export function notifyPrefs(saved?: Notify | null): Notify & { quiet?: { on: boolean; from: string; to: string } } {
  const out: Notify = {};
  for (const [k] of NOTIFY_KEYS) out[k] = { push: k !== 'daily_summary', email: k === 'daily_summary' || k === 'payments', ...(saved?.[k] ?? {}) };
  return { ...out, quiet: (saved as { quiet?: { on: boolean; from: string; to: string } } | null)?.quiet ?? { on: false, from: '21:00', to: '07:00' } } as Notify & { quiet?: { on: boolean; from: string; to: string } };
}

export type ClientPerms = { book_sessions: boolean; cancel_sessions: boolean; join_events: boolean; edit_workouts: boolean; log_food: boolean; see_macros: boolean; message_trainer: boolean; join_communities: boolean };
export const PERM_LABELS: [keyof ClientPerms, string, string][] = [
  ['message_trainer', 'Message you', 'Clients can start chats and reply'],
  ['book_sessions', 'Book sessions', 'Clients book themselves into your open hours'],
  ['cancel_sessions', 'Cancel sessions', 'Clients cancel ahead of time (see the notice below)'],
  ['join_events', 'Sign up for events', 'Classes and workshops you publish'],
  ['join_communities', 'Join communities', 'Read and post in communities they’re in'],
  ['log_food', 'Log food', 'Food diary and water tracking'],
  ['see_macros', 'See macro targets', 'Calories and macros on their nutrition plan'],
  ['edit_workouts', 'Edit their workouts', 'Change sets, reps and exercises you assigned'],
];
export const DEFAULT_PERMS: ClientPerms = { book_sessions: true, cancel_sessions: true, join_events: true, edit_workouts: false, log_food: true, see_macros: true, message_trainer: true, join_communities: true };
