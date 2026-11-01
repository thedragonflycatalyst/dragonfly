import { Redirect } from 'expo-router';
import { useApp } from '@/lib/app-state';
import { guideSeen } from '@/lib/guide';

/** One sign-in for everyone; the account decides the home: trainer → coaching, client → their training. */
export default function Home() {
  const { user, mode, membership } = useApp();
  if (!user) return <Redirect href="/sign-in" />;
  // A client's first sign-in: set up their profile (the guide follows)
  if (mode === 'client' && membership?.status === 'active' && !membership.onboarded_at) return <Redirect href="/onboarding" />;
  // First time on each side: a short quickstart guide
  if (mode && !guideSeen(user.id, mode)) return <Redirect href="/guide" />;
  if (mode === 'coach') return <Redirect href="/coach" />;
  if (mode === 'client') return <Redirect href="/me" />;
  return <Redirect href="/start" />;
}
