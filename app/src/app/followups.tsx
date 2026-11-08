// Trainer: changes to make by hand somewhere else (ClubAutomation), kept until marked done.
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Button, Card, Empty, Txt, useToast } from '@/components/ui';
import { type Followup } from '@/features/followup-bar';
import { confirm } from '@/lib/ask';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

export default function Followups() {
  const p = usePalette();
  const toast = useToast();
  const [rows, setRows] = useState<Followup[]>([]);
  const load = useCallback(async () => {
    const { data } = await sb.from('coach_followups').select('id, title, created_at, status, done_at').order('created_at', { ascending: false }).limit(50);
    setRows((data as Followup[] | null) ?? []);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const done = async (f: Followup) => {
    if (!(await confirm('Done in ClubAutomation?', f.title, 'Yes, it’s done'))) return;
    const { error } = await sb.rpc('coach_followup_done', { p_id: f.id });
    if (error) return toast(errText(error), false);
    toast('Marked done'); void load();
  };
  const open = rows.filter((r) => r.status === 'open'), closed = rows.filter((r) => r.status === 'done').slice(0, 10);
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Update ClubAutomation' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          {open.length === 0 ? <Empty emoji="✅" title="All caught up" body="When a session moves, the change to make in ClubAutomation shows here until you mark it done." />
            : open.map((f) => (
              <Card key={f.id} style={{ gap: 8, borderLeftWidth: 4, borderLeftColor: p.danger }}>
                <Txt v="bold">{f.title}</Txt>
                <Txt v="small">Since {new Date(f.created_at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}. You’ll get a phone alert every hour until it’s done.</Txt>
                <Button icon="check" title="Done, it’s changed in ClubAutomation" onPress={() => done(f)} />
              </Card>
            ))}
          {closed.length > 0 && <>
            <SectionLabel>Done</SectionLabel>
            {closed.map((f) => <Txt key={f.id} v="small">✓ {f.title}</Txt>)}
          </>}
        </View>
      </ScrollView>
    </View>
  );
}
