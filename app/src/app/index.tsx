import { Redirect } from 'expo-router';
import { useApp } from '@/lib/app-state';

/** Sends people to the right home: signed out → welcome, trainer → coaching, client → their training. */
export default function Home() {
  const { user, mode } = useApp();
  if (!user) return <Redirect href="/welcome" />;
  if (mode === 'coach') return <Redirect href="/coach" />;
  if (mode === 'client') return <Redirect href="/me" />;
  return <Redirect href="/start" />;
}
