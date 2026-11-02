import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { Sheet } from '@/components/sheet';
import { Diary } from '@/features/diary';
import { Button, Chip, Txt, useToast } from '@/components/ui';
import { useClientRecord } from '@/features/common';
import { PlansView } from '@/features/plan-view';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import type { NutritionPlan } from '@/lib/nutrition';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

/** Trainer: the meal plans shared with one client, plus share another or stop sharing */
export default function ClientNutrition() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { client } = useClientRecord(id);
  const [plans, setPlans] = useState<NutritionPlan[] | null>(null);
  const [all, setAll] = useState<NutritionPlan[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<'diary' | 'plans'>('diary');

  const load = useCallback(async () => {
    const [mine, everything] = await Promise.all([
      sb.from('coach_nutrition_plan_clients').select('coach_nutrition_plans(*)').eq('client_id', id).order('assigned_at', { ascending: false }),
      sb.from('coach_nutrition_plans').select('*').eq('archived', false).order('name'),
    ]);
    setPlans(((mine.data ?? []) as unknown as { coach_nutrition_plans: NutritionPlan }[]).map((r) => r.coach_nutrition_plans).filter(Boolean));
    setAll((everything.data as NutritionPlan[]) ?? []);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const current = plans?.find((x) => x.id === chosen) ?? plans?.[0];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: client ? `${client.first_name}’s nutrition` : 'Nutrition' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 14 }}>
          <Segmented value={view} onChange={setView} options={[['diary', 'Food diary'], ['plans', 'Plans']]} />
          {view === 'diary' ? (client ? <Diary client={client} imperial={app.units === 'imperial'} asClient={false} /> : <ActivityIndicator color={p.ink} />) : <>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Button title="Share a plan" icon="add" onPress={() => setAdding(true)} />
            {current && <Button kind="ghost" title="Edit this plan" icon="edit" onPress={() => router.push({ pathname: '/nutrition/[id]', params: { id: current.id } })} />}
            {current && <Button kind="quiet" title="Stop sharing" onPress={async () => {
              const { error } = await sb.from('coach_nutrition_plan_clients').delete().eq('plan_id', current.id).eq('client_id', id);
              if (error) toast(errText(error), false); else { setChosen(null); load(); }
            }} />}
          </View>
          {plans === null ? <ActivityIndicator color={p.ink} /> : <PlansView plans={plans} chosen={chosen} onChoose={setChosen} empty="Share one of your plans and it shows up in their app." />}
          </>}
        </View>
      </ScrollView>
      <Sheet visible={adding} onClose={() => setAdding(false)} title={`Share with ${client?.first_name ?? 'client'}`}>
        {all.length === 0 && <Txt v="small">Create a plan in the Nutrition tab first.</Txt>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {all.filter((x) => !plans?.some((y) => y.id === x.id)).map((x) => <Chip key={x.id} label={x.name} onPress={async () => {
            const { error } = await sb.from('coach_nutrition_plan_clients').insert({ plan_id: x.id, client_id: id, trainer_id: app.user?.id });
            setAdding(false);
            if (error) toast(errText(error), false); else { toast(`Shared ${x.name}`); setChosen(x.id); load(); }
          }} />)}
        </View>
      </Sheet>
    </View>
  );
}
