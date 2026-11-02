import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { Cover } from '@/components/cover';
import { Fab } from '@/components/pickers';
import { Badge } from '@/components/shell';
import { Empty, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { eventCost, spotsText, type CoachEvent, type Signup } from '@/lib/business';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, R, usePalette } from '@/lib/theme';

/** Events: classes, workshops and bootcamps with spaces, a waiting list, and a price or credits */
export default function Events() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const coach = app.mode === 'coach';
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const [list, setList] = useState<CoachEvent[] | null>(null);
  const [mine, setMine] = useState<Signup[]>([]);
  const load = useCallback(async () => {
    const now = new Date().toISOString();
    const q = sb.from('coach_events').select('*');
    const { data, error } = when === 'upcoming' ? await q.gte('starts_at', now).order('starts_at') : await q.lt('starts_at', now).order('starts_at', { ascending: false }).limit(60);
    if (error) toast(errText(error), false);
    setList((data as CoachEvent[]) ?? []);
    if (!coach && app.membership) { const { data: s } = await sb.from('coach_event_signups').select('*').eq('client_id', app.membership.id); setMine((s as Signup[]) ?? []); }
  }, [when, toast, coach, app.membership]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Events' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <Segmented value={when} onChange={setWhen} options={[['upcoming', 'Upcoming'], ['past', 'Past']]} />
          {list === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : list.length === 0 ? (
            <Empty emoji="🎟️" title={when === 'past' ? 'No past events' : coach ? 'Create your first event' : 'Nothing coming up'}
              body={coach ? 'Group classes, workshops, bootcamps and challenges. Set spaces and a waiting list, and charge a price or package credits.' : 'When your trainer schedules classes or workshops, sign up here.'} />
          ) : list.map((e) => {
            const s = mine.find((x) => x.event_id === e.id && x.status !== 'cancelled');
            const d = new Date(e.starts_at);
            return (
              <Pressable key={e.id} onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })} accessibilityRole="link" accessibilityLabel={e.title}
                style={({ pressed }) => ({ flexDirection: 'row', gap: 14, backgroundColor: p.surface, borderRadius: R.lg, padding: 12, opacity: pressed ? 0.8 : e.cancelled ? 0.6 : 1 })}>
                <View style={{ width: 92, height: 92, borderRadius: R.md, overflow: 'hidden' }}><Cover name={e.title} cover={e.cover} size={92} /></View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt v="kicker" color={e.color ?? p.focus}>{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Txt>
                  <Txt v="h3" numberOfLines={2}>{e.title}</Txt>
                  <Txt v="small">{e.cancelled ? 'Cancelled' : spotsText(e)} · {eventCost(e)}</Txt>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {s && <Badge text={s.status === 'booked' ? 'You’re going' : 'On the waiting list'} color={s.status === 'booked' ? p.good : p.gold} />}
                    {coach && !e.visible && <Badge text="Hidden" />}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {coach && <Fab title="Create event" onPress={() => router.push({ pathname: '/events/[id]', params: { id: 'new' } })} />}
    </View>
  );
}
