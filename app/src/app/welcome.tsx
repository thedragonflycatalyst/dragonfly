import { Redirect, router } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/shell';
import { Button, Card, Icon, Txt } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { usePalette } from '@/lib/theme';

const POINTS = [
  { icon: 'fitness_center' as const, title: 'Your program, every day', body: 'See today’s workout, log your sets and watch your personal bests grow.' },
  { icon: 'schedule' as const, title: 'Timed work runs in Lapis', body: 'Intervals and circuits open in the Lapis voice timer with one tap.' },
  { icon: 'chat_bubble' as const, title: 'Your coach in your pocket', body: 'Check-ins, messages and progress, all in one place.' },
];

export default function Welcome() {
  const p = usePalette();
  const { user } = useApp();
  if (user) return <Redirect href="/" />;
  return (
    <Screen>
      <View style={{ paddingVertical: 28, gap: 10, maxWidth: 620 }}>
        <Txt v="display" accessibilityRole="header">Train with purpose.</Txt>
        <Txt style={{ fontSize: 19, lineHeight: 28 }} color={p.muted}>
          Dragonfly Coach connects you with your personal trainer: your workouts, your progress and your coach, in one app.
        </Txt>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <Button title="Sign in" onPress={() => router.push('/sign-in')} />
          <Button kind="ghost" title="I have an invite code" icon="link" onPress={() => router.push('/join')} />
        </View>
        <Txt v="small" style={{ marginTop: 4 }}>Use the same account as your other Dragonfly apps.</Txt>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {POINTS.map((pt) => (
          <Card key={pt.title} style={{ flexGrow: 1, flexBasis: 260, gap: 6 }}>
            <Icon name={pt.icon} color={p.focus} size={26} />
            <Txt v="h3">{pt.title}</Txt>
            <Txt v="small" style={{ fontSize: 15 }}>{pt.body}</Txt>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
