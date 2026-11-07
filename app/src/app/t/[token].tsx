// Testimonial link: the client writes (or edits) their words, chooses how their name shows, and approves.
// Nothing is published until they press Publish; they can withdraw it here anytime.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Chip, Field, Txt } from '@/components/ui';
import { LinkPage } from '@/features/link-page';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

type V = { trainer_name: string; client_first: string; client_last_initial: string; body: string | null; display_style: Style; status: string };
type Style = 'first_name' | 'first_initial' | 'anonymous';

export default function Testimonial() {
  const p = usePalette();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [v, setV] = useState<V | null | undefined>(undefined);
  const [body, setBody] = useState('');
  const [style, setStyle] = useState<Style>('first_initial');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = () => sb.rpc('coach_testimonial_view', { p_token: token }).then(({ data }) => {
    const row = ((data as V[] | null) ?? [])[0] ?? null;
    setV(row); if (row) { setBody(row.body ?? ''); setStyle(row.display_style); }
  });
  useEffect(() => { void load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (publish: boolean) => {
    setBusy(true); setMsg('');
    const { data, error } = await sb.rpc('coach_testimonial_submit', { p_token: token, p_body: body, p_style: style, p_publish: publish });
    setBusy(false);
    if (error) return setMsg(error.message.includes('write_a_little_more') ? 'Write a little more first.' : 'Couldn’t save that. Try again.');
    setMsg(data === 'published' ? 'Published. Thank you!' : data === 'withdrawn' ? 'Withdrawn. It’s no longer shown.' : 'Saved as a draft. Nothing is shown until you publish.');
    void load();
  };
  if (v === undefined) return <LinkPage title="Testimonial"><ActivityIndicator color={p.ink} /></LinkPage>;
  if (v === null) return <LinkPage title="Testimonial"><Txt>This link isn’t valid any more.</Txt></LinkPage>;
  if (v.status === 'hidden') return <LinkPage title="Testimonial"><Txt>Thanks, {v.client_first}. This one isn’t shown at the moment.</Txt></LinkPage>;
  const names: Record<Style, string> = { first_name: v.client_first, first_initial: `${v.client_first} ${v.client_last_initial ? `${v.client_last_initial}.` : ''}`.trim(), anonymous: 'A client' };
  return (
    <LinkPage title="Share your experience">
      <Txt v="h2">Share your experience</Txt>
      <Txt>A few words about training with {v.trainer_name}. Once you press Publish, it can appear on {v.trainer_name}’s website exactly as you wrote it.</Txt>
      <Field label="Your words" value={body} onChangeText={setBody} multiline maxLength={1500} />
      <Txt v="small">Please leave out health details and other people’s names.</Txt>
      <Txt v="bold">Show my name as</Txt>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(Object.keys(names) as Style[]).map((k) => <Chip key={k} label={names[k]} selected={style === k} onPress={() => setStyle(k)} />)}
      </View>
      {msg ? <Txt color={msg.startsWith('Couldn') || msg.startsWith('Write') ? p.danger : p.good}>{msg}</Txt> : null}
      {v.status === 'published'
        ? <><Button title="Update" busy={busy} onPress={() => submit(true)} /><Button kind="ghost" title="Withdraw it" disabled={busy} onPress={() => submit(false)} /></>
        : <><Button title="Publish" busy={busy} onPress={() => submit(true)} /><Button kind="ghost" title="Save without publishing" disabled={busy} onPress={() => submit(false)} /></>}
    </LinkPage>
  );
}
