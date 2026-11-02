import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Initials, SectionLabel } from '@/components/bits';
import { DateField } from '@/components/date-field';
import { ActionMenu, Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { CoverPicker } from '@/features/cover-picker';
import { canSendToTrainers, CopyToTrainer } from '@/features/team';
import { ask } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { dayKey, fmtShort, fromKey } from '@/lib/dates';
import { errText, type Client, type Program, type ProgramDay, type ProgramItemKind, type Workout } from '@/lib/model';
import { addItem, copyWeek, deleteWeek, itemsOn, kindOf, moveItem, removeItem } from '@/lib/session';
import { sb } from '@/lib/supabase';
import { MAX_W, R, usePalette } from '@/lib/theme';

const KIND: Record<ProgramItemKind, { label: string; icon: Parameters<typeof Icon>[0]['name'] }> = {
  workout: { label: 'Workout', icon: 'fitness_center' }, measurements: { label: 'Update measurements', icon: 'straighten' },
  photo: { label: 'Upload progress photo', icon: 'photo_camera' }, note: { label: 'Note', icon: 'sticky_note_2' },
};
type Assigned = { client: Client; start: string; done: number; total: number };

/** Program builder: week by week, each day holding workouts and tasks. Saves automatically. */
export default function ProgramScreen() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pr, setPr] = useState<Program | null | undefined>(undefined);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [assigned, setAssigned] = useState<Assigned[]>([]);
  const [week, setWeek] = useState(1);
  const [adding, setAdding] = useState<{ day: number; kind?: ProgramItemKind } | null>(null);
  const [noteText, setNoteText] = useState({ title: '', details: '' });
  const [itemMenu, setItemMenu] = useState<number | null>(null);
  const [weekMenu, setWeekMenu] = useState(false);
  const [details, setDetails] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(dayKey(new Date()));
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef<Program | null>(null);

  const loadAssigned = useCallback(async () => {
    const [a, t] = await Promise.all([
      sb.from('coach_assignments').select('client_id, scheduled_on, status, coach_clients(*)').eq('program_id', id),
      sb.from('coach_tasks').select('client_id, due_on, done_at').eq('program_id', id),
    ]);
    const by = new Map<string, Assigned>();
    for (const x of (a.data ?? []) as unknown as { client_id: string; scheduled_on: string; status: string; coach_clients: Client }[]) {
      const r = by.get(x.client_id) ?? { client: x.coach_clients, start: x.scheduled_on, done: 0, total: 0 };
      r.total++; if (x.status === 'done') r.done++; if (x.scheduled_on < r.start) r.start = x.scheduled_on;
      by.set(x.client_id, r);
    }
    for (const x of (t.data ?? []) as { client_id: string; due_on: string; done_at: string | null }[]) {
      const r = by.get(x.client_id); if (!r) continue;
      r.total++; if (x.done_at) r.done++;
    }
    setAssigned([...by.values()].filter((r) => r.client));
  }, [id]);
  useEffect(() => {
    Promise.all([sb.from('coach_programs').select('*').eq('id', id).maybeSingle(),
      sb.from('coach_workouts').select('*').eq('archived', false).order('name'),
      sb.from('coach_clients').select('*').in('status', ['active', 'invited']).order('first_name')])
      .then(([r, w, c]) => { setPr((r.data as Program) ?? null); setWorkouts((w.data as Workout[]) ?? []); setClients((c.data as Client[]) ?? []); });
    loadAssigned();
  }, [id, loadAssigned]);

  const persist = useCallback(async () => {
    const cur = latest.current;
    if (!cur) return;
    const { error } = await sb.from('coach_programs').update({ name: cur.name.trim() || 'Untitled program', description: cur.description, weeks: cur.weeks, schedule: cur.schedule, cover: cur.cover, am_time: cur.am_time, pm_time: cur.pm_time }).eq('id', cur.id);
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
  const nameOf = (wid?: string) => workouts.find((w) => w.id === wid)?.name ?? 'Deleted workout';
  const label = (i: ProgramDay) => (kindOf(i) === 'workout' ? nameOf(i.workout_id) : i.title || KIND[kindOf(i)].label);
  const add = (item: Omit<ProgramDay, 'week'>) => { update({ schedule: addItem(pr.schedule, { ...item, week }) }); setAdding(null); setNoteText({ title: '', details: '' }); };
  const im = itemMenu !== null ? pr.schedule[itemMenu] : null;
  const lastDay = Math.max(0, ...pr.schedule.map((s) => (s.week - 1) * 7 + s.day));
  const light = (i: ProgramDay) => kindOf(i) === 'note';

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: pr.name, headerRight: () => <Txt v="small" style={{ marginRight: 12 }}>{saved === 'saving' ? 'Saving…' : saved === 'error' ? 'Not saved' : 'Saved'}</Txt> }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <Pressable accessibilityRole="button" onPress={() => setDetails(true)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}><Txt v="h3">{pr.name}</Txt><Txt v="small" numberOfLines={2}>{pr.description || 'Add a description and cover art'}</Txt></View>
              <Icon name="edit" color={p.muted} />
            </Card>
          </Pressable>

          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous week" disabled={week <= 1} onPress={() => setWeek(week - 1)} hitSlop={8} style={{ opacity: week <= 1 ? 0.3 : 1 }}><Icon name="chevron_left" size={28} /></Pressable>
              <Txt v="h3" style={{ flex: 1, textAlign: 'center' }}>Week {week} of {pr.weeks}</Txt>
              <Pressable accessibilityRole="button" accessibilityLabel="Next week" disabled={week >= pr.weeks} onPress={() => setWeek(week + 1)} hitSlop={8} style={{ opacity: week >= pr.weeks ? 0.3 : 1 }}><Icon name="chevron_right" size={28} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Week ${week} options`} onPress={() => setWeekMenu(true)} hitSlop={8}><Icon name="more_horiz" size={26} /></Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {Array.from({ length: pr.weeks }, (_, i) => i + 1).map((w) => (
                <Pressable key={w} accessibilityRole="tab" accessibilityLabel={`Week ${w}`} accessibilityState={{ selected: w === week }} onPress={() => setWeek(w)} hitSlop={4}
                  style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: w === week ? p.focus : p.muted, backgroundColor: w === week ? p.focus : pr.schedule.some((s) => s.week === w) ? p.line : 'transparent' }} />
              ))}
            </View>
            <Button small kind="ghost" icon="add" title="Add week" disabled={pr.weeks >= 52} style={{ alignSelf: 'center' }} onPress={() => { update({ weeks: pr.weeks + 1 }); setWeek(pr.weeks + 1); }} />
          </Card>

          {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => (
            <View key={day} style={{ gap: 6 }}>
              <Txt v="bold">Day {day}</Txt>
              {itemsOn(pr.schedule, week, day).map((it) => (
                <Pressable key={it.index} accessibilityRole="button" accessibilityLabel={`${label(it)} options`} onPress={() => setItemMenu(it.index)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: R.sm, backgroundColor: kindOf(it) === 'workout' ? p.focus : light(it) ? p.soft : p.gold }}>
                  <Icon name={KIND[kindOf(it)].icon} size={20} color={light(it) ? p.ink : '#fff'} />
                  <View style={{ flex: 1 }}>
                    <Txt v="bold" color={light(it) ? p.ink : '#fff'} numberOfLines={2}>{label(it)}</Txt>
                    {it.time ? <Txt v="small" color={light(it) ? p.muted : '#fffc'}>{it.time === 'am' ? `Morning, ${(pr.am_time ?? '07:00').slice(0, 5)}` : `Evening, ${(pr.pm_time ?? '19:00').slice(0, 5)}`}</Txt> : null}
                  </View>
                  <Icon name="more_horiz" color={light(it) ? p.ink : '#fff'} />
                </Pressable>
              ))}
              {(week - 1) * 7 + day === lastDay && <View style={{ padding: 10, borderRadius: R.sm, backgroundColor: p.ink }}><Txt v="smallBold" color={p.bg}>Last day of the program</Txt></View>}
              <Pressable accessibilityRole="button" accessibilityLabel={`Add to day ${day}`} onPress={() => setAdding({ day })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: R.sm, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.line, backgroundColor: p.surface }}>
                <Icon name="add" size={20} color={p.muted} /><Txt color={p.muted}>Add new</Txt>
              </Pressable>
            </View>
          ))}

          <SectionLabel>Times</SectionLabel>
          <Card>
            <Txt v="small" style={{ marginBottom: 10 }}>Suggested times for morning and evening items. Clients see them on their calendar.</Txt>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><TimeField label="Suggested AM time" value={(pr.am_time ?? '07:00').slice(0, 5)} onChange={(am_time) => update({ am_time })} /></View>
              <View style={{ flex: 1 }}><TimeField label="Suggested PM time" value={(pr.pm_time ?? '19:00').slice(0, 5)} onChange={(pm_time) => update({ pm_time })} /></View>
            </View>
          </Card>

          <SectionLabel>Assigned clients</SectionLabel>
          <Card style={{ padding: assigned.length ? 0 : 16 }}>
            {assigned.length === 0 ? <Txt v="small">Nobody’s on this program yet.</Txt> : assigned.map((a, i) => (
              <Pressable key={a.client.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/clients/[id]/workouts', params: { id: a.client.id } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i === assigned.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                <Initials name={a.client.name} />
                <View style={{ flex: 1 }}><Txt v="bold">{a.client.name}</Txt><Txt v="small">Started {fmtShort(fromKey(a.start))} · {a.done} of {a.total} done</Txt></View>
              </Pressable>
            ))}
          </Card>
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' }} pointerEvents="box-none">
        <Button kind="accent" title="Assign to a client" icon="calendar_month" disabled={!pr.schedule.length} onPress={async () => { await persist(); setAssigning(true); }} />
      </View>

      <Sheet visible={!!adding} onClose={() => setAdding(null)} title={adding ? `Week ${week}, day ${adding.day}` : ''}>
        {adding && !adding.kind && (
          <View style={{ gap: 8 }}>
            {(Object.keys(KIND) as ProgramItemKind[]).map((k) => (
              <Pressable key={k} accessibilityRole="button" onPress={() => (k === 'measurements' || k === 'photo' ? add({ day: adding.day, kind: k }) : setAdding({ ...adding, kind: k }))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: R.sm, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line }}>
                <Icon name={KIND[k].icon} color={p.focus} /><Txt v="bold" style={{ flex: 1 }}>{KIND[k].label}</Txt><Icon name="chevron_right" color={p.muted} />
              </Pressable>
            ))}
          </View>
        )}
        {adding?.kind === 'workout' && <>
          {workouts.length === 0 && <Txt v="small" style={{ marginBottom: 10 }}>Create workouts in the Workouts tab first.</Txt>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {workouts.map((w) => <Chip key={w.id} label={w.name} onPress={() => add({ day: adding.day, kind: 'workout', workout_id: w.id })} />)}
          </View>
        </>}
        {adding?.kind === 'note' && <>
          <Field label="Title" value={noteText.title} onChangeText={(title) => setNoteText((n) => ({ ...n, title }))} placeholder="Deload week: keep it light" />
          <Field label="Details" hint="(optional)" value={noteText.details} onChangeText={(d) => setNoteText((n) => ({ ...n, details: d }))} multiline />
          <Button title="Add note" disabled={!noteText.title.trim()} onPress={() => add({ day: adding.day, kind: 'note', title: noteText.title.trim(), details: noteText.details.trim() || undefined })} style={{ alignSelf: 'flex-start' }} />
        </>}
      </Sheet>
      {im && itemMenu !== null && <ActionMenu visible onClose={() => setItemMenu(null)} title={label(im)} items={[
        { label: 'Open workout', icon: 'open_in_new', hidden: kindOf(im) !== 'workout' || !im.workout_id, onPress: () => router.push({ pathname: '/workouts/[id]', params: { id: im.workout_id ?? '' } }) },
        { label: im.time === 'am' ? 'No set time' : 'Morning', icon: 'schedule', onPress: () => update({ schedule: pr.schedule.map((s, i) => (i === itemMenu ? { ...s, time: s.time === 'am' ? undefined : 'am' } : s)) }) },
        { label: im.time === 'pm' ? 'No set time' : 'Evening', icon: 'schedule', onPress: () => update({ schedule: pr.schedule.map((s, i) => (i === itemMenu ? { ...s, time: s.time === 'pm' ? undefined : 'pm' } : s)) }) },
        { label: 'Move to the next day', icon: 'arrow_downward', hidden: im.day === 7 && im.week === pr.weeks, onPress: () => update({ schedule: im.day < 7 ? moveItem(pr.schedule, itemMenu, im.week, im.day + 1) : moveItem(pr.schedule, itemMenu, im.week + 1, 1) }) },
        { label: 'Move to the day before', icon: 'arrow_upward', hidden: im.day === 1 && im.week === 1, onPress: () => update({ schedule: im.day > 1 ? moveItem(pr.schedule, itemMenu, im.week, im.day - 1) : moveItem(pr.schedule, itemMenu, im.week - 1, 7) }) },
        { label: 'Duplicate', icon: 'content_copy', onPress: () => update({ schedule: addItem(pr.schedule, { ...im }) }) },
        { label: 'Remove', icon: 'delete', danger: true, onPress: () => update({ schedule: removeItem(pr.schedule, itemMenu) }) },
      ]} />}
      {weekMenu && <ActionMenu visible onClose={() => setWeekMenu(false)} title={`Week ${week}`} items={[
        { label: 'Copy to the next week', icon: 'content_copy', hidden: week >= 52, onPress: () => { update({ weeks: Math.max(pr.weeks, week + 1), schedule: copyWeek(pr.schedule, week, week + 1) }); setWeek(week + 1); } },
        { label: 'Clear this week', icon: 'remove', onPress: () => update({ schedule: pr.schedule.filter((s) => s.week !== week) }) },
        { label: 'Delete this week', icon: 'delete', danger: true, hidden: pr.weeks <= 1, onPress: () => ask(`Delete week ${week}?`, 'Its workouts and tasks come off the program, and later weeks move up.', [
          { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { update({ weeks: pr.weeks - 1, schedule: deleteWeek(pr.schedule, week) }); setWeek(Math.max(1, Math.min(week, pr.weeks - 1))); } }]) },
      ]} />}
      <Sheet visible={details} onClose={() => setDetails(false)} title="Program details">
        <Field label="Program name" value={pr.name} onChangeText={(name) => update({ name })} />
        <Field label="Description" hint="(your client sees this)" value={pr.description ?? ''} onChangeText={(d) => update({ description: d || null })} multiline />
        <CoverPicker name={pr.name} value={pr.cover} trainerId={pr.trainer_id} onChange={(cover) => update({ cover })} />
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {canSendToTrainers(app) && <Button kind="ghost" icon="send" title="Send a copy to a trainer" onPress={async () => { await persist(); setSending(true); }} />}
          <Button kind="danger" title="Delete program" onPress={() => ask('Delete this program?', 'Workouts already on clients’ calendars stay there.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
              clearTimeout(timer.current); latest.current = null;
              const { error } = await sb.from('coach_programs').delete().eq('id', pr.id);
              if (error) toast(errText(error), false); else { toast('Program deleted'); router.back(); }
            } }])} />
        </View>
      </Sheet>
      <CopyToTrainer item={sending ? { kind: 'program', id: pr.id, name: pr.name } : null} onClose={() => setSending(false)} />
      <Sheet visible={assigning} onClose={() => setAssigning(false)} title={`Assign “${pr.name}”`}>
        <Txt v="smallBold" style={{ marginBottom: 8 }}>Client</Txt>
        {clients.length === 0 && <Txt v="small" style={{ marginBottom: 12 }}>Add clients first, from Contacts.</Txt>}
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
          toast(`${data} workouts and tasks added to the calendar`); setAssigning(false); loadAssigned();
        }} />
      </Sheet>
    </View>
  );
}

/** HH:MM box that only saves valid times */
function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [t, setT] = useState(value);
  return <Field label={label} value={t} placeholder="07:00" keyboardType="numbers-and-punctuation"
    onChangeText={(x) => { setT(x); if (/^([01]?\d|2[0-3]):[0-5]\d$/.test(x)) onChange(x.padStart(5, '0')); }} />;
}
