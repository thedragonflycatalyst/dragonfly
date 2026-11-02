import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sheet } from '@/components/sheet';
import { Button, Chip, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

/** Shown on every screen while a team owner is viewing one of their trainers' accounts */
export function ViewingBanner() {
  const p = usePalette();
  const app = useApp();
  const insets = useSafeAreaInsets();
  if (!app.viewing) return null;
  const name = app.viewing.display_name;
  return (
    <View accessibilityRole="alert" style={{ paddingTop: insets.top + 6, paddingBottom: 8, paddingHorizontal: 16, backgroundColor: app.editing ? p.danger : p.focus, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Txt v="bold" color="#fff" style={{ flex: 1, minWidth: 180 }}>{app.editing ? `Editing ${name}’s account` : `Viewing ${name}’s account (view only)`}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Txt v="smallBold" color="#fff">Emergency edit</Txt>
        <Switch value={app.editing} onValueChange={app.setEditing} accessibilityLabel="Emergency editing" trackColor={{ true: '#fff8', false: '#fff4' }} thumbColor="#fff" />
      </View>
      <Button small kind="ghost" title="Back to my account" style={{ backgroundColor: '#fff' }} onPress={() => { app.stopViewing(); router.replace('/coach/menu'); }} />
    </View>
  );
}

/** Owner: send a copy of a workout, program or meal plan to one of the team's trainers */
export function CopyToTrainer({ item, onClose }: { item: { kind: 'workout' | 'program' | 'plan'; id: string; name: string } | null; onClose: () => void }) {
  const toast = useToast();
  const app = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const trainers = app.teamMembers.filter((m) => m.role === 'trainer' && m.status === 'active' && m.trainer_id);
  return (
    <Sheet visible={!!item} onClose={onClose} title={item ? `Send “${item.name}” to a trainer` : ''}>
      <Txt v="small" style={{ marginBottom: 12 }}>They get their own copy to change for their clients. Yours stays as it is.</Txt>
      {trainers.length === 0 && <Txt v="small">No trainers have joined your team yet.</Txt>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {trainers.map((m) => <Chip key={m.id} label={busy === m.id ? 'Sending…' : m.display_name} onPress={async () => {
          if (!item || busy) return;
          setBusy(m.id);
          const { error } = await sb.rpc('coach_copy_to_trainer', { p_kind: item.kind, p_id: item.id, p_trainer: m.trainer_id });
          setBusy(null);
          if (error) return toast(errText(error), false);
          toast(`Sent to ${m.display_name}`); onClose();
        }} />)}
      </View>
    </Sheet>
  );
}

/** Whether to offer "Send to a trainer" */
export const canSendToTrainers = (app: ReturnType<typeof useApp>) => app.isOwner && !app.viewing && app.teamMembers.some((m) => m.role === 'trainer' && m.status === 'active');
