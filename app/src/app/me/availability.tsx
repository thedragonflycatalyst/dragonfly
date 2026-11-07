// "When I'm free": a client's usual free times and whether they want short-notice offers when a slot opens.
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Txt, useToast } from '@/components/ui';
import { FreeTimes, Waitlist } from '@/features/client-pool';
import { Page } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';

export default function MyAvailability() {
  const app = useApp();
  const toast = useToast();
  const me = app.membership;
  const [ok, setOk] = useState(!!me?.short_notice_ok);
  const [busy, setBusy] = useState(false);
  const change = async (on: boolean) => {
    setBusy(true);
    const { error } = await sb.rpc('coach_set_short_notice', { p_ok: on });
    setBusy(false);
    if (error) return toast(errText(error), false);
    setOk(on);
    toast(on ? 'You’ll get a text when a spot opens at a time you’re free.' : 'No more short-notice offers.');
  };
  return (
    <Page title="When I’m free">
      <Stack.Screen options={{ title: 'When I’m free' }} />
      {!me ? <Txt>Join a trainer first.</Txt> : (
        <View style={{ gap: 12 }}>
          <Card style={{ gap: 8 }}>
            <Txt v="bold">Short-notice offers</Txt>
            <Txt v="small">When someone cancels, your trainer can text you the open spot. The first to accept gets it. You can turn this off anytime.</Txt>
            {ok ? <Button kind="ghost" title="Stop short-notice offers" busy={busy} onPress={() => change(false)} />
              : <Button title="Yes, send me open spots" busy={busy} onPress={() => change(true)} />}
          </Card>
          <Card style={{ gap: 8 }}>
            <Txt v="bold">Times I’m usually free</Txt>
            <FreeTimes clientId={me.id} />
          </Card>
          <Card style={{ gap: 8 }}>
            <Txt v="bold">Waitlist for times that are taken</Txt>
            <Waitlist clientId={me.id} editable />
          </Card>
        </View>
      )}
    </Page>
  );
}
