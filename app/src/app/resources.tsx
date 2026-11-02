import * as Clipboard from 'expo-clipboard';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { Cover } from '@/components/cover';
import { DateField } from '@/components/date-field';
import { ClientPicker, Fab, matches, SearchBox } from '@/components/pickers';
import { Badge } from '@/components/shell';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { CoverPicker } from '@/features/cover-picker';
import { mediaUrl } from '@/features/exercises';
import { confirm } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { bytesOf, fmtSize, pickDocument, rand } from '@/lib/files';
import { errText } from '@/lib/model';
import { extOf } from '@/lib/social';
import { sb } from '@/lib/supabase';
import { MAX_W, R, usePalette } from '@/lib/theme';

type Kind = 'template' | 'offer' | 'media';
type Res = {
  id: string; trainer_id: string; kind: Kind; title: string; body: string | null; url: string | null; file_path: string | null; file_name: string | null; mime: string | null;
  size_bytes: number | null; cover: string | null; code: string | null; price_text: string | null; expires_on: string | null; audience: 'all' | 'clients' | 'none'; client_ids: string[]; archived: boolean; updated_at: string;
};
const ABOUT: Record<Kind, { title: string; body: string; emoji: string }> = {
  template: { emoji: '📝', title: 'Message templates', body: 'Save messages you send often (welcome, check-in, payment reminder) and drop them into a chat in two taps. Write {name} for the client’s first name.' },
  offer: { emoji: '🏷️', title: 'Your offers', body: 'Deals for your clients: a discount code for your supplement line, a referral bonus, a bring-a-friend week.' },
  media: { emoji: '🎬', title: 'Guides and media', body: 'PDF guides, recipe books, videos and audio. Share with all your clients or just some.' },
};

/** Resources: message templates (trainer only), offers and media for clients */
export default function Resources() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const coach = app.mode === 'coach';
  const [tab, setTab] = useState<Kind>(coach ? 'template' : 'media');
  const [list, setList] = useState<Res[] | null>(null);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Res | 'new' | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await sb.from('coach_resources').select('*').eq('archived', false).order('updated_at', { ascending: false });
    if (error) toast(errText(error), false);
    setList((data as Res[]) ?? []);
  }, [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const shown = (list ?? []).filter((r) => r.kind === tab && matches(q, r.title, r.body, r.code));
  const open = async (r: Res) => {
    if (r.kind === 'template') { await Clipboard.setStringAsync(r.body ?? ''); return toast('Copied. Paste it into a chat.'); }
    if (r.file_path) { const u = await mediaUrl(r.file_path); if (u) Linking.openURL(u); else toast('Couldn’t open that file', false); return; }
    if (r.url) Linking.openURL(r.url);
  };
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Resources' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <Segmented<Kind> value={tab} onChange={setTab} options={coach ? [['template', 'Templates'], ['offer', 'Offers'], ['media', 'Media']] : [['media', 'Guides and media'], ['offer', 'Offers']]} />
          <SearchBox value={q} onChange={setQ} />
          {list === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : shown.length === 0 ? (
            <Empty emoji={ABOUT[tab].emoji} title={coach ? ABOUT[tab].title : tab === 'offer' ? 'No offers right now' : 'Nothing shared yet'} body={coach ? ABOUT[tab].body : 'When your trainer shares something, it shows up here.'} />
          ) : tab === 'template' ? (
            <Card style={{ padding: 0 }}>
              {shown.map((r, i) => (
                <Pressable key={r.id} onPress={() => setEdit(r)} accessibilityRole="button" style={{ padding: 14, gap: 4, borderBottomWidth: i === shown.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Txt v="bold" style={{ flex: 1 }}>{r.title}</Txt>
                    <Button small kind="quiet" icon="content_copy" title="Copy" onPress={() => open(r)} />
                  </View>
                  <Txt v="small" numberOfLines={2}>{r.body}</Txt>
                </Pressable>
              ))}
            </Card>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {shown.map((r) => (
                <Card key={r.id} style={{ flexGrow: 1, flexBasis: 260, maxWidth: 480, gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ width: 70, height: 70, borderRadius: R.sm, overflow: 'hidden' }}><Cover name={r.title} cover={r.cover} size={70} /></View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt v="bold">{r.title}</Txt>
                      {r.price_text ? <Txt v="smallBold" color={p.good}>{r.price_text}</Txt> : null}
                      {r.file_name ? <Txt v="small">{r.file_name}{r.size_bytes ? ` · ${fmtSize(r.size_bytes)}` : ''}</Txt> : null}
                      {coach && r.audience !== 'all' && <Badge text={r.audience === 'none' ? 'Hidden' : `${r.client_ids.length} client${r.client_ids.length === 1 ? '' : 's'}`} />}
                    </View>
                  </View>
                  {r.body ? <Txt v="small" numberOfLines={4}>{r.body}</Txt> : null}
                  {r.code ? <Pressable onPress={async () => { await Clipboard.setStringAsync(r.code!); toast('Code copied'); }} accessibilityRole="button" accessibilityLabel={`Copy code ${r.code}`}
                    style={{ alignSelf: 'flex-start', borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.gold, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Txt v="bold" color={p.gold}>{r.code}</Txt><Icon name="content_copy" size={16} color={p.gold} /></Pressable> : null}
                  {r.expires_on ? <Txt v="small">Until {new Date(`${r.expires_on}T12:00:00`).toLocaleDateString()}</Txt> : null}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(r.url || r.file_path) && <Button small icon="open_in_new" title={r.kind === 'offer' ? 'Get it' : 'Open'} onPress={() => open(r)} />}
                    {coach && <Button small kind="ghost" icon="edit" title="Edit" onPress={() => setEdit(r)} />}
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      {coach && <Fab title={tab === 'template' ? 'New template' : tab === 'offer' ? 'New offer' : 'Add media'} onPress={() => setEdit('new')} />}
      {coach && <ResourceSheet r={edit} kind={tab} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </View>
  );
}

function ResourceSheet({ r, kind, onClose, onSaved }: { r: Res | 'new' | null; kind: Kind; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const app = useApp();
  const ed = r && r !== 'new' ? r : null;
  const k = ed?.kind ?? kind;
  const tid = app.trainer?.user_id ?? '';
  const empty = { title: '', body: '', url: '', code: '', price_text: '', expires_on: null as string | null, cover: null as string | null, audience: 'all' as Res['audience'], client_ids: [] as string[], file_path: null as string | null, file_name: null as string | null, mime: null as string | null, size_bytes: null as number | null };
  const [f, setF] = useState(empty);
  const [seen, setSeen] = useState<typeof r>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(false);
  if (r !== seen) {
    setSeen(r);
    setF(ed ? { title: ed.title, body: ed.body ?? '', url: ed.url ?? '', code: ed.code ?? '', price_text: ed.price_text ?? '', expires_on: ed.expires_on, cover: ed.cover, audience: ed.audience, client_ids: ed.client_ids, file_path: ed.file_path, file_name: ed.file_name, mime: ed.mime, size_bytes: ed.size_bytes } : empty);
  }
  const upload = async () => {
    try {
      const d = await pickDocument();
      if (!d) return;
      setBusy(true);
      const path = `${tid}/resources/${rand()}.${extOf(d.name, 'bin')}`;
      const { error } = await sb.storage.from('coach-media').upload(path, await bytesOf(d.uri), { contentType: d.mime ?? 'application/octet-stream' });
      if (error) throw error;
      setF((x) => ({ ...x, file_path: path, file_name: d.name, mime: d.mime, size_bytes: d.size, title: x.title || d.name.replace(/\.[^.]+$/, '') }));
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  const save = async () => {
    if (!f.title.trim()) return toast('Add a title', false);
    if (k === 'template' && !f.body.trim()) return toast('Write the message', false);
    if (f.url && !/^https?:\/\//.test(f.url.trim())) return toast('Links start with https://', false);
    setBusy(true);
    const row = { trainer_id: tid, kind: k, title: f.title.trim(), body: f.body.trim() || null, url: f.url.trim() || null, code: f.code.trim() || null, price_text: f.price_text.trim() || null,
      expires_on: f.expires_on, cover: f.cover, audience: k === 'template' ? 'none' : f.audience, client_ids: f.audience === 'clients' ? f.client_ids : [],
      file_path: f.file_path, file_name: f.file_name, mime: f.mime, size_bytes: f.size_bytes };
    const { error } = ed ? await sb.from('coach_resources').update(row).eq('id', ed.id) : await sb.from('coach_resources').insert(row);
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast('Saved'); onSaved();
  };
  const remove = async () => {
    if (!ed || !(await confirm(`Delete ${ed.title}?`, undefined, 'Delete', true))) return;
    if (ed.file_path) await sb.storage.from('coach-media').remove([ed.file_path]);
    await sb.from('coach_resources').delete().eq('id', ed.id); onSaved();
  };
  return (
    <Sheet visible={!!r} onClose={onClose} title={ed ? 'Edit' : k === 'template' ? 'New template' : k === 'offer' ? 'New offer' : 'Add media'}>
      <Field label="Title" value={f.title} onChangeText={(title) => setF({ ...f, title })} placeholder={k === 'template' ? 'Welcome message' : k === 'offer' ? '20% off Phoenix Fire creatine' : '7-day meal prep guide'} />
      <Field label={k === 'template' ? 'Message' : 'Details'} value={f.body} onChangeText={(body) => setF({ ...f, body })} multiline
        placeholder={k === 'template' ? 'Hi {name}! Welcome to the team…' : ''} />
      {k === 'offer' && <>
        <Field label="Code" hint="(optional)" value={f.code} onChangeText={(code) => setF({ ...f, code: code.toUpperCase() })} autoCapitalize="characters" />
        <Field label="Price or saving" hint="(optional)" value={f.price_text} onChangeText={(price_text) => setF({ ...f, price_text })} placeholder="$29 (save $10)" />
        <DateField label="Ends" optional value={f.expires_on} onChange={(expires_on) => setF({ ...f, expires_on })} />
      </>}
      {k !== 'template' && <>
        <Field label="Link" hint="(optional)" value={f.url} onChangeText={(url) => setF({ ...f, url })} autoCapitalize="none" keyboardType="url" placeholder="https://" />
        {k === 'media' && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Button kind="ghost" icon="attach_file" title={f.file_name ? 'Replace file' : 'Upload a file'} busy={busy} onPress={upload} />
          {f.file_name ? <Txt v="small" style={{ flex: 1 }} numberOfLines={1}>{f.file_name}</Txt> : <Txt v="small" style={{ flex: 1 }}>PDF, video, audio or image, up to 100 MB</Txt>}
        </View>}
        <Txt v="bold" style={{ marginBottom: 8 }}>Cover</Txt>
        <CoverPicker name={f.title || 'Resource'} value={f.cover} trainerId={tid} onChange={(cover) => setF({ ...f, cover })} />
        <Txt v="bold" style={{ marginTop: 14, marginBottom: 8 }}>Who sees it</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <Chip label="All my clients" selected={f.audience === 'all'} onPress={() => setF({ ...f, audience: 'all' })} />
          <Chip label={f.audience === 'clients' ? `${f.client_ids.length} chosen` : 'Some clients'} selected={f.audience === 'clients'} onPress={() => { setF({ ...f, audience: 'clients' }); setPick(true); }} />
          <Chip label="Nobody yet (draft)" selected={f.audience === 'none'} onPress={() => setF({ ...f, audience: 'none' })} />
        </View>
      </>}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Button title="Save" icon="check" busy={busy} onPress={save} />
        {ed && <Button kind="danger" icon="delete" title="Delete" onPress={remove} />}
      </View>
      <ClientPicker visible={pick} onClose={() => setPick(false)} title="Who sees it" value={f.client_ids} onDone={(client_ids) => setF((x) => ({ ...x, client_ids }))} />
    </Sheet>
  );
}
