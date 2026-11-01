import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/shell';
import { Button, Card, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';

/**
 * Signed in with a Dragonfly account that isn't a trainer here and that no trainer has added
 * (e.g. someone who only used another Dragonfly app). Clients normally never see this.
 */
export default function Start() {
  const toast = useToast();
  const app = useApp();
  const [busy, setBusy] = useState(false);

  if (!app.user) return <Redirect href="/sign-in" />;
  if (app.mode) return <Redirect href="/" />;

  return (
    <Screen kicker={`Hi ${app.username ?? ''}`} title="You’re not connected to a trainer yet">
      <View style={{ gap: 14, maxWidth: 560 }}>
        <Card style={{ gap: 8 }}>
          <Txt style={{ fontSize: 17 }}>
            Ask your trainer to add you with <Txt v="bold">{app.user.email}</Txt>. Your training shows up here as soon as they do.
          </Txt>
          <Button kind="quiet" small title="Check again" style={{ alignSelf: 'flex-start', marginTop: 4 }}
            onPress={async () => { if (!(await app.reloadMe())) toast('No trainer has added this email yet', false); }} />
        </Card>
        <Button kind="ghost" small title="I’m a trainer" busy={busy} style={{ alignSelf: 'flex-start' }} onPress={async () => {
          setBusy(true);
          try { await app.becomeTrainer(); router.replace('/'); } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
        }} />
      </View>
    </Screen>
  );
}
