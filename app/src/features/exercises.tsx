import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { Sheet } from '@/components/sheet';
import { Button, Chip, Field, Icon, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { BODY_PARTS, builtIn, byRef, EQUIPMENT, isLink, search, titleCase, youTubeThumb, type LibExercise } from '@/lib/library';
import { errText, type MyExercise, type SetMetric, type Workout } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { F, R, usePalette } from '@/lib/theme';

const MEDIA = 'coach-media';

/** The trainer's own exercises (coach_exercises), shaped like library exercises */
export function toLib(m: MyExercise): LibExercise {
  const thumb = youTubeThumb(m.video_url);
  return { ref: `my:${m.id}`, name: m.name, category: m.default_metric === 'time' ? 'stretching' : 'strength', equipment: m.equipment[0] ?? 'other',
    primary: m.muscles, secondary: [], level: '', mechanic: '', steps: m.instructions ? m.instructions.split('\n').filter(Boolean) : [],
    images: thumb ? [thumb] : [], video: m.video_url, mine: true };
}
export function useMyExercises(trainerId: string | undefined) {
  const [mine, setMine] = useState<LibExercise[]>([]);
  const reload = useCallback(async () => {
    if (!trainerId) return;
    const { data } = await sb.from('coach_exercises').select('*').eq('trainer_id', trainerId).eq('archived', false).order('name');
    setMine(((data as MyExercise[]) ?? []).map(toLib));
  }, [trainerId]);
  useEffect(() => { reload(); }, [reload]);
  return { mine, reload };
}

/** Square thumbnail: the exercise's start image, a video frame, or an icon. Shows a play badge when there's a video. */
export function ExerciseThumb({ img, video, size = 64 }: { img?: string | null; video?: string | null; size?: number }) {
  const p = usePalette();
  const src = img ?? youTubeThumb(video);
  return (
    <View style={{ width: size, height: size, borderRadius: R.sm, overflow: 'hidden', backgroundColor: p.soft, alignItems: 'center', justifyContent: 'center' }}>
      {src ? <Image source={{ uri: src }} style={{ width: size, height: size }} contentFit="cover" transition={120} accessibilityIgnoresInvertColors />
        : <Icon name="fitness_center" size={size * 0.42} color={p.muted} />}
      {video ? (
        <View style={{ position: 'absolute', width: size * 0.4, height: size * 0.4, borderRadius: size, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="play_arrow" size={size * 0.28} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

/** Signed link for a demo video stored in coach-media */
export async function mediaUrl(path: string): Promise<string | null> {
  const { data } = await sb.storage.from(MEDIA).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

function StoredVideo({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { mediaUrl(path).then(setUrl); }, [path]);
  const player = useVideoPlayer(url ? { uri: url } : null, (pl) => { pl.loop = true; });
  if (!url) return <ActivityIndicator style={{ marginVertical: 30 }} />;
  return <VideoView player={player} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: R.sm }} nativeControls contentFit="contain" />;
}

/** Exercise details: start and end images, demo video, how-to steps. */
export function ExerciseInfo({ ex, onClose }: { ex: { name: string; ref?: string; img?: string | null; video?: string | null } | null; onClose: () => void }) {
  const p = usePalette();
  const app = useApp();
  const { mine } = useMyExercises(app.mode === 'coach' ? app.trainer?.user_id : undefined);
  const full = ex?.ref ? byRef(ex.ref, mine) : undefined;
  const images = full?.images.length ? full.images : ex?.img ? [ex.img] : [];
  const video = full?.video ?? ex?.video ?? null;
  return (
    <Sheet visible={!!ex} onClose={onClose} title={ex?.name ?? ''}>
      {video && !isLink(video) && <StoredVideo path={video} />}
      {video && isLink(video) && <Button title="Watch the demo video" icon="play_arrow" style={{ alignSelf: 'flex-start', marginBottom: 12 }}
        onPress={() => (Platform.OS === 'web' ? window.open(video, '_blank', 'noopener') : WebBrowser.openBrowserAsync(video))} />}
      {images.length > 0 && !youTubeThumb(video) && (
        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
          {images.map((src, i) => (
            <View key={src} style={{ flex: 1, gap: 4 }}>
              <Image source={{ uri: src }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: R.sm, backgroundColor: p.soft }} contentFit="cover" accessibilityLabel={`${ex?.name}, ${i === 0 ? 'start' : 'finish'} position`} />
              {images.length > 1 && <Txt v="small" center>{i === 0 ? 'Start' : 'Finish'}</Txt>}
            </View>
          ))}
        </View>
      )}
      {full && (
        <Txt v="small" style={{ marginBottom: 8 }}>{[full.primary.map(titleCase).join(', '), titleCase(full.equipment), full.level && titleCase(full.level)].filter(Boolean).join(' · ')}</Txt>
      )}
      {(full?.steps ?? []).map((s, i) => <Txt key={i} style={{ marginBottom: 8 }}>{i + 1}. {s}</Txt>)}
    </Sheet>
  );
}

type Tab = 'search' | 'part' | 'equipment' | 'recent' | 'favorites' | 'mine';

/** Exercise search: by name, body part, equipment, recently used, favorites, or the trainer's own. Pick one or many. */
export function ExercisePicker({ visible, onClose, onPick, single, title = 'Add exercises' }: {
  visible: boolean; onClose: () => void; onPick: (ex: LibExercise[]) => void; single?: boolean; title?: string;
}) {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const trainerId = app.trainer?.user_id;
  const { mine, reload } = useMyExercises(trainerId);
  const [tab, setTab] = useState<Tab>('search');
  const [q, setQ] = useState('');
  const [part, setPart] = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [recent, setRecent] = useState<string[]>([]);
  const [info, setInfo] = useState<LibExercise | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!visible || !trainerId) return;
    setPicked([]);
    sb.from('coach_exercise_favorites').select('ref').then(({ data }) => setFavs(new Set((data ?? []).map((r) => r.ref))));
    sb.from('coach_workouts').select('blocks').order('updated_at', { ascending: false }).limit(30).then(({ data }) => {
      const seen: string[] = [];
      for (const w of (data as Pick<Workout, 'blocks'>[]) ?? []) for (const b of w.blocks) if (b.kind === 'exercise') {
        const r = `${b.ex.src}:${b.ex.id}`; if (!seen.includes(r)) seen.push(r);
      }
      setRecent(seen.slice(0, 60));
    });
  }, [visible, trainerId]);

  const all = useMemo(() => [...mine, ...builtIn()], [mine]);
  const list = useMemo(() => {
    if (tab === 'recent') return recent.map((r) => byRef(r, mine)).filter(Boolean).filter((e) => search([e!], { q })[0]) as LibExercise[];
    if (tab === 'favorites') return search(all.filter((e) => favs.has(e.ref)), { q });
    if (tab === 'mine') return search(mine, { q });
    return search(all, { q, part: tab === 'part' ? part : null, equipment: tab === 'equipment' ? equip : null }).slice(0, 300);
  }, [tab, q, part, equip, all, mine, favs, recent]);

  const toggleFav = async (e: LibExercise) => {
    const on = favs.has(e.ref);
    setFavs((s) => { const n = new Set(s); if (on) n.delete(e.ref); else n.add(e.ref); return n; });
    const { error } = on ? await sb.from('coach_exercise_favorites').delete().eq('ref', e.ref)
      : await sb.from('coach_exercise_favorites').insert({ trainer_id: trainerId, ref: e.ref });
    if (error) toast(errText(error), false);
  };
  const choose = (e: LibExercise) => {
    if (single) { onPick([e]); onClose(); return; }
    setPicked((x) => (x.includes(e.ref) ? x.filter((r) => r !== e.ref) : [...x, e.ref]));
  };
  const showFilterChips = (tab === 'part' && !part) || (tab === 'equipment' && !equip);

  return (
    <Sheet visible={visible} onClose={onClose} title={title} full>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {([['search', 'Search'], ['part', 'Body part'], ['equipment', 'Equipment'], ['recent', 'Recent'], ['favorites', 'Favorites'], ['mine', 'My exercises']] as [Tab, string][])
            .map(([k, l]) => <Chip key={k} label={l} selected={tab === k} onPress={() => setTab(k)} />)}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: R.pill, paddingHorizontal: 14, height: 46 }}>
          <Icon name="search" size={20} color={p.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search exercises" placeholderTextColor={p.muted} accessibilityLabel="Search exercises"
            autoCorrect={false} style={{ flex: 1, fontFamily: F.body, fontSize: 16, color: p.ink, height: 44 }} />
          {q ? <Pressable accessibilityLabel="Clear search" onPress={() => setQ('')} hitSlop={8}><Icon name="close" size={18} color={p.muted} /></Pressable> : null}
        </View>
        {tab === 'part' && part && <Chip label={`${BODY_PARTS.find((b) => b.key === part)?.label} ✕`} selected onPress={() => setPart(null)} />}
        {tab === 'equipment' && equip && <Chip label={`${titleCase(equip)} ✕`} selected onPress={() => setEquip(null)} />}
        {tab === 'mine' && <Button small kind="ghost" icon="add" title="Create an exercise" style={{ alignSelf: 'flex-start' }} onPress={() => setCreating(true)} />}
      </View>

      {showFilterChips ? (
        <ScrollView contentContainerStyle={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tab === 'part'
            ? BODY_PARTS.map((b) => <Chip key={b.key} label={b.label} onPress={() => setPart(b.key)} />)
            : EQUIPMENT.map((e) => <Chip key={e} label={titleCase(e)} onPress={() => setEquip(e)} />)}
        </ScrollView>
      ) : (
        <FlatList data={list} keyExtractor={(e) => e.ref} keyboardShouldPersistTaps="handled" initialNumToRender={14}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={<Txt v="small" center style={{ marginTop: 30 }}>
            {tab === 'favorites' ? 'Tap the star on any exercise to keep it here.' : tab === 'recent' ? 'Exercises you use in workouts show up here.' : tab === 'mine' ? 'Create your own exercises, like your TRX moves, with your own demo videos.' : 'No exercises match.'}
          </Txt>}
          renderItem={({ item: e }) => {
            const on = picked.includes(e.ref);
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: p.line }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${e.name} details`} onPress={() => setInfo(e)}><ExerciseThumb img={e.images[0]} video={e.video} size={56} /></Pressable>
                <Pressable accessibilityRole={single ? 'button' : 'checkbox'} accessibilityState={{ checked: on }} onPress={() => choose(e)} style={{ flex: 1, gap: 2 }}>
                  <Txt v="bold">{e.name}</Txt>
                  <Txt v="small" numberOfLines={1}>{[e.primary.map(titleCase).join(', '), titleCase(e.equipment)].filter(Boolean).join(' · ')}</Txt>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={favs.has(e.ref) ? 'Remove from favorites' : 'Add to favorites'} onPress={() => toggleFav(e)} hitSlop={8}>
                  <Icon name={favs.has(e.ref) ? 'star' : 'star_outline'} size={24} color={favs.has(e.ref) ? p.gold : p.muted} />
                </Pressable>
                {!single && (
                  <Pressable onPress={() => choose(e)} accessibilityLabel={`Select ${e.name}`} hitSlop={8}
                    style={{ width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: on ? p.focus : p.muted, backgroundColor: on ? p.focus : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on && <Icon name="check" size={18} color={p.onAccent} />}
                  </Pressable>
                )}
              </View>
            );
          }} />
      )}
      {!single && picked.length > 0 && (
        <View style={{ position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center' }}>
          <Button kind="accent" title={`Add ${picked.length} exercise${picked.length === 1 ? '' : 's'}`} onPress={() => {
            onPick(picked.map((r) => byRef(r, mine)).filter(Boolean) as LibExercise[]); onClose();
          }} />
        </View>
      )}
      <ExerciseInfo ex={info ? { name: info.name, ref: info.ref, img: info.images[0], video: info.video } : null} onClose={() => setInfo(null)} />
      <MyExerciseEditor visible={creating} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />
    </Sheet>
  );
}

const MUSCLE_CHOICES = ['chest', 'lats', 'middle back', 'lower back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'abdominals', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'];

/** Create or edit one of the trainer's own exercises, with a demo video link or an uploaded video. */
export function MyExerciseEditor({ visible, onClose, onSaved, initial }: { visible: boolean; onClose: () => void; onSaved: () => void; initial?: MyExercise }) {
  const toast = useToast();
  const app = useApp();
  const [name, setName] = useState(initial?.name ?? '');
  const [muscles, setMuscles] = useState<string[]>(initial?.muscles ?? []);
  const [equipment, setEquipment] = useState(initial?.equipment[0] ?? 'suspension trainer');
  const [metric, setMetric] = useState<SetMetric>(initial?.default_metric ?? 'reps');
  const [steps, setSteps] = useState(initial?.instructions ?? '');
  const [video, setVideo] = useState(initial?.video_url ?? '');
  const [busy, setBusy] = useState<string | null>(null);

  const upload = async () => {
    setBusy('upload');
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: 180, quality: 1 });
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      if (a.fileSize && a.fileSize > 100 * 1024 * 1024) throw new Error('That video is over 100 MB. Trim it or record a shorter one.');
      const ext = (a.fileName?.match(/\.(\w+)$/)?.[1] ?? 'mp4').toLowerCase();
      const path = `${app.trainer!.user_id}/exercises/${Date.now().toString(36)}.${ext}`;
      const bytes = Platform.OS === 'web' ? await (await fetch(a.uri)).arrayBuffer() : await new (await import('expo-file-system')).File(a.uri).arrayBuffer();
      const { error } = await sb.storage.from(MEDIA).upload(path, bytes, { contentType: a.mimeType ?? 'video/mp4' });
      if (error) throw error;
      setVideo(path); toast('Video uploaded');
    } catch (e) { toast(errText(e), false); } finally { setBusy(null); }
  };
  const save = async () => {
    if (!name.trim()) return toast('Name the exercise', false);
    if (video && isLink(video) && !/^https:\/\//i.test(video)) return toast('Use an https link for the video', false);
    setBusy('save');
    const row = { trainer_id: app.trainer!.user_id, name: name.trim(), muscles, equipment: [equipment], default_metric: metric, instructions: steps.trim() || null, video_url: video.trim() || null };
    const { error } = initial ? await sb.from('coach_exercises').update(row).eq('id', initial.id) : await sb.from('coach_exercises').insert(row);
    setBusy(null);
    if (error) return toast(errText(error), false);
    toast('Exercise saved'); onSaved();
    if (!initial) { setName(''); setMuscles([]); setSteps(''); setVideo(''); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={initial ? 'Edit exercise' : 'New exercise'}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="TRX Atomic Push-Up" />
      <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Main muscles</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {MUSCLE_CHOICES.map((m) => <Chip key={m} label={titleCase(m)} selected={muscles.includes(m)} onPress={() => setMuscles((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]))} />)}
      </View>
      <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Equipment</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {EQUIPMENT.map((e) => <Chip key={e} label={titleCase(e)} selected={equipment === e} onPress={() => setEquipment(e)} />)}
      </View>
      <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Measured by</Txt>
      <View style={{ marginBottom: 16 }}><Segmented<SetMetric> value={metric} onChange={setMetric} options={[['reps', 'Reps'], ['time', 'Time'], ['distance', 'Distance']]} /></View>
      <Field label="How to do it" hint="(one step per line)" value={steps} onChangeText={setSteps} multiline />
      <Field label="Demo video link" hint="(YouTube or any https link)" value={isLink(video) ? video : ''} onChangeText={setVideo} autoCapitalize="none" placeholder="https://youtu.be/…" />
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <Button kind="ghost" small icon="video_library" title={video && !isLink(video) ? 'Replace uploaded video' : 'Or upload a video'} busy={busy === 'upload'} onPress={upload} />
        {video && !isLink(video) ? <Txt v="small">Video uploaded</Txt> : null}
      </View>
      <Button title="Save exercise" busy={busy === 'save'} onPress={save} style={{ alignSelf: 'flex-start' }} />
    </Sheet>
  );
}
