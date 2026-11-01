import { router } from 'expo-router';
import type { AndroidSymbol } from 'expo-symbols';
import { Pressable, View } from 'react-native';
import { ComingWith } from '@/components/bits';
import { Screen } from '@/components/shell';
import { Card, Icon, Txt } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { usePalette } from '@/lib/theme';

const ACTIONS: { icon: AndroidSymbol; title: string; go?: () => void; later?: string }[] = [
  { icon: 'person_add', title: 'Add client', go: () => router.push('/clients/new') },
  { icon: 'fitness_center', title: 'Start a workout', later: 'the Workouts tab' },
  { icon: 'event', title: 'Book a session', later: 'the Hub' },
  { icon: 'chat_bubble', title: 'Message a client', later: 'the Hub' },
];

/** Trainer home. Quick actions now; today's schedule, activity and compliance come with the Hub chunk. */
export default function Hub() {
  const p = usePalette();
  const app = useApp();
  return (
    <Screen kicker={app.trainer?.business_name ?? 'Coaching'} title={`Hi ${app.trainer?.display_name ?? ''}`}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {ACTIONS.map((a) => (
          <Pressable key={a.title} accessibilityRole="button" disabled={!a.go} onPress={a.go} style={({ pressed }) => ({ flexGrow: 1, flexBasis: 160, opacity: pressed ? 0.8 : 1 })}>
            <Card style={{ minHeight: 104, justifyContent: 'space-between', gap: 10 }}>
              <Icon name={a.icon} size={26} color={a.go ? p.focus : p.muted} />
              <View><Txt v="bold" color={a.go ? p.ink : p.muted}>{a.title}</Txt>{a.later ? <ComingWith what={a.later} /> : null}</View>
            </Card>
          </Pressable>
        ))}
      </View>
      <Txt v="h2" style={{ marginTop: 24, marginBottom: 10 }}>Today’s schedule</Txt>
      <Card><Txt v="small" style={{ fontSize: 15 }}>Your sessions, client activity and compliance will show here when we build the Hub.</Txt></Card>
    </Screen>
  );
}
