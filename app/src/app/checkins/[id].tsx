import * as Clipboard from 'expo-clipboard';
import { lowRel } from '@/lib/dates';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, Switch, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Badge } from '@/components/shell';
import { Button, Card, Chip, Field, Txt, useToast } from '@/components/ui';
import { DateField } from '@/components/date-field';
import { useCheckins } from '@/features/checkin-data';
import { useApp } from '@/lib/app-state';
import { CHANNELS, dueLabel, MOODS, type Channel, type Checkin } from '@/lib/checkins';
import { dayKey, fmtShort, fromKey, relDay } from '@/lib/dates';
import { errText } from '@/lib/model';
import { actingHeaders, sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

type Brief = { summary: string; wins: string[]; watch: string[]; points: string[]; message: string };

/** One client's check-ins: rhythm, what to notice, AI talking points, log how it went, and history. */
export default function ClientCheckin() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rows, load } = useCheckins(app.trainer?.checkin_every_days ?? 14);
  const [history, setHistory] = useState<Checkin[]>([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefing, setBriefing] = useState(false);
  const [channel, setChannel] = useState<Channel>('text');
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [follow, setFollow] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    await load();
    const { data } = await sb.from('coach_checkins').select('*').eq('client_id', id).order('done_on', { ascending: false }).limit(50);
    setHistory((data as Checkin[]) ?? []);
  }, [id, load]);
  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));
  const row = rows?.find((r) => r.client.id === id);
  if (!rows) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  if (!row) return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Txt>Client not found.</Txt></View>;
  const c = row.client;
  const plan = row.plan ?? { every_days: app.trainer?.checkin_every_days ?? 14, channel: 'text' as Channel, paused: false };

  const savePlan = async (patch: Partial<typeof plan>) => {
    const { error } = await sb.from('coach_checkin_plans').upsert({ client_id: c.id, trainer_id: c.trainer_id, ...plan, ...patch, updated_at: new Date().toISOString() });
    if (error) toast(errText(error), false); else load();
  };
  const getBrief = async () => {
    setBriefing(true);
    try {
      const { data, error } = await sb.functions.invoke('coach-checkin-brief', { body: { client_id: c.id }, headers: actingHeaders() });
      const code = (data as { error?: string } | null)?.error ?? (error ? await (error as { context?: Response }).context?.json?.().then((j: { error?: string }) => j.error).catch(() => null) : null);
      if (code === 'not_configured') return toast('AI isn’t switched on yet (add the Anthropic key in Supabase).', false);
      if (code === 'daily_limit') return toast('That’s today’s limit for AI briefs.', false);
      if (error || !data?.points) return toast('Couldn’t prepare a brief right now. Try again.', false);
      setBrief(data as Brief);
    } finally { setBriefing(false); }
  };
  const log = async () => {
    setBusy(true);
    const { error } = await sb.from('coach_checkins').insert({ client_id: c.id, trainer_id: c.trainer_id, channel, mood, note: note.trim() || null, follow_up_on: follow, done_on: dayKey(new Date()) });
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast('Check-in logged'); setNote(''); setMood(null); setFollow(null); setBrief(null); loadAll();
  };
  const phone = c.phone?.replace(/[^\d+]/g, '');
  const text = (body: string) => Linking.openURL(`sms:${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(body)}`);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: `Check in with ${c.first_name}` }} />
      <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Txt v="h3">{c.name}</Txt>
            <Badge text={dueLabel(row.due)} color={row.due.status === 'overdue' ? p.danger : row.due.status === 'today' ? p.gold : p.focus} />
          </View>
          <Txt v="small">{row.last ? `Last check-in ${lowRel(row.last.done_on)}` : 'No check-ins yet'} · next {fmtShort(fromKey(row.due.due))}</Txt>
          {row.signals.map((s) => <Txt key={s.text} v="smallBold" color={s.level === 'warn' ? p.danger : p.good}>{s.level === 'warn' ? '• ' : '✓ '}{s.text}</Txt>)}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {phone ? <Button small kind="ghost" icon="sms" title="Text" onPress={() => text('')} /> : null}
            {phone ? <Button small kind="ghost" icon="call" title="Call" onPress={() => Linking.openURL(`tel:${phone}`)} /> : null}
            <Button small kind="quiet" title="Open profile" onPress={() => router.push({ pathname: '/clients/[id]', params: { id: c.id } })} />
          </View>
        </Card>

        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <Txt v="h3" style={{ flex: 1 }}>Prepare with AI</Txt>
            <Button small kind="accent" icon="bolt" title={brief ? 'Refresh' : 'Get talking points'} busy={briefing} onPress={getBrief} />
          </View>
          {!brief ? <Txt v="small">Reads {c.first_name}’s last three weeks (workouts, food diary, water, weigh-ins, your notes) and suggests what to praise, what to ask, and an opening message. You do the check-in.</Txt> : <>
            <Txt>{brief.summary}</Txt>
            {brief.wins.length > 0 && <View style={{ gap: 2 }}><Txt v="smallBold" color={p.good}>Wins</Txt>{brief.wins.map((w) => <Txt key={w}>✓ {w}</Txt>)}</View>}
            {brief.watch.length > 0 && <View style={{ gap: 2 }}><Txt v="smallBold" color={p.danger}>Keep an eye on</Txt>{brief.watch.map((w) => <Txt key={w}>• {w}</Txt>)}</View>}
            <View style={{ gap: 2 }}><Txt v="smallBold">Talking points</Txt>{brief.points.map((w, i) => <Txt key={w}>{i + 1}. {w}</Txt>)}</View>
            {brief.message ? <View style={{ gap: 6, padding: 12, borderRadius: 12, backgroundColor: p.soft }}>
              <Txt v="smallBold">Opening message</Txt>
              <Txt>{brief.message}</Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button small kind="ghost" icon="content_copy" title="Copy" onPress={async () => { await Clipboard.setStringAsync(brief.message); toast('Copied'); }} />
                {phone ? <Button small kind="ghost" icon="sms" title="Text it" onPress={() => text(brief.message)} /> : null}
              </View>
            </View> : null}
            <Txt v="small" color={p.muted}>AI suggestions; use your judgement.</Txt>
          </>}
        </Card>

        <SectionLabel>Log a check-in</SectionLabel>
        <Card>
          <Txt v="smallBold" style={{ marginBottom: 8 }}>How</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>{CHANNELS.map(([k, l]) => <Chip key={k} label={l} selected={channel === k} onPress={() => setChannel(k)} />)}</View>
          <Txt v="smallBold" style={{ marginBottom: 8 }}>How did {c.first_name} seem?</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>{[1, 2, 3, 4, 5].map((m) => <Chip key={m} label={MOODS[m]} selected={mood === m} onPress={() => setMood(mood === m ? null : m)} />)}</View>
          <Field label="Notes" hint="(only you see these)" value={note} onChangeText={setNote} multiline placeholder="Knee is better; wants to add a run on Saturdays" />
          <DateField label="Follow up on (optional, otherwise the usual rhythm)" value={follow} onChange={setFollow} />
          <Button title="Save check-in" icon="check" busy={busy} onPress={log} style={{ alignSelf: 'flex-start' }} />
        </Card>

        <SectionLabel>Rhythm</SectionLabel>
        <Card style={{ gap: 10 }}>
          <Txt v="smallBold">Check in every</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[3, 7, 14, 21, 30].map((d) => <Chip key={d} label={d === 7 ? 'Week' : d === 14 ? '2 weeks' : d === 30 ? 'Month' : `${d} days`} selected={plan.every_days === d} onPress={() => savePlan({ every_days: d })} />)}</View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt v="bold">Pause check-in reminders</Txt>
            <Switch value={plan.paused} onValueChange={(paused) => savePlan({ paused })} accessibilityLabel="Pause check-in reminders" trackColor={{ true: p.focus, false: p.line }} thumbColor={p.surface} />
          </View>
        </Card>

        {history.length > 0 && <>
          <SectionLabel>History</SectionLabel>
          <Card style={{ padding: 0 }}>
            {history.map((h, i) => (
              <View key={h.id} style={{ padding: 14, gap: 4, borderBottomWidth: i === history.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                <Txt v="bold">{fmtShort(fromKey(h.done_on))} · {CHANNELS.find(([k]) => k === h.channel)?.[1]}{h.mood ? ` · ${MOODS[h.mood]}` : ''}</Txt>
                {h.note ? <Txt>{h.note}</Txt> : null}
                {h.follow_up_on ? <Txt v="small">Follow up {fmtShort(fromKey(h.follow_up_on))}</Txt> : null}
              </View>
            ))}
          </Card>
        </>}
      </View>
    </ScrollView>
  );
}
