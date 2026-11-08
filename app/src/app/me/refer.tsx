// Refer a friend: the client's own referral link to share.
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share } from 'react-native';
import { Button, Card, Txt } from '@/components/ui';
import { Page } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { sb, WEB_URL } from '@/lib/supabase';

export default function Refer() {
  const app = useApp();
  const me = app.membership;
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => {
    if (!me) return;
    void sb.rpc('coach_referral_code', { p_client: me.id }).then(({ data }) => { if (data) setLink(`${WEB_URL}r/${data as string}`); });
  }, [me]);
  const trainer = app.myTrainer?.display_name ?? 'my trainer';
  return (
    <Page title="Refer a friend">
      <Stack.Screen options={{ title: 'Refer a friend' }} />
      <Card style={{ gap: 8 }}>
        <Txt>Know someone who’d enjoy training with {trainer}? Share your link. They leave their details and {trainer} gets in touch.</Txt>
        <Txt v="bold" selectable>{link ?? 'Getting your link…'}</Txt>
        <Button title="Share my link" disabled={!link} onPress={() => link && Share.share({ message: `I train with ${trainer} and think you’d like it: ${link}` })} />
      </Card>
    </Page>
  );
}
