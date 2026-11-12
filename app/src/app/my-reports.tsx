// The exercise problems this person reported (issue #58) and where each one is: submitted, under review, fixed, released.
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Button, Card, Empty, Txt } from '@/components/ui';
import { KIND_LABEL, refLabel, STATUS_LABEL, type ReportStatus } from '@/lib/exercise-report';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

type Mine = { id: string; ref_no: number; name: string; kind: string; status: string; created_at: string; updated_at: string };

export default function MyReports() {
  const p = usePalette();
  const [rows, setRows] = useState<Mine[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setFailed(false);
    const { data: u } = await sb.auth.getUser();
    const { data, error } = await sb.from('coach_exercise_reports').select('id, ref_no, name, kind, status, created_at, updated_at')
      .eq('user_id', u.user?.id ?? '').order('created_at', { ascending: false }).limit(100);
    if (error) { setFailed(true); setRows([]); return; }
    setRows((data as Mine[]) ?? []);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
      <Stack.Screen options={{ title: 'My problem reports' }} />
      <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
        {failed && <Card style={{ gap: 6 }}><Txt v="small">Couldn’t load your reports. Check your connection.</Txt><Button small title="Try again" onPress={load} style={{ alignSelf: 'flex-start' }} /></Card>}
        {rows === null ? <ActivityIndicator color={p.ink} /> : rows.length === 0 && !failed
          ? <Empty emoji="🏳️" title="No reports yet" body="Open any exercise and tap Report a problem if something looks wrong." /> : (
          <Card style={{ padding: 0 }}>
            {rows.map((r, i) => (
              <View key={r.id} style={{ padding: 14, gap: 2, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                <Txt v="bold">{refLabel(r.ref_no)} · {r.name}</Txt>
                <Txt v="small">{KIND_LABEL[r.kind] ?? r.kind} · sent {new Date(r.created_at).toLocaleDateString()}</Txt>
                <Txt v="small" color={r.status === 'released' || r.status === 'fixed' ? p.good : p.focus}>{STATUS_LABEL[r.status as ReportStatus] ?? r.status}</Txt>
              </View>
            ))}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
