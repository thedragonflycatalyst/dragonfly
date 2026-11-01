import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useToast } from '@/components/ui';
import { ClientForm, type ClientFormValues } from '@/features/client-form';
import { useApp } from '@/lib/app-state';
import { errText, type Group } from '@/lib/model';
import { inviteClient, INVITE_MESSAGE, sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

/** Add client (or add to the client pool). */
export default function NewClient() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { pool } = useLocalSearchParams<{ pool?: string }>();
  const [groups, setGroups] = useState<Group[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { sb.from('coach_groups').select('*').order('name').then(({ data }) => setGroups((data as Group[]) ?? [])); }, []);
  if (!app.trainer) return null;

  const save = async (v: ClientFormValues) => {
    setBusy(true);
    try {
      const { data, error } = await sb.from('coach_clients').insert({
        trainer_id: app.trainer!.user_id, first_name: v.first_name, last_name: v.last_name, email: v.email, phone: v.phone,
        sex: v.sex, date_of_birth: v.date_of_birth, height_cm: v.height_cm, goals: v.goals, source: v.source,
        status: v.asLead ? 'lead' : 'invited',
      }).select('id').single();
      if (error) throw error;
      const id = data.id as string;
      await Promise.all([
        v.groupIds.length ? sb.from('coach_group_members').insert(v.groupIds.map((g) => ({ group_id: g, client_id: id, trainer_id: app.trainer!.user_id }))) : null,
        v.weight_kg ? sb.from('coach_measurements').insert({ client_id: id, trainer_id: app.trainer!.user_id, weight_kg: v.weight_kg, note: 'Starting weight' }) : null,
      ]);
      if (v.asLead) toast(`${v.first_name} added to your client pool`);
      else {
        try { toast(INVITE_MESSAGE[await inviteClient(id)](v.first_name)); }
        catch (e) { toast(`${v.first_name} was added, but the email didn’t send: ${errText(e)}`, false); }
      }
      router.replace({ pathname: '/clients/[id]', params: { id } });
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: pool ? 'Add to client pool' : 'Add client' }} />
      <View style={{ width: '100%', maxWidth: MAX_W }}>
        <ClientForm mode="new" pool={!!pool} groups={groups} units={app.units} busy={busy} onSubmit={save} />
      </View>
    </ScrollView>
  );
}
