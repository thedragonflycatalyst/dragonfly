import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { Sheet } from '@/components/sheet';
import { Button, Chip, Field, Icon, Txt, useToast } from '@/components/ui';
import { foods } from '@/data/foods';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { defaultItem, describe, fromCustom, itemNutr, portionChoices, round, searchFoods, type CustomFood, type FoodSnap, type MealItem } from '@/lib/nutrition';
import { sb } from '@/lib/supabase';
import { F, R, usePalette } from '@/lib/theme';

export const kcalOf = (n: { kcal: number }) => `${Math.round(n.kcal)} kcal`;
const macroLine = (n: { protein: number; carbs: number; fat: number }) => `P ${Math.round(n.protein)} g · C ${Math.round(n.carbs)} g · F ${Math.round(n.fat)} g`;

/** The trainer's own foods */
export function useCustomFoods(enabled = true) {
  const [list, setList] = useState<CustomFood[] | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return;
    const { data } = await sb.from('coach_foods').select('*').eq('archived', false).order('name');
    setList((data as CustomFood[]) ?? []);
  }, [enabled]);
  useEffect(() => { load(); }, [load]);
  return { list, reload: load };
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder: string }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: R.pill, paddingHorizontal: 14, height: 46 }}>
      <Icon name="search" size={20} color={p.muted} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={p.muted} accessibilityLabel={placeholder} autoFocus
        style={{ flex: 1, fontFamily: F.body, fontSize: 16, color: p.ink, height: 44 }} />
    </View>
  );
}

/** Amount + portion for one food, with live calories and macros */
export function AmountEditor({ item, onChange }: { item: MealItem; onChange: (i: MealItem) => void }) {
  const p = usePalette();
  const [qty, setQty] = useState(String(item.qty));
  useEffect(() => setQty(String(item.qty)), [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = round(itemNutr(item));
  return (
    <View style={{ gap: 10 }}>
      <View style={{ width: 160 }}>
        <Field label="Amount" value={qty} keyboardType="decimal-pad" selectTextOnFocus
          onChangeText={(t) => { setQty(t); const v = Number(t.replace(',', '.')); if (Number.isFinite(v) && v >= 0 && v <= 100000) onChange({ ...item, qty: v }); }} />
      </View>
      <Txt v="smallBold">Measure</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {portionChoices(item.food).map((pc) => (
          <Chip key={pc} label={pc === 'g' ? 'grams' : pc === 'oz' ? 'ounces' : pc} selected={item.portion === pc}
            onPress={() => {
              if (pc === item.portion) return;
              const next = { ...item, portion: pc, qty: pc === 'g' ? 100 : pc === 'oz' ? 4 : 1 };
              setQty(String(next.qty)); onChange(next);
            }} />
        ))}
      </View>
      <View style={{ backgroundColor: p.surface, borderRadius: R.sm, padding: 12, gap: 2 }}>
        <Txt v="h3" color={p.focus}>{kcalOf(n)}</Txt>
        <Txt v="small">{macroLine(n)}{n.fibre ? ` · fibre ${n.fibre} g` : ''}</Txt>
      </View>
    </View>
  );
}

/** Find a food (USDA database or the trainer's own), set the amount, add it to a meal. */
export function FoodPicker({ visible, onClose, onAdd, title, mine = true }: { visible: boolean; onClose: () => void; onAdd: (i: MealItem) => void; title: string; mine?: boolean }) {
  const p = usePalette();
  const db = useMemo(() => (visible ? foods() : null), [visible]);
  const custom = useCustomFoods(visible && mine);
  const [tab, setTab] = useState<'search' | 'browse' | 'mine'>('search');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<number | null>(null);
  const [picked, setPicked] = useState<MealItem | null>(null);
  const [making, setMaking] = useState(false);
  useEffect(() => { if (visible) { setPicked(null); setQ(''); } }, [visible]);

  const results: FoodSnap[] = useMemo(() => {
    if (!db) return [];
    if (tab === 'mine') {
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      return (custom.list ?? []).filter((c) => words.every((w) => `${c.name} ${c.brand ?? ''}`.toLowerCase().includes(w))).map(fromCustom);
    }
    if (tab === 'browse') return cat === null ? [] : searchFoods(db, q, cat, 200);
    return q.trim().length < 2 ? [] : searchFoods(db, q);
  }, [db, tab, q, cat, custom.list]);

  return (
    <Sheet visible={visible} onClose={onClose} title={picked ? picked.food.name : title} full>
      {picked ? (
        <View style={{ padding: 16, gap: 14 }}>
          <AmountEditor item={picked} onChange={setPicked} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Add" icon="add" disabled={!(picked.qty > 0)} onPress={() => { onAdd(picked); setPicked(null); }} />
            <Button kind="ghost" title="Back to search" onPress={() => setPicked(null)} />
          </View>
          <Txt v="small" color={p.muted}>Add as many as you like; close when you’re done.</Txt>
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 16, gap: 10 }}>
          <Segmented value={tab} onChange={setTab} options={mine ? [['search', 'Search'], ['browse', 'Food groups'], ['mine', 'Our foods']] : [['search', 'Search'], ['browse', 'Food groups']]} />
          {(tab !== 'browse' || cat !== null) && <SearchBox value={q} onChange={setQ} placeholder={tab === 'mine' ? 'Search my foods' : 'Search foods, e.g. chicken breast'} />}
          {tab === 'browse' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {cat !== null ? <Chip label={`${db?.categories[cat]}  ✕`} selected onPress={() => setCat(null)} />
                : db?.categories.map((c, i) => <Chip key={c} label={c} onPress={() => setCat(i)} />)}
            </View>
          )}
          {tab === 'mine' && <Button small kind="ghost" icon="add" title="New food" style={{ alignSelf: 'flex-start' }} onPress={() => setMaking(true)} />}
          {tab === 'mine' && custom.list === null ? <ActivityIndicator color={p.ink} /> : (
            <FlatList data={results} keyExtractor={(f) => `${f.src}:${f.id}`} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}
              ListEmptyComponent={<Txt v="small" center style={{ marginTop: 20 }}>
                {tab === 'mine' ? 'Foods you add show up here: shakes, bars, your recipes.' : tab === 'search' && q.trim().length < 2 ? 'Type at least two letters.' : tab === 'browse' && cat === null ? '' : 'No foods match. Try fewer words.'}
              </Txt>}
              renderItem={({ item: f }) => {
                const first = defaultItem(f);
                return (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Add ${f.name}`} onPress={() => setPicked(defaultItem(f))}
                    style={({ pressed }) => ({ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: p.line, opacity: pressed ? 0.6 : 1, flexDirection: 'row', alignItems: 'center', gap: 10 })}>
                    <View style={{ flex: 1 }}>
                      <Txt v="bold" numberOfLines={2}>{f.name}</Txt>
                      <Txt v="small">{kcalOf(itemNutr(first))} per {describe(first)}</Txt>
                    </View>
                    <Icon name="add" color={p.focus} />
                  </Pressable>
                );
              }} />
          )}
          <Txt v="small" color={p.muted} style={{ paddingBottom: 6 }}>Food data: USDA FoodData Central.</Txt>
        </View>
      )}
      <CustomFoodEditor visible={making} onClose={() => setMaking(false)} onSaved={(c) => { custom.reload(); setMaking(false); if (c) setPicked(defaultItem(fromCustom(c))); }} />
    </Sheet>
  );
}

const NUM_FIELDS: [keyof CustomFood, string][] = [['kcal', 'Calories'], ['protein', 'Protein (g)'], ['carbs', 'Carbs (g)'], ['fat', 'Fat (g)'], ['sugar', 'Sugar (g)'], ['fibre', 'Fibre (g)'], ['sodium', 'Sodium (mg)']];

/** Create or edit one of the trainer's own foods (numbers are per serving, as on the label) */
export function CustomFoodEditor({ visible, food, onClose, onSaved }: { visible: boolean; food?: CustomFood | null; onClose: () => void; onSaved: (f: CustomFood | null) => void }) {
  const toast = useToast();
  const app = useApp();
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setV(food ? Object.fromEntries(Object.entries(food).map(([k, x]) => [k, x == null ? '' : String(x)])) : { serving_label: '1 serving' });
  }, [visible, food]);
  const set = (k: string) => (t: string) => setV((x) => ({ ...x, [k]: t }));
  const num = (k: string) => { const t = (v[k] ?? '').trim().replace(',', '.'); return t === '' ? 0 : Number(t); };

  const save = async () => {
    if (!v.name?.trim()) return toast('Give the food a name', false);
    const nums = Object.fromEntries(NUM_FIELDS.map(([k]) => [k, num(k)]));
    if (Object.values(nums).some((n) => !Number.isFinite(n) || n < 0)) return toast('Use numbers of 0 or more', false);
    const g = v.serving_g?.trim() ? Number(v.serving_g.replace(',', '.')) : null;
    if (g !== null && !(g > 0)) return toast('Serving weight must be more than 0', false);
    const row = { name: v.name.trim(), brand: v.brand?.trim() || null, serving_label: v.serving_label?.trim() || '1 serving', serving_g: g, ...nums };
    setBusy(true);
    const r = food ? await sb.from('coach_foods').update(row).eq('id', food.id).select('*').single()
      : await sb.from('coach_foods').insert({ ...row, trainer_id: app.trainer?.user_id }).select('*').single();
    setBusy(false);
    if (r.error) return toast(errText(r.error), false);
    toast(food ? 'Food saved' : 'Food added'); onSaved(r.data as CustomFood);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={food ? 'Edit food' : 'New food'}>
      <Field label="Name" value={v.name ?? ''} onChangeText={set('name')} placeholder="Chocolate protein shake" />
      <Field label="Brand" hint="(optional)" value={v.brand ?? ''} onChangeText={set('brand')} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Serving" value={v.serving_label ?? ''} onChangeText={set('serving_label')} placeholder="1 scoop" /></View>
        <View style={{ width: 130 }}><Field label="Weight (g)" hint="(optional)" value={v.serving_g ?? ''} onChangeText={set('serving_g')} keyboardType="decimal-pad" /></View>
      </View>
      <Txt v="small" style={{ marginBottom: 10 }}>Per serving, as on the label. Adding the weight lets clients log it in grams too.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 }}>
        {NUM_FIELDS.map(([k, label]) => <View key={k} style={{ width: 140 }}><Field label={label} value={v[k] ?? ''} onChangeText={set(k)} keyboardType="decimal-pad" placeholder="0" /></View>)}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Save food" busy={busy} onPress={save} />
        {food && <Button kind="danger" title="Delete" onPress={async () => {
          const { error } = await sb.from('coach_foods').update({ archived: true }).eq('id', food.id);
          if (error) toast(errText(error), false); else { toast('Food deleted. Plans that use it keep their copy.'); onSaved(null); }
        }} />}
      </View>
    </Sheet>
  );
}
