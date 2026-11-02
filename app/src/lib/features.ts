import type { AndroidSymbol } from 'expo-symbols';

/** Everything in the trainer's Menu. `href` = built; otherwise `soon` explains what's coming. */
export type Feature = { key: string; title: string; icon: AndroidSymbol; group: 'Coaching' | 'Business' | 'Community' | 'Help' | 'Hidden'; href?: string; soon?: string };
export const FEATURES: Feature[] = [
  { key: 'hub', title: 'Hub', icon: 'home', group: 'Coaching', href: '/coach' },
  { key: 'contacts', title: 'Contacts', icon: 'group', group: 'Coaching', href: '/coach/clients' },
  { key: 'workouts', title: 'Workouts', icon: 'fitness_center', group: 'Coaching', href: '/coach/workouts' },
  { key: 'exercises', title: 'Exercises', icon: 'directions_run', group: 'Coaching', href: '/exercises' },
  { key: 'nutrition', title: 'Nutrition', icon: 'restaurant', group: 'Coaching', href: '/coach/nutrition' },
  { key: 'checkins', title: 'Check-ins', icon: 'inbox', group: 'Coaching', href: '/checkins' },
  { key: 'programs', title: 'Programs', icon: 'calendar_month', group: 'Coaching', href: '/coach/workouts?tab=programs' },
  { key: 'habits', title: 'Habits', icon: 'checklist', group: 'Coaching', soon: 'One place to see every client’s habits and streaks, and assign a habit to many clients at once. (You can already add habits from a client’s profile.)' },
  { key: 'packages', title: 'Packages', icon: 'redeem', group: 'Business', soon: 'Sell session packs and memberships: price, sessions included, expiry, and what clients get.' },
  { key: 'financials', title: 'Financials', icon: 'payments', group: 'Business', soon: 'Payments, invoices, session credits and income at a glance, connected to Stripe.' },
  { key: 'calendar', title: 'Calendar', icon: 'event', group: 'Business', soon: 'Your sessions and availability, client bookings and reminders, plus importing sessions from a screenshot of your texts.' },
  { key: 'events', title: 'Events', icon: 'event_available', group: 'Business', soon: 'Classes, workshops and bootcamps clients can sign up for.' },
  { key: 'chat', title: 'Chat', icon: 'chat_bubble', group: 'Community', soon: 'Messages with clients and groups, with photos and voice notes.' },
  { key: 'communities', title: 'Communities', icon: 'groups', group: 'Community', soon: 'Group spaces where clients post, cheer each other on and join challenges.' },
  { key: 'resources', title: 'Resources', icon: 'storefront', group: 'Community', soon: 'Guides, videos and documents you share with clients or sell.' },
  { key: 'files', title: 'Files', icon: 'description', group: 'Community', soon: 'All your documents in one place, and sharing them with clients or groups. (You can already add files from a client’s profile.)' },
  { key: 'settings', title: 'Settings', icon: 'settings', group: 'Help', href: '/settings' },
  { key: 'support', title: 'Support', icon: 'support_agent', group: 'Help', href: '/support' },
  { key: 'notifications', title: 'Notifications', icon: 'notifications', group: 'Hidden', soon: 'Alerts when clients finish workouts, log food, submit check-ins or message you, all in one place.' },
];
export const GROUPS: Feature['group'][] = ['Coaching', 'Business', 'Community', 'Help'];
