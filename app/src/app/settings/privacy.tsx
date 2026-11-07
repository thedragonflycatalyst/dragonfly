// Photos and AI: read the notice, see your current answer, and change it.
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Txt, useToast } from '@/components/ui';
import { AI_PHOTO_NOTICE, AI_PHOTO_NOTICE_VERSION, recordAiPhotoConsent } from '@/features/ai-photo-consent';
import { Page } from '@/features/settings-page';
import { sb } from '@/lib/supabase';

export default function PrivacySettings() {
  const toast = useToast();
  const [answer, setAnswer] = useState<{ granted: boolean; at: string } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void sb.rpc('coach_consent_current', { p_kind: 'ai_photos' }).then(({ data }) => {
      const row = (data as { version: number; granted: boolean; created_at: string }[] | null)?.[0];
      setAnswer(row ? { granted: row.granted && row.version >= AI_PHOTO_NOTICE_VERSION, at: row.created_at } : null);
    });
  }, []);
  const change = async (granted: boolean) => {
    setBusy(true);
    try {
      await recordAiPhotoConsent(granted);
      setAnswer({ granted, at: new Date().toISOString() });
      toast(granted ? 'Photos can be sent to AI when you ask.' : 'Photos won’t be sent to AI. You can still search or add things yourself.');
    } catch { toast('Couldn’t save your answer. Try again.', false); } finally { setBusy(false); }
  };
  return (
    <Page title="Photos and AI">
      <Stack.Screen options={{ title: 'Photos and AI' }} />
      <Card>
        <View style={{ gap: 8 }}>
          {AI_PHOTO_NOTICE.map((line) => <Txt key={line}>{line}</Txt>)}
        </View>
      </Card>
      <Txt v="small" style={{ marginVertical: 12 }}>
        {answer === undefined ? 'Loading…' : answer === null ? 'You haven’t answered yet. We’ll ask the first time you scan a machine or estimate a meal.'
          : `${answer.granted ? 'You agreed' : 'You said no'} on ${new Date(answer.at).toLocaleDateString()}.`}
      </Txt>
      {answer?.granted
        ? <Button kind="ghost" title="Stop sending photos to AI" onPress={() => change(false)} busy={busy} />
        : <Button title="Allow photos to be sent to AI" onPress={() => change(true)} busy={busy} />}
    </Page>
  );
}
