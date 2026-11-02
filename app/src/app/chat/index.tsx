import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Initials, Segmented } from '@/components/bits';
import { ClientPicker, Fab, matches, SearchBox } from '@/components/pickers';
import { ActionMenu, Sheet } from '@/components/sheet';
import { Button, Card, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { chatName, listTime, unread, type Broadcast, type Chat, type ChatMember } from '@/lib/chat';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, R, usePalette } from '@/lib/theme';

type Tab = 'inbox' | 'archived' | 'broadcasts';

/** Chat inbox: private and group chats, archived chats, and broadcast lists */
export default function ChatInbox() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const me = app.user?.id ?? '';
  const coach = app.mode === 'coach';
  const [tab, setTab] = useState<Tab>('inbox');
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [casts, setCasts] = useState<Broadcast[]>([]);
  const [q, setQ] = useState('');
  const [create, setCreate] = useState(false);
  const [menu, setMenu] = useState<Chat | null>(null);
  const [flow, setFlow] = useState<'private' | 'group' | 'broadcast' | null>(null);

  const load = useCallback(async () => {
    const [c, m, b] = await Promise.all([
      sb.from('coach_chats').select('*').order('last_message_at', { ascending: false, nullsFirst: false }).limit(300),
      sb.from('coach_chat_members').select('*'),
      coach ? sb.from('coach_broadcasts').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
    if (c.error) toast(errText(c.error), false);
    setChats((c.data as Chat[]) ?? []); setMembers((m.data as ChatMember[]) ?? []); setCasts((b.data as Broadcast[]) ?? []);
  }, [toast, coach]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const mine = (c: Chat) => members.find((m) => m.chat_id === c.id && m.user_id === me);
  const shown = (chats ?? []).filter((c) => !!mine(c) && (mine(c)!.archived === (tab === 'archived')) && (c.last_message_at || c.kind === 'group' || c.created_by === me) && matches(q, chatName(c, members, me), c.last_preview));
  const archive = async (c: Chat, v: boolean) => {
    const { error } = await sb.from('coach_chat_members').update({ archived: v }).match({ chat_id: c.id, user_id: me });
    if (error) toast(errText(error), false); else load();
  };
  const messageTrainer = async () => {
    if (!app.myTrainer) return;
    const { data, error } = await sb.rpc('coach_chat_direct', { p_user: app.myTrainer.user_id });
    if (error) return toast(/messages_closed/.test(error.message) ? 'Your trainer has turned off messages.' : errText(error), false);
    router.push({ pathname: '/chat/[id]', params: { id: data as string } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Chat' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <Segmented<Tab> value={tab} onChange={setTab} options={coach ? [['inbox', 'Inbox'], ['archived', 'Archived'], ['broadcasts', 'Broadcasts']] : [['inbox', 'Inbox'], ['archived', 'Archived']]} />
          <SearchBox value={q} onChange={setQ} />
          {chats === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : tab === 'broadcasts' ? (
            casts.filter((b) => matches(q, b.title)).length === 0 ? <Empty emoji="📣" title="No broadcasts" body="Message several clients at once. Each one gets it in their private chat, and their replies come back to you there." />
              : <Card style={{ padding: 0 }}>{casts.filter((b) => matches(q, b.title)).map((b, i, a) => (
                <Pressable key={b.id} onPress={() => router.push({ pathname: '/chat/broadcast', params: { id: b.id } })} accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i === a.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.gold, alignItems: 'center', justifyContent: 'center' }}><Icon name="campaign" size={22} color={p.onAccent} /></View>
                  <View style={{ flex: 1 }}><Txt v="bold">{b.title}</Txt><Txt v="small" numberOfLines={1}>{b.client_ids.length} recipient{b.client_ids.length === 1 ? '' : 's'}{b.last_body ? ` · ${b.last_body}` : ''}</Txt></View>
                  <Txt v="small">{listTime(b.last_sent_at)}</Txt>
                </Pressable>))}</Card>
          ) : shown.length === 0 ? (
            <Empty emoji={tab === 'archived' ? '🗄️' : '💬'} title={tab === 'archived' ? 'No archives' : 'No messages yet'}
              body={tab === 'archived' ? 'Archived chats come back to your inbox when there’s a new message.' : coach ? 'Start a private chat with a client, or a group chat for a class.' : `Say hi to ${app.myTrainer?.display_name ?? 'your trainer'}.`}
              action={!coach && tab === 'inbox' && app.perms.message_trainer ? <Button title="Message your trainer" icon="chat_bubble" onPress={messageTrainer} /> : undefined} />
          ) : (
            <Card style={{ padding: 0 }}>
              {shown.map((c, i) => {
                const name = chatName(c, members, me), m = mine(c), un = unread(c, m);
                return (
                  <Pressable key={c.id} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })} onLongPress={() => setMenu(c)} accessibilityRole="button"
                    accessibilityLabel={`${name}${un ? ', unread' : ''}`} accessibilityHint="Long-press for options"
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i === shown.length - 1 ? 0 : 1, borderBottomColor: p.line, opacity: pressed ? 0.75 : 1 })}>
                    {c.kind === 'group' ? <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name="groups" size={22} color={p.focus} /></View> : <Initials name={name} size={44} />}
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Txt v="bold" style={{ flex: 1 }} numberOfLines={1}>{name}</Txt>
                        {m?.muted && <Icon name="notifications_off" size={16} color={p.muted} />}
                        <Txt v="small" color={un ? p.focus : p.muted}>{listTime(c.last_message_at)}</Txt>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Txt v={un ? 'smallBold' : 'small'} color={un ? p.ink : p.muted} numberOfLines={1} style={{ flex: 1 }}>{c.last_preview ?? 'No messages yet'}</Txt>
                        {un && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.focus }} />}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          )}
        </View>
      </ScrollView>
      {coach ? <Fab title="Create" onPress={() => setCreate(true)} /> : app.perms.message_trainer && shown.length > 0 && tab === 'inbox' ? <Fab title="Message your trainer" icon="chat_bubble" onPress={messageTrainer} /> : null}
      <Sheet visible={create} onClose={() => setCreate(false)} title="New chat type">
        {([['private', 'Private chat', 'One to one chat', 'person'], ['group', 'Group chat', 'Create a chat for a group conversation', 'groups'], ['broadcast', 'Broadcast', 'Message several contacts at once', 'campaign']] as const).map(([k, t, s, ic]) => (
          <Pressable key={k} onPress={() => { setCreate(false); setTimeout(() => setFlow(k), 60); }} accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginBottom: 10, borderRadius: R.md, backgroundColor: p.surface, opacity: pressed ? 0.8 : 1 })}>
            <Icon name={ic} size={24} color={p.focus} />
            <View style={{ flex: 1 }}><Txt v="h3">{t}</Txt><Txt v="small">{s}</Txt></View>
            <Icon name="chevron_right" color={p.muted} />
          </Pressable>
        ))}
      </Sheet>
      <NewChatFlow flow={flow} onClose={() => setFlow(null)} onDone={load} />
      <ActionMenu visible={!!menu} onClose={() => setMenu(null)} title={menu ? chatName(menu, members, me) : ''} items={menu ? [
        { label: mine(menu)?.archived ? 'Move to inbox' : 'Archive', icon: 'archive', onPress: () => archive(menu, !mine(menu)?.archived) },
        { label: mine(menu)?.muted ? 'Unmute' : 'Mute', icon: 'notifications_off', onPress: async () => { await sb.from('coach_chat_members').update({ muted: !mine(menu)?.muted }).match({ chat_id: menu.id, user_id: me }); load(); } },
      ] : []} />
    </View>
  );
}

function NewChatFlow({ flow, onClose, onDone }: { flow: 'private' | 'group' | 'broadcast' | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const app = useApp();
  const [title, setTitle] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<typeof flow>(null);
  if (flow !== seen) { setSeen(flow); setTitle(''); setIds([]); setPick(flow === 'private'); }
  const startPrivate = async (clientIds: string[]) => {
    const { data: c } = await sb.from('coach_clients').select('user_id, first_name').eq('id', clientIds[0]).maybeSingle();
    if (!c?.user_id) return toast(`${c?.first_name ?? 'They'} hasn’t signed in to Dragonfly yet, so they can’t chat.`, false);
    const { data, error } = await sb.rpc('coach_chat_direct', { p_user: c.user_id });
    if (error) return toast(errText(error), false);
    onClose(); router.push({ pathname: '/chat/[id]', params: { id: data as string } });
  };
  const go = async () => {
    if (!title.trim()) return toast('Give it a name', false);
    if (!ids.length) return toast('Choose at least one client', false);
    setBusy(true);
    try {
      if (flow === 'group') {
        const { data, error } = await sb.rpc('coach_chat_group', { p_title: title.trim(), p_clients: ids });
        if (error) throw error;
        onClose(); onDone(); router.push({ pathname: '/chat/[id]', params: { id: data as string } });
      } else {
        const { data, error } = await sb.from('coach_broadcasts').insert({ trainer_id: app.user?.id, title: title.trim(), client_ids: ids }).select('id').single();
        if (error) throw error;
        onClose(); onDone(); router.push({ pathname: '/chat/broadcast', params: { id: data.id } });
      }
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  if (flow === 'private') return <ClientPicker visible onClose={onClose} single onlyLinked title="Private chat with…" value={[]} onDone={startPrivate} />;
  return (
    <Sheet visible={!!flow} onClose={onClose} title={flow === 'group' ? 'New group chat' : 'New broadcast'}>
      <Field label="Name" value={title} onChangeText={setTitle} placeholder={flow === 'group' ? 'Saturday bootcamp crew' : 'All active clients'} />
      <Button kind="ghost" icon="group_add" title={ids.length ? `${ids.length} client${ids.length === 1 ? '' : 's'} chosen` : 'Choose clients'} onPress={() => setPick(true)} style={{ alignSelf: 'flex-start', marginBottom: 16 }} />
      <Txt v="small" style={{ marginBottom: 14 }}>{flow === 'group' ? 'Everyone in the group sees every message. Clients who haven’t signed in yet are added when they do.' : 'Each client gets your message in their own private chat; nobody sees who else got it.'}</Txt>
      <Button title={flow === 'group' ? 'Create group' : 'Create broadcast'} icon="check" busy={busy} onPress={go} />
      <ClientPicker visible={pick} onClose={() => setPick(false)} onlyLinked={flow === 'group'} value={ids} onDone={setIds} />
    </Sheet>
  );
}
