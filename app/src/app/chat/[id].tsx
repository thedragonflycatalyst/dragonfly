import * as Clipboard from 'expo-clipboard';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { CONTACT_LABEL, contactLink, type ContactVia } from '@/lib/contact';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Initials } from '@/components/bits';
import { ActionMenu, Sheet } from '@/components/sheet';
import { Icon, Txt, useToast } from '@/components/ui';
import { EmojiSheet, GifSheet, MessageBody } from '@/features/chat-bits';
import { confirm } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { chatName, layout, QUICK_REACTIONS, seenBy, tally, type Chat, type ChatMember, type Message, type Reaction } from '@/lib/chat';
import { pickDocument } from '@/lib/files';
import { errText } from '@/lib/model';
import { extOf, socialUrls, uploadSocial } from '@/lib/social';
import { sb } from '@/lib/supabase';
import { F, R, usePalette } from '@/lib/theme';

const PAGE = 60;

/** One conversation: texting-style bubbles, reactions, replies, photos, video, voice notes, files, GIFs, seen and typing */
export default function Conversation() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const insets = useSafeAreaInsets();
  const me = app.user?.id ?? '';
  const { id } = useLocalSearchParams<{ id: string }>();
  const [chat, setChat] = useState<Chat | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [reacts, setReacts] = useState<Reaction[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [reply, setReply] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [menu, setMenu] = useState<Message | null>(null);
  const [attach, setAttach] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [gif, setGif] = useState(false);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState<string | null>(null);
  const [recording, setRecording] = useState<number | null>(null);
  const [more, setMore] = useState(true);
  const channel = useRef<ReturnType<typeof sb.channel> | null>(null);
  const lastTyping = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const recTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const viewOnly = !!chat && !members.some((m) => m.user_id === me);

  const sign = useCallback(async (list: Message[]) => {
    const paths = list.map((m) => m.path).filter(Boolean) as string[];
    if (paths.length) { const u = await socialUrls(paths); setUrls((x) => ({ ...x, ...u })); }
  }, []);
  const markRead = useCallback(async () => {
    await sb.from('coach_chat_members').update({ last_read_at: new Date().toISOString() }).match({ chat_id: id, user_id: me });
  }, [id, me]);

  const load = useCallback(async () => {
    const [c, m, ms] = await Promise.all([
      sb.from('coach_chats').select('*').eq('id', id).maybeSingle(),
      sb.from('coach_chat_members').select('*').eq('chat_id', id),
      sb.from('coach_messages').select('*').eq('chat_id', id).order('created_at', { ascending: false }).limit(PAGE),
    ]);
    if (ms.error) toast(errText(ms.error), false);
    setChat((c.data as Chat) ?? null); setMembers((m.data as ChatMember[]) ?? []);
    const list = ((ms.data as Message[]) ?? []).reverse();
    setMsgs(list); setMore(list.length === PAGE); sign(list);
    if (list.length) { const { data } = await sb.from('coach_message_reactions').select('message_id, user_id, emoji').eq('chat_id', id); setReacts((data as Reaction[]) ?? []); }
    markRead();
  }, [id, toast, sign, markRead]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Live: new and edited messages, reactions, read receipts, typing
  useEffect(() => {
    const ch = sb.channel(`chat:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coach_messages', filter: `chat_id=eq.${id}` }, (e) => {
        const m = e.new as Message;
        setMsgs((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l)); sign([m]);
        if (m.sender !== me) { setTyping(null); markRead(); }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'coach_messages', filter: `chat_id=eq.${id}` }, (e) => {
        const m = e.new as Message; setMsgs((l) => l?.map((x) => (x.id === m.id ? m : x)) ?? l);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_message_reactions', filter: `chat_id=eq.${id}` }, (e) => {
        if (e.eventType === 'INSERT') { const r = e.new as Reaction; setReacts((rs) => (rs.some((x) => x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji) ? rs : [...rs, r])); }
        else if (e.eventType === 'DELETE') { const r = e.old as Partial<Reaction>; if (r.message_id) setReacts((rs) => rs.filter((x) => !(x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji))); else load(); }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'coach_chat_members', filter: `chat_id=eq.${id}` }, (e) => {
        const m = e.new as ChatMember; setMembers((ms) => ms.map((x) => (x.user_id === m.user_id ? m : x)));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.user === me) return;
        setTyping(payload?.name ?? 'Someone'); clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(null), 4000);
      })
      .subscribe();
    channel.current = ch;
    return () => { sb.removeChannel(ch); clearTimeout(typingTimer.current); };
  }, [id, me, sign, markRead, load]);

  const myName = members.find((m) => m.user_id === me)?.name ?? '';
  const onType = (t: string) => {
    setText(t);
    if (Date.now() - lastTyping.current > 2500 && t) { lastTyping.current = Date.now(); channel.current?.send({ type: 'broadcast', event: 'typing', payload: { user: me, name: myName.split(' ')[0] } }); }
  };
  const older = async () => {
    if (!msgs?.length || !more) return;
    const { data } = await sb.from('coach_messages').select('*').eq('chat_id', id).lt('created_at', msgs[0].created_at).order('created_at', { ascending: false }).limit(PAGE);
    const list = ((data as Message[]) ?? []).reverse();
    setMore(list.length === PAGE); setMsgs((l) => [...list, ...(l ?? [])]); sign(list);
  };

  const send = async (row: Partial<Message>) => {
    const { error } = await sb.from('coach_messages').insert({ chat_id: id, reply_to: reply?.id ?? null, ...row });
    if (error) { toast(/messages_closed/.test(error.message) ? 'Messages are turned off for this chat.' : errText(error), false); return false; }
    setReply(null); return true;
  };
  const sendText = async () => {
    const body = text.trim();
    if (!body) return;
    if (editing) {
      const { error } = await sb.from('coach_messages').update({ body, edited_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) return toast(errText(error), false);
      setEditing(null); setText(''); return;
    }
    setText('');
    if (!(await send({ kind: 'text', body }))) setText(body);
  };
  const sendMedia = async (kind: 'image' | 'video' | 'file' | 'audio', uri: string, mime: string, name: string, meta: Message['meta'] = {}) => {
    setSending(true);
    try {
      const path = await uploadSocial('chat', id, uri, mime, extOf(name, kind === 'image' ? 'jpg' : kind === 'video' ? 'mp4' : kind === 'audio' ? 'm4a' : 'bin'));
      await send({ kind, path, body: kind !== 'audio' && kind !== 'file' && text.trim() ? text.trim() : null, meta: { name, mime, ...meta } });
      if (kind === 'image' || kind === 'video') setText('');
    } catch (e) { toast(errText(e), false); } finally { setSending(false); }
  };
  const pickMedia = async (camera: boolean) => {
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return toast('Allow camera access in your phone’s settings', false);
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images', 'videos'], quality: 1, videoMaxDuration: 180 };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      if (a.type === 'video') {
        if (a.fileSize && a.fileSize > 50 * 1048576) return toast('Videos up to 50 MB. Trim it and try again.', false);
        return sendMedia('video', a.uri, a.mimeType ?? 'video/mp4', a.fileName ?? 'video.mp4', { w: a.width, h: a.height, secs: a.duration ? a.duration / 1000 : undefined });
      }
      if (a.mimeType === 'image/gif') return sendMedia('image', a.uri, 'image/gif', a.fileName ?? 'image.gif', { w: a.width, h: a.height });
      const out = await ImageManipulator.manipulateAsync(a.uri, Math.max(a.width, a.height) > 1800 ? [{ resize: a.width >= a.height ? { width: 1800 } : { height: 1800 } }] : [], { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG });
      return sendMedia('image', out.uri, 'image/jpeg', 'photo.jpg', { w: out.width, h: out.height });
    } catch (e) { toast(errText(e), false); }
  };
  const pickFile = async () => {
    try { const d = await pickDocument(); if (d) await sendMedia('file', d.uri, d.mime ?? 'application/octet-stream', d.name, { size: d.size ?? undefined }); } catch (e) { toast(errText(e), false); }
  };
  const uploadGif = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    await sendMedia('image', a.uri, a.mimeType ?? 'image/gif', a.fileName ?? 'image.gif', { w: a.width, h: a.height });
  };
  const startRec = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return toast('Allow microphone access to send voice messages', false);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync(); recorder.record();
      setRecording(0); const t0 = Date.now();
      recTimer.current = setInterval(() => setRecording(Math.floor((Date.now() - t0) / 1000)), 500);
    } catch (e) { toast(errText(e), false); }
  };
  const stopRec = async (keep: boolean) => {
    clearInterval(recTimer.current);
    const secs = recording ?? 0;
    setRecording(null);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (keep && recorder.uri && secs >= 1) {
        const web = Platform.OS === 'web';
        await sendMedia('audio', recorder.uri, web ? 'audio/webm' : 'audio/mp4', web ? 'voice.webm' : 'voice.m4a', { secs });
      }
    } catch (e) { toast(errText(e), false); }
  };
  const react = async (m: Message, e: string) => {
    const mine = reacts.some((r) => r.message_id === m.id && r.user_id === me && r.emoji === e);
    setReacts((rs) => (mine ? rs.filter((r) => !(r.message_id === m.id && r.user_id === me && r.emoji === e)) : [...rs, { message_id: m.id, user_id: me, emoji: e }]));
    const { error } = mine ? await sb.from('coach_message_reactions').delete().match({ message_id: m.id, user_id: me, emoji: e }) : await sb.from('coach_message_reactions').insert({ message_id: m.id, emoji: e, chat_id: id });
    if (error) { toast(errText(error), false); load(); }
  };
  const del = async (m: Message) => {
    if (!(await confirm('Delete this message?', 'It’s removed for everyone.', 'Delete', true))) return;
    const { error } = await sb.from('coach_messages').update({ deleted_at: new Date().toISOString(), body: null }).eq('id', m.id);
    if (error) toast(errText(error), false);
  };

  const rows = useMemo(() => (msgs ? layout(msgs).reverse() : []), [msgs]);
  const lastMine = useMemo(() => [...(msgs ?? [])].reverse().find((m) => m.sender === me), [msgs, me]);
  const byId = useMemo(() => new Map((msgs ?? []).map((m) => [m.id, m])), [msgs]);
  const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.name ?? 'Member';
  const title = chat ? chatName(chat, members, me) : '';
  const group = chat?.kind === 'group';
  // Trainer: does this client prefer a text message or WhatsApp?
  const [pref, setPref] = useState<{ first: string; phone: string | null; via: ContactVia } | null>(null);
  const otherClient = app.mode === 'coach' && chat?.kind === 'direct' ? members.find((m) => m.role === 'client')?.user_id : undefined;
  useEffect(() => {
    if (!otherClient) return setPref(null);
    sb.from('coach_clients').select('first_name, phone, contact_via').eq('user_id', otherClient).limit(1).maybeSingle()
      .then(({ data }) => setPref(data && data.contact_via && data.contact_via !== 'app' ? { first: data.first_name, phone: data.phone, via: data.contact_via } : null));
  }, [otherClient]);
  const outside = pref ? contactLink(pref.via, pref.phone, text.trim(), Platform.OS) : null;
  const sendOutside = async () => {
    if (!pref || !outside) return;
    const body = text.trim();
    if (body && !(await send({ kind: 'text', body, meta: { via: pref.via as 'sms' | 'whatsapp' } }))) return;
    setText(''); Linking.openURL(outside).catch(() => toast(`Couldn’t open ${CONTACT_LABEL[pref.via]}`, false));
  };

  if (msgs === null) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title, headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Chat settings" hitSlop={10} onPress={() => router.push({ pathname: '/chat/info', params: { id } })}><Icon name="settings" /></Pressable> }} />
      <FlatList inverted data={rows} keyExtractor={(r) => (r.type === 'day' ? r.key : r.msg.id)} onEndReached={older} onEndReachedThreshold={0.3}
        contentContainerStyle={{ padding: 12, paddingTop: 8, maxWidth: 820, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<View style={{ transform: [{ scaleY: -1 }], padding: 30 }}><Txt v="small" center>{viewOnly ? 'No messages yet.' : 'Say hello 👋'}</Txt></View>}
        ListHeaderComponent={typing ? <Txt v="small" style={{ marginLeft: 44, marginTop: 4 }}>{typing} is typing…</Txt> : undefined}
        renderItem={({ item }) => {
          if (item.type === 'day') return <Txt v="small" center style={{ marginVertical: 12 }}>{item.label}</Txt>;
          const m = item.msg, mine = m.sender === me, quoted = m.reply_to ? byId.get(m.reply_to) : null, tl = tally(reacts, m.id, me);
          return (
            <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8, marginTop: item.first ? 10 : 2 }}>
              {!mine && <View style={{ width: 34 }}>{item.last ? <Initials name={nameOf(m.sender)} size={34} /> : null}</View>}
              <View style={{ maxWidth: '78%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {!mine && group && item.first && <Txt v="small" style={{ marginLeft: 6, marginBottom: 2 }}>{nameOf(m.sender)}</Txt>}
                <Pressable onLongPress={() => !m.deleted_at && setMenu(m)} delayLongPress={300} accessibilityHint="Long-press to react or reply"
                  style={{ backgroundColor: m.kind === 'text' && /^\p{Extended_Pictographic}/u.test(m.body ?? '') && (m.body ?? '').length <= 12 ? 'transparent' : mine ? p.focus : p.surface,
                    borderRadius: 20, borderBottomRightRadius: mine && item.last ? 6 : 20, borderBottomLeftRadius: !mine && item.last ? 6 : 20, paddingHorizontal: 14, paddingVertical: 10 }}>
                  {quoted && (
                    <View style={{ borderLeftWidth: 3, borderLeftColor: mine ? p.onAccent : p.focus, paddingLeft: 8, marginBottom: 6, opacity: 0.85 }}>
                      <Txt v="smallBold" color={mine ? p.onAccent : p.ink}>{quoted.sender === me ? 'You' : nameOf(quoted.sender)}</Txt>
                      <Txt v="small" color={mine ? p.onAccent : p.muted} numberOfLines={2}>{quoted.deleted_at ? 'Message deleted' : quoted.body ?? (quoted.kind === 'image' ? '📷 Photo' : quoted.kind === 'audio' ? '🎤 Voice message' : quoted.kind)}</Txt>
                    </View>
                  )}
                  <MessageBody m={m} url={m.path ? urls[m.path] : undefined} mine={mine} />
                </Pressable>
                {tl.length > 0 && (
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: -6, marginHorizontal: 8 }}>
                    {tl.map((t) => (
                      <Pressable key={t.emoji} onPress={() => react(m, t.emoji)} accessibilityRole="button" accessibilityLabel={`${t.emoji} ${t.n}`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: p.surface, borderRadius: R.pill, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: t.mine ? p.focus : p.line }}>
                        <Text style={{ fontSize: 13 }}>{t.emoji}</Text>{t.n > 1 ? <Txt v="small" style={{ fontSize: 12 }}>{t.n}</Txt> : null}
                      </Pressable>
                    ))}
                  </View>
                )}
                {item.last && (
                  <Txt v="small" style={{ fontSize: 12, marginTop: 3, marginHorizontal: 6 }}>
                    {new Date(m.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}{m.edited_at && !m.deleted_at ? ' · edited' : ''}
                    {mine && lastMine?.id === m.id && seenBy(m, members, me) ? '  ✓ Seen' : ''}
                  </Txt>
                )}
              </View>
            </View>
          );
        }} />
      {viewOnly ? (
        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: p.line }}><Txt v="small" center>You’re viewing this trainer’s chat. Only the people in it can send messages.</Txt></View>
      ) : (
        <View style={{ borderTopWidth: 1, borderTopColor: p.line, backgroundColor: p.bg, paddingBottom: insets.bottom + 6 }}>
          {(reply || editing) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 8 }}>
              <Icon name={editing ? 'edit' : 'reply'} size={18} color={p.focus} />
              <Txt v="small" style={{ flex: 1 }} numberOfLines={1}>{editing ? 'Editing message' : `Replying to ${reply!.sender === me ? 'yourself' : nameOf(reply!.sender)}: ${reply!.body ?? reply!.kind}`}</Txt>
              <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={() => { setReply(null); if (editing) { setEditing(null); setText(''); } }} hitSlop={8}><Icon name="close" size={18} /></Pressable>
            </View>
          )}
          {pref && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 8 }}>
              <Icon name="info" size={18} color={p.focus} />
              <Txt v="small" style={{ flex: 1 }}>{pref.first} prefers {CONTACT_LABEL[pref.via]}{outside ? '' : ' (add their phone number to use it)'}</Txt>
              {outside && <Pressable accessibilityRole="button" onPress={sendOutside} style={{ paddingHorizontal: 12, height: 32, borderRadius: R.md, backgroundColor: p.focus, justifyContent: 'center' }}>
                <Txt v="smallBold" color={p.onAccent}>{text.trim() ? `Send by ${CONTACT_LABEL[pref.via]}` : `Open ${CONTACT_LABEL[pref.via]}`}</Txt>
              </Pressable>}
            </View>
          )}
          {recording !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingHorizontal: 14 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Discard recording" onPress={() => stopRec(false)} hitSlop={8}><Icon name="delete" size={26} color={p.danger} /></Pressable>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.danger }} />
              <Txt style={{ flex: 1 }}>Recording… {Math.floor(recording / 60)}:{String(recording % 60).padStart(2, '0')}</Txt>
              <Pressable accessibilityRole="button" accessibilityLabel="Send voice message" onPress={() => stopRec(true)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.focus, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="send" size={20} color={p.onAccent} />
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, padding: 8, paddingHorizontal: 10 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Attach" onPress={() => setAttach(true)} style={{ padding: 8 }}><Icon name="add" size={28} /></Pressable>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: p.surface, borderRadius: 22, borderWidth: 1.5, borderColor: p.line, paddingLeft: 14, paddingRight: 4 }}>
                <TextInput value={text} onChangeText={onType} placeholder={`Chat with ${title}`} placeholderTextColor={p.muted} multiline accessibilityLabel="Message"
                  onKeyPress={(e) => { if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !(e.nativeEvent as unknown as { shiftKey?: boolean }).shiftKey) { e.preventDefault?.(); sendText(); } }}
                  style={{ flex: 1, minHeight: 42, maxHeight: 140, fontFamily: F.body, fontSize: 17, color: p.ink, paddingVertical: 10 }} />
                <Pressable accessibilityRole="button" accessibilityLabel="Emoji" onPress={() => setEmoji(true)} style={{ padding: 8 }}><Text style={{ fontSize: 22 }}>🙂</Text></Pressable>
              </View>
              {sending ? <ActivityIndicator style={{ padding: 10 }} color={p.ink} />
                : text.trim() ? <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={sendText} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.focus, alignItems: 'center', justifyContent: 'center' }}><Icon name={editing ? 'check' : 'send'} size={20} color={p.onAccent} /></Pressable>
                : <Pressable accessibilityRole="button" accessibilityLabel="Record a voice message" onPress={startRec} style={{ padding: 8 }}><Icon name="mic" size={28} /></Pressable>}
            </View>
          )}
        </View>
      )}
      <Sheet visible={attach} onClose={() => setAttach(false)} title="Send">
        {([['photo_library', 'Photo or video', () => pickMedia(false)], ['photo_camera', 'Camera', () => pickMedia(true)], ['gif', 'GIF', () => setGif(true)], ['attach_file', 'File (PDF, document…)', pickFile]] as const).map(([ic, label, fn]) => (
          <Pressable key={label} accessibilityRole="button" onPress={() => { setAttach(false); setTimeout(fn, 80); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}>
            <Icon name={ic as never} size={24} color={p.focus} /><Txt v="bold">{label}</Txt>
          </Pressable>
        ))}
      </Sheet>
      <EmojiSheet visible={emoji} onClose={() => setEmoji(false)} onPick={(e) => setText((t) => t + e)} />
      <GifSheet visible={gif} onClose={() => setGif(false)} onUpload={uploadGif} onPick={(g) => { setGif(false); send({ kind: 'gif', body: null, meta: { url: g.url, w: g.w, h: g.h, name: g.title } }); }} />
      <ActionMenu visible={!!menu} onClose={() => setMenu(null)} title="Message" items={menu ? [
        ...QUICK_REACTIONS.slice(0, 6).map((e) => ({ label: `React ${e}`, onPress: () => react(menu, e) })),
        { label: 'Reply', icon: 'reply', onPress: () => setReply(menu) },
        { label: 'Copy text', icon: 'content_copy', hidden: !menu.body, onPress: async () => { await Clipboard.setStringAsync(menu.body ?? ''); toast('Copied'); } },
        { label: 'Edit', icon: 'edit', hidden: menu.sender !== me || menu.kind !== 'text', onPress: () => { setEditing(menu); setText(menu.body ?? ''); } },
        { label: 'Delete for everyone', icon: 'delete', danger: true, hidden: menu.sender !== me, onPress: () => del(menu) },
      ] : []} />
    </KeyboardAvoidingView>
  );
}
