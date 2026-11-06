import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { Toggle } from '@/components/pickers';
import { Sheet } from '@/components/sheet';
import { Button, Chip, Field, Icon, Txt, useToast } from '@/components/ui';
import { coverUrl } from '@/components/cover';
import { useApp } from '@/lib/app-state';
import { BODY_PARTS, builtIn, byRef, EQUIPMENT, groupFamilies, isLink, MUSCLES, MY_CATEGORIES, search, titleCase, youTubeThumb, type LibExercise, type ListItem } from '@/lib/library';
import { errText, type MyExercise, type SetMetric, type Workout } from '@/lib/model';
import { MACHINES } from '@/data/machines';
import { findMachines, machineMatches, type MachineRead } from '@/lib/machine-match';
import { sb } from '@/lib/supabase';
import { F, R, usePalette } from '@/lib/theme';
import { REPORT_KINDS, reportExercise, reviewText, suggestExercise, useHidden, type ReportKind } from './library-extras';
import { MachineScanner, scanMachinePhoto } from './machine-scan';

const MEDIA = 'coach-media';

/** The trainer's own exercises (coach_exercises), shaped like library exercises */
export function toLib(m: MyExercise): LibExercise {
  const thumb = youTubeThumb(m.video_url);
  return { ref: `my:${m.id}`, name: m.name, category: m.category ?? 'strength', equipment: m.equipment[0] ?? 'other',
    primary: m.muscles, secondary: m.secondary_muscles ?? [], level: '', mechanic: '', steps: m.instructions ? m.instructions.split('\n').filter(Boolean) : [],
    images: m.image_path ? [`media:${m.image_path}`] : thumb ? [thumb] : [], video: m.video_url, mine: true, alts: m.alternatives ?? [], metric: m.default_metric };
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
  const [stored, setStored] = useState<string | null>(null);
  useEffect(() => { if (img?.startsWith('media:')) coverUrl(img.slice(6)).then(setStored); else setStored(null); }, [img]);
  const src = img?.startsWith('media:') ? stored : img ?? youTubeThumb(video);
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
              <AnyImage src={src} label={`${ex?.name}, ${i === 0 ? 'start' : 'finish'} position`} />
              {images.length > 1 && <Txt v="small" center>{i === 0 ? 'Start' : 'Finish'}</Txt>}
            </View>
          ))}
        </View>
      )}
      {full?.aliases?.length ? <Txt v="small" style={{ marginBottom: 8 }}>Also called: {full.aliases.join(', ')}</Txt> : null}
      {full && (
        <Txt v="small" style={{ marginBottom: 8 }}>{[full.primary.map(titleCase).join(', '), titleCase(full.equipment), full.level && titleCase(full.level)].filter(Boolean).join(' · ')}</Txt>
      )}
      {full?.secondary.length ? <Txt v="small" style={{ marginBottom: 8 }}>Also works: {full.secondary.map(titleCase).join(', ')}</Txt> : null}
      {full?.pattern ? <Txt v="small" style={{ marginBottom: 8 }}>{[full.category, full.kind, full.pattern].filter(Boolean).join(' · ')}</Txt> : null}
      {full?.how && ([['Setup', full.how.setup], ['Movement and return', full.how.move], ['Key cues', full.how.cues]] as const).filter(([, s]) => s).map(([h, s]) => (
        <View key={h} style={{ marginTop: 8 }}>
          <Txt v="bold" style={{ fontSize: 15, marginBottom: 4 }}>{h}</Txt>
          <Txt style={{ marginBottom: 4 }}>{s}</Txt>
        </View>
      ))}
      {(full?.steps ?? []).map((s, i) => <Txt key={i} style={{ marginBottom: 8 }}>{full?.mine ? s : `${i + 1}. ${s}`}</Txt>)}
      {ex?.ref?.startsWith('lib:') && <LibraryActions refId={ex.ref} name={ex.name} />}
    </Sheet>
  );
}

/** Report a library exercise for review, or hide it from your own lists */
function LibraryActions({ refId, name }: { refId: string; name: string }) {
  const p = usePalette();
  const toast = useToast();
  const [hidden, toggleHidden] = useHidden();
  const [reporting, setReporting] = useState(false);
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setReporting(false); setKind(null); setNote(''); }, [refId]);
  const isHidden = hidden.has(refId);
  const send = async () => {
    if (!kind) return toast('Choose what’s wrong', false);
    setBusy(true);
    try { await reportExercise(refId, name, kind, note); toast('Thanks, sent for review'); setReporting(false); setKind(null); setNote(''); }
    catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: p.line, marginTop: 16, paddingTop: 12, gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Button small kind="ghost" icon="flag" title="Report a problem" onPress={() => setReporting((r) => !r)} />
        <Button small kind="quiet" icon={isHidden ? 'visibility' : 'visibility_off'} title={isHidden ? 'Show in my lists again' : 'Hide from my lists'}
          onPress={() => toggleHidden(refId, !isHidden).then(() => toast(isHidden ? 'It’s back in your lists' : 'Hidden. Find it under Hidden in the exercise search to bring it back.'), (e: unknown) => toast(errText(e), false))} />
      </View>
      {reporting && (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {REPORT_KINDS.map(([k, l]) => <Chip key={k} label={l} selected={kind === k} onPress={() => setKind(k)} />)}
          </View>
          <Field label="Details" hint="(optional)" value={note} onChangeText={setNote} multiline
            placeholder={kind === 'redundant' ? 'Which exercise is it the same as?' : 'What’s wrong with it?'} />
          <Button small title="Send report" busy={busy} onPress={send} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}
    </View>
  );
}

/** A picture from a web address or from the trainer's media ("media:path") */
function AnyImage({ src, label }: { src: string; label: string }) {
  const p = usePalette();
  const [url, setUrl] = useState<string | null>(src.startsWith('media:') ? null : src);
  useEffect(() => { if (src.startsWith('media:')) coverUrl(src.slice(6)).then(setUrl); else setUrl(src); }, [src]);
  return <Image source={url ? { uri: url } : null} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: R.sm, backgroundColor: p.soft }} contentFit="cover" accessibilityLabel={label} />;
}

type Tab = 'search' | 'part' | 'equipment' | 'recent' | 'favorites' | 'mine' | 'hidden';

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
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<MachineRead | null>(null);
  const [hidden, toggleHidden] = useHidden();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) setScanned(null);
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

  const all = useMemo(() => [...mine, ...builtIn()], [mine, visible]); // reopening picks up new library additions
  const typedMachines = useMemo(() => (scanned || tab !== 'search' ? [] : findMachines(q)), [q, tab, scanned]);
  const scannedMachine = scanned?.id ? MACHINES.find((m) => m.id === scanned.id) : undefined;
  const fromScan = useMemo(() => (scanned ? machineMatches(scanned, all) : null), [scanned, all]);
  const list = useMemo(() => {
    if (tab === 'hidden') return search(all.filter((e) => hidden.has(e.ref)), { q });
    if (fromScan) return fromScan.list.filter((e) => !hidden.has(e.ref));
    if (tab === 'recent') return recent.map((r) => byRef(r, mine)).filter(Boolean).filter((e) => search([e!], { q })[0]) as LibExercise[];
    if (tab === 'favorites') return search(all.filter((e) => favs.has(e.ref)), { q });
    if (tab === 'mine') return search(mine, { q });
    return search(all, { q, part: tab === 'part' ? part : null, equipment: tab === 'equipment' ? equip : null }).slice(0, 300);
  }, [tab, q, part, equip, all, mine, favs, recent, fromScan, hidden]);
  // Search and body-part lists fold equipment versions of a move into one line (tap it to see them)
  const items = useMemo((): ListItem[] => {
    const shown = tab === 'hidden' ? list : list.filter((e) => !hidden.has(e.ref));
    return !fromScan && (tab === 'search' || tab === 'part') ? groupFamilies(shown) : shown.map((e) => ({ kind: 'one', e }));
  }, [list, hidden, fromScan, tab]);

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
  /** One exercise line: tap the picture for details, tap the name to pick it */
  const row = (e: LibExercise, version?: string) => {
    const on = picked.includes(e.ref);
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: version ? 0 : 1, borderBottomColor: p.line }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${e.name} details`} onPress={() => setInfo(e)}><ExerciseThumb img={e.images[0]} video={e.video} size={version ? 48 : 56} /></Pressable>
        <Pressable accessibilityRole={single ? 'button' : 'checkbox'} accessibilityState={{ checked: on }} onPress={() => choose(e)} style={{ flex: 1, gap: 2 }}>
          <Txt v="bold">{version ? `${version}: ${e.name}` : e.name}</Txt>
          {fromScan ? (
            <>
              <Txt v="small" numberOfLines={1}>Focus: {e.primary.map(titleCase).join(', ') || 'Full body'}{e.pattern ? ` · ${e.pattern}` : ''}</Txt>
              {!!e.how?.setup && <Txt v="small" numberOfLines={2} style={{ color: p.muted }}>{e.how.setup.split('. ')[0].replace(/\.$/, '')}.</Txt>}
            </>
          ) : <Txt v="small" numberOfLines={1}>{[e.primary.map(titleCase).join(', '), titleCase(e.equipment)].filter(Boolean).join(' · ')}</Txt>}
        </Pressable>
        {tab === 'hidden' ? (
          <Button small kind="quiet" title="Show" onPress={() => toggleHidden(e.ref, false).catch((x: unknown) => toast(errText(x), false))} />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={favs.has(e.ref) ? 'Remove from favorites' : 'Add to favorites'} onPress={() => toggleFav(e)} hitSlop={8}>
            <Icon name={favs.has(e.ref) ? 'star' : 'star_outline'} size={24} color={favs.has(e.ref) ? p.gold : p.muted} />
          </Pressable>
        )}
        {!single && tab !== 'hidden' && (
          <Pressable onPress={() => choose(e)} accessibilityLabel={`Select ${e.name}`} hitSlop={8}
            style={{ width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: on ? p.focus : p.muted, backgroundColor: on ? p.focus : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {on && <Icon name="check" size={18} color={p.onAccent} />}
          </Pressable>
        )}
      </View>
    );
  };
  const showFilterChips = !scanned && ((tab === 'part' && !part) || (tab === 'equipment' && !equip));
  /** Scan a machine: the live scanner on phones, a photo on the web */
  const scan = async () => {
    if (Platform.OS !== 'web') { setScanning(true); return; }
    const r = await scanMachinePhoto(toast);
    if (r) setScanned(r);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title} full>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {([['search', 'Search'], ['part', 'Body part'], ['equipment', 'Equipment'], ['recent', 'Recent'], ['favorites', 'Favorites'], ['mine', 'My exercises'], ...(hidden.size ? [['hidden', `Hidden (${hidden.size})`]] : [])] as [Tab, string][])
            .map(([k, l]) => <Chip key={k} label={l} selected={!scanned && tab === k} onPress={() => { setScanned(null); setTab(k); }} />)}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: R.pill, paddingHorizontal: 14, height: 46 }}>
          <Icon name="search" size={20} color={p.muted} />
          <TextInput value={q} onChangeText={(t) => { setScanned(null); setQ(t); }} placeholder="Search exercises" placeholderTextColor={p.muted} accessibilityLabel="Search exercises"
            autoCorrect={false} style={{ flex: 1, fontFamily: F.body, fontSize: 16, color: p.ink, height: 44 }} />
          {q ? <Pressable accessibilityLabel="Clear search" onPress={() => setQ('')} hitSlop={8}><Icon name="close" size={18} color={p.muted} /></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Scan a machine" onPress={scan} hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: p.line }}>
            <Icon name="photo_camera" size={20} color={p.focus} />
            <Txt v="small" style={{ color: p.focus, fontFamily: F.bodyBold }}>Scan machine</Txt>
          </Pressable>
        </View>
        {typedMachines.length > 0 && (
          <View style={{ gap: 6 }}>
            <Txt v="small">Equipment that matches “{q.trim()}”: tap it to see everything you can do on it</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {typedMachines.map((m) => <Chip key={m.id} label={m.name} onPress={() => setScanned({ id: m.id, machine: m.name, brand: '', gear: [], exercises: [] })} />)}
            </View>
          </View>
        )}
        {scanned && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="photo_camera" size={18} color={p.focus} />
            <Txt v="small" style={{ flex: 1 }} numberOfLines={2}>
              {scannedMachine ? `${scannedMachine.name}${scanned.brand ? ` (${scanned.brand})` : ''}` : scanned.machine ? `${titleCase(scanned.machine)}${scanned.brand ? ` (${scanned.brand})` : ''}` : 'Scanned equipment'}: everything you can do on it. Tap a picture to watch the demo.
            </Txt>
            <Chip label="Clear ✕" selected onPress={() => setScanned(null)} />
          </View>
        )}
        {!!scannedMachine?.note && <Txt v="small">{scannedMachine.note}</Txt>}
        {!!fromScan?.extra.length && (
          <Txt v="small">Also done on it (not in the library yet): {fromScan.extra.join(', ')}</Txt>
        )}
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
        <FlatList data={items} keyExtractor={(it) => (it.kind === 'one' ? it.e.ref : `fam:${it.key}`)} keyboardShouldPersistTaps="handled" initialNumToRender={14}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={<Txt v="small" center style={{ marginTop: 30 }}>
            {scanned ? 'No library exercises match that machine yet. Try searching by what it works.' : tab === 'hidden' ? 'Nothing hidden.' : tab === 'favorites' ? 'Tap the star on any exercise to keep it here.' : tab === 'recent' ? 'Exercises you use in workouts show up here.' : tab === 'mine' ? 'Create your own exercises, like your TRX moves, with your own demo videos.' : 'No exercises match.'}
          </Txt>}
          renderItem={({ item }) => {
            if (item.kind === 'one') return row(item.e);
            const open = expanded.has(item.key);
            const lead = item.members[0].e;
            return (
              <View style={{ borderBottomWidth: 1, borderBottomColor: p.line }}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${item.name}, ${item.members.length} versions`}
                  onPress={() => setExpanded((x) => { const n = new Set(x); if (open) n.delete(item.key); else n.add(item.key); return n; })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                  <ExerciseThumb img={lead.images[0]} video={lead.video} size={56} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Txt v="bold">{item.name}</Txt>
                      <View style={{ backgroundColor: p.soft, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Txt v="small" style={{ color: p.focus, fontFamily: F.bodyBold }}>{item.members.length} versions</Txt>
                      </View>
                    </View>
                    <Txt v="small" numberOfLines={2}>{item.members.map((m) => m.version).join(' · ')}</Txt>
                  </View>
                  <Icon name={open ? 'expand_less' : 'expand_more'} size={24} color={p.muted} />
                </Pressable>
                {open && <View style={{ paddingLeft: 18, borderLeftWidth: 2, borderLeftColor: p.focus, marginLeft: 26, marginBottom: 6 }}>
                  {item.members.map((m) => <View key={m.e.ref}>{row(m.e, m.version)}</View>)}
                </View>}
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
      <MachineScanner visible={scanning} onClose={() => setScanning(false)} onFound={setScanned} />
    </Sheet>
  );
}

const MUSCLE_CHOICES = MUSCLES;

/** Create or edit one of the trainer's own exercises: details, muscles, equipment, demo video and image, and alternatives. */
export function MyExerciseEditor({ visible, onClose, onSaved, initial }: { visible: boolean; onClose: () => void; onSaved: () => void; initial?: MyExercise }) {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { mine } = useMyExercises(app.trainer?.user_id);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Bodyweight');
  const [metric, setMetric] = useState<SetMetric>('reps');
  const [steps, setSteps] = useState('');
  const [main, setMain] = useState<string | null>(null);
  const [other, setOther] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [video, setVideo] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [alts, setAlts] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [suggest, setSuggest] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setSuggest(false);
    setName(initial?.name ?? ''); setCategory(initial?.category ?? 'Bodyweight'); setMetric(initial?.default_metric ?? 'reps'); setSteps(initial?.instructions ?? '');
    setMain(initial?.muscles[0] ?? null); setOther(initial?.secondary_muscles ?? []); setEquipment(initial?.equipment ?? []);
    setVideo(initial?.video_url ?? ''); setImage(initial?.image_path ?? null); setAlts(initial?.alternatives ?? []);
  }, [visible, initial]);
  const tid = app.trainer?.user_id;

  const uploadMedia = async (kind: 'video' | 'image') => {
    setBusy(kind);
    try {
      const res = await ImagePicker.launchImageLibraryAsync(kind === 'video' ? { mediaTypes: ['videos'], videoMaxDuration: 180, quality: 1 } : { mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [4, 3] });
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      if (a.fileSize && a.fileSize > 100 * 1024 * 1024) throw new Error('That file is over 100 MB. Trim it or choose a smaller one.');
      const ext = (a.fileName?.match(/\.(\w+)$/)?.[1] ?? (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase();
      const path = `${tid}/exercises/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const bytes = Platform.OS === 'web' ? await (await fetch(a.uri)).arrayBuffer() : await new (await import('expo-file-system')).File(a.uri).arrayBuffer();
      const { error } = await sb.storage.from(MEDIA).upload(path, bytes, { contentType: a.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg') });
      if (error) throw error;
      if (kind === 'video') setVideo(path); else setImage(path);
      toast(kind === 'video' ? 'Video uploaded' : 'Image uploaded');
    } catch (e) { toast(errText(e), false); } finally { setBusy(null); }
  };
  const save = async () => {
    if (!name.trim()) return toast('Name the exercise', false);
    if (video && isLink(video) && !/^https:\/\//i.test(video)) return toast('Use an https link for the video', false);
    setBusy('save');
    const row = { trainer_id: tid, name: name.trim(), category, default_metric: metric, instructions: steps.trim() || null,
      muscles: main ? [main] : [], secondary_muscles: other.filter((m) => m !== main), equipment, video_url: video.trim() || null, image_path: image, alternatives: alts };
    const { error } = initial ? await sb.from('coach_exercises').update(row).eq('id', initial.id) : await sb.from('coach_exercises').insert(row);
    if (error) { setBusy(null); return toast(errText(error), false); }
    if (!suggest) { setBusy(null); toast('Exercise saved'); onSaved(); return; }
    // Also suggested for the shared library: reviewed against the existing exercises before anything is added
    try {
      const r = await suggestExercise({ name: row.name, category, gear: equipment, main: main ? [main] : [], other: row.secondary_muscles, description: steps.trim(),
        video: isLink(video) ? video.trim() : undefined });
      toast(`Exercise saved. ${reviewText(r)}`, r.outcome === 'pending' || r.outcome === 'already_listed');
    } catch (e) { toast(`Exercise saved, but the suggestion couldn’t be sent: ${errText(e)}`, false); }
    setBusy(null); onSaved();
  };
  const chips = (list: string[], on: (m: string) => boolean, tap: (m: string) => void) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>{list.map((m) => <Chip key={m} label={titleCase(m)} selected={on(m)} onPress={() => tap(m)} />)}</View>
  );
  const toggle = (set: (f: (x: string[]) => string[]) => void) => (m: string) => set((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]));

  return (
    <Sheet visible={visible} onClose={onClose} title={initial ? 'Edit exercise' : 'Create exercise'}>
      <Field label="Exercise name *" value={name} onChangeText={setName} placeholder="TRX Atomic Push-Up" />
      <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Category *</Txt>
      {chips(MY_CATEGORIES, (c) => c === category, setCategory)}
      <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Type *</Txt>
      <View style={{ marginBottom: 16 }}><Segmented<SetMetric> value={metric} onChange={setMetric} options={[['reps', 'Reps and weight'], ['time', 'Timed (Lapis)'], ['distance', 'Distance']]} /></View>
      <Field label="Description" hint="(how to do it, cues; one step per line)" value={steps} onChangeText={setSteps} multiline placeholder="Write something…" />
      <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Main muscle worked</Txt>
      {chips(MUSCLE_CHOICES, (m) => m === main, (m) => setMain(main === m ? null : m))}
      <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Other muscles worked</Txt>
      {chips(MUSCLE_CHOICES.filter((m) => m !== main), (m) => other.includes(m), toggle(setOther))}
      <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Equipment</Txt>
      {chips(EQUIPMENT, (m) => equipment.includes(m), toggle(setEquipment))}

      <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Exercise video</Txt>
      <Field label="Video link" hint="(YouTube or any https link)" value={isLink(video) ? video : ''} onChangeText={setVideo} autoCapitalize="none" placeholder="https://youtu.be/…" />
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <Button kind="ghost" small icon="video_library" title={video && !isLink(video) ? 'Replace uploaded video' : 'Or upload a video'} busy={busy === 'video'} onPress={() => uploadMedia('video')} />
        {video && !isLink(video) ? <><Txt v="small">Video uploaded</Txt><Button small kind="quiet" title="Remove" onPress={() => setVideo('')} /></> : null}
      </View>
      <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Exercise image</Txt>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <ExerciseThumb img={image ? `media:${image}` : null} size={72} />
        <Button kind="ghost" small icon="photo_library" title={image ? 'Replace image' : 'Upload an image'} busy={busy === 'image'} onPress={() => uploadMedia('image')} />
        {image && <Button small kind="quiet" title="Remove" onPress={() => setImage(null)} />}
      </View>

      <Txt v="bold" style={{ fontSize: 15 }}>Alternatives</Txt>
      <Txt v="small" style={{ marginBottom: 8 }}>Clients can swap to one of these during a workout (no equipment, a sore joint, a busy gym).</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {alts.map((r) => <Chip key={r} label={`${byRef(r, mine)?.name ?? 'Removed exercise'}  ✕`} selected onPress={() => setAlts((x) => x.filter((y) => y !== r))} />)}
      </View>
      <Button small kind="ghost" icon="add" title="Select alternative exercises" disabled={alts.length >= 12} style={{ alignSelf: 'flex-start', marginBottom: 20 }} onPress={() => setPicking(true)} />
      <View style={{ borderTopWidth: 1, borderTopColor: p.line, paddingTop: 16 }}>
        <Toggle label="Suggest it for the Dragonfly library" value={suggest} onChange={setSuggest}
          sub="Your exercise is yours to use with clients either way. A suggestion is checked against the library, then reviewed by the Dragonfly team: an exercise we already have can get your name as a search name; a new, well-described variation can be added for everyone." />
        <Button title="Save exercise" busy={busy === 'save'} onPress={save} style={{ alignSelf: 'flex-start' }} />
      </View>
      <ExercisePicker visible={picking} title="Select alternatives" onClose={() => setPicking(false)}
        onPick={(list) => setAlts((x) => [...new Set([...x, ...list.map((e) => e.ref)])].filter((r) => r !== (initial ? `my:${initial.id}` : '')).slice(0, 12))} />
    </Sheet>
  );
}
