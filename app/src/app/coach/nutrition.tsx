import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, TextInput, View } from 'react-native';
import { Row, Segmented } from '@/components/bits';
import { Cover } from '@/components/cover';
import { Screen } from '@/components/shell';
import { ActionMenu, Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { nutritionTemplates, type NutritionTemplate } from '@/data/nutrition-templates';
import { CustomFoodEditor, kcalOf, useCustomFoods } from '@/features/food-picker';
import { SharePlan } from '@/features/nutrition-view';
import { ask } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { blankMeals, newId, NO_TARGETS, planNutr, type CustomFood, type NutritionPlan } from '@/lib/nutrition';
import { sb } from '@/lib/supabase';
import { F, R, usePalette } from '@/lib/theme';

type Tab = 'plans' | 'folders' | 'foods' | 'templates';
type Sort = 'recent' | 'az' | 'created';
type Folder = { id: string; trainer_id: string; name: string };
type Source = Pick<NutritionPlan, 'meals' | 'targets'> & Partial<Pick<NutritionPlan, 'description' | 'notes' | 'cover'>>;

/** Trainer's Nutrition tab: meal plans, folders, your own foods and starter templates. */
export default function NutritionTab() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const tid = app.trainer?.user_id;
  const [tab, setTab] = useState<Tab>('plans');
  const [plans, setPlans] = useState<NutritionPlan[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [folders, setFolders] = useState<Folder[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [folder, setFolder] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<NutritionPlan | null>(null);
  const [share, setShare] = useState<NutritionPlan | null>(null);
  const [moving, setMoving] = useState<NutritionPlan | null>(null);
  const [newFolder, setNewFolder] = useState('');
  const [food, setFood] = useState<CustomFood | null | 'new'>(null);
  const custom = useCustomFoods(tab === 'foods');
  const templates = useMemo(() => (tab === 'templates' ? nutritionTemplates() : []), [tab]);

  const load = useCallback(async () => {
    const [pl, f, s] = await Promise.all([
      sb.from('coach_nutrition_plans').select('*').eq('archived', false),
      sb.from('coach_nutrition_folders').select('*').order('name'),
      sb.from('coach_nutrition_plan_clients').select('plan_id'),
    ]);
    if (pl.error) toast(errText(pl.error), false);
    setPlans((pl.data as NutritionPlan[]) ?? []); setFolders((f.data as Folder[]) ?? []);
    const c: Record<string, number> = {};
    for (const r of (s.data ?? []) as { plan_id: string }[]) c[r.plan_id] = (c[r.plan_id] ?? 0) + 1;
    setCounts(c);
  }, [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = (plans ?? []).filter((x) => (!folder || x.folder_id === folder) && words.every((w) => x.name.toLowerCase().includes(w)));
    const recency = (x: NutritionPlan) => (x.last_used_at && x.last_used_at > x.updated_at ? x.last_used_at : x.updated_at);
    return rows.sort((a, b) => (sort === 'az' ? a.name.localeCompare(b.name) : sort === 'created' ? b.created_at.localeCompare(a.created_at) : recency(b).localeCompare(recency(a))));
  }, [plans, q, folder, sort]);

  const createFrom = async (name: string, src?: Source) => {
    const meals = src ? src.meals.map((m) => ({ ...m, id: newId(), items: m.items.map((i) => ({ ...i, id: newId() })) })) : blankMeals();
    const { data, error } = await sb.from('coach_nutrition_plans').insert({
      trainer_id: tid, name: name.trim().slice(0, 120), meals, targets: src?.targets ?? NO_TARGETS, description: src?.description ?? null, notes: src?.notes ?? null,
      cover: src?.cover ?? null, folder_id: folder,
    }).select('id').single();
    if (error) { toast(errText(error), false); return; }
    router.push({ pathname: '/nutrition/[id]', params: { id: data.id, ...(src ? {} : { tab: 'details' }) } });
  };
  const useTemplate = (t: NutritionTemplate) => createFrom(t.name, t);

  return (
    <Screen title="Nutrition" right={tab === 'plans' ? <Button title="Create plan" icon="add" onPress={() => setCreating(true)} />
      : tab === 'foods' ? <Button title="New food" icon="add" onPress={() => setFood('new')} /> : undefined}>
      <Segmented value={tab} onChange={setTab} options={[['plans', 'Plans'], ['folders', 'Folders'], ['foods', 'My foods'], ['templates', 'Templates']]} />

      {tab === 'plans' && (
        <View style={{ marginTop: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: R.pill, paddingHorizontal: 14, height: 46 }}>
            <Icon name="search" size={20} color={p.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search plans" placeholderTextColor={p.muted} accessibilityLabel="Search plans" style={{ flex: 1, fontFamily: F.body, fontSize: 16, color: p.ink, height: 44 }} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {([['recent', 'Most recent'], ['az', 'A to Z'], ['created', 'Newest']] as [Sort, string][]).map(([k, l]) => <Chip key={k} label={l} selected={sort === k} onPress={() => setSort(k)} />)}
            {folders.length > 0 && <View style={{ width: 1, backgroundColor: p.line, marginHorizontal: 4 }} />}
            {folders.map((f) => <Chip key={f.id} label={f.name} selected={folder === f.id} onPress={() => setFolder(folder === f.id ? null : f.id)} />)}
          </View>
          {plans === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : list.length === 0 ? (
            plans.length === 0
              ? <Empty emoji="🥗" title="Build your first meal plan" body="Start blank, or copy a starter template and adjust the portions for your client."
                  action={<View style={{ flexDirection: 'row', gap: 10 }}><Button title="Create plan" onPress={() => setCreating(true)} /><Button kind="ghost" title="Templates" onPress={() => setTab('templates')} /></View>} />
              : <Txt v="small" center style={{ marginTop: 20 }}>No plans match.</Txt>
          ) : (
            <Card style={{ padding: 0 }}>
              {list.map((x, i) => (
                <Pressable key={x.id} accessibilityRole="link" onPress={() => router.push({ pathname: '/nutrition/[id]', params: { id: x.id } })}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: p.line, opacity: pressed ? 0.7 : 1 })}>
                  <Cover name={x.name} cover={x.cover} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt v="bold" numberOfLines={2}>{x.name}</Txt>
                    <Txt v="small">{kcalOf(planNutr(x.meals))}{x.targets?.on && x.targets.kcal ? ` · target ${x.targets.kcal.toLocaleString()}` : ''}{counts[x.id] ? ` · ${counts[x.id]} client${counts[x.id] === 1 ? '' : 's'}` : ''}{x.folder_id ? ` · ${folders.find((f) => f.id === x.folder_id)?.name ?? ''}` : ''}</Txt>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`More options for ${x.name}`} onPress={() => setMenu(x)} hitSlop={10}><Icon name="more_horiz" size={26} /></Pressable>
                </Pressable>
              ))}
            </Card>
          )}
        </View>
      )}

      {tab === 'folders' && (
        <View style={{ marginTop: 16, gap: 12 }}>
          <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><Field label="New folder" value={newFolder} onChangeText={setNewFolder} placeholder="Cutting, Bulking, Vegetarian" /></View>
            <Button title="Create" style={{ marginBottom: 16 }} onPress={async () => {
              if (!newFolder.trim()) return;
              const { error } = await sb.from('coach_nutrition_folders').insert({ trainer_id: tid, name: newFolder.trim() });
              if (error) return toast(errText(error), false);
              setNewFolder(''); load();
            }} />
          </Card>
          {folders.length > 0 && <Card style={{ padding: 0 }}>
            {folders.map((f, i) => (
              <Row key={f.id} icon="folder" title={f.name} sub={`${(plans ?? []).filter((x) => x.folder_id === f.id).length} plans`} last={i === folders.length - 1}
                onPress={() => { setFolder(f.id); setTab('plans'); }}
                right={<Button small kind="quiet" title="Delete" onPress={() => ask(`Delete the ${f.name} folder?`, 'Its plans stay; they just move out of the folder.', [
                  { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await sb.from('coach_nutrition_folders').delete().eq('id', f.id); if (folder === f.id) setFolder(null); load(); } }])} />} />
            ))}
          </Card>}
        </View>
      )}

      {tab === 'foods' && (
        <View style={{ marginTop: 16, gap: 12 }}>
          <Txt v="small">Foods that aren’t in the database, like your client’s protein shake, a branded bar or a recipe. Enter the numbers from the label.</Txt>
          {custom.list === null ? <ActivityIndicator color={p.ink} /> : custom.list.length === 0
            ? <Empty emoji="🥫" title="No foods of your own yet" action={<Button title="New food" onPress={() => setFood('new')} />} />
            : <Card style={{ padding: 0 }}>
              {custom.list.map((c, i) => <Row key={c.id} icon="restaurant" title={c.brand ? `${c.name} (${c.brand})` : c.name}
                sub={`${Math.round(+c.kcal)} kcal · P ${+c.protein} g · C ${+c.carbs} g · F ${+c.fat} g per ${c.serving_label.replace(/^1 /, '')}`} last={i === custom.list!.length - 1} onPress={() => setFood(c)} />)}
            </Card>}
        </View>
      )}

      {tab === 'templates' && (
        <View style={{ marginTop: 16, gap: 12 }}>
          <Txt v="small">Starter days built from USDA foods. Copy one, then change foods and portions to fit your client.</Txt>
          {templates.map((t) => (
            <Card key={t.key} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <Cover name={t.name} cover={t.cover} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="bold">{t.name}</Txt>
                <Txt v="small">About {t.targets.kcal.toLocaleString()} kcal · P {t.targets.protein} g · C {t.targets.carbs} g · F {t.targets.fat} g</Txt>
                <Txt v="small" numberOfLines={2}>{t.description}</Txt>
              </View>
              <Button small title="Use" onPress={() => useTemplate(t)} />
            </Card>
          ))}
        </View>
      )}

      <CreateSheet visible={creating} plans={plans ?? []} onClose={() => setCreating(false)} onCreate={(name, from) => { setCreating(false); createFrom(name, from ?? undefined); }} />
      {menu && <ActionMenu visible onClose={() => setMenu(null)} title={menu.name} items={[
        { label: 'Share with clients', icon: 'group_add', onPress: () => setShare(menu) },
        { label: 'Duplicate', icon: 'content_copy', onPress: () => createFrom(`${menu.name} (copy)`, menu) },
        { label: 'Move to folder', icon: 'drive_file_move', onPress: () => setMoving(menu) },
        { label: 'Delete', icon: 'delete', danger: true, onPress: () => ask(`Delete ${menu.name}?`, counts[menu.id] ? `It’s removed from ${counts[menu.id]} client${counts[menu.id] === 1 ? '' : 's'} too.` : 'This can’t be undone.', [
          { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { const { error } = await sb.from('coach_nutrition_plans').delete().eq('id', menu.id); if (error) toast(errText(error), false); load(); } }]) },
      ]} />}
      <SharePlan plan={share} visible={!!share} onClose={() => { setShare(null); load(); }} />
      <Sheet visible={!!moving} onClose={() => setMoving(null)} title="Move to folder">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[{ id: null as string | null, name: 'No folder' }, ...folders].map((f) => (
            <Chip key={f.id ?? 'none'} label={f.name} selected={moving?.folder_id === f.id} onPress={async () => {
              const { error } = await sb.from('coach_nutrition_plans').update({ folder_id: f.id }).eq('id', moving!.id);
              if (error) toast(errText(error), false); setMoving(null); load();
            }} />
          ))}
        </View>
        {folders.length === 0 && <Txt v="small" style={{ marginTop: 10 }}>Create folders in the Folders tab.</Txt>}
      </Sheet>
      <CustomFoodEditor visible={!!food} food={food === 'new' ? null : food} onClose={() => setFood(null)} onSaved={() => { setFood(null); custom.reload(); }} />
    </Screen>
  );
}

/** "Create plan": blank, or a copy of one you already have */
function CreateSheet({ visible, plans, onClose, onCreate }: { visible: boolean; plans: NutritionPlan[]; onClose: () => void; onCreate: (name: string, from: NutritionPlan | null) => void }) {
  const p = usePalette();
  const [name, setName] = useState('');
  const [copy, setCopy] = useState(false);
  const [from, setFrom] = useState<NutritionPlan | null>(null);
  const reset = () => { setName(''); setCopy(false); setFrom(null); };
  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="Create plan">
      <Field label="Plan name" value={name} onChangeText={setName} placeholder="Cutting phase, 1,900 kcal" autoFocus />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Txt v="bold">Copy an existing plan?</Txt>
        <Switch value={copy} onValueChange={setCopy} accessibilityLabel="Copy an existing plan" trackColor={{ true: p.focus, false: p.line }} thumbColor={p.surface} />
      </View>
      {copy && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {plans.length === 0 && <Txt v="small">You don’t have any plans to copy yet. Try the Templates tab.</Txt>}
          {plans.slice(0, 40).map((x) => <Chip key={x.id} label={x.name} selected={from?.id === x.id} onPress={() => { setFrom(x); if (!name) setName(x.name); }} />)}
        </View>
      )}
      <Txt v="small" style={{ marginBottom: 12 }}>New plans start with Breakfast, Lunch, Dinner, Snacks and Drinks. You’ll set calorie and macro targets next.</Txt>
      <Button title="Create" disabled={!name.trim() || (copy && !from)} style={{ alignSelf: 'flex-start' }} onPress={() => { onCreate(name.trim(), copy ? from : null); reset(); }} />
    </Sheet>
  );
}
