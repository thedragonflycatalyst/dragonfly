import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Initials } from '@/components/bits';
import { ActionMenu, Sheet } from '@/components/sheet';
import { Button, Card, Empty, Icon, Txt, useToast } from '@/components/ui';
import { confirm } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { listTime } from '@/lib/chat';
import { pickPhoto } from '@/lib/files';
import { errText } from '@/lib/model';
import { socialUrls, uploadSocial } from '@/lib/social';
import { sb } from '@/lib/supabase';
import { F, MAX_W, R, usePalette } from '@/lib/theme';
import { CommunitySheet, type Community } from './index';

type Post = { id: string; community_id: string; author: string; author_name: string; body: string; image_path: string | null; pinned: boolean; comments: number; created_at: string; edited_at: string | null };
type Comment = { id: string; post_id: string; author: string; author_name: string; body: string; created_at: string };
type React = { post_id: string; user_id: string; emoji: string };
const EMOJIS = ['❤️', '🔥', '💪', '👏', '🎉'];

/** A community's feed: posts with photos, reactions and comments; the trainer pins and moderates */
export default function CommunityFeed() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const me = app.user?.id ?? '';
  const { id } = useLocalSearchParams<{ id: string }>();
  const [c, setC] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [reacts, setReacts] = useState<React[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<Post | null>(null);
  const [thread, setThread] = useState<Post | null>(null);
  const [settings, setSettings] = useState(false);
  const owner = !!c && app.mode === 'coach' && c.trainer_id === app.trainer?.user_id;

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([sb.from('coach_communities').select('*').eq('id', id).maybeSingle(), sb.from('coach_posts').select('*').eq('community_id', id).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(100)]);
    setC((a.data as Community) ?? null);
    const ps = (b.data as Post[]) ?? [];
    setPosts(ps);
    if (ps.length) {
      const { data } = await sb.from('coach_post_reactions').select('post_id, user_id, emoji').in('post_id', ps.map((x) => x.id));
      setReacts((data as React[]) ?? []);
      setUrls(await socialUrls(ps.map((x) => x.image_path).filter(Boolean) as string[]));
    }
    if (app.mode === 'coach') { const { data } = await sb.from('coach_community_members').select('client_id').eq('community_id', id); setMembers((data ?? []).map((m) => m.client_id)); }
  }, [id, app.mode]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const post = async () => {
    if (!text.trim()) return toast('Write something first', false);
    setBusy(true);
    try {
      const image_path = photo ? await uploadSocial('community', id, photo, 'image/jpeg', 'jpg') : null;
      const { error } = await sb.from('coach_posts').insert({ community_id: id, body: text.trim(), image_path });
      if (error) throw error;
      setText(''); setPhoto(null); load();
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  const react = async (x: Post, e: string) => {
    const mine = reacts.some((r) => r.post_id === x.id && r.user_id === me && r.emoji === e);
    setReacts((rs) => (mine ? rs.filter((r) => !(r.post_id === x.id && r.user_id === me && r.emoji === e)) : [...rs, { post_id: x.id, user_id: me, emoji: e }]));
    const { error } = mine ? await sb.from('coach_post_reactions').delete().match({ post_id: x.id, user_id: me, emoji: e }) : await sb.from('coach_post_reactions').insert({ post_id: x.id, emoji: e });
    if (error) { toast(errText(error), false); load(); }
  };
  if (posts === null) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  if (!c) return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="🔒" title="Community not found" body="It may have been archived, or you’re no longer a member." /></View>;
  const canPost = owner || c.clients_can_post;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: c.name, headerRight: owner ? () => <Pressable accessibilityRole="button" accessibilityLabel="Community settings" onPress={() => setSettings(true)} hitSlop={10}><Icon name="settings" /></Pressable> : undefined }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 720, gap: 12 }}>
          {c.description ? <Txt v="small">{c.description}</Txt> : null}
          {canPost && (
            <Card style={{ gap: 10 }}>
              <TextInput value={text} onChangeText={setText} placeholder={owner ? 'Post an update or a challenge…' : 'Share a win, ask a question…'} placeholderTextColor={p.muted} multiline
                accessibilityLabel="Write a post" style={{ minHeight: 70, fontFamily: F.body, fontSize: 16, color: p.ink, textAlignVertical: 'top' }} />
              {photo && <View><Image source={{ uri: photo }} style={{ width: '100%', aspectRatio: 1.4, borderRadius: R.sm }} contentFit="cover" />
                <Pressable onPress={() => setPhoto(null)} accessibilityLabel="Remove photo" style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#0009', borderRadius: 16, padding: 4 }}><Icon name="close" size={20} color="#fff" /></Pressable></View>}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Button small kind="ghost" icon="photo_library" title="Photo" onPress={async () => { try { const u = await pickPhoto('library'); if (u) setPhoto(u); } catch (e) { toast(errText(e), false); } }} />
                <Button small title="Post" icon="send" busy={busy} onPress={post} />
              </View>
            </Card>
          )}
          {posts.length === 0 ? <Empty emoji="🌟" title="No posts yet" body={canPost ? 'Be the first: introduce yourself or share this week’s challenge.' : 'Your trainer’s posts will show here.'} /> : posts.map((x) => {
            const counts = EMOJIS.map((e) => ({ e, n: reacts.filter((r) => r.post_id === x.id && r.emoji === e).length, mine: reacts.some((r) => r.post_id === x.id && r.emoji === e && r.user_id === me) }));
            return (
              <Card key={x.id} style={{ gap: 10, borderWidth: x.pinned ? 1.5 : 0, borderColor: p.gold }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Initials name={x.author_name} size={36} />
                  <View style={{ flex: 1 }}>
                    <Txt v="bold">{x.author_name}{x.author === c.trainer_id ? ' · Coach' : ''}</Txt>
                    <Txt v="small">{x.pinned ? '📌 Pinned · ' : ''}{listTime(x.created_at)}{x.edited_at ? ' · edited' : ''}</Txt>
                  </View>
                  {(owner || x.author === me) && <Pressable accessibilityRole="button" accessibilityLabel="Post options" onPress={() => setMenu(x)} hitSlop={10}><Icon name="more_horiz" /></Pressable>}
                </View>
                <Txt>{x.body}</Txt>
                {x.image_path && urls[x.image_path] ? <Image source={{ uri: urls[x.image_path] }} style={{ width: '100%', aspectRatio: 1.3, borderRadius: R.sm }} contentFit="cover" accessibilityLabel="Photo in post" /> : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {counts.map(({ e, n, mine }) => (
                    <Pressable key={e} onPress={() => react(x, e)} accessibilityRole="button" accessibilityLabel={`React ${e}${n ? `, ${n}` : ''}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 32, borderRadius: R.pill, borderWidth: 1, borderColor: mine ? p.focus : p.line, backgroundColor: mine ? p.soft : 'transparent' }}>
                      <Text style={{ fontSize: 16 }}>{e}</Text>{n ? <Txt v="smallBold">{n}</Txt> : null}
                    </Pressable>
                  ))}
                  <Pressable onPress={() => setThread(x)} accessibilityRole="button" style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 }}>
                    <Icon name="chat_bubble" size={18} color={p.muted} /><Txt v="small">{x.comments ? `${x.comments} comment${x.comments === 1 ? '' : 's'}` : 'Comment'}</Txt>
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
      <ActionMenu visible={!!menu} onClose={() => setMenu(null)} title="Post" items={menu ? [
        { label: menu.pinned ? 'Unpin' : 'Pin to top', icon: 'push_pin', hidden: !owner, onPress: async () => { const { error } = await sb.from('coach_posts').update({ pinned: !menu.pinned }).eq('id', menu.id); if (error) toast(errText(error), false); load(); } },
        { label: 'Delete post', icon: 'delete', danger: true, onPress: async () => { if (!(await confirm('Delete this post?', undefined, 'Delete', true))) return; await sb.from('coach_posts').delete().eq('id', menu.id); load(); } },
      ] : []} />
      <Comments post={thread} onClose={() => { setThread(null); load(); }} owner={owner} me={me} />
      {owner && <CommunitySheet visible={settings} onClose={() => setSettings(false)} initial={c} members={members} onSaved={() => { setSettings(false); load(); }} />}
      {owner && <ArchiveHint c={c} onDone={() => router.back()} />}
    </View>
  );
}

function ArchiveHint({ c, onDone }: { c: Community; onDone: () => void }) {
  const toast = useToast();
  return (
    <View style={{ position: 'absolute', bottom: 12, right: 12 }}>
      <Button small kind="quiet" icon="archive" title={c.archived ? 'Restore' : 'Archive'} onPress={async () => {
        if (!c.archived && !(await confirm(`Archive ${c.name}?`, 'Members won’t see it any more. You can restore it later.', 'Archive'))) return;
        const { error } = await sb.from('coach_communities').update({ archived: !c.archived }).eq('id', c.id);
        if (error) toast(errText(error), false); else onDone();
      }} />
    </View>
  );
}

function Comments({ post, onClose, owner, me }: { post: Post | null; onClose: () => void; owner: boolean; me: string }) {
  const p = usePalette();
  const toast = useToast();
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState('');
  const [seen, setSeen] = useState<string | null>(null);
  const load = useCallback(async (pid: string) => {
    const { data } = await sb.from('coach_post_comments').select('*').eq('post_id', pid).order('created_at');
    setList((data as Comment[]) ?? []);
  }, []);
  if ((post?.id ?? null) !== seen) { setSeen(post?.id ?? null); setList(null); if (post) load(post.id); }
  const send = async () => {
    if (!post || !text.trim()) return;
    const { error } = await sb.from('coach_post_comments').insert({ post_id: post.id, body: text.trim() });
    if (error) return toast(errText(error), false);
    setText(''); load(post.id);
  };
  return (
    <Sheet visible={!!post} onClose={onClose} title="Comments">
      {list === null ? <ActivityIndicator color={p.ink} /> : list.length === 0 ? <Txt v="small">No comments yet.</Txt> : list.map((x) => (
        <View key={x.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8 }}>
          <Initials name={x.author_name} size={30} />
          <View style={{ flex: 1 }}><Txt v="smallBold">{x.author_name} <Txt v="small">· {listTime(x.created_at)}</Txt></Txt><Txt>{x.body}</Txt></View>
          {(owner || x.author === me) && <Pressable accessibilityRole="button" accessibilityLabel="Delete comment" hitSlop={8} onPress={async () => { await sb.from('coach_post_comments').delete().eq('id', x.id); if (post) load(post.id); }}><Icon name="delete" size={18} color={p.muted} /></Pressable>}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <TextInput value={text} onChangeText={setText} placeholder="Add a comment" placeholderTextColor={p.muted} onSubmitEditing={send} accessibilityLabel="Add a comment"
          style={{ flex: 1, minHeight: 46, borderWidth: 1.5, borderColor: p.line, borderRadius: R.pill, paddingHorizontal: 14, fontFamily: F.body, fontSize: 16, color: p.ink, backgroundColor: p.surface }} />
        <Button icon="send" onPress={send} />
      </View>
    </Sheet>
  );
}
