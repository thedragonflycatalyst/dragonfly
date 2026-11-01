import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Row, Segmented } from '@/components/bits';
import { Badge } from '@/components/shell';
import { Button, Card, Empty, Txt } from '@/components/ui';
import { AssignToClient } from '@/features/assign';
import { useClientRecord } from '@/features/common';
import { dayKey, fmtShort, fromKey, relDay } from '@/lib/dates';
import type { Assignment } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

/** A client's calendar of workouts from the trainer's side: what's coming, what was done, and Assign. */
export default function ClientWorkouts() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { client } = useClientRecord(id);
  const [items, setItems] = useState<Assignment[] | null>(null);
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb.from('coach_assignments').select('*').eq('client_id', id).order('scheduled_on', { ascending: false }).limit(300);
    setItems((data as Assignment[]) ?? []);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = dayKey(new Date());
  const list = (items ?? []).filter((a) => (view === 'upcoming' ? a.scheduled_on >= today && a.status === 'scheduled' : a.scheduled_on < today || a.status !== 'scheduled'));
  if (view === 'upcoming') list.reverse();
  const doneCount = (items ?? []).filter((a) => a.status === 'done').length;
  const due = (items ?? []).filter((a) => a.scheduled_on <= today).length;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: client ? `${client.first_name}’s workouts` : 'Workouts' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <Segmented value={view} onChange={setView} options={[['upcoming', 'Upcoming'], ['past', 'Past']]} />
            {client && <Button title="Assign" icon="add" onPress={() => setAssigning(true)} />}
          </View>
          {due > 0 && <Txt v="small">Completed {doneCount} of {due} workouts due so far ({Math.round((doneCount / due) * 100)}%).</Txt>}
          {items === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : list.length === 0 ? (
            <Empty emoji={view === 'upcoming' ? '🗓️' : '📒'} title={view === 'upcoming' ? 'Nothing scheduled' : 'No history yet'}
              body={view === 'upcoming' ? 'Assign a workout or a whole program and it shows up on their calendar.' : 'Finished and skipped workouts show up here.'} />
          ) : (
            <Card style={{ padding: 0 }}>
              {list.map((a, i) => (
                <Row key={a.id} icon={a.status === 'done' ? 'task_alt' : 'fitness_center'} title={a.title} sub={`${relDay(a.scheduled_on)} · ${fmtShort(fromKey(a.scheduled_on))}`}
                  last={i === list.length - 1} onPress={() => router.push({ pathname: '/workout/[aid]', params: { aid: a.id } })}
                  right={a.status === 'done' ? <Badge text="Done" color={p.good} /> : a.status === 'skipped' ? <Badge text="Skipped" /> : a.scheduled_on < today ? <Badge text="Missed" color={p.danger} /> : undefined} />
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
      {client && <AssignToClient client={client} visible={assigning} onClose={() => setAssigning(false)} onDone={load} />}
    </View>
  );
}
