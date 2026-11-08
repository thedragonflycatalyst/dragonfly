import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { Button, Card, Chip, Empty, Txt, useToast } from '@/components/ui';
import { ask } from '@/lib/ask';
import { fromKey } from '@/lib/dates';
import { pickPhoto, removeStored, signedUrls, uploadPhoto } from '@/lib/files';
import { errText, type Photo, type Pose } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { R, usePalette } from '@/lib/theme';
import type { SectionProps } from './common';

const POSES: [Pose, string][] = [['front', 'Front'], ['side', 'Side'], ['back', 'Back'], ['other', 'Other']];
const fmtDate = (k: string) => fromKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** Progress photos: take or upload, filter by pose, and compare two side by side (before and after). */
export function Photos({ client, role, me }: SectionProps) {
  const p = usePalette();
  const toast = useToast();
  const [rows, setRows] = useState<Photo[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pose, setPose] = useState<Pose>('front');
  const [filter, setFilter] = useState<Pose | 'all'>('all');
  const [compare, setCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb.from('coach_photos').select('*').eq('client_id', client.id).order('taken_on', { ascending: false }).order('created_at', { ascending: false });
    const list = (data as Photo[]) ?? [];
    setRows(list); setUrls(await signedUrls(list.map((r) => r.path)));
  }, [client.id]);
  useEffect(() => { load(); }, [load]);

  const add = async (source: 'camera' | 'library') => {
    setBusy(true);
    try {
      const local = await pickPhoto(source);
      if (!local) return;
      const path = await uploadPhoto(client, local);
      const { error } = await sb.from('coach_photos').insert({ client_id: client.id, trainer_id: client.trainer_id, pose, path });
      if (error) { await removeStored([path]); throw error; }
      toast('Photo saved'); load();
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  const del = (r: Photo) => ask('Delete this photo?', 'This can’t be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
    const { error } = await sb.from('coach_photos').delete().eq('id', r.id);
    if (error) return toast(errText(error), false);
    await removeStored([r.path]); setCompare((c) => c.filter((x) => x !== r.id)); load();
  } }]);

  const shown = (rows ?? []).filter((r) => filter === 'all' || r.pose === filter);
  const pair = compare.map((id) => rows?.find((r) => r.id === id)).filter(Boolean) as Photo[];
  pair.sort((a, b) => a.taken_on.localeCompare(b.taken_on));

  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 10 }}>
        <Txt v="h3">Add a photo</Txt>
        <Txt v="small">Same pose, light and spot each time makes changes easy to see. {role === 'client' ? 'Only you and your trainer can see these.' : 'Only you and your client can see these.'}</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{POSES.map(([k, l]) => <Chip key={k} label={l} selected={pose === k} onPress={() => setPose(k)} />)}</View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {Platform.OS !== 'web' && <Button title="Take photo" icon="photo_camera" busy={busy} onPress={() => add('camera')} />}
          <Button kind={Platform.OS === 'web' ? 'solid' : 'ghost'} title="Choose photo" icon="image" busy={busy && Platform.OS === 'web'} onPress={() => add('library')} />
        </View>
      </Card>

      {rows && rows.length > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Segmented value={filter} onChange={setFilter} options={[['all', 'All'], ...POSES]} />
          <Button small kind={comparing ? 'solid' : 'quiet'} title={comparing ? 'Done comparing' : 'Compare two'} onPress={() => { setComparing(!comparing); setCompare([]); }} />
        </View>
      )}
      {comparing && <Txt v="small">{pair.length < 2 ? `Tap ${2 - pair.length} photo${pair.length ? '' : 's'} to compare.` : 'Before and after:'}</Txt>}
      {comparing && pair.length === 2 && (
        <Card style={{ flexDirection: 'row', gap: 10 }}>
          {pair.map((r) => (
            <View key={r.id} style={{ flex: 1, gap: 6 }}>
              <Image source={{ uri: urls[r.path] }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: R.sm, backgroundColor: p.soft }} contentFit="cover" accessibilityLabel={`${r.pose} photo from ${fmtDate(r.taken_on)}`} />
              <Txt v="smallBold" center>{fmtDate(r.taken_on)}</Txt>
            </View>
          ))}
        </Card>
      )}

      {rows && rows.length === 0 && <Empty emoji="📸" title="No photos yet" body="Add a front, side and back photo to start. Later photos can be compared side by side." />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {shown.map((r) => {
          const picked = compare.includes(r.id);
          return (
            <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`${r.pose} photo from ${fmtDate(r.taken_on)}${picked ? ', selected' : ''}`}
              onPress={() => comparing ? setCompare((c) => picked ? c.filter((x) => x !== r.id) : [...c, r.id].slice(-2)) : undefined}
              onLongPress={() => (role === 'coach' || r.uploaded_by === me) && del(r)}
              style={{ width: 150, flexGrow: 1, maxWidth: 220, gap: 4 }}>
              <Image source={{ uri: urls[r.path] }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: R.sm, backgroundColor: p.soft, borderWidth: picked ? 3 : 0, borderColor: p.focus }} contentFit="cover" accessibilityLabel="" accessible={false} />
              <Txt v="small">{fmtDate(r.taken_on)} · {r.pose}</Txt>
              {!comparing && (role === 'coach' || r.uploaded_by === me) && <Button small kind="quiet" title="Delete" onPress={() => del(r)} style={{ alignSelf: 'flex-start' }} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
