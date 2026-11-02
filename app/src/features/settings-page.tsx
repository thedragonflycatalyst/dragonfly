import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

/** Saves fields on the trainer profile and reloads it */
export function useTrainerSave() {
  const app = useApp();
  const toast = useToast();
  return async (patch: Record<string, unknown>, ok: string | null = 'Saved') => {
    if (!app.trainer) return false;
    const { error } = await sb.from('coach_trainers').update(patch).eq('user_id', app.trainer.user_id);
    if (error) { toast(errText(error), false); return false; }
    await app.reloadMe(); if (ok) toast(ok); return true;
  };
}
export function Page({ title, children }: { title: string; children: ReactNode }) {
  const p = usePalette();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title }} />
      <View style={{ width: '100%', maxWidth: 640, gap: 12 }}>{children}</View>
    </ScrollView>
  );
}
