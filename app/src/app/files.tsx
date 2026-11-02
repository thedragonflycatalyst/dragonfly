import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import { ClientPicker, Fab, matches, SearchBox } from '@/components/pickers';
import { ActionMenu, Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { mediaUrl } from '@/features/exercises';
import { confirm } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { bytesOf, fmtSize, pickDocument, rand } from '@/lib/files';
import { errText } from '@/lib/model';
import { extOf } from '@/lib/social';
import { sb } from '@/lib/supabase';
import { MAX_W, R, usePalette } from '@/lib/theme';

type LibFile = { id: string; trainer_id: string; name: string; path: string; size_bytes: number; mime: string | null; folder: string | null; created_at: string };
type Sort = 'new' | 'old' | 'name' | 'size';
type Kind = 'all' | 'pdf' | 'image' | 'video' | 'doc';
const QUOTA = 10 * 1024 ** 3;
const kindOf = (f: LibFile): Kind => (/pdf/.test(f.mime ?? '') ? 'pdf' : /^image/.test(f.mime ?? '') ? 'image' : /^video/.test(f.mime ?? '') ? 'video' : 'doc');
const ICON = { pdf: 'picture_as_pdf', image: 'image', video: 'movie', doc: 'description', all: 'description' } as const;

/** Files: your document library (10 GB), shared with clients one by one */
export default function FilesScreen() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const coach = app.mode === 'coach';
  const [files, setFiles] = useState<LibFile[] | null>(null);
  const [shares, setShares] = useState<{ file_id: string; client_id: string }[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('new');
  const [kind, setKind] = useState<Kind>('all');
  const [filter, setFilter] = useState(false);
  const [menu, setMenu] = useState<LibFile | null>(null);
  const [sharing, setSharing] = useState<LibFile | null>(null);
  const [renaming, setRenaming] = useState<LibFile | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [f, s] = await Promise.all([sb.from('coach_library_files').select('*').order('created_at', { ascending: false }), sb.from('coach_file_shares').select('file_id, client_id')]);
    if (f.error) toast(errText(f.error), false);
    setFiles((f.data as LibFile[]) ?? []); setShares(s.data ?? []);
  }, [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const used = (files ?? []).reduce((a, f) => a + Number(f.size_bytes), 0);
  const list = useMemo(() => (files ?? []).filter((f) => (kind === 'all' || kindOf(f) === kind) && matches(q, f.name, f.folder)).sort((a, b) =>
    sort === 'new' ? b.created_at.localeCompare(a.created_at) : sort === 'old' ? a.created_at.localeCompare(b.created_at) : sort === 'name' ? a.name.localeCompare(b.name) : Number(b.size_bytes) - Number(a.size_bytes)), [files, kind, q, sort]);

  const upload = async () => {
    try {
      const d = await pickDocument();
      if (!d) return;
      if (used + (d.size ?? 0) > QUOTA) return toast('That would go over your 10 GB. Delete something first.', false);
      setBusy(true);
      const path = `${app.trainer?.user_id}/files/${rand()}.${extOf(d.name, 'bin')}`;
      const { error } = await sb.storage.from('coach-media').upload(path, await bytesOf(d.uri), { contentType: d.mime ?? 'application/octet-stream' });
      if (error) throw error;
      const r = await sb.from('coach_library_files').insert({ trainer_id: app.trainer?.user_id, name: d.name, path, size_bytes: d.size ?? 0, mime: d.mime });
      if (r.error) { await sb.storage.from('coach-media').remove([path]); throw r.error; }
      toast('Uploaded'); load();
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  const open = async (f: LibFile) => { const u = await mediaUrl(f.path); if (u) Linking.openURL(u); else toast('Couldn’t open that file', false); };
  const remove = async (f: LibFile) => {
    if (!(await confirm(`Delete ${f.name}?`, 'Clients you shared it with lose access too.', 'Delete', true))) return;
    await sb.storage.from('coach-media').remove([f.path]);
    const { error } = await sb.from('coach_library_files').delete().eq('id', f.id);
    if (error) toast(errText(error), false); else load();
  };
  const share = async (f: LibFile, ids: string[]) => {
    const now = shares.filter((s) => s.file_id === f.id).map((s) => s.client_id);
    const add = ids.filter((x) => !now.includes(x)), drop = now.filter((x) => !ids.includes(x));
    const r1 = add.length ? await sb.from('coach_file_shares').insert(add.map((client_id) => ({ file_id: f.id, client_id, trainer_id: f.trainer_id }))) : { error: null };
    const r2 = drop.length ? await sb.from('coach_file_shares').delete().eq('file_id', f.id).in('client_id', drop) : { error: null };
    if (r1.error || r2.error) return toast(errText(r1.error ?? r2.error), false);
    toast(ids.length ? `Shared with ${ids.length} client${ids.length === 1 ? '' : 's'}` : 'No longer shared'); load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: coach ? 'Files' : 'Shared files' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <SearchBox value={q} onChange={setQ} />
          {coach && <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="h3">Usage</Txt><Txt v="bold">{fmtSize(used) || '0 B'} / 10 GB</Txt></View>
            <View style={{ height: 12, borderRadius: 6, backgroundColor: p.soft, overflow: 'hidden' }}><View style={{ width: `${Math.min(100, (used / QUOTA) * 100)}%`, minWidth: used ? 4 : 0, height: 12, backgroundColor: used / QUOTA > 0.9 ? p.danger : p.focus }} /></View>
          </View>}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Txt v="h3" style={{ flex: 1 }}>{sort === 'new' ? 'Most recent' : sort === 'old' ? 'Oldest first' : sort === 'name' ? 'By name' : 'Largest first'}</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Filter and sort" onPress={() => setFilter(true)} hitSlop={10}><Icon name="filter_list" color={kind !== 'all' ? p.gold : p.focus} /></Pressable>
          </View>
          {files === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : list.length === 0 ? (
            <Empty emoji="📄" title="Nothing to see here?" body={coach ? (files.length ? 'No files match.' : 'No files uploaded yet. Keep your guides, contracts, waivers and meal plans here, and share them with clients.') : 'Files your trainer shares with you show up here.'} />
          ) : (
            <Card style={{ padding: 0 }}>
              {list.map((f, i) => {
                const n = shares.filter((s) => s.file_id === f.id).length;
                return (
                  <Pressable key={f.id} onPress={() => (coach ? setMenu(f) : open(f))} accessibilityRole="button" accessibilityLabel={f.name}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: p.line, opacity: pressed ? 0.75 : 1 })}>
                    <View style={{ width: 42, height: 42, borderRadius: R.sm, backgroundColor: p.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={ICON[kindOf(f)] as never} color={p.focus} /></View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Txt v="bold" numberOfLines={1}>{f.name}</Txt>
                      <Txt v="small">{fmtSize(Number(f.size_bytes))} · {new Date(f.created_at).toLocaleDateString()}{coach ? ` · ${n ? `shared with ${n}` : 'only you'}` : ''}</Txt>
                    </View>
                    {!coach && <Icon name="open_in_new" size={20} color={p.muted} />}
                  </Pressable>
                );
              })}
            </Card>
          )}
        </View>
      </ScrollView>
      {coach && <Fab title={busy ? 'Uploading…' : 'Upload file'} icon="upload" onPress={() => !busy && upload()} />}
      <Sheet visible={filter} onClose={() => setFilter(false)} title="Filter and sort">
        <Txt v="bold" style={{ marginBottom: 8 }}>Sort</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>{([['new', 'Newest'], ['old', 'Oldest'], ['name', 'Name'], ['size', 'Size']] as const).map(([k, l]) => <Chip key={k} label={l} selected={sort === k} onPress={() => setSort(k)} />)}</View>
        <Txt v="bold" style={{ marginBottom: 8 }}>Type</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>{([['all', 'All'], ['pdf', 'PDFs'], ['image', 'Images'], ['video', 'Videos'], ['doc', 'Documents']] as const).map(([k, l]) => <Chip key={k} label={l} selected={kind === k} onPress={() => setKind(k)} />)}</View>
        <Button title="Done" onPress={() => setFilter(false)} />
      </Sheet>
      <ActionMenu visible={!!menu} onClose={() => setMenu(null)} title={menu?.name} items={menu ? [
        { label: 'Open', icon: 'open_in_new', onPress: () => open(menu) },
        { label: 'Share with clients', icon: 'group_add', onPress: () => setSharing(menu) },
        { label: 'Rename', icon: 'edit', onPress: () => { setName(menu.name); setRenaming(menu); } },
        { label: 'Delete', icon: 'delete', danger: true, onPress: () => remove(menu) },
      ] : []} />
      {sharing && <ClientPicker visible onClose={() => setSharing(null)} title={`Share ${sharing.name}`} value={shares.filter((s) => s.file_id === sharing.id).map((s) => s.client_id)} onDone={(ids) => share(sharing, ids)} />}
      <Sheet visible={!!renaming} onClose={() => setRenaming(null)} title="Rename">
        <Field label="Name" value={name} onChangeText={setName} />
        <Button title="Save" onPress={async () => { if (!renaming || !name.trim()) return; const { error } = await sb.from('coach_library_files').update({ name: name.trim() }).eq('id', renaming.id); if (error) toast(errText(error), false); else { setRenaming(null); load(); } }} />
      </Sheet>
    </View>
  );
}
