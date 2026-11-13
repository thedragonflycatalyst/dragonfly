// Routines (owner 2026-11-13). A saved workout is assigned to clients with no date; the client (or the trainer, in a
// session) starts it from their routines whenever they train. A workout reminder ("Wednesday at 3 PM, Legs") reminds
// the client the day before, with a link that starts that routine.
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { DateField } from '@/components/date-field';
import { TimeField } from '@/components/pickers';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Field, Txt, useToast } from '@/components/ui';
import { dayKey } from '@/lib/dates';
import { errText, type Client, type Group, type Workout } from '@/lib/model';
import { reminderAt, reminderLine } from '@/lib/routines';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';
import { exerciseCount } from '@/lib/workouts';

export type Routine = { id: string; client_id: string; workout_id: string | null; title: string; snapshot: Workout['blocks']; note: string | null; last_started_at: string | null };
export type Reminder = { id: string; routine_id: string; at: string; weekly: boolean; active: boolean };

/** Opens today's workout from a routine and starts it */
export async function startRoutine(id: string, toast: (m: string, ok?: boolean) => void) {
  const { data, error } = await sb.rpc('coach_start_routine', { p_routine: id });
  if (error || !data) return toast(errText(error), false);
  router.push({ pathname: '/session', params: { aid: data as string } });
}

/** Assign a saved workout to clients (and/or a group): no date, it goes on their list of routines */
export function AssignRoutine({ workout, visible, onClose, preselect }: { workout: Workout | null; visible: boolean; onClose: () => void; preselect?: string[] }) {
  const p = usePalette();
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<(Group & { members: string[] })[]>([]);
  const [chosen, setChosen] = useState<string[]>(preselect ?? []);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setChosen(preselect ?? []); setNote('');
    Promise.all([
      sb.from('coach_clients').select('*').in('status', ['active', 'invited']).order('last_name'),
      sb.from('coach_groups').select('*, coach_group_members(client_id)').order('name'),
    ]).then(([c, g]) => {
      setClients((c.data as Client[]) ?? []);
      setGroups(((g.data ?? []) as (Group & { coach_group_members: { client_id: string }[] })[]).map((x) => ({ ...x, members: x.coach_group_members.map((m) => m.client_id) })));
    });
  }, [visible, preselect]);
  if (!workout) return null;
  const save = async () => {
    if (!chosen.length) return toast('Choose at least one client', false);
    setBusy(true);
    const { data, error } = await sb.rpc('coach_assign_routine', { p_workout: workout.id, p_clients: chosen, p_note: note.trim() || null });
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast(`“${workout.name}” is in ${data === 1 ? 'their' : `${data} clients’`} routines`); onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={`Assign “${workout.name}”`}>
      {groups.length > 0 && <>
        <Txt v="smallBold" style={{ marginBottom: 8 }}>Groups</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {groups.map((g) => <Chip key={g.id} label={`${g.name} (${g.members.length})`} onPress={() => setChosen((c) => [...new Set([...c, ...g.members.filter((m) => clients.some((x) => x.id === m))])])} />)}
        </View>
      </>}
      <Txt v="smallBold" style={{ marginBottom: 8 }}>Clients</Txt>
      {clients.length === 0 && <Txt v="small" style={{ marginBottom: 14 }}>Add clients first, from the Clients tab.</Txt>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {clients.map((c) => <Chip key={c.id} label={c.name} selected={chosen.includes(c.id)} onPress={() => setChosen((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))} />)}
      </View>
      <Field label="Note for the client" hint="(optional)" value={note} onChangeText={setNote} placeholder="Go light on the squats this week" />
      <Txt v="small" color={p.muted} style={{ marginBottom: 12 }}>
        {exerciseCount(workout.blocks)} exercises. It goes on their list of routines (no date): they start it whenever they train, and it stays up to date when you edit the workout. Set a reminder from their profile to tell them when.
      </Txt>
      <Button title="Assign" busy={busy} onPress={save} style={{ alignSelf: 'flex-start' }} />
    </Sheet>
  );
}

/** "Work out Wednesday at 3 PM": reminded the day before, once or every week */
export function ReminderSheet({ routine, visible, onClose, onDone }: { routine: Routine | null; visible: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [day, setDay] = useState<string | null>(dayKey(new Date()));
  const [time, setTime] = useState('15:00');
  const [weekly, setWeekly] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setDay(dayKey(new Date(Date.now() + 2 * 86_400_000))); setTime('15:00'); setWeekly(true); } }, [visible]);
  if (!routine) return null;
  const save = async () => {
    if (!day) return toast('Choose a day', false);
    const at = reminderAt(day, time);
    if (!weekly && at.getTime() <= Date.now()) return toast('Choose a time in the future', false);
    setBusy(true);
    const { error } = await sb.rpc('coach_set_workout_reminder', { p_routine: routine.id, p_at: at.toISOString(), p_weekly: weekly });
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast(`Reminder set: ${reminderLine({ at: at.toISOString(), weekly })}`); onDone(); onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={`Remind about “${routine.title}”`}>
      <DateField label="Day" value={day} onChange={setDay} min={dayKey(new Date())} />
      <TimeField label="Time" value={time} onChange={setTime} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Switch value={weekly} onValueChange={setWeekly} accessibilityLabel="Every week" />
        <Txt style={{ flex: 1 }}>Every week on this day</Txt>
      </View>
      <Txt v="small" style={{ marginBottom: 12 }}>They get a reminder the day before (text, email or the app, as they chose, plus a phone alert) with a link that starts the workout.</Txt>
      <Button title="Set reminder" icon="notifications" busy={busy} onPress={save} style={{ alignSelf: 'flex-start' }} />
    </Sheet>
  );
}

/** A client's routines, with Start, reminders and (for the trainer) Remove */
export function RoutineList({ clientId, trainer, empty }: { clientId: string; trainer?: boolean; empty?: string }) {
  const p = usePalette();
  const toast = useToast();
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reminding, setReminding] = useState<Routine | null>(null);
  const load = useCallback(async () => {
    const [r, m] = await Promise.all([
      sb.from('coach_client_routines').select('id, client_id, workout_id, title, snapshot, note, last_started_at').eq('client_id', clientId).eq('active', true).order('title'),
      sb.from('coach_workout_reminders').select('id, routine_id, at, weekly, active').eq('client_id', clientId).eq('active', true).order('at'),
    ]);
    setRoutines((r.data as Routine[]) ?? []); setReminders((m.data as Reminder[]) ?? []);
  }, [clientId]);
  useEffect(() => { void load(); }, [load]);
  if (routines === null) return null;
  if (!routines.length) return empty ? <Txt v="small">{empty}</Txt> : null;
  return (
    <View style={{ gap: 10 }}>
      {routines.map((r) => {
        const mine = reminders.filter((m) => m.routine_id === r.id);
        return (
          <Card key={r.id} style={{ gap: 6 }}>
            <Txt v="h3">{r.title}</Txt>
            <Txt v="small">{exerciseCount(r.snapshot)} exercises{r.last_started_at ? ` · last done ${new Date(r.last_started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}{r.note ? ` · ${r.note}` : ''}</Txt>
            {mine.map((m) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt v="small" color={p.focus} style={{ flex: 1 }}>⏰ {reminderLine(m)}</Txt>
                <Button small kind="quiet" title="Stop" onPress={async () => { const { error } = await sb.rpc('coach_stop_workout_reminder', { p_id: m.id }); if (error) toast(errText(error), false); load(); }} />
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <Button small kind="accent" icon="play_arrow" title="Start" onPress={() => startRoutine(r.id, toast)} />
              <Button small kind="ghost" icon="notifications" title="Remind" onPress={() => setReminding(r)} />
              {trainer && <Button small kind="quiet" title="Remove" onPress={async () => { const { error } = await sb.rpc('coach_remove_routine', { p_routine: r.id }); if (error) toast(errText(error), false); load(); }} />}
            </View>
          </Card>
        );
      })}
      <ReminderSheet routine={reminding} visible={!!reminding} onClose={() => setReminding(null)} onDone={load} />
    </View>
  );
}

/** A trainer starting a saved workout picks the client first; the workout then opens for that client only */
export function StartForClient({ workout, onClose }: { workout: { id: string; name: string } | null; onClose: () => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  useEffect(() => {
    if (!workout) return;
    sb.from('coach_clients').select('*').eq('status', 'active').order('last_name').then(({ data }) => setClients((data as Client[]) ?? []));
  }, [workout]);
  if (!workout) return null;
  return (
    <Sheet visible onClose={onClose} title={`Who are you training?`}>
      <Txt v="small" style={{ marginBottom: 10 }}>“{workout.name}” opens for the client you pick.</Txt>
      {clients.length === 0 ? <Txt v="small">You need an active client to log a session.</Txt> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {clients.map((c) => <Chip key={c.id} label={c.name} onPress={() => { onClose(); router.push({ pathname: '/session', params: { workout: workout.id, client: c.id } }); }} />)}
        </View>
      )}
    </Sheet>
  );
}
