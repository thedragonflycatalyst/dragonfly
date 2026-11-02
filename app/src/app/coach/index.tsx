import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { occurrences, type Booking, type CoachEvent } from '@/lib/business';
import { dayKey } from '@/lib/dates';
import { sb } from '@/lib/supabase';
import { useCheckins } from '@/features/checkin-data';
import { dueLabel } from '@/lib/checkins';
import type { AndroidSymbol } from 'expo-symbols';
import { Pressable, View } from 'react-native';
import { ComingWith } from '@/components/bits';
import { Screen } from '@/components/shell';
import { Card, Icon, Txt } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { usePalette } from '@/lib/theme';

const ACTIONS: { icon: AndroidSymbol; title: string; go?: () => void; later?: string }[] = [
  { icon: 'person_add', title: 'Add client', go: () => router.push('/clients/new') },
  { icon: 'qr_code_2', title: 'QR sign-up', go: () => router.push('/join-qr') },
  { icon: 'fitness_center', title: 'Start a workout', go: () => router.push('/coach/workouts') },
  { icon: 'inbox', title: 'Check-ins', go: () => router.push('/checkins') },
  { icon: 'event', title: 'Book a session', go: () => router.push('/calendar') },
  { icon: 'chat_bubble', title: 'Message a client', go: () => router.push('/chat') },
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
      <DueCard />
      <Txt v="h2" style={{ marginTop: 24, marginBottom: 10 }}>Today’s schedule</Txt>
      <Today />
    </Screen>
  );
}

/** Today's sessions and events, from the calendar */
function Today() {
  const p = usePalette();
  const [items, setItems] = useState<{ key: string; t: Date; title: string; sub: string; done?: boolean }[] | null>(null);
  const load = useCallback(async () => {
    const today = dayKey(new Date());
    const [b, e] = await Promise.all([
      sb.from('coach_bookings').select('*'),
      sb.from('coach_events').select('*').eq('cancelled', false).gte('starts_at', new Date(`${today}T00:00:00`).toISOString()).lt('starts_at', new Date(`${today}T23:59:59`).toISOString()),
    ]);
    const occ = occurrences((b.data as Booking[]) ?? [], today, today).map((o) => ({ key: o.booking.id, t: o.start, title: o.booking.title, sub: o.booking.location ?? '', done: o.done }));
    const evs = ((e.data as CoachEvent[]) ?? []).map((x) => ({ key: x.id, t: new Date(x.starts_at), title: x.title, sub: `${x.booked}${x.spaces ? `/${x.spaces}` : ''} going` }));
    setItems([...occ, ...evs].sort((a, b2) => a.t.getTime() - b2.t.getTime()));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (items === null) return null;
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push('/calendar')}>
      <Card style={{ padding: items.length ? 0 : 16 }}>
        {items.length === 0 ? <Txt v="small" style={{ fontSize: 15 }}>Nothing booked today. Tap to open your calendar.</Txt> : items.map((x, i) => (
          <View key={x.key} style={{ flexDirection: 'row', gap: 12, padding: 14, borderBottomWidth: i === items.length - 1 ? 0 : 1, borderBottomColor: p.line, opacity: x.done ? 0.6 : 1 }}>
            <Txt v="bold" style={{ width: 76 }}>{x.t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Txt>
            <View style={{ flex: 1 }}><Txt v="bold">{x.title}{x.done ? ' ✓' : ''}</Txt>{x.sub ? <Txt v="small">{x.sub}</Txt> : null}</View>
          </View>
        ))}
      </Card>
    </Pressable>
  );
}

/** Who's due a personal check-in */
function DueCard() {
  const p = usePalette();
  const app = useApp();
  const { rows, load } = useCheckins(app.trainer?.checkin_every_days ?? 14);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const due = (rows ?? []).filter((r) => r.due.status === 'overdue' || r.due.status === 'today').sort((a, b) => a.due.days - b.due.days);
  if (!due.length) return null;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/checkins')} style={{ marginTop: 16 }}>
      <Card style={{ gap: 6, borderWidth: 1.5, borderColor: p.gold }}>
        <Txt v="bold">{due.length} check-in{due.length === 1 ? '' : 's'} due</Txt>
        {due.slice(0, 4).map((r) => <Txt key={r.client.id} v="small">{r.client.name} · {dueLabel(r.due).toLowerCase()}{r.signals[0] ? ` · ${r.signals[0].text.toLowerCase()}` : ''}</Txt>)}
      </Card>
    </Pressable>
  );
}
