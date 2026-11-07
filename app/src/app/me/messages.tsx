// Which messages a client wants from their trainer, and how. Each answer is stored with the time it was given.
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Card, Chip, Txt, useToast } from '@/components/ui';
import { Page } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';

type Purpose = 'reminders' | 'offers' | 'surveys' | 'marketing';
const ROWS: { purpose: Purpose; title: string; body: string }[] = [
  { purpose: 'reminders', title: 'Session reminders', body: 'A reminder before each session. Reply C to confirm or R to reschedule.' },
  { purpose: 'offers', title: 'Open spots', body: 'When someone cancels and a time you’re free opens up.' },
  { purpose: 'surveys', title: 'Quick feedback', body: 'Now and then, one question about how training is going.' },
  { purpose: 'marketing', title: 'Testimonials, referrals and group classes', body: 'Occasional asks to share your experience, refer a friend or join a group session.' },
];
/** Bump when the consent wording above changes */
const TEXT_VERSION = 2;
type Channel = 'sms' | 'email' | 'app';
const CH: [Channel, string][] = [['sms', 'By text'], ['email', 'By email'], ['app', 'In the app']];

export default function MyMessages() {
  const app = useApp();
  const toast = useToast();
  const me = app.membership;
  const [state, setState] = useState<Record<string, boolean>>({});
  const [preferred, setPreferred] = useState<Channel>('sms');
  useEffect(() => {
    if (!me) return;
    void sb.from('coach_contact_prefs').select('preferred_channel').eq('client_id', me.id).maybeSingle()
      .then(({ data }) => { if (data?.preferred_channel) setPreferred(data.preferred_channel as Channel); });
    void Promise.all(ROWS.flatMap((r) => CH.map(([ch]) => ch).map(async (ch) => {
      const { data } = await sb.rpc('coach_contact_allowed', { p_client: me.id, p_purpose: r.purpose, p_channel: ch });
      return [`${r.purpose}:${ch}`, data === true] as const;
    }))).then((pairs) => setState(Object.fromEntries(pairs)));
  }, [me]);
  const prefer = async (ch: Channel) => {
    if (!me) return;
    const { error } = await sb.from('coach_contact_prefs').upsert({ client_id: me.id, preferred_channel: ch, updated_at: new Date().toISOString() }, { onConflict: 'client_id' });
    if (error) return toast(errText(error), false);
    setPreferred(ch);
  };
  const toggle = async (purpose: Purpose, channel: Channel) => {
    if (!me) return;
    const k = `${purpose}:${channel}`, granted = !state[k];
    const { error } = await sb.from('coach_contact_consents').insert({ client_id: me.id, purpose, channel, granted, text_version: TEXT_VERSION, source: 'client' });
    if (error) return toast(errText(error), false);
    setState({ ...state, [k]: granted });
  };
  return (
    <Page title="Messages from your trainer">
      <Stack.Screen options={{ title: 'Messages' }} />
      {!me ? <Txt>Join a trainer first.</Txt> : (
        <View style={{ gap: 10 }}>
          <Card style={{ gap: 6 }}>
            <Txt v="bold">Reach me first by</Txt>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {CH.map(([ch, label]) => <Chip key={ch} label={ch === 'sms' ? 'Text (recommended)' : label.replace('By ', '').replace('In the app', 'The app')} selected={preferred === ch} onPress={() => prefer(ch)} />)}
            </View>
            <Txt v="small">Text is the default because it’s the hardest to miss. If we can’t reach you that way, we try the next one you allow.</Txt>
          </Card>
          <Txt v="small">Choose what you’d like and how. Texts go to {me.phone || 'your mobile number'} and emails to {me.email}. Reply STOP to any text to stop them all. Message and data rates may apply.</Txt>
          {ROWS.map((r) => (
            <Card key={r.purpose} style={{ gap: 6 }}>
              <Txt v="bold">{r.title}</Txt>
              <Txt v="small">{r.body}</Txt>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {CH.map(([ch, label]) => <Chip key={ch} label={label} selected={!!state[`${r.purpose}:${ch}`]} onPress={() => toggle(r.purpose, ch)} />)}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Page>
  );
}
