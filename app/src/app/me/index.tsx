import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Badge, Screen } from '@/components/shell';
import { Button, Card, Empty, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { addDays, dayKey, relDay } from '@/lib/dates';
import { errText, type Assignment, type Person } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

/** Client home: who coaches them, today's workout and what's coming up. */
export default function Me() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const [items, setItems] = useState<Assignment[] | null>(null);
  const [trainers, setTrainers] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const from = dayKey(addDays(new Date(), -7));
    const [a, ppl, t] = await Promise.all([
      sb.from('coach_assignments').select('*').gte('scheduled_on', from).order('scheduled_on').limit(60),
      sb.rpc('coach_people'),
      sb.from('coach_trainers').select('user_id,display_name,business_name'),
    ]);
    if (a.error) toast(errText(a.error), false);
    setItems((a.data as Assignment[]) ?? []);
    const names: Record<string, string> = {};
    for (const x of (ppl.data as Person[]) ?? []) if (x.relation === 'trainer') names[x.user_id] = x.username;
    for (const x of (t.data as { user_id: string; display_name: string }[]) ?? []) names[x.user_id] = x.display_name;
    setTrainers(names);
  }, [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!app.user) return <Redirect href="/welcome" />;
  if (!app.memberships.length) return <Redirect href="/" />;

  const today = dayKey(new Date());
  const todays = (items ?? []).filter((a) => a.scheduled_on === today);
  const upcoming = (items ?? []).filter((a) => a.scheduled_on > today && a.status === 'scheduled');
  const missed = (items ?? []).filter((a) => a.scheduled_on < today && a.status === 'scheduled');
  const coachNames = app.memberships.map((m) => trainers[m.trainer_id]).filter(Boolean).join(' and ');

  return (
    <Screen kicker={coachNames ? `Coached by ${coachNames}` : 'My training'} title={`Hi ${app.username ?? ''}`}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing}>
      {items === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 40 }} /> : (
        <View style={{ gap: 14 }}>
          <Txt v="h2">Today</Txt>
          {todays.length ? todays.map((a) => <WorkoutCard key={a.id} a={a} />) : (
            <Empty emoji="🌿" title="Rest day" body={upcoming.length ? `Next up: ${upcoming[0].title}, ${relDay(upcoming[0].scheduled_on).toLowerCase()}.` : 'Nothing is scheduled yet. Your coach will add your program here.'} />
          )}
          {missed.length > 0 && (
            <>
              <Txt v="h2" style={{ marginTop: 8 }}>Catch up</Txt>
              {missed.map((a) => <WorkoutCard key={a.id} a={a} />)}
            </>
          )}
          {upcoming.length > 0 && (
            <>
              <Txt v="h2" style={{ marginTop: 8 }}>Coming up</Txt>
              {upcoming.slice(0, 10).map((a) => <WorkoutCard key={a.id} a={a} />)}
            </>
          )}
          {app.memberships.some((m) => m.goals) && (
            <Card style={{ gap: 6 }}>
              <Txt v="h3">Your goals</Txt>
              {app.memberships.filter((m) => m.goals).map((m) => <Txt key={m.id}>{m.goals}</Txt>)}
            </Card>
          )}
          <Button kind="quiet" small title="Join another trainer" icon="link" style={{ alignSelf: 'flex-start' }} onPress={() => router.push('/join')} />
        </View>
      )}
    </Screen>
  );
}

function WorkoutCard({ a }: { a: Assignment }) {
  const p = usePalette();
  const blocks = a.snapshot.filter((b) => b.kind !== 'note').length;
  return (
    <Card style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <Txt v="kicker" color={p.focus}>{relDay(a.scheduled_on)}</Txt>
        {a.status === 'done' ? <Badge text="Done" color={p.good} /> : a.status === 'skipped' ? <Badge text="Skipped" /> : null}
      </View>
      <Txt v="h3">{a.title}</Txt>
      <Txt v="small">{blocks} {blocks === 1 ? 'exercise block' : 'exercise blocks'}{a.trainer_note ? ` · ${a.trainer_note}` : ''}</Txt>
    </Card>
  );
}
