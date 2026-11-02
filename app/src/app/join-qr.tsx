import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Share, View } from 'react-native';
import { QrCode } from '@/components/qr';
import { Button, Card, Txt, useToast } from '@/components/ui';
import { Page } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { confirm } from '@/lib/ask';
import { errText } from '@/lib/model';
import { sb, WEB_URL } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 57]).join('');

/** Trainer: a QR code to sign a client up in person. They scan it, make an account, and they're on your client list. */
export default function JoinQr() {
  const p = usePalette();
  const app = useApp();
  const toast = useToast();
  const tid = app.trainer?.user_id;
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const save = async (c: string) => {
    const { error } = await sb.from('coach_trainer_details').upsert({ user_id: tid, join_code: c, updated_at: new Date().toISOString() });
    if (error) { toast(errText(error), false); return; }
    setCode(c);
  };
  useEffect(() => {
    if (!tid) return;
    sb.from('coach_trainer_details').select('join_code').eq('user_id', tid).maybeSingle().then(({ data }) => {
      if (data?.join_code) setCode(data.join_code); else if (!app.viewing) save(newCode()); else setCode(null);
    });
  }, [tid]); // eslint-disable-line react-hooks/exhaustive-deps
  const link = code ? `${WEB_URL}join/${code}` : '';
  return (
    <Page title="Sign up in person">
      <Stack.Screen options={{ title: 'Sign up in person' }} />
      <Card style={{ alignItems: 'center', gap: 14, paddingVertical: 24 }}>
        {code === undefined ? <ActivityIndicator color={p.ink} /> : code === null ? <Txt center>Only {app.trainer?.display_name} can show their sign-up code.</Txt> : <>
          <Txt v="h2" center>Scan to join {app.trainer?.business_name || app.trainer?.display_name}</Txt>
          <QrCode value={link} size={260} label="Sign-up QR code" />
          <Txt v="small" center style={{ maxWidth: 420 }}>Have them point their phone’s camera at the code. They make an account on the page it opens, they’re added to your clients straight away, and then they can download the app.</Txt>
        </>}
      </Card>
      {code ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          <Button kind="ghost" small icon="content_copy" title="Copy link" onPress={async () => { await Clipboard.setStringAsync(link); toast('Copied'); }} />
          <Button kind="ghost" small icon="share" title="Share link" onPress={() => Share.share({ message: `Join me on Dragonfly: ${link}` }).catch(() => {})} />
          <Button kind="quiet" small title="Make a new code" onPress={async () => {
            if (await confirm('Make a new code?', 'The old QR code and link stop working. Clients who already joined aren’t affected.', 'New code', true)) save(newCode());
          }} />
        </View>
      ) : null}
      <Txt v="small" center>Anyone with this code can join as your client, so share the link with people you train. You can archive anyone from your client list.</Txt>
    </Page>
  );
}
