import { View } from 'react-native';
import { Card, Chip, Empty, Txt } from '@/components/ui';
import { MacroSummary, MealsView } from '@/features/nutrition-view';
import { NO_TARGETS, type NutritionPlan } from '@/lib/nutrition';
import { usePalette } from '@/lib/theme';

/** One or more shared plans, read-only: pick a plan, see targets, totals and meals */
export function PlansView({ plans, chosen, onChoose, empty }: { plans: NutritionPlan[]; chosen: string | null; onChoose: (id: string) => void; empty: string }) {
  const p = usePalette();
  if (!plans.length) return <Empty emoji="🥗" title="No nutrition plan yet" body={empty} />;
  const plan = plans.find((x) => x.id === chosen) ?? plans[0];
  const targets = { ...NO_TARGETS, ...plan.targets };
  return (
    <View style={{ gap: 14 }}>
      {plans.length > 1 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{plans.map((x) => <Chip key={x.id} label={x.name} selected={x.id === plan.id} onPress={() => onChoose(x.id)} />)}</View>}
      <View style={{ gap: 4 }}>
        <Txt v="h2">{plan.name}</Txt>
        {plan.description ? <Txt>{plan.description}</Txt> : null}
      </View>
      {plan.notes ? <Card style={{ gap: 4 }}><Txt v="smallBold" color={p.focus}>Notes</Txt><Txt>{plan.notes}</Txt></Card> : null}
      <Card><Txt v="h3" style={{ marginBottom: 12 }}>{targets.on ? 'Plan vs daily targets' : 'Totals for the day'}</Txt><MacroSummary meals={plan.meals} targets={targets} /></Card>
      <MealsView meals={plan.meals} />
    </View>
  );
}
