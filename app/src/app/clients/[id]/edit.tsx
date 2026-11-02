import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useToast } from '@/components/ui';
import { useClientRecord } from '@/features/common';
import { ClientForm, type ClientFormValues } from '@/features/client-form';
import { useApp } from '@/lib/app-state';
import { errText, type Group } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

/** Edit a client's details and groups. */
export default function EditClient() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { client } = useClientRecord(id);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [mine, setMine] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([sb.from('coach_groups').select('*').order('name'), sb.from('coach_group_members').select('group_id').eq('client_id', id)])
      .then(([g, m]) => { setGroups((g.data as Group[]) ?? []); setMine((m.data ?? []).map((r) => r.group_id)); });
  }, [id]);
  if (!client || !groups || !app.trainer) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;

  const save = async (v: ClientFormValues) => {
    setBusy(true);
    try {
      const { error } = await sb.from('coach_clients').update({
        first_name: v.first_name, last_name: v.last_name, phone: v.phone, sex: v.sex, date_of_birth: v.date_of_birth,
        height_cm: v.height_cm, goals: v.goals, source: v.source, contact_via: v.contact_via, ...(client.user_id ? {} : { email: v.email }),
      }).eq('id', client.id);
      if (error) throw error;
      const add = v.groupIds.filter((g) => !mine.includes(g)), drop = mine.filter((g) => !v.groupIds.includes(g));
      if (add.length) { const r = await sb.from('coach_group_members').insert(add.map((g) => ({ group_id: g, client_id: client.id, trainer_id: app.trainer!.user_id }))); if (r.error) throw r.error; }
      if (drop.length) { const r = await sb.from('coach_group_members').delete().eq('client_id', client.id).in('group_id', drop); if (r.error) throw r.error; }
      toast('Saved'); router.back();
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: `Edit ${client.first_name}` }} />
      <View style={{ width: '100%', maxWidth: MAX_W }}>
        <ClientForm mode="edit" initial={client} groups={groups} initialGroups={mine} units={app.units} busy={busy} onSubmit={save} />
      </View>
    </ScrollView>
  );
}
