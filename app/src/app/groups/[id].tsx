import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Initials, Row, SectionLabel } from '@/components/bits';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { ask } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { errText, type Client, type Group } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

/** A client group: rename it, add or remove clients, delete it. */
export default function GroupScreen() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [g, setG] = useState<Group | null>(null);
  const [name, setName] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [inGroup, setInGroup] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [gr, c, m] = await Promise.all([
      sb.from('coach_groups').select('*').eq('id', id).maybeSingle(),
      sb.from('coach_clients').select('*').in('status', ['invited', 'active', 'frozen']).order('last_name'),
      sb.from('coach_group_members').select('client_id').eq('group_id', id),
    ]);
    setG(gr.data as Group); setName((gr.data as Group)?.name ?? ''); setClients((c.data as Client[]) ?? []);
    setInGroup(new Set((m.data ?? []).map((r) => r.client_id)));
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!g) return null;

  const toggle = async (c: Client) => {
    const on = inGroup.has(c.id);
    const { error } = on ? await sb.from('coach_group_members').delete().eq('group_id', g.id).eq('client_id', c.id)
      : await sb.from('coach_group_members').insert({ group_id: g.id, client_id: c.id, trainer_id: app.trainer!.user_id });
    if (error) return toast(errText(error), false);
    load();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
      <Stack.Screen options={{ title: g.name }} />
      <View style={{ width: '100%', maxWidth: MAX_W }}>
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}><Field label="Group name" value={name} onChangeText={setName} /></View>
          <Button kind="quiet" title="Rename" style={{ marginBottom: 16 }} onPress={async () => {
            if (!name.trim()) return;
            const { error } = await sb.from('coach_groups').update({ name: name.trim() }).eq('id', g.id);
            if (error) toast(errText(error), false); else { toast('Renamed'); load(); }
          }} />
        </Card>
        <SectionLabel>{`${inGroup.size} in this group`}</SectionLabel>
        <Card style={{ padding: 0 }}>
          {clients.length === 0 && <Txt v="small" style={{ padding: 16 }}>Add clients first, then put them in groups.</Txt>}
          {clients.map((c, i) => (
            <Row key={c.id} title={c.name} sub={c.email} last={i === clients.length - 1} onPress={() => toggle(c)}
              right={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Initials name={c.name} size={30} />
                <Txt v="smallBold" color={inGroup.has(c.id) ? p.good : p.muted}>{inGroup.has(c.id) ? 'In group' : 'Add'}</Txt></View>} />
          ))}
        </Card>
        <Button kind="danger" title="Delete group" style={{ marginTop: 20, alignSelf: 'flex-start' }} onPress={() => ask(`Delete ${g.name}?`, 'The clients stay; only the group is removed.', [
          { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await sb.from('coach_groups').delete().eq('id', g.id); router.back(); } }])} />
      </View>
    </ScrollView>
  );
}
