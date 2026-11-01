import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/shell';
import { Button, Card, Field, Icon, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

/** Signed in but not linked to anything yet: join a trainer, or set up as one. */
export default function Start() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const [coaching, setCoaching] = useState(false);
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [busy, setBusy] = useState(false);

  if (!app.user) return <Redirect href="/welcome" />;
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
    <Screen kicker={`Hi ${app.username ?? ''}`} title="How will you use Dragonfly Coach?">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        <Card style={{ flexGrow: 1, flexBasis: 300, gap: 8 }}>
          <Icon name="link" color={p.focus} size={26} />
          <Txt v="h2">I’m training with a coach</Txt>
          <Txt v="small" style={{ fontSize: 15 }}>Your trainer sends you an invite code or link. Enter it to connect.</Txt>
          <Button title="Enter invite code" style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={() => router.push('/join')} />
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 300, gap: 8 }}>
          <Icon name="sports_gymnastics" color={p.focus} size={26} />
          <Txt v="h2">I’m a trainer</Txt>
          <Txt v="small" style={{ fontSize: 15 }}>Set up your coaching space to add clients and build their programs.</Txt>
          {coaching ? (
            <View style={{ marginTop: 6 }}>
              <Field label="Your name, as clients see it" value={name} onChangeText={setName} placeholder="Coach Emmet" autoComplete="name" />
              <Field label="Business name" hint="(optional)" value={business} onChangeText={setBusiness} placeholder="The Dragonfly Catalyst" />
              <Button title="Create coaching space" busy={busy} onPress={becomeTrainer} />
            </View>
          ) : (
            <Button kind="ghost" title="Set up as a trainer" style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={() => setCoaching(true)} />
          )}
        </Card>
      </View>
    </Screen>
  );
}
