import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { Button, Card, Chip, Empty, Field, Txt, useToast } from '@/components/ui';
import { AssignWorkout } from '@/features/assign';
import { BlocksEditor } from '@/features/workout-editor';
import { ask } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { errText, type Folder, type Workout, type WorkoutBlock } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { weightUnit } from '@/lib/units';
import { estimateMinutes, exerciseCount } from '@/lib/workouts';
import { CoverPicker } from '@/features/cover-picker';
import { MAX_W, R, usePalette } from '@/lib/theme';

/** Workout builder: exercises and sets, details, and Start / Assign. Saves automatically. */
export default function WorkoutScreen() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [w, setW] = useState<Workout | null | undefined>(undefined);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tab, setTab] = useState<'exercises' | 'details'>('exercises');
  const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved');
  const [assigning, setAssigning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef<Workout | null>(null);

  useEffect(() => {
    Promise.all([sb.from('coach_workouts').select('*').eq('id', id).maybeSingle(), sb.from('coach_workout_folders').select('*').order('name')])
      .then(([r, f]) => { setW((r.data as Workout) ?? null); setFolders((f.data as Folder[]) ?? []); });
  }, [id]);

  const persist = useCallback(async () => {
    const cur = latest.current;
    if (!cur) return;
    setSaved('saving');
    const { error } = await sb.from('coach_workouts').update({ name: cur.name.trim() || 'Untitled workout', description: cur.description, blocks: cur.blocks, folder_id: cur.folder_id, cover: cur.cover }).eq('id', cur.id);
    setSaved(error ? 'error' : 'saved');
    if (error) toast(errText(error), false);
  }, [toast]);
  // Save shortly after each change, and right away when leaving
  const update = (patch: Partial<Workout>) => setW((x) => {
    if (!x) return x;
    const next = { ...x, ...patch };
    latest.current = next;
    clearTimeout(timer.current);
    setSaved('saving');
    timer.current = setTimeout(persist, 700);
    return next;
  });
  useEffect(() => () => { clearTimeout(timer.current); if (latest.current) persist(); }, [persist]);

  if (w === undefined) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  if (!w) return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="🔎" title="Workout not found" /></View>;
  const unit = weightUnit(app.units);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: w.name, headerRight: () => <Txt v="small" style={{ marginRight: 12 }}>{saved === 'saving' ? 'Saving…' : saved === 'error' ? 'Not saved' : 'Saved'}</Txt> }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <Segmented value={tab} onChange={setTab} options={[['exercises', 'Exercises'], ['details', 'Details']]} />
            <Txt v="small">{exerciseCount(w.blocks)} exercises · about {estimateMinutes(w.blocks)} min</Txt>
          </View>
          {tab === 'exercises' ? (
            <BlocksEditor blocks={w.blocks} weightUnit={unit} onChange={(blocks: WorkoutBlock[]) => update({ blocks })} />
          ) : (
            <Card>
              <Field label="Workout name" value={w.name} onChangeText={(name) => update({ name })} />
              <Field label="Description" hint="(optional, your client sees this)" value={w.description ?? ''} onChangeText={(d) => update({ description: d || null })} multiline />
              <CoverPicker name={w.name} value={w.cover} trainerId={w.trainer_id} onChange={(cover) => update({ cover })} />
              <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Folder</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                <Chip label="None" selected={!w.folder_id} onPress={() => update({ folder_id: null })} />
                {folders.map((f) => <Chip key={f.id} label={f.name} selected={w.folder_id === f.id} onPress={() => update({ folder_id: f.id })} />)}
              </View>
              <Button kind="danger" title="Delete workout" style={{ alignSelf: 'flex-start' }} onPress={() => ask('Delete this workout?', 'Workouts already assigned to clients stay on their calendars.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: async () => {
                  clearTimeout(timer.current); latest.current = null;
                  const { error } = await sb.from('coach_workouts').delete().eq('id', w.id);
                  if (error) toast(errText(error), false); else { toast('Workout deleted'); router.back(); }
                } }])} />
            </Card>
          )}
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 10 }} pointerEvents="box-none">
        <Button kind="ghost" title="Assign" icon="calendar_month" style={{ backgroundColor: p.surface }} onPress={async () => { await persist(); setAssigning(true); }} />
        <Button kind="accent" title="Start workout" icon="play_arrow" disabled={!exerciseCount(w.blocks)}
          onPress={async () => { await persist(); router.push({ pathname: '/session', params: { workout: w.id } }); }} />
      </View>
      <AssignWorkout workout={latest.current ?? w} visible={assigning} onClose={() => setAssigning(false)} />
    </View>
  );
}
