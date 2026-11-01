import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/shell';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { errText, parseInviteCode } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

/** Client accepts their trainer's invite. Opened from the invite link (…/join?code=XXXX) or typed in. */
export default function Join() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const params = useLocalSearchParams<{ code?: string }>();
  const [input, setInput] = useState(params.code ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const accept = async () => {
    setErr('');
    const code = parseInviteCode(input);
    if (!code) return setErr('Enter the 8-character code from your trainer (letters A–F and numbers), or paste the whole link.');
    setBusy(true);
    try {
      const { error } = await sb.rpc('coach_accept_invite', { p_code: code });
      if (error) throw error;
      await app.reloadMe();
      app.setMode('client');
      toast('You’re connected with your trainer');
      router.replace('/me');
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };

  return (
    <Screen kicker="Join your trainer" title="Enter your invite code">
      <Card style={{ maxWidth: 520, gap: 4 }}>
        <Field label="Invite code or link" value={input} onChangeText={setInput} autoCapitalize="characters" autoCorrect={false}
          placeholder="AB12CD34" onSubmitEditing={app.user ? accept : undefined} />
        {err ? <Txt v="bold" color={p.danger} style={{ marginBottom: 12 }} accessibilityLiveRegion="polite">{err}</Txt> : null}
        {app.user ? (
          <Button title="Connect" busy={busy} onPress={accept} />
        ) : (
          <View style={{ gap: 10 }}>
            <Txt v="small" style={{ fontSize: 15 }}>Sign in or create your Dragonfly account first. Your code stays filled in.</Txt>
            <Button title="Sign in or create account" onPress={() => router.push('/sign-in')} />
          </View>
        )}
      </Card>
    </Screen>
  );
}
