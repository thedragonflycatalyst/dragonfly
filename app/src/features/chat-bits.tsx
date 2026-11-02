import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Icon, Txt } from '@/components/ui';
import { bigEmoji, EMOJI, linkify, type Message } from '@/lib/chat';
import { fmtSize } from '@/lib/files';
import { F, R, usePalette } from '@/lib/theme';

const GIPHY = (Constants.expoConfig?.extra as { giphyKey?: string } | undefined)?.giphyKey ?? '';

/** The inside of one message bubble: text with links, photo, video, voice note, file, GIF or shared workout */
export function MessageBody({ m, url, mine }: { m: Message; url?: string; mine: boolean }) {
  const p = usePalette();
  const [zoom, setZoom] = useState(false);
  const fg = mine ? p.onAccent : p.ink;
  if (m.deleted_at) return <Txt v="small" color={mine ? p.onAccent : p.muted} style={{ fontStyle: 'italic' }}>Message deleted</Txt>;
  const caption = m.body && m.kind !== 'text' ? <Txt color={fg} style={{ marginTop: 6 }}>{m.body}</Txt> : null;
  switch (m.kind) {
    case 'image': case 'gif': {
      const src = m.kind === 'gif' && m.meta.url ? m.meta.url : url;
      const ratio = m.meta.w && m.meta.h ? Math.max(0.6, Math.min(1.8, m.meta.w / m.meta.h)) : 1.2;
      return (
        <View>
          {src ? <Pressable onPress={() => setZoom(true)} accessibilityRole="imagebutton" accessibilityLabel={m.kind === 'gif' ? 'GIF' : 'Photo'}>
            <Image source={{ uri: src }} style={{ width: 230, aspectRatio: ratio, borderRadius: R.sm }} contentFit="cover" autoplay />
          </Pressable> : <View style={{ width: 230, aspectRatio: ratio, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>}
          {caption}
          <Modal visible={zoom} transparent onRequestClose={() => setZoom(false)}>
            <Pressable onPress={() => setZoom(false)} style={{ flex: 1, backgroundColor: '#000e', alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Close">
              {src ? <Image source={{ uri: src }} style={{ width: '100%', height: '85%' }} contentFit="contain" autoplay /> : null}
            </Pressable>
          </Modal>
        </View>
      );
    }
    case 'video': return <View>{url ? <ChatVideo url={url} /> : <ActivityIndicator />}{caption}</View>;
    case 'audio': return url ? <VoiceNote url={url} secs={m.meta.secs} mine={mine} /> : <ActivityIndicator />;
    case 'file':
      return (
        <Pressable onPress={() => url && Linking.openURL(url)} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 260 }}>
          <Icon name="description" size={30} color={fg} />
          <View style={{ flexShrink: 1 }}><Txt v="bold" color={fg} numberOfLines={2}>{m.meta.name ?? 'File'}</Txt><Txt v="small" color={mine ? p.onAccent : p.muted}>{fmtSize(m.meta.size ?? null)}{m.meta.size ? ' · ' : ''}Tap to open</Txt></View>
        </Pressable>
      );
    case 'workout':
      return (
        <View style={{ gap: 6 }}>
          <Pressable onPress={() => m.meta.assignment_id && router.push({ pathname: '/workout/[aid]', params: { aid: m.meta.assignment_id } })} accessibilityRole="link"
            style={{ borderLeftWidth: 4, borderLeftColor: mine ? p.onAccent : p.focus, backgroundColor: mine ? '#ffffff22' : p.soft, borderRadius: R.sm, padding: 10 }}>
            <Txt v="small" color={fg}>{m.meta.date ? new Date(m.meta.date).toLocaleString(undefined, { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</Txt>
            <Txt v="bold" color={fg}>💪 {m.meta.title ?? 'Workout'} completed</Txt>
            {m.meta.summary ? <Txt v="small" color={fg}>{m.meta.summary}</Txt> : null}
          </Pressable>
          {m.body ? <Txt color={fg}>{m.body}</Txt> : null}
        </View>
      );
    default: {
      if (bigEmoji(m.body)) return <Text style={{ fontSize: 42, lineHeight: 50 }}>{m.body}</Text>;
      const text = <Text style={{ fontFamily: F.body, fontSize: 16, lineHeight: 23, color: fg }}>{linkify(m.body ?? '').map((part, i) => part.url
        ? <Text key={i} style={{ textDecorationLine: 'underline' }} onPress={() => Linking.openURL(part.url!)}>{part.text}</Text> : part.text)}</Text>;
      return m.meta.via ? <View>{text}<Txt v="small" color={mine ? p.onAccent : p.muted} style={{ marginTop: 4, opacity: 0.85 }}>Sent by {m.meta.via === 'whatsapp' ? 'WhatsApp' : 'text message'}</Txt></View> : text;
    }
  }
}

function ChatVideo({ url }: { url: string }) {
  const player = useVideoPlayer({ uri: url });
  return <VideoView player={player} style={{ width: 240, aspectRatio: 9 / 12, borderRadius: R.sm, backgroundColor: '#000' }} nativeControls contentFit="contain" />;
}

function VoiceNote({ url, secs, mine }: { url: string; secs?: number; mine: boolean }) {
  const p = usePalette();
  const player = useAudioPlayer({ uri: url });
  const st = useAudioPlayerStatus(player);
  const fg = mine ? p.onAccent : p.ink;
  const total = st.duration || secs || 0, pos = st.currentTime || 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  useEffect(() => { if (st.didJustFinish) player.seekTo(0); }, [st.didJustFinish, player]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: 210 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={st.playing ? 'Pause voice message' : 'Play voice message'} onPress={() => (st.playing ? player.pause() : player.play())}
        style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: mine ? '#ffffff33' : p.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={st.playing ? 'pause' : 'play_arrow'} size={22} color={fg} />
      </Pressable>
      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: mine ? '#ffffff44' : p.line }}>
        <View style={{ width: `${total ? Math.min(100, (pos / total) * 100) : 0}%`, height: 4, borderRadius: 2, backgroundColor: fg }} />
      </View>
      <Txt v="small" color={fg}>{fmt(st.playing || pos ? pos : total)}</Txt>
    </View>
  );
}

/** Emoji grid by category */
export function EmojiSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (e: string) => void }) {
  const p = usePalette();
  const [cat, setCat] = useState(0);
  return (
    <Sheet visible={visible} onClose={onClose} title="Emoji">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
        {EMOJI.map(([name, list], i) => (
          <Pressable key={name} onPress={() => setCat(i)} accessibilityRole="tab" accessibilityState={{ selected: cat === i }}
            style={{ paddingHorizontal: 12, height: 36, borderRadius: R.pill, justifyContent: 'center', backgroundColor: cat === i ? p.soft : 'transparent' }}>
            <Text style={{ fontSize: 18 }}>{list[0]} <Text style={{ fontFamily: F.body, fontSize: 14, color: p.ink }}>{name}</Text></Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {EMOJI[cat][1].map((e) => (
          <Pressable key={e} onPress={() => onPick(e)} accessibilityRole="button" accessibilityLabel={e} style={{ width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 28 }}>{e}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

type Gif = { id: string; url: string; still: string; w: number; h: number; title: string };
/** GIF search (GIPHY). Without a GIPHY key, explains how to send GIFs another way. */
export function GifSheet({ visible, onClose, onPick, onUpload }: { visible: boolean; onClose: () => void; onPick: (g: Gif) => void; onUpload: () => void }) {
  const p = usePalette();
  const [q, setQ] = useState('');
  const [list, setList] = useState<Gif[] | null>(null);
  useEffect(() => {
    if (!visible || !GIPHY) return;
    const t = setTimeout(async () => {
      try {
        const base = 'https://api.giphy.com/v1/gifs/';
        const res = await fetch(`${base}${q.trim() ? `search?q=${encodeURIComponent(q.trim())}&` : 'trending?'}api_key=${GIPHY}&limit=24&rating=pg-13`);
        const j = await res.json();
        setList((j.data ?? []).map((g: { id: string; title: string; images: Record<string, { url: string; width: string; height: string }> }) => ({
          id: g.id, title: g.title, url: g.images.downsized_medium?.url ?? g.images.original.url, still: g.images.fixed_width_small?.url ?? g.images.fixed_width.url,
          w: Number(g.images.original.width), h: Number(g.images.original.height) })));
      } catch { setList([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [q, visible]);
  return (
    <Sheet visible={visible} onClose={onClose} title="GIFs">
      {!GIPHY ? (
        <View style={{ gap: 10 }}>
          <Txt>GIF search is almost ready: it needs a free GIPHY key added to the app.</Txt>
          <Txt v="small">Meanwhile, send a GIF from your phone’s keyboard (most keyboards have a GIF button), or upload one you’ve saved.</Txt>
          <Button kind="ghost" icon="photo_library" title="Upload a GIF" onPress={() => { onClose(); setTimeout(onUpload, 80); }} />
        </View>
      ) : <>
        <TextInput value={q} onChangeText={setQ} placeholder="Search GIPHY" placeholderTextColor={p.muted} accessibilityLabel="Search GIFs"
          style={{ height: 46, borderWidth: 1.5, borderColor: p.line, borderRadius: R.pill, paddingHorizontal: 14, fontFamily: F.body, fontSize: 16, color: p.ink, backgroundColor: p.surface, marginBottom: 10 }} />
        {list === null ? <ActivityIndicator /> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {list.map((g) => (
              <Pressable key={g.id} onPress={() => onPick(g)} accessibilityRole="button" accessibilityLabel={g.title || 'GIF'} style={{ width: '31.5%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: p.soft }}>
                <Image source={{ uri: g.still }} style={{ width: '100%', height: '100%' }} contentFit="cover" autoplay />
              </Pressable>
            ))}
          </View>
        )}
        <Txt v="small" center style={{ marginTop: 8 }}>Powered by GIPHY</Txt>
      </>}
    </Sheet>
  );
}
