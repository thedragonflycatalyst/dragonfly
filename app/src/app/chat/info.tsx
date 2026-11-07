import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import { Initials, SectionLabel } from '@/components/bits';
import { ClientPicker, Toggle } from '@/components/pickers';
import { Button, Card, Field, Icon, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import type { Chat, ChatMember, Message } from '@/lib/chat';
import { fmtSize } from '@/lib/files';
import { errText } from '@/lib/model';
import { socialUrls } from '@/lib/social';
import { sb } from '@/lib/supabase';
import { MAX_W, R, usePalette } from '@/lib/theme';

/** Chat settings: mute, the group's name and members, and everything shared in the chat */
export default function ChatInfo() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const me = app.user?.id ?? '';
  const { id } = useLocalSearchParams<{ id: string }>();
  const [chat, setChat] = useState<Chat | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [media, setMedia] = useState<Message[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [pick, setPick] = useState(false);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const load = useCallback(async () => {
    const [c, m, ms] = await Promise.all([
      sb.from('coach_chats').select('*').eq('id', id).maybeSingle(), sb.from('coach_chat_members').select('*').eq('chat_id', id),
      sb.from('coach_messages').select('*').eq('chat_id', id).in('kind', ['image', 'video', 'file', 'gif', 'audio']).is('deleted_at', null).order('created_at', { ascending: false }).limit(200),
    ]);
    const ch = (c.data as Chat) ?? null;
    setChat(ch); setTitle(ch?.title ?? ''); setMembers((m.data as ChatMember[]) ?? []);
    const list = (ms.data as Message[]) ?? [];
    setMedia(list); setUrls(await socialUrls(list.map((x) => x.path).filter(Boolean) as string[]));
    if (ch?.kind === 'group') {
      const { data } = await sb.from('coach_clients').select('id, user_id').in('user_id', ((m.data as ChatMember[]) ?? []).map((x) => x.user_id));
      setClientIds((data ?? []).map((x) => x.id));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const mine = members.find((m) => m.user_id === me);
  const owner = chat?.kind === 'group' && chat.trainer_id === me;
  const setMine = async (patch: Partial<ChatMember>) => {
    const { error } = await sb.from('coach_chat_members').update(patch).match({ chat_id: id, user_id: me });
    if (error) toast(errText(error), false); else load();
  };
  const pics = (media ?? []).filter((m) => m.kind === 'image' || m.kind === 'gif' || m.kind === 'video');
  const files = (media ?? []).filter((m) => m.kind === 'file' || m.kind === 'audio');
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 4 }}>
          {mine && <Card>
            <Toggle label="Mute chat" sub="No notifications for new messages here" value={mine.muted} onChange={(muted) => setMine({ muted })} />
            <Toggle label="Archived" sub="Hidden from your inbox until there’s a new message" value={mine.archived} onChange={(archived) => setMine({ archived })} />
          </Card>}
          {owner && <>
            <SectionLabel>Group</SectionLabel>
            <Card>
              <Field label="Group name" value={title} onChangeText={setTitle} />
              <Button small title="Rename" onPress={async () => { const { error } = await sb.from('coach_chats').update({ title: title.trim() }).eq('id', id); if (error) toast(errText(error), false); else toast('Renamed'); }} style={{ alignSelf: 'flex-start' }} />
            </Card>
          </>}
          {chat?.kind === 'group' && <>
            <SectionLabel>{`Members · ${members.length}`}</SectionLabel>
            <Card style={{ padding: 0 }}>
              {members.map((m, i) => (
                <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: i === members.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                  <Initials name={m.name} size={34} /><Txt style={{ flex: 1 }}>{m.name}{m.user_id === me ? ' (you)' : ''}</Txt>{m.role === 'trainer' ? <Txt v="small">Coach</Txt> : null}
                </View>
              ))}
            </Card>
            {owner && <Button kind="ghost" icon="group_add" title="Change members" onPress={() => setPick(true)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />}
          </>}
          <SectionLabel>Media</SectionLabel>
          {media === null ? <ActivityIndicator color={p.ink} /> : pics.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: 26, gap: 6 }}><Icon name="photo_library" size={36} color={p.focus} /><Txt v="h3">Nothing to see here?</Txt><Txt v="small">No media has been added to this conversation yet</Txt></Card>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {pics.map((m) => {
                const src = m.kind === 'gif' ? m.meta.url : m.path ? urls[m.path] : undefined;
                return (
                  <Pressable key={m.id} onPress={() => src && Linking.openURL(src)} accessibilityRole="imagebutton" accessibilityLabel={m.kind}
                    style={{ width: '32.5%', aspectRatio: 1, borderRadius: 6, overflow: 'hidden', backgroundColor: p.soft, alignItems: 'center', justifyContent: 'center' }}>
                    {m.kind === 'video' ? <Icon name="play_arrow" size={36} /> : src ? <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel="" accessible={false} /> : null}
                  </Pressable>
                );
              })}
            </View>
          )}
          {files.length > 0 && <>
            <SectionLabel>Files and voice messages</SectionLabel>
            <Card style={{ padding: 0 }}>
              {files.map((m, i) => (
                <Pressable key={m.id} onPress={() => m.path && urls[m.path] && Linking.openURL(urls[m.path])} accessibilityRole="link"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: i === files.length - 1 ? 0 : 1, borderBottomColor: p.line, borderRadius: R.sm }}>
                  <Icon name={m.kind === 'audio' ? 'mic' : 'description'} size={22} color={p.focus} />
                  <View style={{ flex: 1 }}><Txt v="bold" numberOfLines={1}>{m.kind === 'audio' ? 'Voice message' : m.meta.name ?? 'File'}</Txt><Txt v="small">{new Date(m.created_at).toLocaleDateString()}{m.meta.size ? ` · ${fmtSize(m.meta.size)}` : ''}</Txt></View>
                </Pressable>
              ))}
            </Card>
          </>}
          {chat?.kind === 'direct' && app.mode === 'coach' && <Button kind="quiet" title="Open their profile" style={{ marginTop: 16, alignSelf: 'flex-start' }} onPress={async () => {
            const other = members.find((m) => m.user_id !== me);
            const { data } = await sb.from('coach_clients').select('id').eq('user_id', other?.user_id ?? '').maybeSingle();
            if (data) router.push({ pathname: '/clients/[id]', params: { id: data.id } }); else toast('That’s not one of your clients', false);
          }} />}
        </View>
      </ScrollView>
      <ClientPicker visible={pick} onClose={() => setPick(false)} onlyLinked title="Group members" value={clientIds}
        onDone={async (ids) => { const { error } = await sb.rpc('coach_chat_set_members', { p_chat: id, p_clients: ids }); if (error) toast(errText(error), false); else { toast('Members updated'); load(); } }} />
    </View>
  );
}
