import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Txt, useToast } from '@/components/ui';
import { errText, type Client, type Group } from '@/lib/model';
import { describe, itemNutr, macroSplit, mealNutr, NO_TARGETS, NUTRIENTS, planNutr, round, targetGrams, type Meal, type Nutr, type NutritionPlan, type Targets } from '@/lib/nutrition';
import { sb } from '@/lib/supabase';
import { R, usePalette } from '@/lib/theme';

/** Totals for the day against the targets, one bar per nutrient */
export function MacroSummary({ meals, targets }: { meals: Meal[]; targets: Targets }) {
  return <TotalsBars n={round(planNutr(meals))} targets={targets} />;
}

/** Bars for any set of totals against targets (or plain numbers when there are none) */
export function TotalsBars({ n, targets }: { n: Nutr; targets: Targets | null }) {
  const p = usePalette();
  targets = targets ?? { ...NO_TARGETS };
  const goal = targets.on ? targetGrams(targets) : null;
  const split = macroSplit(n);
  return (
    <View style={{ gap: 12 }}>
      {NUTRIENTS.map(([k, label, unit]) => {
        const want = goal?.[k] ?? 0;
        const pct = want > 0 ? Math.min(1, n[k] / want) : 0;
        const over = want > 0 && n[k] > want * 1.05;
        return (
          <View key={k} style={{ gap: 4 }} accessible accessibilityLabel={`${label}: ${n[k]} ${unit}${want ? ` of ${want} ${unit}` : ''}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt v="bold">{label}</Txt>
              <Txt>{n[k].toLocaleString()} {unit}{want ? <Txt color={p.muted}> / {Math.round(want).toLocaleString()} {unit}</Txt> : null}</Txt>
            </View>
            {want > 0 && <View style={{ height: 8, borderRadius: 4, backgroundColor: p.line, overflow: 'hidden' }}>
              <View style={{ width: `${pct * 100}%`, height: 8, backgroundColor: over ? p.danger : p.focus }} />
            </View>}
          </View>
        );
      })}
      <Txt v="small">Calories from protein {split.protein}% · carbs {split.carbs}% · fat {split.fat}%</Txt>
      {!targets.on && <Txt v="small">No daily targets set yet.</Txt>}
    </View>
  );
}

/** Read-only meals, for the client's view */
export function MealsView({ meals }: { meals: Meal[] }) {
  const p = usePalette();
  return (
    <View style={{ gap: 12 }}>
      {meals.filter((m) => m.items.length || m.note).map((m) => (
        <Card key={m.id} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt v="h3">{m.name}</Txt>
            <Txt v="bold" color={p.focus}>{Math.round(mealNutr(m).kcal)} kcal</Txt>
          </View>
          {m.note ? <Txt v="small">{m.note}</Txt> : null}
          {m.items.map((i) => (
            <View key={i.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: p.line, paddingTop: 8 }}>
              <View style={{ flex: 1 }}><Txt>{i.food.name}</Txt><Txt v="small">{describe(i)}</Txt></View>
              <Txt v="small">{Math.round(itemNutr(i).kcal)} kcal</Txt>
            </View>
          ))}
        </Card>
      ))}
    </View>
  );
}

/** Share a plan with clients (or everyone in a group) */
export function SharePlan({ plan, visible, onClose, preselect }: { plan: Pick<NutritionPlan, 'id' | 'name' | 'trainer_id'> | null; visible: boolean; onClose: (changed: boolean) => void; preselect?: string[] }) {
  const p = usePalette();
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<(Group & { members: string[] })[]>([]);
  const [have, setHave] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible || !plan) return;
    Promise.all([
      sb.from('coach_clients').select('*').in('status', ['active', 'invited']).order('last_name'),
      sb.from('coach_groups').select('*, coach_group_members(client_id)').order('name'),
      sb.from('coach_nutrition_plan_clients').select('client_id').eq('plan_id', plan.id),
    ]).then(([c, g, h]) => {
      setClients((c.data as Client[]) ?? []);
      setGroups(((g.data ?? []) as (Group & { coach_group_members: { client_id: string }[] })[]).map((x) => ({ ...x, members: x.coach_group_members.map((m) => m.client_id) })));
      const already = ((h.data ?? []) as { client_id: string }[]).map((x) => x.client_id);
      setHave(already); setChosen([...new Set([...already, ...(preselect ?? [])])]);
    });
  }, [visible, plan, preselect]);
  if (!plan) return null;
  const save = async () => {
    const add = chosen.filter((c) => !have.includes(c)), drop = have.filter((c) => !chosen.includes(c));
    setBusy(true);
    const errs = await Promise.all([
      add.length ? sb.from('coach_nutrition_plan_clients').insert(add.map((client_id) => ({ plan_id: plan.id, client_id, trainer_id: plan.trainer_id }))) : null,
      drop.length ? sb.from('coach_nutrition_plan_clients').delete().eq('plan_id', plan.id).in('client_id', drop) : null,
    ]);
    setBusy(false);
    const e = errs.find((r) => r?.error)?.error;
    if (e) return toast(errText(e), false);
    toast(add.length || drop.length ? `Shared with ${chosen.length} client${chosen.length === 1 ? '' : 's'}` : 'No changes'); onClose(true);
  };
  return (
    <Sheet visible={visible} onClose={() => onClose(false)} title={`Share “${plan.name}”`}>
      {groups.length > 0 && <>
        <Txt v="smallBold" style={{ marginBottom: 8 }}>Add a whole group</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {groups.map((g) => <Chip key={g.id} label={`${g.name} (${g.members.length})`} onPress={() => setChosen((c) => [...new Set([...c, ...g.members.filter((m) => clients.some((x) => x.id === m))])])} />)}
        </View>
      </>}
      <Txt v="smallBold" style={{ marginBottom: 8 }}>Clients</Txt>
      {clients.length === 0 && <Txt v="small" style={{ marginBottom: 12 }}>Add clients first, from the Clients tab.</Txt>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {clients.map((c) => <Chip key={c.id} label={c.name} selected={chosen.includes(c.id)} onPress={() => setChosen((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))} />)}
      </View>
      <Txt v="small" color={p.muted} style={{ marginBottom: 12 }}>Clients see this plan in their app and always see your latest version.</Txt>
      <Button title="Save" busy={busy} onPress={save} style={{ alignSelf: 'flex-start', borderRadius: R.pill }} />
    </Sheet>
  );
}
