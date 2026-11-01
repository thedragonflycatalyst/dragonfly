import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DateField } from '@/components/date-field';
import { Sheet } from '@/components/sheet';
import { Button, Chip, Field, Txt, useToast } from '@/components/ui';
import { addDays, dayKey, fromKey } from '@/lib/dates';
import { errText, type Client, type Group, type Program, type Workout } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';
import { exerciseCount } from '@/lib/workouts';

/** Dates for an assignment: one day, or the same weekday for N weeks */
export const assignDates = (start: string, weeks: number) => Array.from({ length: Math.max(1, weeks) }, (_, i) => dayKey(addDays(fromKey(start), i * 7)));

/** Assign a workout to clients (and/or a group) on a date, optionally repeating weekly. */
export function AssignWorkout({ workout, visible, onClose, preselect }: { workout: Workout | null; visible: boolean; onClose: () => void; preselect?: string[] }) {
  const p = usePalette();
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<(Group & { members: string[] })[]>([]);
  const [chosen, setChosen] = useState<string[]>(preselect ?? []);
  const [day, setDay] = useState<string | null>(dayKey(new Date()));
  const [weeks, setWeeks] = useState('1');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setChosen(preselect ?? []);
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
    const w = Number(weeks);
    if (!chosen.length) return toast('Choose at least one client', false);
    if (!day) return toast('Choose a date', false);
    if (!Number.isInteger(w) || w < 1 || w > 52) return toast('Repeat for 1 to 52 weeks', false);
    setBusy(true);
    const rows = chosen.flatMap((cid) => assignDates(day, w).map((d) => ({
      trainer_id: workout.trainer_id, client_id: cid, workout_id: workout.id, scheduled_on: d, title: workout.name, snapshot: workout.blocks, trainer_note: note.trim() || null,
    })));
    const { error } = await sb.from('coach_assignments').insert(rows);
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast(`Assigned to ${chosen.length} client${chosen.length === 1 ? '' : 's'}${w > 1 ? ` for ${w} weeks` : ''}`); onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Assign “${workout.name}”`}>
      {groups.length > 0 && (
        <>
          <Txt v="smallBold" style={{ marginBottom: 8 }}>Groups</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {groups.map((g) => <Chip key={g.id} label={`${g.name} (${g.members.length})`} onPress={() => setChosen((c) => [...new Set([...c, ...g.members.filter((m) => clients.some((x) => x.id === m))])])} />)}
          </View>
        </>
      )}
      <Txt v="smallBold" style={{ marginBottom: 8 }}>Clients</Txt>
      {clients.length === 0 && <Txt v="small" style={{ marginBottom: 14 }}>Add clients first, from the Clients tab.</Txt>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {clients.map((c) => <Chip key={c.id} label={c.name} selected={chosen.includes(c.id)} onPress={() => setChosen((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))} />)}
      </View>
      <DateField label="Date" value={day} onChange={setDay} />
      <View style={{ width: 200 }}><Field label="Repeat weekly for" hint="(weeks)" value={weeks} onChangeText={setWeeks} keyboardType="number-pad" /></View>
      <Field label="Note for the client" hint="(optional)" value={note} onChangeText={setNote} placeholder="Go light on the squats this week" />
      <Txt v="small" color={p.muted} style={{ marginBottom: 12 }}>{exerciseCount(workout.blocks)} exercises. Later edits to the workout don’t change what’s already assigned.</Txt>
      <Button title="Assign" busy={busy} onPress={save} style={{ alignSelf: 'flex-start' }} />
    </Sheet>
  );
}

/** From a client's profile: pick one of your workouts (or a program) to put on their calendar. */
export function AssignToClient({ client, visible, onClose, onDone }: { client: Client; visible: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [chosen, setChosen] = useState<Workout | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [day, setDay] = useState<string | null>(dayKey(new Date()));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setChosen(null); setProgram(null);
    Promise.all([sb.from('coach_workouts').select('*').eq('archived', false).order('updated_at', { ascending: false }),
      sb.from('coach_programs').select('*').eq('archived', false).order('updated_at', { ascending: false })])
      .then(([w, pr]) => { setWorkouts((w.data as Workout[]) ?? []); setPrograms((pr.data as Program[]) ?? []); });
  }, [visible]);

  if (chosen) return <AssignWorkout workout={chosen} visible={visible} preselect={[client.id]} onClose={() => { onClose(); onDone(); }} />;
  return (
    <Sheet visible={visible} onClose={onClose} title={`Assign to ${client.first_name}`}>
      {program ? (
        <>
          <Txt v="bold" style={{ marginBottom: 8 }}>{program.name}: {program.weeks} weeks, {program.schedule.length} workouts</Txt>
          <DateField label="Start date" value={day} onChange={setDay} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Assign program" busy={busy} onPress={async () => {
              if (!day) return;
              setBusy(true);
              const { data, error } = await sb.rpc('coach_assign_program', { p_program: program.id, p_client: client.id, p_start: day });
              setBusy(false);
              if (error) return toast(errText(error), false);
              toast(`${data} workouts added to ${client.first_name}’s calendar`); onClose(); onDone();
            }} />
            <Button kind="ghost" title="Back" onPress={() => setProgram(null)} />
          </View>
        </>
      ) : (
        <>
          <Txt v="smallBold" style={{ marginBottom: 8 }}>A workout</Txt>
          {workouts.length === 0 && <Txt v="small" style={{ marginBottom: 12 }}>Create workouts in the Workouts tab first.</Txt>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {workouts.map((w) => <Chip key={w.id} label={w.name} onPress={() => setChosen(w)} />)}
          </View>
          {programs.length > 0 && <>
            <Txt v="smallBold" style={{ marginBottom: 8 }}>Or a program</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{programs.map((pr) => <Chip key={pr.id} label={pr.name} onPress={() => setProgram(pr)} />)}</View>
          </>}
        </>
      )}
    </Sheet>
  );
}
