import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, TextInput, View } from 'react-native';
import { Row, Segmented } from '@/components/bits';
import { Cover } from '@/components/cover';
import { Screen } from '@/components/shell';
import { ActionMenu, Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { TEMPLATES, type Template } from '@/data/templates';
import { AssignWorkout } from '@/features/assign';
import { ask } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { errText, type Folder, type Program, type Workout } from '@/lib/model';
import { ResumeBanner } from '@/features/resume';
import { canSendToTrainers, CopyToTrainer } from '@/features/team';
import { sb } from '@/lib/supabase';
import { cloneBlocks, estimateMinutes, exerciseCount } from '@/lib/workouts';
import { F, R, usePalette } from '@/lib/theme';

type Tab = 'workouts' | 'programs' | 'folders' | 'templates';
type Sort = 'recent' | 'az' | 'created';

/** Trainer's Workouts tab: workouts, programs, folders and starter templates. */
export default function WorkoutsTab() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const tid = app.trainer?.user_id;
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'workouts');
  useEffect(() => { if (params.tab) setTab(params.tab); }, [params.tab]);
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [folder, setFolder] = useState<string | null>(null);
  const [creating, setCreating] = useState<'workout' | 'program' | null>(null);
  const [menu, setMenu] = useState<Workout | null>(null);
  const [assign, setAssign] = useState<Workout | null>(null);
  const [moving, setMoving] = useState<Workout | null>(null);
  const [renaming, setRenaming] = useState<{ w: Workout; name: string } | null>(null);
  const [newFolder, setNewFolder] = useState('');
  const [sending, setSending] = useState<{ kind: 'workout' | 'program'; id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const [w, pr, f] = await Promise.all([
      sb.from('coach_workouts').select('*').eq('archived', false),
      sb.from('coach_programs').select('*').eq('archived', false).order('updated_at', { ascending: false }),
      sb.from('coach_workout_folders').select('*').order('name'),
    ]);
    if (w.error) toast(errText(w.error), false);
    setWorkouts((w.data as Workout[]) ?? []); setPrograms((pr.data as Program[]) ?? []); setFolders((f.data as Folder[]) ?? []);
  }, [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = (workouts ?? []).filter((w) => (!folder || w.folder_id === folder) && words.every((x) => w.name.toLowerCase().includes(x)));
    const recency = (w: Workout) => w.last_used_at && w.last_used_at > w.updated_at ? w.last_used_at : w.updated_at;
    return rows.sort((a, b) => sort === 'az' ? a.name.localeCompare(b.name) : sort === 'created' ? b.created_at.localeCompare(a.created_at) : recency(b).localeCompare(recency(a)));
  }, [workouts, q, folder, sort]);

  const createFrom = async (name: string, source?: { blocks: Workout['blocks']; description?: string | null; cover?: string | null }) => {
    const { data, error } = await sb.from('coach_workouts').insert({
      trainer_id: tid, name: name.trim().slice(0, 120), blocks: source ? cloneBlocks(source.blocks) : [], description: source?.description ?? null,
      cover: source?.cover ?? null, folder_id: folder,
    }).select('id').single();
    if (error) { toast(errText(error), false); return; }
    router.push({ pathname: '/workouts/[id]', params: { id: data.id } });
  };
  const useTemplate = (t: Template) => createFrom(t.name, { blocks: t.blocks, description: t.description, cover: t.cover });

  return (
    <Screen title="Workouts" right={
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button kind="ghost" title="Exercise library" icon="sports_gymnastics" onPress={() => router.push('/exercises')} />
        {tab === 'workouts' || tab === 'programs' ? <Button title={tab === 'programs' ? 'Create program' : 'Create routine'} icon="add" onPress={() => setCreating(tab === 'programs' ? 'program' : 'workout')} /> : null}
      </View>}>
      <ResumeBanner />
      <Segmented value={tab} onChange={setTab} options={[['workouts', 'Routines'], ['programs', 'Programs'], ['folders', 'Folders'], ['templates', 'Templates']]} />

      {tab === 'workouts' && (
        <View style={{ marginTop: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: R.pill, paddingHorizontal: 14, height: 46 }}>
            <Icon name="search" size={20} color={p.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search routines" placeholderTextColor={p.muted} accessibilityLabel="Search workouts" style={{ flex: 1, fontFamily: F.body, fontSize: 16, color: p.ink, height: 44 }} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {([['recent', 'Most recent'], ['az', 'A to Z'], ['created', 'Newest']] as [Sort, string][]).map(([k, l]) => <Chip key={k} label={l} selected={sort === k} onPress={() => setSort(k)} />)}
            {folders.length > 0 && <View style={{ width: 1, backgroundColor: p.line, marginHorizontal: 4 }} />}
            {folders.map((f) => <Chip key={f.id} label={f.name} selected={folder === f.id} onPress={() => setFolder(folder === f.id ? null : f.id)} />)}
          </View>
          {workouts === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : list.length === 0 ? (
            workouts.length === 0
              ? <Empty emoji="🏋️" title="Build your first workout" body="Start blank, or copy one of the starter templates and make it yours."
                  action={<View style={{ flexDirection: 'row', gap: 10 }}><Button title="Create routine" onPress={() => setCreating('workout')} /><Button kind="ghost" title="Templates" onPress={() => setTab('templates')} /></View>} />
              : <Txt v="small" center style={{ marginTop: 20 }}>No workouts match.</Txt>
          ) : (
            <Card style={{ padding: 0 }}>
              {list.map((w, i) => (
                <Pressable key={w.id} accessibilityRole="link" onPress={() => router.push({ pathname: '/workouts/[id]', params: { id: w.id } })}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: p.line, opacity: pressed ? 0.7 : 1 })}>
                  <Cover name={w.name} cover={w.cover} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt v="bold" numberOfLines={2}>{w.name}</Txt>
                    <Txt v="small">{exerciseCount(w.blocks)} exercises · about {estimateMinutes(w.blocks)} min{w.folder_id ? ` · ${folders.find((f) => f.id === w.folder_id)?.name ?? ''}` : ''}</Txt>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`More options for ${w.name}`} onPress={() => setMenu(w)} hitSlop={10}><Icon name="more_horiz" size={26} /></Pressable>
                </Pressable>
              ))}
            </Card>
          )}
        </View>
      )}

      {tab === 'programs' && (
        <View style={{ marginTop: 16 }}>
          {programs.length === 0 ? <Empty emoji="🗓️" title="No programs yet" body="A program lays your workouts out over several weeks. Assign it once and every session lands on your client’s calendar." />
            : <Card style={{ padding: 0 }}>
              {programs.map((pr, i) => (
                <Pressable key={pr.id} accessibilityRole="link" onPress={() => router.push({ pathname: '/programs/[id]', params: { id: pr.id } })}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderBottomWidth: i === programs.length - 1 ? 0 : 1, borderBottomColor: p.line, opacity: pressed ? 0.7 : 1 })}>
                  <Cover name={pr.name} cover={pr.cover} />
                  <View style={{ flex: 1, gap: 2 }}><Txt v="bold" numberOfLines={2}>{pr.name}</Txt><Txt v="small">{pr.weeks} weeks · {pr.schedule.length} workouts</Txt></View>
                  <Icon name="chevron_right" color={p.muted} />
                </Pressable>
              ))}
            </Card>}
        </View>
      )}

      {tab === 'folders' && (
        <View style={{ marginTop: 16, gap: 12 }}>
          <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><Field label="New folder" value={newFolder} onChangeText={setNewFolder} placeholder="Client programs, Bootcamp, TRX" /></View>
            <Button title="Create" style={{ marginBottom: 16 }} onPress={async () => {
              if (!newFolder.trim()) return;
              const { error } = await sb.from('coach_workout_folders').insert({ trainer_id: tid, name: newFolder.trim() });
              if (error) return toast(errText(error), false);
              setNewFolder(''); load();
            }} />
          </Card>
          {folders.length > 0 && <Card style={{ padding: 0 }}>
            {folders.map((f, i) => (
              <Row key={f.id} icon="folder" title={f.name} sub={`${(workouts ?? []).filter((w) => w.folder_id === f.id).length} workouts`} last={i === folders.length - 1}
                onPress={() => { setFolder(f.id); setTab('workouts'); }}
                right={<Button small kind="quiet" title="Delete" onPress={() => ask(`Delete the ${f.name} folder?`, 'Its workouts stay; they just move out of the folder.', [
                  { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await sb.from('coach_workout_folders').delete().eq('id', f.id); if (folder === f.id) setFolder(null); load(); } }])} />} />
            ))}
          </Card>}
        </View>
      )}

      {tab === 'templates' && (
        <View style={{ marginTop: 16, gap: 12 }}>
          <Txt v="small">Starter workouts built from the exercise library. Copy one, then adjust it for your client.</Txt>
          {TEMPLATES.map((t) => (
            <Card key={t.key} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <Cover name={t.name} cover={t.cover} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="bold">{t.name}</Txt>
                <Txt v="small">{exerciseCount(t.blocks)} exercises · about {estimateMinutes(t.blocks)} min</Txt>
                <Txt v="small" numberOfLines={2}>{t.description}</Txt>
              </View>
              <Button small title="Use" onPress={() => useTemplate(t)} />
            </Card>
          ))}
        </View>
      )}

      <CreateSheet kind={creating} workouts={workouts ?? []} onClose={() => setCreating(null)}
        onWorkout={(name, from) => { setCreating(null); createFrom(name, from ?? undefined); }}
        onProgram={async (name, weeks) => {
          setCreating(null);
          const { data, error } = await sb.from('coach_programs').insert({ trainer_id: tid, name, weeks }).select('id').single();
          if (error) return toast(errText(error), false);
          router.push({ pathname: '/programs/[id]', params: { id: data.id } });
        }} />
      {menu && <ActionMenu visible onClose={() => setMenu(null)} title={menu.name} items={[
        { label: 'Assign to clients', icon: 'calendar_month', onPress: () => setAssign(menu) },
        { label: 'Start workout', icon: 'play_arrow', onPress: () => router.push({ pathname: '/session', params: { workout: menu.id } }) },
        { label: 'Rename', icon: 'edit', onPress: () => setRenaming({ w: menu, name: menu.name }) },
        { label: 'Duplicate', icon: 'content_copy', onPress: () => createFrom(`${menu.name} (copy)`, menu) },
        { label: 'Move to folder', icon: 'drive_file_move', onPress: () => setMoving(menu) },
        { label: 'Send a copy to a trainer', icon: 'send', hidden: !canSendToTrainers(app), onPress: () => setSending({ kind: 'workout', id: menu.id, name: menu.name }) },
        { label: 'Delete', icon: 'delete', danger: true, onPress: () => ask(`Delete ${menu.name}?`, 'Workouts already assigned to clients stay on their calendars.', [
          { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { const { error } = await sb.from('coach_workouts').delete().eq('id', menu.id); if (error) toast(errText(error), false); load(); } }]) },
      ]} />}
      <CopyToTrainer item={sending} onClose={() => setSending(null)} />
      <AssignWorkout workout={assign} visible={!!assign} onClose={() => { setAssign(null); load(); }} />
      <Sheet visible={!!moving} onClose={() => setMoving(null)} title="Move to folder">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[{ id: null as string | null, name: 'No folder' }, ...folders].map((f) => (
            <Chip key={f.id ?? 'none'} label={f.name} selected={moving?.folder_id === f.id} onPress={async () => {
              const { error } = await sb.from('coach_workouts').update({ folder_id: f.id }).eq('id', moving!.id);
              if (error) toast(errText(error), false); setMoving(null); load();
            }} />
          ))}
        </View>
        {folders.length === 0 && <Txt v="small" style={{ marginTop: 10 }}>Create folders in the Folders tab.</Txt>}
      </Sheet>
      <Sheet visible={!!renaming} onClose={() => setRenaming(null)} title="Rename workout">
        <Field label="Name" value={renaming?.name ?? ''} onChangeText={(name) => setRenaming((r) => (r ? { ...r, name } : r))} autoFocus />
        <Button title="Save" onPress={async () => {
          if (!renaming?.name.trim()) return;
          const { error } = await sb.from('coach_workouts').update({ name: renaming.name.trim() }).eq('id', renaming.w.id);
          if (error) toast(errText(error), false); setRenaming(null); load();
        }} style={{ alignSelf: 'flex-start' }} />
      </Sheet>
    </Screen>
  );
}

/** "Create workout" (blank or copied from an existing one) and "Create program" */
function CreateSheet({ kind, workouts, onClose, onWorkout, onProgram }: {
  kind: 'workout' | 'program' | null; workouts: Workout[]; onClose: () => void;
  onWorkout: (name: string, from: Workout | null) => void; onProgram: (name: string, weeks: number) => void;
}) {
  const p = usePalette();
  const toast = useToast();
  const [name, setName] = useState('');
  const [copy, setCopy] = useState(false);
  const [from, setFrom] = useState<Workout | null>(null);
  const [weeks, setWeeks] = useState('4');
  const reset = () => { setName(''); setCopy(false); setFrom(null); setWeeks('4'); };
  return (
    <Sheet visible={!!kind} onClose={() => { reset(); onClose(); }} title={kind === 'program' ? 'Create program' : 'Create routine'}>
      <Field label={kind === 'program' ? 'Program name' : 'Workout title'} value={name} onChangeText={setName} placeholder={kind === 'program' ? '8-week strength block' : 'Upper body day'} autoFocus />
      {kind === 'program' ? (
        <View style={{ width: 160 }}><Field label="Weeks" value={weeks} onChangeText={setWeeks} keyboardType="number-pad" /></View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Txt v="bold">Copy an existing workout?</Txt>
            <Switch value={copy} onValueChange={setCopy} accessibilityLabel="Copy an existing workout" trackColor={{ true: p.focus, false: p.line }} thumbColor={p.surface} />
          </View>
          {copy && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {workouts.length === 0 && <Txt v="small">You don’t have any workouts to copy yet.</Txt>}
              {workouts.slice(0, 40).map((w) => <Chip key={w.id} label={w.name} selected={from?.id === w.id} onPress={() => { setFrom(w); if (!name) setName(w.name); }} />)}
            </View>
          )}
        </>
      )}
      <Button title="Create" disabled={!name.trim()} style={{ alignSelf: 'flex-start' }} onPress={() => {
        if (kind === 'program') {
          const n = Number(weeks);
          if (!Number.isInteger(n) || n < 1 || n > 52) return toast('Use 1 to 52 weeks', false);
          onProgram(name.trim(), n);
        } else onWorkout(name.trim(), copy ? from : null);
        reset();
      }} />
    </Sheet>
  );
}
