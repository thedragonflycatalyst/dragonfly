import { LinearGradient } from 'expo-linear-gradient';
import { F, R } from '@/lib/theme';
import { coverColors } from '@/lib/workouts';
import { Txt } from './ui';

/** Gradient cover with the workout's initials (Dragonfly's own art; no stock photos) */
export function Cover({ name, cover, size = 64 }: { name: string; cover: string | null; size?: number }) {
  const [a, b] = coverColors(cover, name);
  const letters = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' }}>
      <Txt style={{ fontFamily: F.display, fontSize: size * 0.34, color: '#fff' }}>{letters}</Txt>
    </LinearGradient>
  );
}

