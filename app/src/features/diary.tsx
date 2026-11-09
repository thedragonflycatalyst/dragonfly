import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ActionMenu, Sheet } from '@/components/sheet';
import { Button, Card, Chip, Field, Icon, Txt, useToast } from '@/components/ui';
import { addDays, dayKey, fmtShort, fromKey, relDay } from '@/lib/dates';
import { activeTargets, aiFood, DIARY_MEALS, fromItem, fromOpenFoodFacts, quickItem, showWater, toLog, totals, WATER_GOAL_ML, waterStep, type AiItem, type FoodLog, type LogSource, type NewLogItem, type SavedMeal } from '@/lib/diary';
import { bytesOf, BUCKET, folder, pickPhoto, rand, removeStored, signedUrls } from '@/lib/files';
import { errText, type Client } from '@/lib/model';
import { defaultItem, describe, type MealItem, type Nutr, type NutritionPlan } from '@/lib/nutrition';
import { sb } from '@/lib/supabase';
import { R, usePalette } from '@/lib/theme';
import { useAiPhotoConsent } from './ai-photo-consent';
import { BarcodeScanner } from './barcode';
import { AmountEditor, FoodPicker, kcalOf } from './food-picker';
import { TotalsBars } from './nutrition-view';

type Mode = null | 'menu' | 'search' | 'plan' | 'barcode' | 'quick' | 'photo' | 'saved';

/** A client's food diary for one day: totals against targets, water, and each meal. Used by the client and their trainer. */
export function Diary({ client, imperial, asClient }: { client: Client; imperial: boolean; asClient: boolean }) {
  const p = usePalette();
  const toast = useToast();
  const [day, setDay] = useState(dayKey(new Date()));
  const [logs, setLogs] = useState<FoodLog[] | null>(null);
  const [water, setWater] = useState(0);
  const [plans, setPlans] = useState<NutritionPlan[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<{ meal: string; mode: Mode } | null>(null);
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const [mealMenu, setMealMenu] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [l, w, pl] = await Promise.all([
      sb.from('coach_food_logs').select('*').eq('client_id', client.id).eq('eaten_on', day).order('created_at'),
      sb.from('coach_water_logs').select('ml').eq('client_id', client.id).eq('day', day).maybeSingle(),
      sb.from('coach_nutrition_plan_clients').select('coach_nutrition_plans(*)').eq('client_id', client.id).order('assigned_at', { ascending: false }),
    ]);
    if (l.error) toast(errText(l.error), false);
    const rows = (l.data as FoodLog[]) ?? [];
    setLogs(rows); setWater((w.data as { ml: number } | null)?.ml ?? 0);
    setPlans(((pl.data ?? []) as unknown as { coach_nutrition_plans: NutritionPlan }[]).map((r) => r.coach_nutrition_plans).filter(Boolean));
    setPhotos(await signedUrls(rows.map((r) => r.photo_path).filter((x): x is string => !!x)));
  }, [client.id, day, toast]);
  useEffect(() => { setLogs(null); load(); }, [load]);

  const add = async (items: NewLogItem[], meal: string, source: LogSource, extra: Partial<FoodLog> = {}) => {
    if (!items.length) return;
    const { data: u } = await sb.auth.getUser();
    const rows = items.map((x, i) => ({ ...toLog(x, { client_id: client.id, eaten_on: day, meal, source }, i === 0 ? extra : {}), user_id: u.user?.id }));
    const { error } = await sb.from('coach_food_logs').insert(rows);
    if (error) return toast(errText(error), false);
    toast(items.length === 1 ? `Logged ${items[0].name.split(',')[0]}` : `Logged ${items.length} foods`);
    load();
  };
  const setWaterMl = async (ml: number) => {
    const v = Math.max(0, Math.min(20000, ml));
    setWater(v);
    const { error } = await sb.from('coach_water_logs').upsert({ client_id: client.id, trainer_id: client.trainer_id, day, ml: v, updated_at: new Date().toISOString() });
    if (error) toast(errText(error), false);
  };

  const targets = activeTargets(plans);
  const t = totals(logs ?? []);
  const meals = [...DIARY_MEALS, ...[...new Set((logs ?? []).map((l) => l.meal))].filter((m) => !DIARY_MEALS.includes(m))];
  const left = targets?.kcal ? Math.round(targets.kcal - t.kcal) : null;
  const step = waterStep(imperial);
  const mealLogs = (m: string) => (logs ?? []).filter((l) => l.meal === m);

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => setDay(dayKey(addDays(fromKey(day), -1)))} hitSlop={10}><Icon name="chevron_left" size={30} /></Pressable>
        <View style={{ alignItems: 'center' }}><Txt v="h3">{relDay(day)}</Txt><Txt v="small">{fmtShort(fromKey(day))}</Txt></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Next day" disabled={day >= dayKey(new Date())} onPress={() => setDay(dayKey(addDays(fromKey(day), 1)))} hitSlop={10}
          style={{ opacity: day >= dayKey(new Date()) ? 0.3 : 1 }}><Icon name="chevron_right" size={30} /></Pressable>
      </View>

      {logs === null ? <ActivityIndicator color={p.ink} /> : (
        <>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View><Txt v="kicker" color={p.focus}>Eaten</Txt><Txt v="h1">{t.kcal.toLocaleString()}</Txt><Txt v="small">kcal</Txt></View>
              {left !== null && <View style={{ alignItems: 'flex-end' }}><Txt v="kicker" color={left < 0 ? p.danger : p.focus}>{left < 0 ? 'Over' : 'Left'}</Txt><Txt v="h1">{Math.abs(left).toLocaleString()}</Txt><Txt v="small">of {targets!.kcal.toLocaleString()} kcal</Txt></View>}
            </View>
            <TotalsBars n={t} targets={targets} />
          </Card>

          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="water_drop" color={p.focus} /><Txt v="h3">Water</Txt></View>
              <Txt v="bold">{showWater(water, imperial)} <Txt v="small">/ {showWater(WATER_GOAL_ML, imperial)}</Txt></Txt>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: p.line, overflow: 'hidden' }}><View style={{ width: `${Math.min(1, water / WATER_GOAL_ML) * 100}%`, height: 8, backgroundColor: p.focus }} /></View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button small kind="ghost" icon="remove" title={imperial ? '8 oz' : '250 ml'} disabled={!water} onPress={() => setWaterMl(water - step)} />
              <Button small icon="add" title={imperial ? '8 oz glass' : '250 ml glass'} onPress={() => setWaterMl(water + step)} />
            </View>
          </Card>

          {meals.map((m) => {
            const ls = mealLogs(m);
            return (
              <Card key={m} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Txt v="h3" style={{ flex: 1 }}>{m}</Txt>
                  <Txt v="bold" color={p.focus}>{kcalOf(totals(ls))}</Txt>
                  {asClient && ls.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`More options for ${m}`} onPress={() => setMealMenu(m)} hitSlop={10}><Icon name="more_horiz" size={26} /></Pressable>}
                </View>
                {ls.map((l) => (
                  <Pressable key={l.id} accessibilityRole="button" accessibilityLabel={`Edit ${l.name}`} onPress={() => setEditing(l)}
                    style={({ pressed }) => ({ flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: p.line, paddingTop: 10, opacity: pressed ? 0.6 : 1 })}>
                    {l.photo_path ? <Image source={photos[l.photo_path] ? { uri: photos[l.photo_path] } : null} style={{ width: 44, height: 44, borderRadius: R.sm, backgroundColor: p.line }} contentFit="cover" accessibilityLabel="" accessible={false} /> : null}
                    <View style={{ flex: 1 }}>
                      <Txt numberOfLines={2}>{l.name}</Txt>
                      <Txt v="small">{[l.qty && l.portion ? describe({ id: '', food: l.food!, qty: Number(l.qty), portion: l.portion }) : null, SOURCE[l.source]].filter(Boolean).join(' · ')}</Txt>
                    </View>
                    <Txt v="small">{l.source === 'photo' && !l.n.kcal ? '' : kcalOf(l.n)}</Txt>
                  </Pressable>
                ))}
                <Button small kind="ghost" title="Add food" icon="add" style={{ alignSelf: 'center' }} onPress={() => setAdding({ meal: m, mode: 'menu' })} />
              </Card>
            );
          })}
        </>
      )}

      {adding && <AddFood meal={adding.meal} mode={adding.mode} setMode={(mode) => setAdding(mode ? { ...adding, mode } : null)} client={client} plans={plans} asClient={asClient}
        onAdd={async (items, source, extra) => { await add(items, adding.meal, source, extra); setAdding(null); }} />}
      {editing && <EditLog log={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
      {mealMenu && <ActionMenu visible onClose={() => setMealMenu(null)} title={mealMenu} items={[
        { label: 'Save as a meal to log again', icon: 'bookmark', onPress: async () => {
          const items = mealLogs(mealMenu).filter((l) => l.source !== 'photo' || l.n.kcal).map((l) => ({ name: l.name, food: l.food, qty: l.qty, portion: l.portion, n: l.n }));
          const name = `${mealMenu}, ${fmtShort(fromKey(day))}`;
          const { error } = await sb.from('coach_saved_meals').insert({ client_id: client.id, trainer_id: client.trainer_id, name, items });
          toast(error ? errText(error) : `Saved “${name}”. Find it under Saved meals.`, !error);
        } },
        { label: 'Copy to today', icon: 'content_copy', hidden: day === dayKey(new Date()), onPress: async () => {
          const { data: u } = await sb.auth.getUser();
          const rows = mealLogs(mealMenu).map(({ id: _i, trainer_id: _t, created_at: _c, ...r }) => ({ ...r, eaten_on: dayKey(new Date()), user_id: u.user?.id }));
          const { error } = await sb.from('coach_food_logs').insert(rows);
          toast(error ? errText(error) : 'Copied to today', !error);
        } },
      ]} />}
    </View>
  );
}

const SOURCE: Partial<Record<LogSource, string>> = { plan: 'from plan', barcode: 'scanned', quick: 'quick add', photo: 'photo', ai: 'AI estimate', saved: 'saved meal' };

/** The "Add food" flow: every way of logging, one sheet */
function AddFood({ meal, mode, setMode, client, plans, asClient, onAdd }: {
  meal: string; mode: Mode; setMode: (m: Mode) => void; client: Client; plans: NutritionPlan[]; asClient: boolean;
  onAdd: (items: NewLogItem[], source: LogSource, extra?: Partial<FoodLog>) => Promise<void>;
}) {
  const p = usePalette();
  const close = () => setMode(null);
  if (mode === 'search') return <FoodPicker visible mine={!asClient} title={`Add to ${meal}`} onClose={close} onAdd={(i) => onAdd([fromItem(i)], 'search')} />;
  const options: [Mode, string, string, Parameters<typeof Icon>[0]['name']][] = [
    ['search', 'Search foods', 'About 7,400 foods', 'search'],
    ['plan', 'From my plan', plans.length ? 'Log a planned meal in one tap' : 'No plan shared yet', 'restaurant'],
    ['barcode', 'Scan a barcode', 'Packaged foods', 'qr_code_scanner'],
    ['photo', 'Snap a photo', 'AI can estimate it for you', 'photo_camera'],
    ['quick', 'Quick add', 'Just the calories and macros', 'bolt'],
    ['saved', 'Saved meals', 'Meals you saved before', 'bookmark'],
  ];
  return (
    <Sheet visible onClose={close} title={mode === 'menu' ? `Add to ${meal}` : options.find((o) => o[0] === mode)?.[1]}>
      {mode === 'menu' && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {options.map(([m, title, sub, icon]) => (
            <Pressable key={m} accessibilityRole="button" accessibilityLabel={title} onPress={() => setMode(m)}
              style={({ pressed }) => ({ flexGrow: 1, flexBasis: 150, padding: 14, borderRadius: R.md, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, gap: 6, opacity: pressed ? 0.7 : 1 })}>
              <Icon name={icon} color={p.focus} size={26} />
              <Txt v="bold">{title}</Txt>
              <Txt v="small">{sub}</Txt>
            </Pressable>
          ))}
        </View>
      )}
      {mode === 'plan' && <FromPlan plans={plans} meal={meal} onAdd={(items) => onAdd(items, 'plan')} />}
      {mode === 'barcode' && <FromBarcode onAdd={(i) => onAdd([i], 'barcode')} />}
      {mode === 'quick' && <QuickAdd onAdd={(i) => onAdd([i], 'quick')} />}
      {mode === 'photo' && <FromPhoto client={client} onAdd={onAdd} />}
      {mode === 'saved' && <FromSaved client={client} asClient={asClient} onAdd={(items) => onAdd(items, 'saved')} />}
      {mode !== 'menu' && <Button kind="quiet" title="Other ways to add" style={{ alignSelf: 'flex-start', marginTop: 12 }} onPress={() => setMode('menu')} />}
      {mode === 'menu' && !asClient && <Txt v="small" style={{ marginTop: 12 }}>You’re adding to your client’s diary.</Txt>}
      {mode === 'barcode' && <Txt v="small" color={p.muted} style={{ marginTop: 8 }}>Packaged food data: Open Food Facts (openfoodfacts.org), ODbL.</Txt>}
      {mode === 'plan' && !plans.length && <Txt v="small" style={{ marginTop: 8 }}>{asClient ? 'When your trainer shares a meal plan, its meals show up here.' : 'Share a plan with this client first.'}</Txt>}
    </Sheet>
  );
}

function FromPlan({ plans, meal, onAdd }: { plans: NutritionPlan[]; meal: string; onAdd: (items: NewLogItem[]) => void }) {
  const p = usePalette();
  const [pid, setPid] = useState(plans[0]?.id);
  const plan = plans.find((x) => x.id === pid);
  if (!plan) return null;
  const meals = [...plan.meals].sort((a, b) => Number(b.name === meal) - Number(a.name === meal)).filter((m) => m.items.length);
  return (
    <View style={{ gap: 12 }}>
      {plans.length > 1 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{plans.map((x) => <Chip key={x.id} label={x.name} selected={x.id === pid} onPress={() => setPid(x.id)} />)}</View>}
      {meals.length === 0 && <Txt v="small">This plan doesn’t have any foods yet.</Txt>}
      {meals.map((m) => (
        <Card key={m.id} style={{ gap: 8, borderWidth: 1.5, borderColor: p.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Txt v="bold" style={{ flex: 1 }}>{m.name}</Txt>
            <Button small title="Log all" onPress={() => onAdd(m.items.map(fromItem))} />
          </View>
          {m.items.map((i) => (
            <Pressable key={i.id} accessibilityRole="button" accessibilityLabel={`Log ${i.food.name}`} onPress={() => onAdd([fromItem(i)])}
              style={{ flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: p.line, paddingTop: 8 }}>
              <View style={{ flex: 1 }}><Txt numberOfLines={2}>{i.food.name}</Txt><Txt v="small">{describe(i)} · tap to log just this</Txt></View>
              <Icon name="add" color={p.focus} />
            </Pressable>
          ))}
        </Card>
      ))}
    </View>
  );
}

function FromBarcode({ onAdd }: { onAdd: (i: NewLogItem) => void }) {
  const toast = useToast();
  const [item, setItem] = useState<MealItem | null>(null);
  const [busy, setBusy] = useState(false);
  const look = async (code: string) => {
    setBusy(true);
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`);
      const j = r.ok ? await r.json() : null;
      const food = fromOpenFoodFacts(code, j?.product);
      if (!food) toast('That product isn’t in the database yet. Try Search foods or Quick add.', false);
      else setItem(defaultItem(food));
    } catch { toast('Couldn’t look that up. Check your connection.', false); } finally { setBusy(false); }
  };
  if (busy) return <ActivityIndicator style={{ marginVertical: 30 }} />;
  if (item) return (
    <View style={{ gap: 12 }}>
      <Txt v="h3">{item.food.name}</Txt>
      <AmountEditor item={item} onChange={setItem} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Add" icon="add" disabled={!(item.qty > 0)} onPress={() => onAdd(fromItem(item))} />
        <Button kind="ghost" title="Scan another" onPress={() => setItem(null)} />
      </View>
    </View>
  );
  return <BarcodeScanner onCode={look} />;
}

function QuickAdd({ onAdd }: { onAdd: (i: NewLogItem) => void }) {
  const toast = useToast();
  const [v, setV] = useState<Record<string, string>>({});
  const set = (k: string) => (t: string) => setV((x) => ({ ...x, [k]: t }));
  return (
    <View>
      <Field label="What was it?" hint="(optional)" value={v.name ?? ''} onChangeText={set('name')} placeholder="Latte at the café" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 }}>
        {([['kcal', 'Calories'], ['protein', 'Protein (g)'], ['carbs', 'Carbs (g)'], ['fat', 'Fat (g)']] as [string, string][]).map(([k, label]) => (
          <View key={k} style={{ width: 140 }}><Field label={label} value={v[k] ?? ''} onChangeText={set(k)} keyboardType="decimal-pad" placeholder="0" /></View>
        ))}
      </View>
      <Txt v="small" style={{ marginBottom: 12 }}>Leave calories empty and they’re worked out from the macros.</Txt>
      <Button title="Add" icon="add" style={{ alignSelf: 'flex-start' }} onPress={() => {
        const item = quickItem(v.name ?? '', v as Partial<Record<keyof Nutr, string>>);
        if (!item) return toast('Enter calories, or protein, carbs and fat', false);
        onAdd(item);
      }} />
    </View>
  );
}

async function toBase64(uri: string) {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1024 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  return out.base64 ?? '';
}

function FromPhoto({ client, onAdd }: { client: Client; onAdd: (items: NewLogItem[], source: LogSource, extra?: Partial<FoodLog>) => Promise<void> }) {
  const p = usePalette();
  const toast = useToast();
  const [uri, setUri] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const [items, setItems] = useState<(AiItem & { keep: boolean })[] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'ai' | 'save' | null>(null);
  const take = async (src: 'camera' | 'library') => { try { const u = await pickPhoto(src); if (u) { setUri(u); setItems(null); } } catch (e) { toast(errText(e), false); } };
  const upload = async () => {
    const path = `${folder(client, 'meals')}/${rand()}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(path, await bytesOf(uri!), { contentType: 'image/jpeg' });
    if (error) throw error;
    return path;
  };
  const consent = useAiPhotoConsent();
  const estimate = async () => {
    if (!(await consent.ask())) return;
    setBusy('ai');
    try {
      const { data, error } = await sb.functions.invoke('coach-food-photo', { body: { image: await toBase64(uri!), hint } });
      const code = (data as { error?: string } | null)?.error ?? (error ? await (error as { context?: Response }).context?.json?.().then((j: { error?: string }) => j.error).catch(() => null) : null);
      if (code === 'not_configured') return toast('AI estimates aren’t switched on yet. You can still save the photo or add foods yourself.', false);
      if (code === 'daily_limit') return toast('That’s today’s limit for AI estimates. Add the rest by search or quick add.', false);
      if (error || !data?.items) return toast('Couldn’t estimate this photo. Try again, or add foods yourself.', false);
      setItems((data.items as AiItem[]).map((i) => ({ ...i, keep: true }))); setNote(data.note ?? '');
      if (!data.items.length) toast('No food found in that photo.', false);
    } catch (e) { toast(errText(e), false); } finally { setBusy(null); }
  };
  const save = async (withItems: boolean) => {
    setBusy('save');
    try {
      const path = await upload();
      const kept = (items ?? []).filter((i) => i.keep);
      if (withItems && kept.length) await onAdd(kept.map(aiFood), 'ai', { photo_path: path, note: note || null });
      else await onAdd([{ name: hint.trim() || 'Meal photo', food: null, qty: null, portion: null, n: { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fibre: 0, sodium: 0 } }], 'photo', { photo_path: path });
    } catch (e) { toast(errText(e), false); } finally { setBusy(null); }
  };

  if (!uri) return (
    <View style={{ gap: 12 }}>
      <Txt>Take a photo of the meal. AI can estimate the foods, portions, calories and macros, and you can adjust before saving. Or just save the photo for your trainer.</Txt>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Button icon="photo_camera" title="Take photo" onPress={() => take('camera')} />
        <Button kind="ghost" icon="photo_library" title="Choose photo" onPress={() => take('library')} />
      </View>
    </View>
  );
  return (
    <View style={{ gap: 12 }}>
      <Image source={{ uri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: R.md }} contentFit="cover" accessibilityLabel="Meal photo" />
      {items === null ? (
        <>
          <Field label="Anything the photo won’t show?" hint="(optional)" value={hint} onChangeText={setHint} placeholder="Cooked in butter, large portion, oat milk" />
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Button kind="accent" icon="bolt" title="Estimate with AI" busy={busy === 'ai'} onPress={estimate} />
            <Button kind="ghost" title="Just save the photo" busy={busy === 'save'} onPress={() => save(false)} />
            <Button kind="quiet" title="Retake" onPress={() => setUri(null)} />
          </View>
        </>
      ) : (
        <>
          <Txt v="bold">Here’s the estimate. Untick anything that’s wrong and adjust the amounts.</Txt>
          {items.map((i, n) => (
            <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: p.line, paddingTop: 8, opacity: i.keep ? 1 : 0.5 }}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: i.keep }} accessibilityLabel={`Keep ${i.name}`} onPress={() => setItems(items.map((x, m) => (m === n ? { ...x, keep: !x.keep } : x)))}
                style={{ width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: p.focus, backgroundColor: i.keep ? p.focus : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {i.keep && <Icon name="check" size={18} color="#fff" />}
              </Pressable>
              <View style={{ flex: 1 }}><Txt>{i.name}</Txt><Txt v="small">{Math.round(i.kcal)} kcal · P {Math.round(i.protein)} · C {Math.round(i.carbs)} · F {Math.round(i.fat)}</Txt></View>
              <View style={{ width: 90 }}><Field label="Grams" value={String(i.grams)} keyboardType="decimal-pad" onChangeText={(t) => {
                const g = Number(t); if (!Number.isFinite(g) || g < 0) return;
                setItems(items.map((x, m) => (m === n ? scaleAi(x, g) : x)));
              }} /></View>
            </View>
          ))}
          {note ? <Txt v="small">{note}</Txt> : null}
          <Txt v="small" color={p.muted}>AI estimates can be off, especially for oils and sauces.</Txt>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Button title="Add to diary" icon="check" busy={busy === 'save'} disabled={!items.some((i) => i.keep)} onPress={() => save(true)} />
            <Button kind="ghost" title="Retake" onPress={() => { setUri(null); setItems(null); }} />
          </View>
        </>
      )}
      {consent.sheet}
    </View>
  );
}
const scaleAi = (x: AiItem & { keep: boolean }, g: number) => {
  const f = x.grams > 0 ? g / x.grams : 0;
  return { ...x, grams: g, kcal: x.kcal * f, protein: x.protein * f, carbs: x.carbs * f, fat: x.fat * f, sugar: (x.sugar ?? 0) * f, fibre: (x.fibre ?? 0) * f, sodium: (x.sodium ?? 0) * f };
};

function FromSaved({ client, asClient, onAdd }: { client: Client; asClient: boolean; onAdd: (items: NewLogItem[]) => void }) {
  const p = usePalette();
  const [list, setList] = useState<SavedMeal[] | null>(null);
  const load = useCallback(() => { sb.from('coach_saved_meals').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).then(({ data }) => setList((data as SavedMeal[]) ?? [])); }, [client.id]);
  useEffect(load, [load]);
  if (list === null) return <ActivityIndicator />;
  if (!list.length) return <Txt v="small">{asClient ? 'No saved meals yet. In your diary, tap “…” on a meal and choose “Save as a meal”.' : 'Your client hasn’t saved any meals yet.'}</Txt>;
  return (
    <View style={{ gap: 10 }}>
      {list.map((m) => (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: p.line, paddingBottom: 10 }}>
          <View style={{ flex: 1 }}><Txt v="bold">{m.name}</Txt><Txt v="small">{m.items.length} foods · {kcalOf(totals(m.items))}</Txt></View>
          <Button small title="Log" onPress={() => onAdd(m.items)} />
          {asClient && <Button small kind="quiet" title="Delete" onPress={async () => { await sb.from('coach_saved_meals').delete().eq('id', m.id); load(); }} />}
        </View>
      ))}
    </View>
  );
}

/** Change the amount of a logged food, or remove it */
function EditLog({ log, onClose, onDone }: { log: FoodLog; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [item, setItem] = useState<MealItem | null>(log.food && log.qty && log.portion ? { id: log.id, food: log.food, qty: Number(log.qty), portion: log.portion } : null);
  return (
    <Sheet visible onClose={onClose} title={log.name}>
      {item ? <AmountEditor item={item} onChange={setItem} /> : <Txt style={{ marginBottom: 8 }}>{log.n.kcal ? `${kcalOf(log.n)} · P ${Math.round(log.n.protein)} g · C ${Math.round(log.n.carbs)} g · F ${Math.round(log.n.fat)} g` : 'Photo only, no numbers.'}</Txt>}
      {log.note ? <Txt v="small" style={{ marginTop: 8 }}>{log.note}</Txt> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        {item && <Button title="Save" disabled={!(item.qty > 0)} onPress={async () => {
          const x = fromItem(item);
          const { error } = await sb.from('coach_food_logs').update({ qty: x.qty, portion: x.portion, n: x.n }).eq('id', log.id);
          if (error) toast(errText(error), false); else onDone();
        }} />}
        <Button kind="danger" title="Remove" onPress={async () => {
          const { error } = await sb.from('coach_food_logs').delete().eq('id', log.id);
          if (error) return toast(errText(error), false);
          if (log.photo_path) await removeStored([log.photo_path]);
          onDone();
        }} />
      </View>
    </Sheet>
  );
}
