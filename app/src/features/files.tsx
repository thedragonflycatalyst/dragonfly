import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Row } from '@/components/bits';
import { Button, Card, Empty, Txt, useToast } from '@/components/ui';
import { ask } from '@/lib/ask';
import { fmtShort } from '@/lib/dates';
import { fmtSize, pickDocument, removeStored, signedUrls, uploadFile } from '@/lib/files';
import { errText, type ClientFile } from '@/lib/model';
import { sb } from '@/lib/supabase';
import type { SectionProps } from './common';

/** Files shared between trainer and client: PDFs, documents, images (25 MB each). */
export function Files({ client, role, me }: SectionProps) {
  const toast = useToast();
  const [rows, setRows] = useState<ClientFile[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb.from('coach_files').select('*').eq('client_id', client.id).order('created_at', { ascending: false });
    setRows((data as ClientFile[]) ?? []);
  }, [client.id]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setBusy(true);
    try {
      const picked = await pickDocument();
      if (!picked) return;
      const path = await uploadFile(client, picked);
      const { error } = await sb.from('coach_files').insert({ client_id: client.id, trainer_id: client.trainer_id, name: picked.name.slice(0, 200), path, size_bytes: picked.size, mime: picked.mime });
      if (error) { await removeStored([path]); throw error; }
      toast('File uploaded'); load();
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  const open = async (f: ClientFile) => {
    const url = (await signedUrls([f.path]))[f.path];
    if (!url) return toast('That file couldn’t be opened', false);
    if (Platform.OS === 'web') window.open(url, '_blank', 'noopener'); else await WebBrowser.openBrowserAsync(url);
  };
  const del = (f: ClientFile) => ask(`Delete ${f.name}?`, 'This can’t be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
    const { error } = await sb.from('coach_files').delete().eq('id', f.id);
    if (error) return toast(errText(error), false);
    await removeStored([f.path]); load();
  } }]);

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Button title="Upload a file" icon="attach_file" busy={busy} style={{ alignSelf: 'flex-start' }} onPress={add} />
        <Txt v="small">{role === 'coach' ? 'Your client can see and download these.' : 'Your trainer can see these.'} PDFs, documents, spreadsheets and images up to 25 MB.</Txt>
      </View>
      {rows && rows.length === 0 && <Empty emoji="📎" title="No files yet" body="Share plans, medical clearance, assessments or anything else here." />}
      {rows && rows.length > 0 && (
        <Card style={{ padding: 0 }}>
          {rows.map((f, i) => (
            <Row key={f.id} icon="description" title={f.name} sub={[fmtShort(f.created_at), fmtSize(f.size_bytes)].filter(Boolean).join(' · ')} last={i === rows.length - 1}
              onPress={() => open(f)} right={(role === 'coach' || f.uploaded_by === me) ? <Button small kind="quiet" title="Delete" onPress={() => del(f)} /> : undefined} />
          ))}
        </Card>
      )}
    </View>
  );
}
