import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { ActionMenu, Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { AmountEditor, FoodPicker, kcalOf } from '@/features/food-picker';
import { MacroSummary, SharePlan } from '@/features/nutrition-view';
import { ask } from '@/lib/ask';
import { errText, type Client } from '@/lib/model';
import { describe, itemNutr, mealNutr, newId, NO_TARGETS, NUTRIENTS, pctOk, planNutr, type Meal, type MealItem, type NutritionPlan, type Targets } from '@/lib/nutrition';
import { sb } from '@/lib/supabase';
import { CoverPicker } from '@/features/cover-picker';
import { MAX_W, R, usePalette } from '@/lib/theme';
import { move } from '@/lib/workouts';

type Folder = { id: string; name: string };

/** Nutrition plan builder: meals and foods on one tab, details, targets and sharing on the other. Saves automatically. */
export default function PlanScreen() {
  const p = usePalette();
  const toast = useToast();
  const { id, tab: startTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const [plan, setPlan] = useState<NutritionPlan | null | undefined>(undefined);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [shared, setShared] = useState<Client[]>([]);
  const [tab, setTab] = useState<'plan' | 'details'>(startTab === 'details' ? 'details' : 'plan');
  const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved');
  const [adding, setAdding] = useState<string | null>(null);         // meal id
  const [editing, setEditing] = useState<{ meal: string; item: MealItem } | null>(null);
  const [mealMenu, setMealMenu] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<{ index: number; name: string; note: string } | null>(null);
  const [macros, setMacros] = useState(false);
  const [sharing, setSharing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef<NutritionPlan | null>(null);

  const loadShared = useCallback(async () => {
    const { data } = await sb.from('coach_nutrition_plan_clients').select('coach_clients(*)').eq('plan_id', id);
    setShared(((data ?? []) as unknown as { coach_clients: Client }[]).map((r) => r.coach_clients).filter(Boolean));
  }, [id]);
  useEffect(() => {
    Promise.all([sb.from('coach_nutrition_plans').select('*').eq('id', id).maybeSingle(), sb.from('coach_nutrition_folders').select('id, name').order('name')])
      .then(([r, f]) => { const x = r.data as NutritionPlan | null; setPlan(x ? { ...x, targets: { ...NO_TARGETS, ...x.targets } } : null); setFolders((f.data as Folder[]) ?? []); });
    loadShared();
  }, [id, loadShared]);

  const persist = useCallback(async () => {
    const cur = latest.current;
    if (!cur) return;
    const { error } = await sb.from('coach_nutrition_plans').update({ name: cur.name.trim() || 'Untitled plan', description: cur.description, notes: cur.notes, cover: cur.cover, folder_id: cur.folder_id, targets: cur.targets, meals: cur.meals }).eq('id', cur.id);
    setSaved(error ? 'error' : 'saved');
    if (error) toast(errText(error), false);
  }, [toast]);
  const update = (patch: Partial<NutritionPlan>) => setPlan((x) => {
    if (!x) return x;
    const next = { ...x, ...patch };
    latest.current = next; clearTimeout(timer.current); setSaved('saving');
    timer.current = setTimeout(persist, 700);
    return next;
  });
  useEffect(() => () => { clearTimeout(timer.current); if (latest.current) persist(); }, [persist]);

  if (plan === undefined) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  if (!plan) return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="🔎" title="Plan not found" /></View>;
  const setMeals = (meals: Meal[]) => update({ meals });
  const setMeal = (mid: string, f: (m: Meal) => Meal) => setMeals(plan.meals.map((m) => (m.id === mid ? f(m) : m)));
  const setTargets = (t: Partial<Targets>) => update({ targets: { ...plan.targets, ...t } });
  const total = planNutr(plan.meals);
  const mm = mealMenu !== null ? plan.meals[mealMenu] : null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: plan.name, headerRight: () => <Txt v="small" style={{ marginRight: 12 }}>{saved === 'saving' ? 'Saving…' : saved === 'error' ? 'Not saved' : 'Saved'}</Txt> }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <Segmented value={tab} onChange={setTab} options={[['plan', 'Plan'], ['details', 'Details']]} />
            <Txt v="small">{kcalOf(total)}{plan.targets.on && plan.targets.kcal ? ` of ${plan.targets.kcal.toLocaleString()}` : ''} · P {Math.round(total.protein)} · C {Math.round(total.carbs)} · F {Math.round(total.fat)}</Txt>
          </View>

          {tab === 'plan' ? (
            <>
              {plan.meals.map((m, mi) => (
                <Card key={m.id} style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Txt v="h3" style={{ flex: 1 }}>{m.name}</Txt>
                    <Txt v="bold" color={p.focus}>{kcalOf(mealNutr(m))}</Txt>
                    <Pressable accessibilityRole="button" accessibilityLabel={`More options for ${m.name}`} onPress={() => setMealMenu(mi)} hitSlop={10}><Icon name="more_horiz" size={26} /></Pressable>
                  </View>
                  {m.note ? <Txt v="small">{m.note}</Txt> : null}
                  {m.items.map((i) => (
                    <Pressable key={i.id} accessibilityRole="button" accessibilityLabel={`Edit ${i.food.name}`} onPress={() => setEditing({ meal: m.id, item: i })}
                      style={({ pressed }) => ({ flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: p.line, paddingTop: 10, opacity: pressed ? 0.6 : 1 })}>
                      <View style={{ flex: 1 }}><Txt numberOfLines={2}>{i.food.name}</Txt><Txt v="small">{describe(i)}</Txt></View>
                      <Txt v="small">{kcalOf(itemNutr(i))}</Txt>
                    </Pressable>
                  ))}
                  <Button small kind="ghost" title="Add food or drink" icon="add" style={{ alignSelf: 'center' }} onPress={() => setAdding(m.id)} />
                </Card>
              ))}
              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button kind="ghost" icon="add" title="Add meal" onPress={() => setRenaming({ index: -1, name: '', note: '' })} />
                <Button kind="ghost" icon="timeline" title="View macros" onPress={() => setMacros(true)} />
              </View>
            </>
          ) : (
            <>
              <Card>
                <Field label="Plan name" value={plan.name} onChangeText={(name) => update({ name })} />
                <Field label="Description" hint="(your client sees this)" value={plan.description ?? ''} onChangeText={(d) => update({ description: d || null })} multiline placeholder="What this plan is for and how to use it" />
                <Field label="Notes" hint="(your client sees these too)" value={plan.notes ?? ''} onChangeText={(d) => update({ notes: d || null })} multiline placeholder="Swaps, prep tips, eating out" />
                <CoverPicker name={plan.name} value={plan.cover} trainerId={plan.trainer_id} onChange={(cover) => update({ cover })} />
                <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Folder</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Chip label="None" selected={!plan.folder_id} onPress={() => update({ folder_id: null })} />
                  {folders.map((f) => <Chip key={f.id} label={f.name} selected={plan.folder_id === f.id} onPress={() => update({ folder_id: f.id })} />)}
                </View>
              </Card>

              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: plan.targets.on ? 14 : 0 }}>
                  <Txt v="h3">Daily targets</Txt>
                  <Switch value={plan.targets.on} onValueChange={(on) => setTargets({ on })} accessibilityLabel="Set daily targets" trackColor={{ true: p.focus, false: p.line }} thumbColor={p.surface} />
                </View>
                {plan.targets.on && <>
                  <Txt v="smallBold" style={{ marginBottom: 8 }}>Set protein, carbs and fat in</Txt>
                  <View style={{ marginBottom: 14 }}><Segmented value={plan.targets.mode} onChange={(mode) => setTargets({ mode })} options={[['g', 'Grams'], ['pct', '% of calories']]} /></View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 }}>
                    {NUTRIENTS.map(([k, label, unit]) => {
                      const u = plan.targets.mode === 'pct' && ['protein', 'carbs', 'fat'].includes(k) ? '%' : unit;
                      return <View key={k} style={{ width: 150 }}><TargetField label={`${label} (${u})`} value={plan.targets[k]} onChange={(v) => setTargets({ [k]: v })} /></View>;
                    })}
                  </View>
                  {!pctOk(plan.targets) && <Txt v="small" color={p.danger}>Protein, carbs and fat add up to {Math.round(plan.targets.protein + plan.targets.carbs + plan.targets.fat)}%. Make them total 100%.</Txt>}
                </>}
              </Card>

              <Card style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Txt v="h3">Clients</Txt>
                  <Button small kind="ghost" title="Share" icon="group_add" onPress={async () => { await persist(); setSharing(true); }} />
                </View>
                {shared.length === 0 ? <Txt v="small">Not shared with anyone yet.</Txt>
                  : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{shared.map((c) => <Chip key={c.id} label={c.name} onPress={() => router.push({ pathname: '/clients/[id]', params: { id: c.id } })} />)}</View>}
              </Card>

              <Button kind="danger" title="Delete plan" style={{ alignSelf: 'flex-start' }} onPress={() => ask('Delete this plan?', shared.length ? `It’s removed from ${shared.length} client${shared.length === 1 ? '' : 's'} too.` : 'This can’t be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: async () => {
                  clearTimeout(timer.current); latest.current = null;
                  const { error } = await sb.from('coach_nutrition_plans').delete().eq('id', plan.id);
                  if (error) toast(errText(error), false); else { toast('Plan deleted'); router.back(); }
                } }])} />
            </>
          )}
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' }} pointerEvents="box-none">
        <Button kind="accent" title="Share with clients" icon="group_add" onPress={async () => { await persist(); setSharing(true); }} />
      </View>

      <FoodPicker visible={!!adding} title={`Add to ${plan.meals.find((m) => m.id === adding)?.name ?? 'meal'}`} onClose={() => setAdding(null)}
        onAdd={(item) => { if (adding) { setMeal(adding, (m) => ({ ...m, items: [...m.items, { ...item, id: newId() }] })); toast(`Added ${item.food.name.split(',')[0]}`); } }} />
      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing?.item.food.name}>
        {editing && <>
          <AmountEditor item={editing.item} onChange={(item) => setEditing({ ...editing, item })} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Button title="Save" disabled={!(editing.item.qty > 0)} onPress={() => { setMeal(editing.meal, (m) => ({ ...m, items: m.items.map((x) => (x.id === editing.item.id ? editing.item : x)) })); setEditing(null); }} />
            <Button kind="danger" title="Remove" onPress={() => { setMeal(editing.meal, (m) => ({ ...m, items: m.items.filter((x) => x.id !== editing.item.id) })); setEditing(null); }} />
          </View>
        </>}
      </Sheet>
      {mm && mealMenu !== null && <ActionMenu visible onClose={() => setMealMenu(null)} title={mm.name} items={[
        { label: 'Rename or add a note', icon: 'edit', onPress: () => setRenaming({ index: mealMenu, name: mm.name, note: mm.note ?? '' }) },
        { label: 'Move up', icon: 'arrow_upward', hidden: mealMenu === 0, onPress: () => setMeals(move(plan.meals, mealMenu, mealMenu - 1)) },
        { label: 'Move down', icon: 'arrow_downward', hidden: mealMenu === plan.meals.length - 1, onPress: () => setMeals(move(plan.meals, mealMenu, mealMenu + 1)) },
        { label: 'Duplicate', icon: 'content_copy', onPress: () => setMeals([...plan.meals.slice(0, mealMenu + 1), { ...mm, id: newId(), name: `${mm.name} (copy)`, items: mm.items.map((i) => ({ ...i, id: newId() })) }, ...plan.meals.slice(mealMenu + 1)]) },
        { label: 'Clear foods', icon: 'remove', hidden: !mm.items.length, onPress: () => setMeal(mm.id, (m) => ({ ...m, items: [] })) },
        { label: 'Delete meal', icon: 'delete', danger: true, onPress: () => setMeals(plan.meals.filter((_, n) => n !== mealMenu)) },
      ]} />}
      <Sheet visible={!!renaming} onClose={() => setRenaming(null)} title={renaming?.index === -1 ? 'Add meal' : 'Edit meal'}>
        <Field label="Meal name" value={renaming?.name ?? ''} onChangeText={(name) => setRenaming((r) => (r ? { ...r, name } : r))} placeholder="Pre-workout" autoFocus />
        <Field label="Note" hint="(optional)" value={renaming?.note ?? ''} onChangeText={(note) => setRenaming((r) => (r ? { ...r, note } : r))} multiline placeholder="Eat within an hour of training" />
        <Button title="Save" disabled={!renaming?.name.trim()} style={{ alignSelf: 'flex-start' }} onPress={() => {
          if (!renaming) return;
          const name = renaming.name.trim().slice(0, 60), note = renaming.note.trim() || undefined;
          setMeals(renaming.index === -1 ? [...plan.meals, { id: newId(), name, note, items: [] }] : plan.meals.map((m, n) => (n === renaming.index ? { ...m, name, note } : m)));
          setRenaming(null);
        }} />
      </Sheet>
      <Sheet visible={macros} onClose={() => setMacros(false)} title="Macros for the day"><MacroSummary meals={plan.meals} targets={plan.targets} /></Sheet>
      <SharePlan plan={plan} visible={sharing} onClose={(changed) => { setSharing(false); if (changed) loadShared(); }} />
    </View>
  );
}

function TargetField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [t, setT] = useState(value ? String(value) : '');
  return <Field label={label} value={t} keyboardType="decimal-pad" placeholder="0"
    onChangeText={(x) => { setT(x); const n = Number(x.replace(',', '.') || 0); if (Number.isFinite(n) && n >= 0 && n <= 100000) onChange(n); }} />;
}
