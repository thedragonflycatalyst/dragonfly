import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { ClientPicker, useClientList } from '@/components/pickers';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { confirm } from '@/lib/ask';
import type { Broadcast } from '@/lib/chat';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { F, MAX_W, R, usePalette } from '@/lib/theme';

/** A broadcast list: who's on it, and sending a message to each of them privately */
export default function BroadcastScreen() {
  const p = usePalette();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [b, setB] = useState<Broadcast | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const { clients } = useClientList();
  const load = useCallback(async () => {
    const { data } = await sb.from('coach_broadcasts').select('*').eq('id', id).maybeSingle();
    setB((data as Broadcast) ?? null); setTitle((data as Broadcast | null)?.title ?? '');
  }, [id]);
  useEffect(() => { load(); }, [load]);
  if (!b) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  const people = (clients ?? []).filter((c) => b.client_ids.includes(c.id));
  const reach = people.filter((c) => c.user_id && c.status === 'active').length;
  const save = async (patch: Partial<Broadcast>) => { const { error } = await sb.from('coach_broadcasts').update(patch).eq('id', b.id); if (error) toast(errText(error), false); else load(); };
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const { data, error } = await sb.rpc('coach_broadcast_send', { p_broadcast: b.id, p_body: text.trim() });
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast(`Sent to ${data} client${data === 1 ? '' : 's'}`); setText(''); load();
  };
  const remove = async () => {
    if (!(await confirm(`Delete ${b.title}?`, 'Messages already sent stay in each private chat.', 'Delete', true))) return;
    await sb.from('coach_broadcasts').delete().eq('id', b.id); router.back();
  };
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: b.title }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <Card style={{ gap: 10 }}>
            <TextInput value={text} onChangeText={setText} placeholder="Write your message…" placeholderTextColor={p.muted} multiline accessibilityLabel="Broadcast message"
              style={{ minHeight: 110, fontFamily: F.body, fontSize: 17, color: p.ink, textAlignVertical: 'top', borderWidth: 1.5, borderColor: p.line, borderRadius: R.sm, padding: 12 }} />
            <Button title={`Send to ${reach} client${reach === 1 ? '' : 's'}`} icon="send" busy={busy} disabled={!text.trim() || !reach} onPress={send} />
            <Txt v="small">Each client gets it in their private chat with you. {people.length - reach > 0 ? `${people.length - reach} haven’t signed in yet and won’t get it.` : ''}</Txt>
          </Card>
          {b.last_body ? <><SectionLabel>Last sent</SectionLabel><Card><Txt>{b.last_body}</Txt><Txt v="small">{b.last_sent_at ? new Date(b.last_sent_at).toLocaleString() : ''}</Txt></Card></> : null}
          <SectionLabel>{`Recipients · ${people.length}`}</SectionLabel>
          <Card><Txt>{people.map((c) => c.name).join(', ') || 'Nobody yet'}</Txt></Card>
          <Button kind="ghost" icon="group_add" title="Change recipients" onPress={() => setPick(true)} style={{ alignSelf: 'flex-start' }} />
          <SectionLabel>List</SectionLabel>
          <Card>
            <Field label="Name" value={title} onChangeText={setTitle} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button small title="Rename" onPress={() => save({ title: title.trim() })} />
              <Button small kind="danger" icon="delete" title="Delete list" onPress={remove} />
            </View>
          </Card>
        </View>
      </ScrollView>
      <ClientPicker visible={pick} onClose={() => setPick(false)} title="Recipients" value={b.client_ids} onDone={(client_ids) => save({ client_ids })} />
    </View>
  );
}
