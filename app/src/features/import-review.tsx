import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { DateField } from '@/components/date-field';
import { Sheet } from '@/components/sheet';
import { Button, Icon, Txt, useToast } from '@/components/ui';
import { addBookings, bookingLine, needsDay, toBookings, type FoundSession } from '@/features/calendar-import';
import { useApp } from '@/lib/app-state';
import { fnText } from '@/lib/fn';
import type { Client } from '@/lib/model';
import { usePalette } from '@/lib/theme';

/** Review what was read from a picture: untick anything wrong, pick the day if the picture didn't show one, then add. */
export function ImportReview({ found, clients, onClose, onAdded }: { found: FoundSession[] | null; clients: Client[]; onClose: () => void; onAdded: (n: number) => void }) {
  const p = usePalette();
  const app = useApp();
  const toast = useToast();
  const [pick, setPick] = useState<boolean[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setPick((found ?? []).map(() => true)); setDay(null); }, [found]);
  const ask = needsDay(found ?? []);
  const rows = toBookings(found ?? [], clients, app.trainer?.user_id, day ?? undefined);
  const count = pick.filter(Boolean).length;
  const add = async () => {
    setSaving(true);
    try { await addBookings(rows.filter((_, i) => pick[i])); onAdded(count); } catch (e) { toast(fnText(e), false); } finally { setSaving(false); }
  };
  return (
    <Sheet visible={!!found} onClose={onClose} title={`Found ${found?.length ?? 0} appointment${found?.length === 1 ? '' : 's'}`}>
      {ask && (
        <View style={{ marginBottom: 6 }}>
          <Txt v="small" style={{ marginBottom: 8 }}>The picture doesn’t show a date. Which day is {(found ?? []).filter((s) => s.dated === false || !s.date).length > 1 ? 'they' : 'it'} on?</Txt>
          <DateField label="Day" value={day} onChange={setDay} />
        </View>
      )}
      <ScrollView style={{ maxHeight: 300 }}>
        {rows.map((b, i) => (
          <Pressable key={i} accessibilityRole="checkbox" accessibilityState={{ checked: pick[i] }} onPress={() => setPick((x) => x.map((v, j) => (j === i ? !v : v)))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.line }}>
            <Icon name={pick[i] ? 'check_box' : 'check_box_outline_blank'} color={pick[i] ? p.focus : p.muted} />
            <View style={{ flex: 1 }}>
              <Txt v="bold">{ask && !day && found && (found[i].dated === false || !found[i].date) ? `Day not picked: ${b.title}` : bookingLine(b)}</Txt>
              {!b.client_id && <Txt v="small">Not matched to a client</Txt>}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Button title={ask && !day ? 'Pick the day first' : `Add ${count}`} busy={saving} disabled={!count || (ask && !day)} onPress={add} style={{ flex: 1 }} />
        <Button kind="ghost" title="Cancel" onPress={onClose} />
      </View>
    </Sheet>
  );
}
