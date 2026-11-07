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
const TEXT_VERSION = 1;

export default function MyMessages() {
  const app = useApp();
  const toast = useToast();
  const me = app.membership;
  const [state, setState] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!me) return;
    void Promise.all(ROWS.flatMap((r) => (['sms', 'app'] as const).map(async (ch) => {
      const { data } = await sb.rpc('coach_contact_allowed', { p_client: me.id, p_purpose: r.purpose, p_channel: ch });
      return [`${r.purpose}:${ch}`, data === true] as const;
    }))).then((pairs) => setState(Object.fromEntries(pairs)));
  }, [me]);
  const toggle = async (purpose: Purpose, channel: 'sms' | 'app') => {
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
          <Txt v="small">Choose what you’d like and how. Texts go to {me.phone || 'your mobile number'}; reply STOP to any text to stop them all. Message and data rates may apply.</Txt>
          {ROWS.map((r) => (
            <Card key={r.purpose} style={{ gap: 6 }}>
              <Txt v="bold">{r.title}</Txt>
              <Txt v="small">{r.body}</Txt>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Chip label="By text" selected={!!state[`${r.purpose}:sms`]} onPress={() => toggle(r.purpose, 'sms')} />
                <Chip label="In the app" selected={!!state[`${r.purpose}:app`]} onPress={() => toggle(r.purpose, 'app')} />
              </View>
            </Card>
          ))}
        </View>
      )}
    </Page>
  );
}
