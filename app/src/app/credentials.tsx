// Credentials: what you hold or are working toward (trainers and clients), and a directory of certifications and challenges to
// explore. Directory entries link to the official site; Dragonfly doesn't award them, and requirements change, so people
// are told to confirm details there.
import * as DocumentPicker from 'expo-document-picker';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { Toggle } from '@/components/pickers';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Field, Icon, Txt, useToast } from '@/components/ui';
import { mediaUrl } from '@/features/exercises';
import { Page } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

type Catalog = { id: string; name: string; org: string; url: string; discipline: string; audience: 'trainer' | 'client' | 'both'; summary: string; verified_on: string | null };
type Mine = { id: string; catalog_id: string | null; name: string; org: string | null; status: 'held' | 'working'; earned_on: string | null; expires_on: string | null;
  file_path: string | null; note: string | null; show_on_profile: boolean };
const MEDIA = 'coach-media';
const open = (url: string) => (Platform.OS === 'web' ? window.open(url, '_blank', 'noopener') : WebBrowser.openBrowserAsync(url));
const DISCIPLINES = ['personal training', 'strength', 'kettlebell', 'specialty', 'nutrition', 'pilates', 'yoga', 'group fitness', 'aquatics', 'safety', 'challenge'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Days until a date (negative when past) */
const daysTo = (d: string) => Math.round((new Date(`${d}T12:00:00`).getTime() - Date.now()) / 86_400_000);

export default function Credentials() {
  const p = usePalette();
  const app = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<'mine' | 'explore'>('mine');
  const [catalog, setCatalog] = useState<Catalog[]>([]);
  const [mine, setMine] = useState<Mine[]>([]);
  const [who, setWho] = useState<'all' | 'trainer' | 'client'>(app.trainer ? 'trainer' : 'client');
  const [disc, setDisc] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Mine> | null>(null);
  const load = useCallback(async () => {
    const [c, m] = await Promise.all([
      sb.from('coach_credential_catalog').select('*').eq('active', true).order('sort'),
      sb.from('coach_user_credentials').select('*').eq('user_id', app.user?.id ?? '').order('status').order('expires_on', { nullsFirst: false }),
    ]);
    setCatalog((c.data as Catalog[]) ?? []); setMine((m.data as Mine[]) ?? []);
  }, [app.user?.id]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => catalog.filter((c) => (who === 'all' || c.audience === who || c.audience === 'both') && (!disc || c.discipline === disc)), [catalog, who, disc]);
  const have = new Map(mine.filter((m) => m.catalog_id).map((m) => [m.catalog_id!, m]));
  const add = (c: Catalog, status: 'held' | 'working') => setEditing({ catalog_id: c.id, name: c.name, org: c.org, status, show_on_profile: false });

  return (
    <Page title="Credentials">
      <Stack.Screen options={{ title: 'Credentials' }} />
      <Segmented value={tab} onChange={setTab} options={[['mine', `Mine${mine.length ? ` (${mine.length})` : ''}`], ['explore', 'Explore']]} />
      {tab === 'mine' ? (
        <View style={{ gap: 12, marginTop: 16 }}>
          {mine.length === 0 && <Txt>Keep your certifications here with their expiry dates and certificates, and track what you’re working toward. Find more under Explore.</Txt>}
          {(['held', 'working'] as const).map((st) => mine.some((m) => m.status === st) && (
            <View key={st} style={{ gap: 8 }}>
              <Txt v="kicker" color={p.muted} style={{ textTransform: 'uppercase' }}>{st === 'held' ? 'Earned' : 'Working toward'}</Txt>
              {mine.filter((m) => m.status === st).map((m) => {
                const left = m.expires_on ? daysTo(m.expires_on) : null;
                return (
                  <Card key={m.id} style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Txt v="bold" style={{ flex: 1 }}>{m.name}</Txt>
                      <Button small kind="quiet" title="Edit" onPress={() => setEditing(m)} />
                    </View>
                    {m.org ? <Txt v="small">{m.org}</Txt> : null}
                    <Txt v="small">{[m.earned_on && `Earned ${m.earned_on}`, m.expires_on && `Expires ${m.expires_on}`, m.show_on_profile && 'On your profile'].filter(Boolean).join(' · ')}</Txt>
                    {left !== null && left < 90 && <Txt v="small" color={left < 0 ? p.danger : p.gold}>{left < 0 ? 'Expired: renew it' : `Renew within ${left} days`}</Txt>}
                    {m.file_path ? <Button small kind="ghost" icon="description" title="Open certificate" style={{ alignSelf: 'flex-start' }}
                      onPress={async () => { const u = await mediaUrl(m.file_path!); if (u) void open(u); }} /> : null}
                  </Card>
                );
              })}
            </View>
          ))}
          <Button kind="ghost" icon="add" title="Add one that isn’t listed" style={{ alignSelf: 'flex-start' }} onPress={() => setEditing({ status: 'held', name: '', show_on_profile: false })} />
        </View>
      ) : (
        <View style={{ gap: 10, marginTop: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {([['trainer', 'For trainers'], ['client', 'Challenges for clients'], ['all', 'Everything']] as const).map(([k, l]) => <Chip key={k} label={l} selected={who === k} onPress={() => setWho(k)} />)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DISCIPLINES.filter((d) => catalog.some((c) => c.discipline === d)).map((d) => <Chip key={d} label={cap(d)} selected={disc === d} onPress={() => setDisc(disc === d ? null : d)} />)}
          </View>
          <Txt v="small">Requirements, prices and renewal rules change. Always confirm on the official site.</Txt>
          {shown.map((c) => {
            const h = have.get(c.id);
            return (
              <Card key={c.id} style={{ gap: 6 }}>
                <Txt v="bold">{c.name}</Txt>
                <Txt v="small">{c.org} · {cap(c.discipline)}</Txt>
                <Txt>{c.summary}</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  <Button small kind="ghost" icon="open_in_new" title="Official site" onPress={() => void open(c.url)} />
                  {h ? <Txt v="small" style={{ alignSelf: 'center' }}>{h.status === 'held' ? '✓ You have this' : 'You’re working toward this'}</Txt> : <>
                    <Button small title={c.audience === 'client' ? 'I’ve done this' : 'I have this'} onPress={() => add(c, 'held')} />
                    <Button small kind="quiet" title="Working toward it" onPress={() => add(c, 'working')} />
                  </>}
                </View>
              </Card>
            );
          })}
        </View>
      )}
      <Editor value={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); toast('Saved'); }} />
    </Page>
  );
}

function Editor({ value, onClose, onSaved }: { value: Partial<Mine> | null; onClose: () => void; onSaved: () => void }) {
  const app = useApp();
  const toast = useToast();
  const [v, setV] = useState<Partial<Mine>>({});
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (value) setV(value); }, [value]);
  const set = (x: Partial<Mine>) => setV((o) => ({ ...o, ...x }));
  const okDate = (d?: string | null) => !d || /^\d{4}-\d{2}-\d{2}$/.test(d);
  const save = async () => {
    if (!v.name?.trim() || v.name.trim().length < 2) return toast('Name it', false);
    if (!okDate(v.earned_on) || !okDate(v.expires_on)) return toast('Dates look like 2026-03-31', false);
    setBusy('save');
    const row = { catalog_id: v.catalog_id ?? null, name: v.name.trim(), org: v.org?.trim() || null, status: v.status ?? 'held', earned_on: v.earned_on || null,
      expires_on: v.expires_on || null, file_path: v.file_path ?? null, note: v.note?.trim() || null, show_on_profile: !!v.show_on_profile };
    const { error } = v.id ? await sb.from('coach_user_credentials').update(row).eq('id', v.id) : await sb.from('coach_user_credentials').insert(row);
    setBusy(null);
    if (error) return toast(errText(error), false);
    onSaved();
  };
  const remove = async () => {
    if (!v.id) return onClose();
    setBusy('remove');
    const { error } = await sb.from('coach_user_credentials').delete().eq('id', v.id);
    setBusy(null);
    if (error) return toast(errText(error), false);
    onSaved();
  };
  const upload = async () => {
    setBusy('file');
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
      const a = res.canceled ? undefined : res.assets[0];
      if (!a) return;
      if (a.size && a.size > 20 * 1024 * 1024) throw new Error('That file is over 20 MB.');
      const ext = (a.name.match(/\.(\w+)$/)?.[1] ?? 'pdf').toLowerCase();
      const path = `${app.user?.id}/credentials/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const bytes = Platform.OS === 'web' ? await (await fetch(a.uri)).arrayBuffer() : await new (await import('expo-file-system')).File(a.uri).arrayBuffer();
      const { error } = await sb.storage.from(MEDIA).upload(path, bytes, { contentType: a.mimeType ?? 'application/pdf' });
      if (error) throw error;
      set({ file_path: path }); toast('Certificate attached');
    } catch (e) { toast(errText(e), false); } finally { setBusy(null); }
  };
  return (
    <Sheet visible={!!value} onClose={onClose} title={v.id ? 'Edit credential' : 'Add credential'}>
      <View style={{ marginBottom: 12 }}><Segmented value={v.status ?? 'held'} onChange={(s) => set({ status: s })} options={[['held', 'I have it'], ['working', 'Working toward it']]} /></View>
      <Field label="Name *" value={v.name ?? ''} onChangeText={(t) => set({ name: t })} placeholder="Certified Personal Trainer" />
      <Field label="Organization" value={v.org ?? ''} onChangeText={(t) => set({ org: t })} placeholder="NASM" />
      {v.status !== 'working' && <>
        <Field label="Earned on" hint="(YYYY-MM-DD)" value={v.earned_on ?? ''} onChangeText={(t) => set({ earned_on: t })} placeholder="2025-06-01" />
        <Field label="Expires on" hint="(YYYY-MM-DD, if it does)" value={v.expires_on ?? ''} onChangeText={(t) => set({ expires_on: t })} placeholder="2027-06-01" />
      </>}
      <Field label="Notes" value={v.note ?? ''} onChangeText={(t) => set({ note: t })} multiline placeholder={v.status === 'working' ? 'Exam date, what’s left to study…' : 'CEUs, renewal steps…'} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Button small kind="ghost" icon="attach_file" title={v.file_path ? 'Replace certificate' : 'Attach certificate (PDF or photo)'} busy={busy === 'file'} onPress={upload} />
        {v.file_path ? <><Icon name="task_alt" size={18} /><Button small kind="quiet" title="Remove" onPress={() => set({ file_path: null })} /></> : null}
      </View>
      {v.status !== 'working' && <Toggle label="Show on my profile" sub="Others see the name, organization and dates, never the certificate file." value={!!v.show_on_profile} onChange={(b) => set({ show_on_profile: b })} />}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Button title="Save" busy={busy === 'save'} onPress={save} />
        {v.id ? <Button kind="ghost" title="Remove" busy={busy === 'remove'} onPress={remove} /> : null}
      </View>
    </Sheet>
  );
}
