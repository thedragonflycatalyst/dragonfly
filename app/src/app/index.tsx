import { Redirect } from 'expo-router';
import { useApp } from '@/lib/app-state';

/** One sign-in for everyone; the account decides the home: trainer → coaching, client → their training. */
export default function Home() {
  const { user, mode } = useApp();
  if (!user) return <Redirect href="/sign-in" />;
  if (mode === 'coach') return <Redirect href="/coach" />;
  if (mode === 'client') return <Redirect href="/me" />;
  return <Redirect href="/start" />;
}
