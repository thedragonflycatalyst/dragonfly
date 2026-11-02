import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Row, SectionLabel } from '@/components/bits';
import { Badge, Screen } from '@/components/shell';
import { Card, Empty, Press, Txt, useToast } from '@/components/ui';
import { ResumeBanner } from '@/features/resume';
import { SECTIONS, type SectionKey } from '@/features/common';
import { useApp } from '@/lib/app-state';
import { addDays, dayKey, relDay } from '@/lib/dates';
import { errText, type Assignment, type FormRequest } from '@/lib/model';
import { recall, sb } from '@/lib/supabase';
import { callFn, fnText } from '@/lib/fn';
import { usePalette } from '@/lib/theme';

const MINE: SectionKey[] = ['measurements', 'photos', 'habits', 'goals', 'forms', 'files'];

/** Client home: today's workout, anything waiting on them, and their progress sections. */
export default function Me() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const c = app.membership;
  const [items, setItems] = useState<Assignment[] | null>(null);
  const [forms, setForms] = useState<FormRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!c || c.status !== 'active') return setItems([]);
    const [a, f] = await Promise.all([
      sb.from('coach_assignments').select('*').eq('client_id', c.id).gte('scheduled_on', dayKey(addDays(new Date(), -7))).order('scheduled_on').limit(60),
      sb.from('coach_form_requests').select('*').eq('client_id', c.id).eq('status', 'pending'),
    ]);
    if (a.error) toast(errText(a.error), false);
    setItems((a.data as Assignment[]) ?? []); setForms((f.data as FormRequest[]) ?? []);
  }, [c, toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  // Back from Stripe checkout (web): record the payment straight away
  const { paid } = useLocalSearchParams<{ paid?: string }>();
  useEffect(() => {
    const id = paid ?? null;
    if (!id || !/^cs_/.test(id) || id !== recall<string | null>('coach.lastCheckout', null)) return;
    callFn<{ status: string }>('coach-pay', { action: 'confirm', session_id: id })
      .then((r) => { if (r.status !== 'unpaid') toast('Payment received. Thank you!'); router.replace('/me'); })
      .catch((e) => toast(fnText(e), false));
  }, [paid, toast]);

  if (!app.user) return <Redirect href="/sign-in" />;
  if (!c) return <Redirect href="/" />;
  const coach = app.myTrainer?.display_name;

  if (c.status === 'frozen') {
    return (
      <Screen kicker={coach ? `Coached by ${coach}` : undefined} title={`Hi ${c.first_name}`}>
        <Empty emoji="❄️" title="Your account is frozen" body={`Your training is paused${coach ? ` by ${coach}` : ''}. Everything you’ve logged is kept. Reach out to your trainer to pick back up.`} />
      </Screen>
    );
  }

  const today = dayKey(new Date());
  const todays = (items ?? []).filter((a) => a.scheduled_on === today);
  const upcoming = (items ?? []).filter((a) => a.scheduled_on > today && a.status === 'scheduled');
  const missed = (items ?? []).filter((a) => a.scheduled_on < today && a.status === 'scheduled');

  return (
    <Screen kicker={coach ? `Coached by ${coach}` : 'My training'} title={`Hi ${c.first_name}`}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing}>
      {items === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 40 }} /> : (
        <View style={{ gap: 14 }}>
          {forms.length > 0 && (
            <Card style={{ padding: 0, borderWidth: 1.5, borderColor: p.gold }}>
              {forms.map((f, i) => <Row key={f.id} icon={f.kind === 'health' ? 'health_and_safety' : 'description'} title={f.title} sub="Your trainer asked you to fill this in"
                last={i === forms.length - 1} onPress={() => router.push({ pathname: '/forms/[rid]', params: { rid: f.id } })} />)}
            </Card>
          )}
          {app.myTrainer?.welcome ? <Card style={{ borderLeftWidth: 4, borderLeftColor: app.myTrainer.brand_color ?? p.focus }}><Txt>{app.myTrainer.welcome}</Txt></Card> : null}
          <ResumeBanner />
          <Txt v="h2">Today</Txt>
          {todays.length ? todays.map((a) => <WorkoutCard key={a.id} a={a} />) : (
            <Empty emoji="🌿" title="Rest day" body={upcoming.length ? `Next up: ${upcoming[0].title}, ${relDay(upcoming[0].scheduled_on).toLowerCase()}.` : 'Nothing is scheduled yet. Your trainer will add your program here.'} />
          )}
          {missed.length > 0 && <><Txt v="h2" style={{ marginTop: 8 }}>Catch up</Txt>{missed.map((a) => <WorkoutCard key={a.id} a={a} />)}</>}
          {upcoming.length > 0 && <><Txt v="h2" style={{ marginTop: 8 }}>Coming up</Txt>{upcoming.slice(0, 10).map((a) => <WorkoutCard key={a.id} a={a} />)}</>}
          <Card style={{ padding: 0 }}>
            <Row icon="menu_book" title="Food diary" sub="Log meals, scan barcodes, snap a photo, track water" onPress={() => router.push('/me/food')} />
            <Row icon="restaurant" title="My nutrition plan" sub="Meals and daily targets from your trainer" onPress={() => router.push('/me/nutrition')} />
            <Row icon="monitor_weight" title="Scale" sub="Weigh-ins, body fat, muscle and your trend" onPress={() => router.push('/me/scale')} />
            <Row icon="directions_walk" title="Activity & sleep" sub="Steps, sleep, heart rate and workouts" onPress={() => router.push('/me/activity')} />
            <Row icon="link" title="Connected apps" sub="Health Connect, Strava, Oura, WHOOP, your food tracker" last onPress={() => router.push('/connections')} />
          </Card>
          <Card style={{ padding: 0 }}>
            <Row icon="chat_bubble" title="Messages" sub={`Chat with ${coach ?? 'your trainer'}`} onPress={() => router.push('/chat')} />
            <Row icon="event" title="Sessions" sub="Your bookings, and booking a session" onPress={() => router.push('/calendar')} />
            <Row icon="event_available" title="Events and classes" sub="Sign up for what’s coming up" onPress={() => router.push('/events')} />
            <Row icon="redeem" title="Packages and credits" sub="Session packs, memberships and payments" onPress={() => router.push('/me/packages')} />
            <Row icon="groups" title="Communities" sub="Posts and challenges with other clients" onPress={() => router.push('/communities')} />
            <Row icon="storefront" title="Resources and offers" sub="Guides, videos and deals from your trainer" onPress={() => router.push('/resources')} />
            <Row icon="description" title="Shared files" last onPress={() => router.push('/files')} />
          </Card>
          <SectionLabel>My progress</SectionLabel>
          <Card style={{ padding: 0 }}>
            {MINE.map((k, i) => <Row key={k} icon={SECTIONS[k].icon} title={SECTIONS[k].title} last={i === MINE.length - 1}
              onPress={() => router.push({ pathname: '/me/[section]', params: { section: k } })} />)}
          </Card>
        </View>
      )}
    </Screen>
  );
}

function WorkoutCard({ a }: { a: Assignment }) {
  const p = usePalette();
  const blocks = a.snapshot.filter((b) => b.kind !== 'note').length;
  return (
    <Press accessibilityRole="button" accessibilityLabel={`${a.title}, ${relDay(a.scheduled_on)}`} onPress={() => router.push({ pathname: '/workout/[aid]', params: { aid: a.id } })}>
    <Card style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <Txt v="kicker" color={p.focus}>{relDay(a.scheduled_on)}</Txt>
        {a.status === 'done' ? <Badge text="Done" color={p.good} /> : a.status === 'skipped' ? <Badge text="Skipped" /> : null}
      </View>
      <Txt v="h3">{a.title}</Txt>
      <Txt v="small">{blocks} {blocks === 1 ? 'exercise block' : 'exercise blocks'}{a.trainer_note ? ` · ${a.trainer_note}` : ''}</Txt>
    </Card>
    </Press>
  );
}
