import { useState } from 'react';
import { usesSides } from '@/lib/sides';
import { Pressable, TextInput, View } from 'react-native';
import { ActionMenu } from '@/components/sheet';
import { Button, Card, Field, Icon, Txt } from '@/components/ui';
import type { ExerciseBlock, SetMetric, SetSpec, WorkoutBlock } from '@/lib/model';
import type { LibExercise } from '@/lib/library';
import { addSet, fmtSeconds, linkNext, move, newBlock, normalizeGroups, parseSeconds, refOf, removeSet, supersetLabels, unlink } from '@/lib/workouts';
import { F, R, usePalette } from '@/lib/theme';
import { ExerciseInfo, ExercisePicker, ExerciseThumb } from './exercises';

type Col = { key: keyof SetSpec; label: string; width: number; kind: 'text' | 'seconds'; placeholder?: string };
export function columnsFor(metric: SetMetric, weightUnit: string): Col[] {
  const rest: Col = { key: 'rest', label: 'Rest', width: 64, kind: 'seconds', placeholder: '1:00' };
  if (metric === 'time') return [{ key: 'weight', label: weightUnit, width: 60, kind: 'text' }, { key: 'time', label: 'Time', width: 64, kind: 'seconds', placeholder: '0:30' }, rest];
  if (metric === 'distance') return [{ key: 'distance', label: 'Distance', width: 96, kind: 'text', placeholder: '400 m' }, rest];
  return [{ key: 'weight', label: weightUnit, width: 60, kind: 'text' }, { key: 'reps', label: 'Reps', width: 56, kind: 'text', placeholder: '10' },
    { key: 'tempo', label: 'Tempo', width: 64, kind: 'text', placeholder: '3010' }, rest];
}

/** One editable cell; seconds columns accept 90, 1:30 or 90s and show m:ss */
function Cell({ col, value, onChange, label }: { col: Col; value: SetSpec[keyof SetSpec]; onChange: (v: string | number | undefined) => void; label: string }) {
  const p = usePalette();
  const shown = col.kind === 'seconds' ? fmtSeconds(value as number | undefined) : String(value ?? '');
  const [text, setText] = useState(shown);
  const [editing, setEditing] = useState(false);
  return (
    <TextInput value={editing ? text : shown} accessibilityLabel={label} placeholder={col.placeholder} placeholderTextColor={p.muted}
      keyboardType={col.key === 'weight' || col.key === 'reps' ? 'numbers-and-punctuation' : 'default'} selectTextOnFocus
      onFocus={() => { setText(shown); setEditing(true); }}
      onChangeText={(t) => { setText(t); if (col.kind === 'text') onChange(t.slice(0, 20)); }}
      onBlur={() => { setEditing(false); if (col.kind === 'seconds') onChange(text.trim() ? parseSeconds(text) ?? (value as number | undefined) : undefined); }}
      style={{ width: col.width, height: 42, borderWidth: 1.5, borderColor: p.line, borderRadius: R.sm, textAlign: 'center', fontFamily: F.body, fontSize: 16, color: p.ink, backgroundColor: p.surface }} />
  );
}

/** Exercise cards with set tables, notes, supersets and a menu; the core of the workout builder. */
export function BlocksEditor({ blocks, onChange, weightUnit }: { blocks: WorkoutBlock[]; onChange: (b: WorkoutBlock[]) => void; weightUnit: string }) {
  const p = usePalette();
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'replace'; index: number } | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [info, setInfo] = useState<ExerciseBlock | null>(null);
  const [notes, setNotes] = useState<Set<string>>(new Set());
  const labels = supersetLabels(blocks);
  const set = (i: number, b: WorkoutBlock) => onChange(blocks.map((x, n) => (n === i ? b : x)));
  const m = menu !== null ? blocks[menu] : null;

  return (
    <View style={{ gap: 12 }}>
      {blocks.length === 0 && <Card><Txt center color={p.muted}>Nothing added yet. Add exercises from the library or your own.</Txt></Card>}
      {blocks.map((b, i) => {
        if (b.kind !== 'exercise') return <Card key={b.id}><Txt>{b.kind === 'note' ? b.text : b.name}</Txt></Card>;
        const cols = columnsFor(b.metric, weightUnit);
        const label = labels[i];
        const joinedBelow = label && labels[i + 1] === label;
        return (
          <View key={b.id} style={{ flexDirection: 'row', gap: 8 }}>
            {label ? <View style={{ width: 6, borderRadius: 3, backgroundColor: p.focus, marginBottom: joinedBelow ? -12 : 0 }} /> : null}
            <Card style={{ flex: 1, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${b.ex.name} details`} onPress={() => setInfo(b)}><ExerciseThumb img={b.ex.img} video={b.ex.video} size={64} /></Pressable>
                <View style={{ flex: 1 }}>
                  {label ? <Txt v="kicker" color={p.focus}>Superset {label}</Txt> : null}
                  <Txt v="h3">{b.ex.name}</Txt>
                  {usesSides(b.sides, b.ex.name) ? <Txt v="small" color={p.focus}>Left and right logged separately</Txt> : null}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`More options for ${b.ex.name}`} onPress={() => setMenu(i)} hitSlop={10}><Icon name="more_horiz" size={26} /></Pressable>
              </View>
              {b.note !== undefined || notes.has(b.id)
                ? <Field label="Note" value={b.note ?? ''} onChangeText={(v) => set(i, { ...b, note: v })} placeholder="Cues, setup, what to feel" />
                : <Pressable accessibilityRole="button" onPress={() => setNotes((s) => new Set(s).add(b.id))}><Txt v="smallBold" color={p.focus}>Add note</Txt></Pressable>}
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Txt v="smallBold" style={{ width: 34 }}>Set</Txt>
                  {cols.map((c) => <Txt key={c.key} v="smallBold" style={{ width: c.width, textAlign: 'center' }}>{c.label}</Txt>)}
                </View>
                {b.sets.map((s, si) => (
                  <View key={si} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Txt v="bold" style={{ width: 34 }}>{si + 1}</Txt>
                    {cols.map((c) => (
                      <Cell key={c.key} col={c} value={s[c.key]} label={`Set ${si + 1} ${c.label}`}
                        onChange={(v) => set(i, { ...b, sets: b.sets.map((x, n) => (n === si ? { ...x, [c.key]: v } : x)) })} />
                    ))}
                    {b.sets.length > 1 && (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Remove set ${si + 1}`} onPress={() => set(i, removeSet(b, si))} hitSlop={8}>
                        <Icon name="remove" size={20} color={p.muted} />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
              <Button small kind="ghost" title="Add set" icon="add" style={{ alignSelf: 'center' }} onPress={() => set(i, addSet(b))} />
            </Card>
          </View>
        );
      })}
      <Button title="Add exercise" icon="add" kind="solid" style={{ alignSelf: 'center' }} onPress={() => setPicker({ mode: 'add' })} />

      <ExercisePicker visible={!!picker} single={picker?.mode === 'replace'} title={picker?.mode === 'replace' ? 'Replace exercise' : 'Add exercises'}
        onClose={() => setPicker(null)}
        onPick={(picked) => {
          if (picker?.mode === 'replace') {
            const old = blocks[picker.index] as ExerciseBlock;
            set(picker.index, { ...old, ex: refOf(picked[0]) });
          } else onChange([...blocks, ...picked.map((e) => newBlockFor(e))]);
        }} />
      <ExerciseInfo ex={info ? { name: info.ex.name, ref: `${info.ex.src}:${info.ex.id}`, img: info.ex.img, video: info.ex.video } : null} onClose={() => setInfo(null)} />
      {menu !== null && m?.kind === 'exercise' && (
        <ActionMenu visible onClose={() => setMenu(null)} title={m.ex.name} items={[
          { label: 'Move up', icon: 'arrow_upward', hidden: menu === 0, onPress: () => onChange(normalizeGroups(move(blocks, menu, menu - 1))) },
          { label: 'Move down', icon: 'arrow_downward', hidden: menu === blocks.length - 1, onPress: () => onChange(normalizeGroups(move(blocks, menu, menu + 1))) },
          { label: 'Superset with the next exercise', icon: 'link', hidden: menu === blocks.length - 1 || (labels[menu] !== null && labels[menu] === labels[menu + 1]), onPress: () => onChange(linkNext(blocks, menu)) },
          { label: 'Remove from superset', icon: 'link_off', hidden: !labels[menu], onPress: () => onChange(unlink(blocks, menu)) },
          { label: 'Replace exercise', icon: 'swap_horiz', onPress: () => setPicker({ mode: 'replace', index: menu }) },
          { label: 'Measure by reps', icon: 'fitness_center', hidden: m.metric === 'reps', onPress: () => set(menu, withMetric(m, 'reps')) },
          { label: 'Measure by time', icon: 'timer', hidden: m.metric === 'time', onPress: () => set(menu, withMetric(m, 'time')) },
          { label: 'Measure by distance', icon: 'straighten', hidden: m.metric === 'distance', onPress: () => set(menu, withMetric(m, 'distance')) },
          usesSides(m.sides, m.ex.name)
            ? { label: 'Log both sides together', icon: 'join_inner', onPress: () => set(menu, { ...m, sides: false }) }
            : { label: 'Log left and right separately', icon: 'compare_arrows', onPress: () => set(menu, { ...m, sides: true }) },
          { label: 'Duplicate', icon: 'content_copy', onPress: () => onChange([...blocks.slice(0, menu + 1), { ...JSON.parse(JSON.stringify(m)), id: `${m.id}c${Date.now().toString(36)}`, group: null }, ...blocks.slice(menu + 1)]) },
          { label: 'Remove exercise', icon: 'delete', danger: true, onPress: () => onChange(normalizeGroups(blocks.filter((_, n) => n !== menu))) },
        ]} />
      )}
    </View>
  );
}

const newBlockFor = (e: LibExercise) => newBlock(e);
const withMetric = (b: ExerciseBlock, metric: SetMetric): ExerciseBlock => ({
  ...b, metric, sets: b.sets.map((s) => (metric === 'time' ? { weight: s.weight, time: s.time ?? 30, rest: s.rest } : metric === 'distance' ? { distance: s.distance ?? '400 m', rest: s.rest } : { weight: s.weight, reps: s.reps ?? '10', tempo: s.tempo, rest: s.rest })),
});
