import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Empty } from '@/components/ui';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

/** Opens the private chat with a client (?client=) or a person (?user=), creating it if needed */
export default function NewChat() {
  const p = usePalette();
  const { client, user } = useLocalSearchParams<{ client?: string; user?: string }>();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      let uid = user ?? null;
      if (!uid && client) {
        const { data } = await sb.from('coach_clients').select('user_id, first_name').eq('id', client).maybeSingle();
        if (!data?.user_id) return setErr(`${data?.first_name ?? 'This client'} hasn’t signed in to Dragonfly yet. Once they do, you can chat here. Until then, text or email them.`);
        uid = data.user_id;
      }
      if (!uid) return setErr('Nobody to message.');
      const { data, error } = await sb.rpc('coach_chat_direct', { p_user: uid });
      if (error) return setErr(/messages_closed/.test(error.message) ? 'Messages are turned off.' : errText(error));
      router.replace({ pathname: '/chat/[id]', params: { id: data as string } });
    })();
  }, [client, user]);
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center', padding: 16 }}>
      {err ? <Empty emoji="💬" title="Can’t chat yet" body={err} action={<Button kind="ghost" title="Back" onPress={() => router.back()} />} /> : <ActivityIndicator color={p.ink} />}
    </View>
  );
}
