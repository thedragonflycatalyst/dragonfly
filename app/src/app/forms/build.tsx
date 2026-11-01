import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useToast } from '@/components/ui';
import { FormBuilder } from '@/features/forms';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

/** Trainer creates a reusable form (intake, check-in, waiver…). */
export default function BuildForm() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'New form' }} />
      <View style={{ width: '100%', maxWidth: MAX_W }}>
        <FormBuilder busy={busy} onSave={async (f) => {
          setBusy(true);
          const { error } = await sb.from('coach_forms').insert({ trainer_id: app.trainer!.user_id, ...f });
          setBusy(false);
          if (error) return toast(errText(error), false);
          toast('Form saved. Send it from any client’s Forms.'); router.back();
        }} />
      </View>
    </ScrollView>
  );
}
