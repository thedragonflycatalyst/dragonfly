import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { PlansView } from '@/features/plan-view';
import { useApp } from '@/lib/app-state';
import type { NutritionPlan } from '@/lib/nutrition';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

/** Client: the meal plans their trainer shared */
export default function MyNutrition() {
  const p = usePalette();
  const app = useApp();
  const [plans, setPlans] = useState<NutritionPlan[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await sb.from('coach_nutrition_plans').select('*').order('updated_at', { ascending: false });
    setPlans((data as NutritionPlan[]) ?? []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const coach = app.myTrainer?.display_name ?? 'your trainer';
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'My nutrition' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W }}>
          {plans === null ? <ActivityIndicator color={p.ink} /> : <PlansView plans={plans} chosen={chosen} onChoose={setChosen} empty={`When ${coach} shares a meal plan, it shows up here.`} />}
        </View>
      </ScrollView>
    </View>
  );
}
