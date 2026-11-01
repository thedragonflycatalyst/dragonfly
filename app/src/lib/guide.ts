import type { AndroidSymbol } from 'expo-symbols';
import type { Mode } from './app-state';
import { recall, store } from './supabase';

/** One quickstart card. `ready: false` marks a feature that's on the roadmap but not in the app yet. */
export type GuideStep = { icon: AndroidSymbol; title: string; body: string; ready: boolean };

export const GUIDES: Record<Mode, { title: string; intro: string; steps: GuideStep[] }> = {
  client: {
    title: 'Welcome to Dragonfly',
    intro: 'A quick look at what you can do here. You can reopen this guide from your account anytime.',
    steps: [
      { icon: 'fitness_center', title: 'Your workouts', ready: true,
        body: 'Today’s workout is on your home screen, with what’s coming up below it. Tap a workout to see every exercise, then log your sets as you go.' },
      { icon: 'monitor_weight', title: 'Weigh-ins and your trend', ready: false,
        body: 'Log your weight and see your true trend, not the daily ups and downs. Set a goal and see when you’re on track to reach it. You can bring your history over from Libra.' },
      { icon: 'photo_camera', title: 'Before and after photos', ready: false,
        body: 'Take progress photos in the same pose each time and compare them side by side. Only you and your trainer can see them.' },
      { icon: 'restaurant', title: 'Nutrition tracking', ready: false,
        body: 'Log meals by searching or scanning a barcode, and see your calories and macros against the targets your trainer sets.' },
      { icon: 'watch', title: 'Pair your watch', ready: false,
        body: 'Connect Health Connect so steps, heart rate and workouts from your watch show up automatically.' },
      { icon: 'person', title: 'Your profile and account', ready: true,
        body: 'Tap your picture at the top right to change your photo, email or password. It’s the same account as every other Dragonfly app.' },
    ],
  },
  coach: {
    title: 'Welcome, coach',
    intro: 'Here’s how Dragonfly works for trainers. You can reopen this guide from your account anytime.',
    steps: [
      { icon: 'person_add', title: 'Onboard a client', ready: true,
        body: 'Tap Add client and enter their name and email. They get an email with a code to set their password, then sign in on the same screen you do.' },
      { icon: 'group', title: 'Your client list', ready: true,
        body: 'See who’s active, who hasn’t signed in yet, and open anyone to edit their goals and your private notes. Pause or archive clients when needed.' },
      { icon: 'fitness_center', title: 'Build workouts and routines', ready: false,
        body: 'Create workouts from your exercise library, including your TRX moves, then group them into multi-week programs you can reuse.' },
      { icon: 'calendar_month', title: 'Assign and schedule', ready: false,
        body: 'Put a program on a client’s calendar from any start date. Timed sections open in Lapis on their phone.' },
      { icon: 'monitor_weight', title: 'Track progress', ready: false,
        body: 'See each client’s weight trend, photos, workout logs and personal bests in one place, and reply to their check-ins.' },
      { icon: 'person', title: 'Your profile and account', ready: true,
        body: 'Tap your picture at the top right to change your photo, email or password. It’s your one Dragonfly account.' },
    ],
  },
};

const key = (uid: string, mode: Mode) => `guide.seen.${uid}.${mode}`;
export const guideSeen = (uid: string, mode: Mode) => recall<boolean>(key(uid, mode), false);
export const markGuideSeen = (uid: string, mode: Mode) => store(key(uid, mode), true);
