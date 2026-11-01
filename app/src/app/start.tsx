import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/shell';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

/** Signed in, but not a trainer here yet and no trainer has added this email: set up a coaching space. */
export default function Start() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [busy, setBusy] = useState(false);

  if (!app.user) return <Redirect href="/sign-in" />;
  if (app.mode) return <Redirect href="/" />;

  const becomeTrainer = async () => {
    if (!name.trim()) return toast('Enter the name your clients will see', false);
    setBusy(true);
    try {
      const { error } = await sb.from('coach_trainers').insert({
        user_id: app.user!.id, display_name: name.trim(), business_name: business.trim() || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      });
      if (error) throw error;
      await app.reloadMe();
      app.setMode('coach');
      toast('Your coaching space is ready');
      router.replace('/coach');
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };

  return (
    <Screen kicker={`Hi ${app.username ?? ''}`} title="Set up your coaching space">
      <View style={{ gap: 14, maxWidth: 560 }}>
        <Card>
          <Field label="Your name, as clients see it" value={name} onChangeText={setName} placeholder="Coach Emmet" autoComplete="name" />
          <Field label="Business name" hint="(optional)" value={business} onChangeText={setBusiness} placeholder="The Dragonfly Catalyst" />
          <Button title="Create coaching space" busy={busy} onPress={becomeTrainer} />
        </Card>
        <Card style={{ gap: 6 }}>
          <Txt v="h3">Here as a client?</Txt>
          <Txt v="small" style={{ fontSize: 15 }}>
            Ask your trainer to add you with <Txt v="smallBold" style={{ fontSize: 15 }}>{app.user.email}</Txt>. Your training shows up here as soon as they do.
          </Txt>
          <Button kind="quiet" small title="Check again" icon="schedule" style={{ alignSelf: 'flex-start', marginTop: 4 }}
            onPress={async () => { if (!(await app.reloadMe())) toast('No trainer has added this email yet', false); }} />
        </Card>
        <Txt v="small" color={p.muted}>You can be both a trainer and a client with the same account.</Txt>
      </View>
    </Screen>
  );
}
