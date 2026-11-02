import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { DateField } from '@/components/date-field';
import { ActionMenu, Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { ask } from '@/lib/ask';
import { dayKey } from '@/lib/dates';
import { errText, type Client, type Program, type Workout } from '@/lib/model';
import { copyWeek, setDay, trimWeeks } from '@/lib/session';
import { sb } from '@/lib/supabase';
import { CoverPicker } from '@/features/cover-picker';
import { canSendToTrainers, CopyToTrainer } from '@/features/team';
import { useApp } from '@/lib/app-state';
import { MAX_W, R, usePalette } from '@/lib/theme';

/** Program builder: a grid of weeks × days, each day holding one workout. Saves automatically. */
export default function ProgramScreen() {
  const p = usePalette();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pr, setPr] = useState<Program | null | undefined>(undefined);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pick, setPick] = useState<{ week: number; day: number } | null>(null);
  const [weekMenu, setWeekMenu] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(dayKey(new Date()));
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const app = useApp();
  const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef<Program | null>(null);

  useEffect(() => {
    Promise.all([sb.from('coach_programs').select('*').eq('id', id).maybeSingle(),
      sb.from('coach_workouts').select('*').eq('archived', false).order('name'),
      sb.from('coach_clients').select('*').in('status', ['active', 'invited']).order('last_name')])
      .then(([r, w, c]) => { setPr((r.data as Program) ?? null); setWorkouts((w.data as Workout[]) ?? []); setClients((c.data as Client[]) ?? []); });
  }, [id]);

  const persist = useCallback(async () => {
    const cur = latest.current;
    if (!cur) return;
    const { error } = await sb.from('coach_programs').update({ name: cur.name.trim() || 'Untitled program', description: cur.description, weeks: cur.weeks, schedule: cur.schedule, cover: cur.cover }).eq('id', cur.id);
    setSaved(error ? 'error' : 'saved');
    if (error) toast(errText(error), false);
  }, [toast]);
  const update = (patch: Partial<Program>) => setPr((x) => {
    if (!x) return x;
    const next = { ...x, ...patch };
    latest.current = next; clearTimeout(timer.current); setSaved('saving');
    timer.current = setTimeout(persist, 700);
    return next;
  });
  useEffect(() => () => { clearTimeout(timer.current); if (latest.current) persist(); }, [persist]);

  if (pr === undefined) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  if (!pr) return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="🔎" title="Program not found" /></View>;
  const nameOf = (wid: string) => workouts.find((w) => w.id === wid)?.name ?? 'Deleted workout';
  const setWeeks = (n: number) => {
    const weeks = Math.max(1, Math.min(52, n));
    const drop = pr.schedule.filter((s) => s.week > weeks).length;
    const apply = () => update({ weeks, schedule: trimWeeks(pr.schedule, weeks) });
    if (drop) ask(`Remove week ${pr.weeks}?`, `${drop} workout${drop === 1 ? '' : 's'} in it will come off the program.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: apply }]);
    else apply();
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: pr.name, headerRight: () => <Txt v="small" style={{ marginRight: 12 }}>{saved === 'saving' ? 'Saving…' : saved === 'error' ? 'Not saved' : 'Saved'}</Txt> }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 14 }}>
          <Card>
            <Field label="Program name" value={pr.name} onChangeText={(name) => update({ name })} />
            <Field label="Description" hint="(optional)" value={pr.description ?? ''} onChangeText={(d) => update({ description: d || null })} multiline />
            <CoverPicker name={pr.name} value={pr.cover} trainerId={pr.trainer_id} onChange={(cover) => update({ cover })} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Txt v="bold" style={{ flexShrink: 0 }}>{pr.weeks} {pr.weeks === 1 ? 'week' : 'weeks'}</Txt>
              <Button small kind="ghost" title="Remove week" icon="remove" disabled={pr.weeks <= 1} onPress={() => setWeeks(pr.weeks - 1)} />
              <Button small kind="ghost" title="Add week" icon="add" disabled={pr.weeks >= 52} onPress={() => setWeeks(pr.weeks + 1)} />
            </View>
          </Card>
          <Txt v="small">Day 1 is the start date you pick when assigning. Tap a day to put a workout on it.</Txt>
          {workouts.length === 0 && <Card><Txt>Create a few workouts first, then lay them out here.</Txt></Card>}
          {Array.from({ length: pr.weeks }, (_, wi) => wi + 1).map((week) => (
            <Card key={week} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Txt v="h3">Week {week}</Txt>
                <Pressable accessibilityRole="button" accessibilityLabel={`Week ${week} options`} onPress={() => setWeekMenu(week)} hitSlop={10}><Icon name="more_horiz" /></Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {Array.from({ length: 7 }, (_, di) => di + 1).map((day) => {
                  const s = pr.schedule.find((x) => x.week === week && x.day === day);
                  return (
                    <Pressable key={day} accessibilityRole="button" accessibilityLabel={`Week ${week} day ${day}: ${s ? nameOf(s.workout_id) : 'rest'}`}
                      onPress={() => setPick({ week, day })}
                      style={{ flexGrow: 1, flexBasis: 110, minHeight: 72, padding: 10, borderRadius: R.sm, borderWidth: 1.5, borderColor: s ? p.focus : p.line, backgroundColor: s ? p.surface : 'transparent', gap: 4 }}>
                      <Txt v="kicker" color={s ? p.focus : p.muted}>Day {day}</Txt>
                      <Txt v={s ? 'bold' : 'small'} numberOfLines={2}>{s ? nameOf(s.workout_id) : 'Rest'}</Txt>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          ))}
          {canSendToTrainers(app) && <Button kind="ghost" icon="send" title="Send a copy to a trainer" style={{ alignSelf: 'flex-start' }} onPress={async () => { await persist(); setSending(true); }} />}
          <Button kind="danger" title="Delete program" style={{ alignSelf: 'flex-start' }} onPress={() => ask('Delete this program?', 'Workouts already on clients’ calendars stay there.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
              clearTimeout(timer.current); latest.current = null;
              const { error } = await sb.from('coach_programs').delete().eq('id', pr.id);
              if (error) toast(errText(error), false); else { toast('Program deleted'); router.back(); }
            } }])} />
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' }} pointerEvents="box-none">
        <Button kind="accent" title="Assign to a client" icon="calendar_month" disabled={!pr.schedule.length} onPress={async () => { await persist(); setAssigning(true); }} />
      </View>

      <Sheet visible={!!pick} onClose={() => setPick(null)} title={pick ? `Week ${pick.week}, day ${pick.day}` : ''}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Rest day" selected={!!pick && !pr.schedule.some((s) => s.week === pick.week && s.day === pick.day)}
            onPress={() => { if (pick) update({ schedule: setDay(pr.schedule, pick.week, pick.day, null) }); setPick(null); }} />
          {workouts.map((w) => <Chip key={w.id} label={w.name} selected={!!pick && pr.schedule.some((s) => s.week === pick.week && s.day === pick.day && s.workout_id === w.id)}
            onPress={() => { if (pick) update({ schedule: setDay(pr.schedule, pick.week, pick.day, w.id) }); setPick(null); }} />)}
        </View>
      </Sheet>
      {weekMenu !== null && (
        <ActionMenu visible onClose={() => setWeekMenu(null)} title={`Week ${weekMenu}`} items={[
          { label: 'Copy to the next week', icon: 'content_copy', hidden: weekMenu >= 52, onPress: () => update({ weeks: Math.max(pr.weeks, weekMenu + 1), schedule: copyWeek(pr.schedule, weekMenu, weekMenu + 1) }) },
          { label: 'Clear this week', icon: 'delete', danger: true, onPress: () => update({ schedule: pr.schedule.filter((s) => s.week !== weekMenu) }) },
        ]} />
      )}
      <CopyToTrainer item={sending ? { kind: 'program', id: pr.id, name: pr.name } : null} onClose={() => setSending(false)} />
      <Sheet visible={assigning} onClose={() => setAssigning(false)} title={`Assign “${pr.name}”`}>
        <Txt v="smallBold" style={{ marginBottom: 8 }}>Client</Txt>
        {clients.length === 0 && <Txt v="small" style={{ marginBottom: 12 }}>Add clients first, from the Clients tab.</Txt>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {clients.map((c) => <Chip key={c.id} label={c.name} selected={who === c.id} onPress={() => setWho(c.id)} />)}
        </View>
        <DateField label="Start date (day 1)" value={start} onChange={setStart} />
        <Button title="Assign program" busy={busy} style={{ alignSelf: 'flex-start' }} onPress={async () => {
          if (!who || !start) return toast('Choose a client and a start date', false);
          setBusy(true);
          const { data, error } = await sb.rpc('coach_assign_program', { p_program: pr.id, p_client: who, p_start: start });
          setBusy(false);
          if (error) return toast(errText(error), false);
          toast(`${data} workouts added to the calendar`); setAssigning(false);
        }} />
      </Sheet>
    </View>
  );
}
