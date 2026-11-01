import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { ask } from '@/lib/ask';
import { fmtShort, fmtTime } from '@/lib/dates';
import { errText, type Note } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';
import type { SectionProps } from './common';

/** Trainer-only notes about a client, newest first, pinned ones on top. */
export function Notes({ client }: SectionProps) {
  const p = usePalette();
  const toast = useToast();
  const [rows, setRows] = useState<Note[] | null>(null);
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb.from('coach_notes').select('*').eq('client_id', client.id).order('pinned', { ascending: false }).order('created_at', { ascending: false });
    setRows((data as Note[]) ?? []);
  }, [client.id]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!body.trim()) return;
    const { error } = await sb.from('coach_notes').insert({ client_id: client.id, trainer_id: client.trainer_id, body: body.trim() });
    if (error) return toast(errText(error), false);
    setBody(''); load();
  };
  const update = async (id: string, patch: Partial<Note>) => {
    const { error } = await sb.from('coach_notes').update(patch).eq('id', id);
    if (error) return toast(errText(error), false);
    setEditing(null); load();
  };

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Field label="New note" hint="(only you see notes)" value={body} onChangeText={setBody} multiline placeholder="Injuries, preferences, what you talked about…" />
        <Button title="Add note" style={{ alignSelf: 'flex-start' }} onPress={add} />
      </Card>
      {rows && rows.length === 0 && <Empty emoji="📝" title="No notes yet" />}
      {(rows ?? []).map((n) => (
        <Card key={n.id} style={{ gap: 8, borderWidth: n.pinned ? 1.5 : 0, borderColor: p.gold }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Txt v="small">{fmtShort(n.created_at)} {fmtTime(n.created_at)}{n.updated_at > n.created_at ? ' · edited' : ''}</Txt>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={n.pinned ? 'Unpin note' : 'Pin note'} hitSlop={8} onPress={() => update(n.id, { pinned: !n.pinned })}>
                <Icon name="push_pin" size={20} color={n.pinned ? p.gold : p.muted} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Edit note" hitSlop={8} onPress={() => setEditing({ id: n.id, body: n.body })}><Icon name="edit" size={20} color={p.muted} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Delete note" hitSlop={8} onPress={() => ask('Delete this note?', 'This can’t be undone.', [
                { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await sb.from('coach_notes').delete().eq('id', n.id); load(); } }])}>
                <Icon name="delete" size={20} color={p.muted} />
              </Pressable>
            </View>
          </View>
          {editing?.id === n.id ? (
            <>
              <Field label="Edit note" value={editing.body} onChangeText={(v) => setEditing({ id: n.id, body: v })} multiline />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button small title="Save" onPress={() => editing.body.trim() && update(n.id, { body: editing.body.trim() })} />
                <Button small kind="ghost" title="Cancel" onPress={() => setEditing(null)} />
              </View>
            </>
          ) : <Txt selectable>{n.body}</Txt>}
        </Card>
      ))}
    </View>
  );
}
