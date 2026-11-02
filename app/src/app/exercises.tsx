import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { Button, Chip, Icon, Txt } from '@/components/ui';
import { ExerciseInfo, ExerciseThumb, MyExerciseEditor, toLib } from '@/features/exercises';
import { useApp } from '@/lib/app-state';
import { BODY_PARTS, builtIn, search, titleCase, type LibExercise } from '@/lib/library';
import type { MyExercise } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { F, MAX_W, R, usePalette } from '@/lib/theme';

/** The exercise library: browse every built-in exercise and manage your own (with demo videos). */
export default function Exercises() {
  const p = usePalette();
  const app = useApp();
  const [tab, setTab] = useState<'library' | 'mine'>('library');
  const [q, setQ] = useState('');
  const [part, setPart] = useState<string | null>(null);
  const [mine, setMine] = useState<MyExercise[]>([]);
  const [info, setInfo] = useState<LibExercise | null>(null);
  const [editing, setEditing] = useState<MyExercise | 'new' | null>(null);
  const tid = app.trainer?.user_id;
  const load = useCallback(async () => {
    if (!tid) return;
    const { data } = await sb.from('coach_exercises').select('*').eq('trainer_id', tid).eq('archived', false).order('name');
    setMine((data as MyExercise[]) ?? []);
  }, [tid]);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => search(tab === 'mine' ? mine.map(toLib) : builtIn(), { q, part }).slice(0, 300), [tab, mine, q, part]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center' }}>
      <Stack.Screen options={{ title: 'Exercises' }} />
      <View style={{ flex: 1, width: '100%', maxWidth: MAX_W, padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Segmented value={tab} onChange={setTab} options={[['library', `Library (${builtIn().length})`], ['mine', `My exercises (${mine.length})`]]} />
          {tab === 'mine' && <Button small icon="add" title="New exercise" onPress={() => setEditing('new')} />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: R.pill, paddingHorizontal: 14, height: 46 }}>
          <Icon name="search" size={20} color={p.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search exercises" placeholderTextColor={p.muted} accessibilityLabel="Search exercises" style={{ flex: 1, fontFamily: F.body, fontSize: 16, color: p.ink, height: 44 }} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {BODY_PARTS.map((b) => <Chip key={b.key} label={b.label} selected={part === b.key} onPress={() => setPart(part === b.key ? null : b.key)} />)}
        </View>
        <FlatList data={list} keyExtractor={(e) => e.ref} style={{ flex: 1 }}
          ListEmptyComponent={<Txt v="small" center style={{ marginTop: 20 }}>{tab === 'mine' && !mine.length ? 'Add your own exercises with your demo videos. They show up when you build workouts.' : 'No exercises match.'}</Txt>}
          renderItem={({ item: e }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={e.name} onPress={() => (e.mine ? setEditing(mine.find((m) => `my:${m.id}` === e.ref) ?? null) : setInfo(e))}
              style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: p.line, opacity: pressed ? 0.6 : 1 })}>
              <ExerciseThumb img={e.images[0]} video={e.video} size={56} />
              <View style={{ flex: 1 }}>
                <Txt v="bold">{e.name}</Txt>
                <Txt v="small">{[e.primary.map(titleCase).join(', '), titleCase(e.equipment)].filter(Boolean).join(' · ')}</Txt>
              </View>
              <Icon name="chevron_right" color={p.muted} />
            </Pressable>
          )} />
      </View>
      <ExerciseInfo ex={info ? { name: info.name, ref: info.ref, img: info.images[0], video: info.video } : null} onClose={() => setInfo(null)} />
      <MyExerciseEditor visible={!!editing} initial={editing && editing !== 'new' ? editing : undefined} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    </View>
  );
}
