import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { Cover } from '@/components/cover';
import { ClientPicker, Fab, Toggle } from '@/components/pickers';
import { Sheet } from '@/components/sheet';
import { Button, Chip, Empty, Field, Txt, useToast } from '@/components/ui';
import { CoverPicker } from '@/features/cover-picker';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, R, usePalette } from '@/lib/theme';

export type Community = { id: string; trainer_id: string; name: string; description: string | null; cover: string | null; all_clients: boolean; clients_can_post: boolean; archived: boolean; created_at: string };

/** Communities: group spaces where clients post, cheer each other on and see your announcements */
export default function Communities() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const coach = app.mode === 'coach';
  const [shelf, setShelf] = useState<'current' | 'archived'>('current');
  const [list, setList] = useState<Community[] | null>(null);
  const [editing, setEditing] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await sb.from('coach_communities').select('*').order('created_at', { ascending: false });
    if (error) toast(errText(error), false);
    setList((data as Community[]) ?? []);
  }, [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const shown = (list ?? []).filter((c) => c.archived === (shelf === 'archived'));
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Social' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          {coach && <Segmented value={shelf} onChange={setShelf} options={[['current', 'Current'], ['archived', 'Archived']]} />}
          {list === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : shown.length === 0 ? (
            <Empty emoji="🫂" title={coach ? (shelf === 'archived' ? 'Nothing archived' : 'Start a group') : 'No groups yet'}
              body={coach ? 'A shared space for a group: a bootcamp crew, a 6-week challenge, everyone on a program. Post announcements, and let members share wins and cheer each other on.' : 'When your trainer adds you to a workout group, it shows up here.'} />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {shown.map((c) => (
                <Pressable key={c.id} accessibilityRole="link" accessibilityLabel={c.name} onPress={() => router.push({ pathname: '/communities/[id]', params: { id: c.id } })}
                  style={({ pressed }) => ({ flexGrow: 1, flexBasis: 220, maxWidth: 460, gap: 8, opacity: pressed ? 0.8 : 1 })}>
                  <View style={{ aspectRatio: 2.2, borderRadius: R.md, overflow: 'hidden', alignItems: 'stretch' }}><Cover name={c.name} cover={c.cover} size={460} /></View>
                  <View><Txt v="bold">{c.name}</Txt>{c.description ? <Txt v="small" numberOfLines={2}>{c.description}</Txt> : null}</View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      {coach && shelf === 'current' && <Fab title="Create group" onPress={() => setEditing(true)} />}
      {coach && <CommunitySheet visible={editing} onClose={() => setEditing(false)} onSaved={(id) => { setEditing(false); load(); if (id) router.push({ pathname: '/communities/[id]', params: { id } }); }} />}
    </View>
  );
}

/** Create or edit a community and who's in it */
export function CommunitySheet({ visible, onClose, onSaved, initial, members = [] }: {
  visible: boolean; onClose: () => void; onSaved: (id?: string) => void; initial?: Community; members?: string[];
}) {
  const toast = useToast();
  const app = useApp();
  const [f, setF] = useState({ name: '', description: '', cover: null as string | null, all: false, post: true });
  const [chosen, setChosen] = useState<string[]>([]);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState(false);
  if (visible !== seen) {
    setSeen(visible);
    if (visible) { setF({ name: initial?.name ?? '', description: initial?.description ?? '', cover: initial?.cover ?? null, all: initial?.all_clients ?? false, post: initial?.clients_can_post ?? true }); setChosen(members); }
  }
  const tid = app.trainer?.user_id ?? '';
  const save = async () => {
    if (!f.name.trim()) return toast('Name the community', false);
    setBusy(true);
    try {
      const row = { trainer_id: tid, name: f.name.trim(), description: f.description.trim() || null, cover: f.cover, all_clients: f.all, clients_can_post: f.post };
      const { data, error } = initial ? await sb.from('coach_communities').update(row).eq('id', initial.id).select('id').single() : await sb.from('coach_communities').insert(row).select('id').single();
      if (error) throw error;
      const id = data.id as string;
      if (!f.all) {
        const drop = members.filter((m) => !chosen.includes(m)), add = chosen.filter((m) => !members.includes(m));
        if (drop.length) await sb.from('coach_community_members').delete().eq('community_id', id).in('client_id', drop);
        if (add.length) { const r = await sb.from('coach_community_members').insert(add.map((client_id) => ({ community_id: id, client_id, trainer_id: tid }))); if (r.error) throw r.error; }
      }
      toast('Saved'); onSaved(initial ? undefined : id);
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={initial ? 'Group settings' : 'New group'}>
      <Field label="Name" value={f.name} onChangeText={(name) => setF({ ...f, name })} placeholder="Spring Shred Challenge" />
      <Field label="Description" hint="(optional)" value={f.description} onChangeText={(description) => setF({ ...f, description })} multiline placeholder="Six weeks, three workouts a week. Post your wins!" />
      <Txt v="bold" style={{ marginBottom: 8 }}>Cover art</Txt>
      <CoverPicker name={f.name || 'Community'} value={f.cover} trainerId={tid} onChange={(cover) => setF({ ...f, cover })} />
      <Txt v="bold" style={{ marginTop: 14, marginBottom: 8 }}>Members</Txt>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <Chip label="All my clients" selected={f.all} onPress={() => setF({ ...f, all: true })} />
        <Chip label={!f.all && chosen.length ? `${chosen.length} chosen` : 'Choose clients'} selected={!f.all} onPress={() => { setF({ ...f, all: false }); setPick(true); }} />
      </View>
      <Toggle label="Members can post" sub="Off: only you post (announcements); members can still react and comment" value={f.post} onChange={(post) => setF({ ...f, post })} />
      <Button title="Save" icon="check" busy={busy} onPress={save} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      <ClientPicker visible={pick} onClose={() => setPick(false)} title="Members" value={chosen} onDone={setChosen} />
    </Sheet>
  );
}
