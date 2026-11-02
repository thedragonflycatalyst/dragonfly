import { lowRel } from '@/lib/dates';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Initials, Segmented } from '@/components/bits';
import { Badge } from '@/components/shell';
import { Card, Empty, Icon, Txt } from '@/components/ui';
import { useCheckins } from '@/features/checkin-data';
import { useApp } from '@/lib/app-state';
import { byUrgency, CHANNELS, dueLabel, MOODS } from '@/lib/checkins';
import { fmtShort, fromKey, relDay } from '@/lib/dates';
import { F, MAX_W, R, usePalette } from '@/lib/theme';

/** Check-ins: who you should reach out to personally, and the check-ins you've done. */
export default function Checkins() {
  const p = usePalette();
  const app = useApp();
  const { rows, recent, load } = useCheckins(app.trainer?.checkin_every_days ?? 14);
  const [tab, setTab] = useState<'due' | 'all' | 'done'>('due');
  const [q, setQ] = useState('');
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const match = (name: string) => q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => name.toLowerCase().includes(w));
  const list = useMemo(() => (rows ?? []).filter((r) => match(r.client.name) && (tab === 'all' || ['overdue', 'today', 'soon'].includes(r.due.status)))
    .sort((a, b) => byUrgency(a.due, b.due)), [rows, q, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const overdue = (rows ?? []).filter((r) => r.due.status === 'overdue' || r.due.status === 'today').length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Check-ins' }} />
      <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
        <Txt v="small">Reach out personally. Dragonfly keeps track of who’s due, flags what’s worth asking about, and can prepare talking points for you.</Txt>
        <Segmented value={tab} onChange={setTab} options={[['due', overdue ? `Due (${overdue})` : 'Due'], ['all', 'All clients'], ['done', 'Done']]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: R.pill, paddingHorizontal: 14, height: 46 }}>
          <Icon name="search" size={20} color={p.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search client name" placeholderTextColor={p.muted} accessibilityLabel="Search client name" style={{ flex: 1, fontFamily: F.body, fontSize: 16, color: p.ink, height: 44 }} />
        </View>
        {rows === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : tab === 'done' ? (
          recent.filter((c) => match(c.client?.name ?? '')).length === 0
            ? <Empty emoji="📞" title="No check-ins yet" body="When you check in with a client, log it here: how it went, how they seemed, and when to follow up." />
            : <Card style={{ padding: 0 }}>
              {recent.filter((c) => match(c.client?.name ?? '')).map((c, i, a) => (
                <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/checkins/[id]', params: { id: c.client_id } })}
                  style={{ padding: 14, gap: 4, borderBottomWidth: i === a.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                    <Txt v="bold">{c.client?.name ?? 'Client'}</Txt>
                    <Txt v="small">{relDay(c.done_on)} · {CHANNELS.find(([k]) => k === c.channel)?.[1]}</Txt>
                  </View>
                  {c.mood ? <Txt v="small">Seemed: {MOODS[c.mood]}</Txt> : null}
                  {c.note ? <Txt numberOfLines={2}>{c.note}</Txt> : null}
                </Pressable>
              ))}
            </Card>
        ) : list.length === 0 ? (
          <Empty emoji="🌿" title={tab === 'due' ? 'Nobody’s due' : 'No clients yet'} body={tab === 'due' ? 'You’re caught up. Clients show up here a few days before their next check-in.' : 'Add clients in Contacts.'} />
        ) : (
          <Card style={{ padding: 0 }}>
            {list.map((r, i) => (
              <Pressable key={r.client.id} accessibilityRole="button" accessibilityLabel={`${r.client.name}, ${dueLabel(r.due)}`} onPress={() => router.push({ pathname: '/checkins/[id]', params: { id: r.client.id } })}
                style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 14, alignItems: 'center', borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: p.line, opacity: pressed ? 0.7 : 1 })}>
                <Initials name={r.client.name} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Txt v="bold">{r.client.name}</Txt>
                    <Badge text={dueLabel(r.due)} color={r.due.status === 'overdue' ? p.danger : r.due.status === 'today' ? p.gold : r.due.status === 'paused' ? undefined : p.focus} />
                  </View>
                  <Txt v="small">{r.last ? `Last: ${lowRel(r.last.done_on)} by ${CHANNELS.find(([k]) => k === r.last!.channel)?.[1].toLowerCase()}` : 'No check-ins yet'} · next {fmtShort(fromKey(r.due.due))}</Txt>
                  {r.signals.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {r.signals.map((s) => <Txt key={s.text} v="smallBold" color={s.level === 'warn' ? p.danger : p.good}>{s.level === 'warn' ? '• ' : '✓ '}{s.text}</Txt>)}
                  </View>}
                </View>
                <Icon name="chevron_right" color={p.muted} />
              </Pressable>
            ))}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
