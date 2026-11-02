import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { Sheet } from '@/components/sheet';
import { Button, Chip, Icon, Txt, useToast } from '@/components/ui';
import { ExerciseInfo, ExerciseThumb, MyExerciseEditor, toLib } from '@/features/exercises';
import { useApp } from '@/lib/app-state';
import { BODY_PARTS, builtIn, EQUIPMENT, MY_CATEGORIES, search, titleCase, type LibExercise } from '@/lib/library';
import { errText, type MyExercise } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { F, MAX_W, R, usePalette } from '@/lib/theme';
import { newBlock } from '@/lib/workouts';

type Sort = 'az' | 'za';

/** The exercise library: browse every exercise, manage your own, or pick several to start a workout. */
export default function Exercises() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const [tab, setTab] = useState<'library' | 'mine'>('library');
  const [q, setQ] = useState('');
  const [part, setPart] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('az');
  const [filtering, setFiltering] = useState(false);
  const [mine, setMine] = useState<MyExercise[]>([]);
  const [info, setInfo] = useState<LibExercise | null>(null);
  const [editing, setEditing] = useState<MyExercise | 'new' | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<LibExercise[]>([]);
  const tid = app.trainer?.user_id;
  const load = useCallback(async () => {
    if (!tid) return;
    const { data } = await sb.from('coach_exercises').select('*').eq('trainer_id', tid).eq('archived', false).order('name');
    setMine((data as MyExercise[]) ?? []);
  }, [tid]);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => {
    const rows = search(tab === 'mine' ? mine.map(toLib) : builtIn(), { q, part, equipment, category });
    const sorted = q.trim() ? rows : [...rows].sort((a, b) => a.name.localeCompare(b.name));
    return (sort === 'za' && !q.trim() ? sorted.reverse() : sorted).slice(0, 400);
  }, [tab, mine, q, part, equipment, category, sort]);
  const filters = [equipment, category].filter(Boolean).length;
  const isPicked = (e: LibExercise) => picked.some((x) => x.ref === e.ref);

  const tap = (e: LibExercise) => {
    if (selecting) return setPicked((x) => (isPicked(e) ? x.filter((y) => y.ref !== e.ref) : [...x, e]));
    if (e.mine) setEditing(mine.find((m) => `my:${m.id}` === e.ref) ?? null); else setInfo(e);
  };
  const createWorkout = async () => {
    const { data, error } = await sb.from('coach_workouts').insert({ trainer_id: tid, name: picked.length === 1 ? picked[0].name : 'New workout', blocks: picked.map((e) => newBlock(e)) }).select('id').single();
    if (error) return toast(errText(error), false);
    setPicked([]); setSelecting(false);
    router.push({ pathname: '/workouts/[id]', params: { id: data.id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center' }}>
      <Stack.Screen options={{ title: 'Exercises' }} />
      <View style={{ flex: 1, width: '100%', maxWidth: MAX_W, padding: 16, gap: 10 }}>
        <Segmented value={tab} onChange={setTab} options={[['library', `Exercises (${builtIn().length})`], ['mine', `Custom exercises (${mine.length})`]]} />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: R.pill, paddingHorizontal: 14, height: 46 }}>
            <Icon name="search" size={20} color={p.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search exercises" placeholderTextColor={p.muted} accessibilityLabel="Search exercises" style={{ flex: 1, fontFamily: F.body, fontSize: 16, color: p.ink, height: 44 }} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Filter and sort${filters ? `, ${filters} filters on` : ''}`} onPress={() => setFiltering(true)} hitSlop={6}
            style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: filters ? p.ink : p.surface, borderWidth: 1.5, borderColor: filters ? p.ink : p.line }}>
            <Icon name="filter_list" color={filters ? p.bg : p.ink} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {BODY_PARTS.map((b) => <Chip key={b.key} label={b.label} selected={part === b.key} onPress={() => setPart(part === b.key ? null : b.key)} />)}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt v="smallBold">{q.trim() ? 'Best matches' : sort === 'az' ? 'A to Z' : 'Z to A'} · {list.length}{list.length === 400 ? '+' : ''}</Txt>
          {selecting && picked.length > 0 && <Button small kind="quiet" title="Clear" onPress={() => setPicked([])} />}
        </View>
        <FlatList data={list} keyExtractor={(e) => e.ref} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={<Txt v="small" center style={{ marginTop: 20 }}>{tab === 'mine' && !mine.length ? 'Add your own exercises with your demo videos. They show up when you build workouts.' : 'No exercises match.'}</Txt>}
          renderItem={({ item: e }) => {
            const on = isPicked(e);
            return (
              <Pressable accessibilityRole={selecting ? 'checkbox' : 'button'} accessibilityState={selecting ? { checked: on } : undefined} accessibilityLabel={e.name} onPress={() => tap(e)}
                style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: p.line, opacity: pressed ? 0.6 : 1 })}>
                <ExerciseThumb img={e.images[0]} video={e.video} size={56} />
                <View style={{ flex: 1 }}>
                  <Txt v="bold">{e.name}</Txt>
                  <Txt v="small">{[e.primary.map(titleCase).join(', '), titleCase(e.equipment)].filter(Boolean).join(' · ')}</Txt>
                </View>
                {selecting
                  ? <View style={{ width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: p.focus, backgroundColor: on ? p.focus : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on && <Icon name="check" size={18} color="#fff" />}</View>
                  : <Icon name="chevron_right" color={p.muted} />}
              </Pressable>
            );
          }} />
      </View>
      <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 10 }} pointerEvents="box-none">
        {selecting ? <>
          <Button kind="ghost" title="Cancel" style={{ backgroundColor: p.surface }} onPress={() => { setSelecting(false); setPicked([]); }} />
          <Button kind="accent" icon="fitness_center" title={`Create workout (${picked.length})`} disabled={!picked.length} onPress={createWorkout} />
        </> : <>
          <Button kind="ghost" icon="checklist" title="Multi-select" style={{ backgroundColor: p.surface }} onPress={() => setSelecting(true)} />
          <Button kind="accent" icon="add" title="Create exercise" onPress={() => setEditing('new')} />
        </>}
      </View>

      <Sheet visible={filtering} onClose={() => setFiltering(false)} title="Filter and sort">
        <Txt v="smallBold" style={{ marginBottom: 8 }}>Sort</Txt>
        <View style={{ marginBottom: 16 }}><Segmented value={sort} onChange={setSort} options={[['az', 'A to Z'], ['za', 'Z to A']]} /></View>
        <Txt v="smallBold" style={{ marginBottom: 8 }}>Equipment</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {EQUIPMENT.map((x) => <Chip key={x} label={titleCase(x)} selected={equipment === x} onPress={() => setEquipment(equipment === x ? null : x)} />)}
        </View>
        <Txt v="smallBold" style={{ marginBottom: 8 }}>Category</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {MY_CATEGORIES.map((x) => <Chip key={x} label={titleCase(x)} selected={category === x} onPress={() => setCategory(category === x ? null : x)} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Done" onPress={() => setFiltering(false)} />
          {filters > 0 && <Button kind="quiet" title="Clear filters" onPress={() => { setEquipment(null); setCategory(null); }} />}
        </View>
      </Sheet>
      <ExerciseInfo ex={info ? { name: info.name, ref: info.ref, img: info.images[0], video: info.video } : null} onClose={() => setInfo(null)} />
      <MyExerciseEditor visible={!!editing} initial={editing && editing !== 'new' ? editing : undefined} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); setTab('mine'); }} />
    </View>
  );
}
