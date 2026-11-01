import type { AndroidSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Card, Empty, Icon, Txt } from '@/components/ui';
import { fmtShort, fmtTime } from '@/lib/dates';
import { sb } from '@/lib/supabase';
import { fmtWeight } from '@/lib/units';
import { usePalette } from '@/lib/theme';
import type { SectionProps } from './common';

type Item = { at: string; icon: AndroidSymbol; text: string; dateOnly?: boolean };

/** Everything that happened on a client's profile, newest first (last 90 days). */
export function Activity({ client, units }: SectionProps) {
  const p = usePalette();
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 90 * 864e5).toISOString();
      const [m, ph, fi, fo, hc, lg] = await Promise.all([
        sb.from('coach_measurements').select('measured_on,created_at,weight_kg').eq('client_id', client.id).gte('created_at', since),
        sb.from('coach_photos').select('created_at,pose').eq('client_id', client.id).gte('created_at', since),
        sb.from('coach_files').select('created_at,name').eq('client_id', client.id).gte('created_at', since),
        sb.from('coach_form_requests').select('title,requested_at,completed_at,flagged').eq('client_id', client.id).gte('requested_at', since),
        sb.from('coach_habit_checks').select('day,created_at,coach_habits!inner(title,client_id)').eq('coach_habits.client_id', client.id).gte('created_at', since),
        sb.from('coach_logs').select('performed_at,coach_assignments(title)').eq('client_id', client.id).gte('performed_at', since),
      ]);
      const out: Item[] = [];
      for (const r of m.data ?? []) out.push({ at: r.created_at, icon: 'monitor_weight', text: r.weight_kg ? `Weighed in at ${fmtWeight(r.weight_kg, units)}` : 'Logged measurements' });
      for (const r of ph.data ?? []) out.push({ at: r.created_at, icon: 'photo_camera', text: `Added a ${r.pose} progress photo` });
      for (const r of fi.data ?? []) out.push({ at: r.created_at, icon: 'attach_file', text: `Shared a file: ${r.name}` });
      for (const r of fo.data ?? []) {
        out.push({ at: r.requested_at, icon: 'description', text: `${r.title} sent` });
        if (r.completed_at) out.push({ at: r.completed_at, icon: r.flagged ? 'warning' : 'task_alt', text: `${r.title} answered${r.flagged ? ' (flagged)' : ''}` });
      }
      for (const r of (hc.data ?? []) as unknown as { created_at: string; coach_habits: { title: string } }[]) out.push({ at: r.created_at, icon: 'task_alt', text: `Ticked off “${r.coach_habits.title}”` });
      for (const r of (lg.data ?? []) as unknown as { performed_at: string; coach_assignments: { title: string } | null }[]) out.push({ at: r.performed_at, icon: 'fitness_center', text: `Logged a workout${r.coach_assignments ? `: ${r.coach_assignments.title}` : ''}` });
      if (client.started_on) out.push({ at: `${client.started_on}T12:00:00`, icon: 'person_add', text: 'Joined', dateOnly: true });
      out.sort((a, b) => b.at.localeCompare(a.at));
      setItems(out.slice(0, 200));
    })();
  }, [client.id, client.started_on, units]);

  if (!items) return <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} />;
  if (!items.length) return <Empty emoji="🌙" title="No activity yet" body="Weigh-ins, photos, forms, habits and workouts show up here as they happen." />;
  return (
    <Card style={{ padding: 0 }}>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12, padding: 14, borderBottomWidth: i === items.length - 1 ? 0 : 1, borderBottomColor: p.line, alignItems: 'center' }}>
          <Icon name={it.icon} size={20} color={it.icon === 'warning' ? p.danger : p.focus} />
          <View style={{ flex: 1 }}>
            <Txt>{it.text}</Txt>
            <Txt v="small">{fmtShort(it.at)}{it.dateOnly ? '' : ` · ${fmtTime(it.at)}`}</Txt>
          </View>
        </View>
      ))}
    </Card>
  );
}
