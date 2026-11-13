import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DateField } from '@/components/date-field';
import { Sheet } from '@/components/sheet';
import { Button, Chip, Txt, useToast } from '@/components/ui';
import { AssignRoutine } from '@/features/routines';
import { dayKey } from '@/lib/dates';
import { errText, type Client, type Program, type Workout } from '@/lib/model';
import { sb } from '@/lib/supabase';

/** From a client's profile: add one of your saved workouts to their routines, or put a program on their calendar. */
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

  if (chosen) return <AssignRoutine workout={chosen} visible={visible} preselect={[client.id]} onClose={() => { onClose(); onDone(); }} />;
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
          <Txt v="smallBold" style={{ marginBottom: 8 }}>A saved workout (goes on their routines)</Txt>
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
