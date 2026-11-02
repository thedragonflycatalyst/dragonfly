import Constants from 'expo-constants';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Badge } from '@/components/shell';
import { Button, Card, Chip, Field, Txt, useToast } from '@/components/ui';
import { Page } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

type Kind = 'feature' | 'design' | 'bug' | 'other';
type Status = 'new' | 'planned' | 'done' | 'declined';
type Item = { id: string; user_id: string; kind: Kind; body: string; screen: string | null; device: string | null; status: Status; reply: string | null; created_at: string };
const KINDS: Record<Kind, string> = { feature: 'Feature idea', design: 'Design / look', bug: 'Something’s broken', other: 'Other' };
const STATUS: Record<Status, string> = { new: 'Sent', planned: 'Planned', done: 'Done', declined: 'Not planned' };

/** Send ideas for features and design straight to Dragonfly, and see the replies. Admins answer everyone's here. */
export default function Feedback() {
  const p = usePalette();
  const app = useApp();
  const toast = useToast();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [kind, setKind] = useState<Kind>('feature');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Item[]>([]);
  const [admin, setAdmin] = useState(false);
  const [all, setAll] = useState<Item[]>([]);
  const [filter, setFilter] = useState<Status | 'all'>('new');
  const load = useCallback(async () => {
    if (!app.user) return;
    const [m, a] = await Promise.all([
      sb.from('dragonfly_feedback').select('*').eq('user_id', app.user.id).order('created_at', { ascending: false }).limit(50),
      sb.rpc('dragonfly_is_admin'),
    ]);
    setMine((m.data as Item[]) ?? []);
    setAdmin(a.data === true);
    if (a.data === true) {
      const r = await sb.from('dragonfly_feedback').select('*').eq('app', 'coach').order('created_at', { ascending: false }).limit(200);
      setAll((r.data as Item[]) ?? []);
    }
  }, [app.user]);
  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    if (body.trim().length < 3) return toast('Tell us a little more first', false);
    setBusy(true);
    const device = `${Platform.OS} · app ${Constants.expoConfig?.version ?? '?'}`;
    const { error } = await sb.from('dragonfly_feedback').insert({ app: 'coach', kind, body: body.trim(), screen: from?.slice(0, 200) ?? null, device });
    setBusy(false);
    if (error) return toast(error.message.includes('feedback_limit') ? 'That’s 20 today. Thank you! Send more tomorrow.' : errText(error), false);
    setBody(''); toast('Sent. Thank you!'); void load();
  };

  return (
    <Page title="Send feedback">
      <Stack.Screen options={{ title: 'Send feedback' }} />
      <Card style={{ gap: 12 }}>
        <Txt>Ideas for new features, changes to how something looks or works, or anything that broke: it goes straight to the people building Dragonfly.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(KINDS) as Kind[]).map((k) => <Chip key={k} label={KINDS[k]} selected={kind === k} onPress={() => setKind(k)} />)}
        </View>
        <Field label={kind === 'bug' ? 'What happened, and what did you expect?' : kind === 'design' ? 'What would you change about how it looks or works?' : 'Your idea'}
          value={body} onChangeText={(t) => setBody(t.slice(0, 4000))} multiline placeholder={kind === 'feature' ? 'It would be great if…' : ''} style={{ minHeight: 120, textAlignVertical: 'top' }} />
        {from ? <Txt v="small">We’ll note you were on {from}.</Txt> : null}
        <Button title="Send" icon="send" busy={busy} onPress={send} style={{ alignSelf: 'flex-start' }} />
      </Card>

      {mine.length > 0 && <>
        <SectionLabel>What you’ve sent</SectionLabel>
        <Card style={{ padding: 0 }}>
          {mine.map((f, i) => <Entry key={f.id} f={f} last={i === mine.length - 1} />)}
        </Card>
      </>}

      {admin && <>
        <SectionLabel>Everyone’s feedback (admin)</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {(['new', 'planned', 'done', 'declined', 'all'] as const).map((s) => (
            <Chip key={s} label={`${s === 'all' ? 'All' : STATUS[s]} (${all.filter((f) => s === 'all' || f.status === s).length})`} selected={filter === s} onPress={() => setFilter(s)} />
          ))}
        </View>
        <Card style={{ padding: 0 }}>
          {all.filter((f) => filter === 'all' || f.status === filter).map((f, i, list) => <Entry key={f.id} f={f} last={i === list.length - 1} admin onChanged={load} />)}
          {all.filter((f) => filter === 'all' || f.status === filter).length === 0 && <Txt v="small" style={{ padding: 14 }}>Nothing here.</Txt>}
        </Card>
      </>}
      <View style={{ height: 1, backgroundColor: p.bg }} />
    </Page>
  );
}

function Entry({ f, last, admin, onChanged }: { f: Item; last: boolean; admin?: boolean; onChanged?: () => void }) {
  const p = usePalette();
  const toast = useToast();
  const [reply, setReply] = useState(f.reply ?? '');
  const update = async (patch: Partial<Item>) => {
    const { error } = await sb.from('dragonfly_feedback').update(patch).eq('id', f.id);
    if (error) toast(errText(error), false); else { toast('Saved'); onChanged?.(); }
  };
  const color = f.status === 'done' ? p.good : f.status === 'planned' ? p.focus : f.status === 'declined' ? p.muted : p.gold;
  return (
    <View style={{ padding: 14, gap: 6, borderBottomWidth: last ? 0 : 1, borderBottomColor: p.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Txt v="smallBold">{KINDS[f.kind]}</Txt>
        <Badge text={STATUS[f.status]} color={color} />
        <Txt v="small">{new Date(f.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Txt>
      </View>
      <Txt>{f.body}</Txt>
      {admin && (f.screen || f.device) ? <Txt v="small">{[f.screen, f.device].filter(Boolean).join(' · ')}</Txt> : null}
      {!admin && f.reply ? <View style={{ borderLeftWidth: 3, borderLeftColor: p.focus, paddingLeft: 10 }}><Txt v="small" color={p.ink}>{f.reply}</Txt></View> : null}
      {admin && (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(Object.keys(STATUS) as Status[]).map((s) => <Chip key={s} label={STATUS[s]} selected={f.status === s} onPress={() => update({ status: s })} />)}
          </View>
          <Field label="Reply (they’ll see it)" value={reply} onChangeText={setReply} multiline />
          <Button small kind="ghost" title="Save reply" onPress={() => update({ reply: reply.trim() || null })} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}
    </View>
  );
}
