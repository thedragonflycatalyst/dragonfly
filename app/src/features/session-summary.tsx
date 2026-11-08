// The achievement summary shown after a completed session: records, volume vs last time, streak, month count, milestones.
// Worked out from the client's logs (lib/achievements); new milestones are recorded once for later features.
import { useEffect, useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Card, Txt } from '@/components/ui';
import { changes, milestoneText, prText, summarize, volumeIn, type Change, type Summary } from '@/lib/achievements';
import type { PastLog } from '@/lib/history';
import type { WorkoutLog } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

type Row = PastLog & { id: string };

export function SessionSummary({ log, unit, title, popup, onClose }: { log: WorkoutLog; unit: 'lb' | 'kg'; title: string; popup?: boolean; onClose?: () => void }) {
  const p = usePalette();
  const [all, setAll] = useState<Row[] | null>(null);
  useEffect(() => {
    let live = true;
    void sb.from('coach_logs').select('id, performed_at, entries').eq('client_id', log.client_id).order('performed_at', { ascending: false }).limit(400)
      .then(({ data }) => { if (live) setAll((data as Row[] | null) ?? []); });
    return () => { live = false; };
  }, [log.client_id, log.id]);

  const [s, ch]: [Summary | null, Change[]] = useMemo(() => {
    if (!all) return [null, []];
    const cur = all.find((r) => r.id === log.id) ?? { id: log.id, performed_at: log.performed_at, entries: log.entries };
    const every = all.some((r) => r.id === log.id) ? all : [cur, ...all];
    return [summarize(cur, every), changes(cur, every.filter((r) => r !== cur))];
  }, [all, log]);

  // Record new milestones once (only for the client's newest session, so old sessions don't re-trigger them)
  useEffect(() => {
    if (!s || !all?.length || all[0].id !== log.id || !s.milestones.length) return;
    void sb.from('coach_milestones').upsert(s.milestones.map((key) => ({ client_id: log.client_id, trainer_id: log.client_id, key, log_id: log.id })),
      { onConflict: 'client_id,key', ignoreDuplicates: true });
  }, [s, all, log.id, log.client_id]);

  if (!s) return null;
  const vol = volumeIn(s.volumeKg, unit);
  const prev = s.prevVolumeKg != null ? volumeIn(s.prevVolumeKg, unit) : null;
  const diff = prev ? Math.round(((vol - prev) / prev) * 100) : null;
  const lines = [
    ...s.milestones.map((m) => `🏅 ${milestoneText(m)}`),
    ...s.prs.map((r) => `⭐ ${r.name}: ${prText(r)}`),
    vol > 0 ? `💪 ${vol.toLocaleString()} ${unit} lifted${diff != null ? ` (${diff >= 0 ? '+' : ''}${diff}% vs last session)` : ''}` : null,
    s.streakWeeks > 1 ? `🔥 ${s.streakWeeks}-week streak` : null,
    `📅 Session ${s.sessionsThisMonth} this month · ${s.sessionNumber} in total`,
  ].filter((x): x is string => !!x);
  const share = () => Share.share({ message: [`${title}: what I achieved today`, ...lines, log.note ? `“${log.note}”` : null].filter(Boolean).join('\n') });
  const body = (<>
      {lines.map((l) => <Txt key={l}>{l}</Txt>)}
      {ch.length > 0 && <Txt v="bold" style={{ marginTop: 6 }}>Exercise by exercise</Txt>}
      {ch.map((c) => (
        <View key={c.key} style={{ flexDirection: 'row', gap: 6 }}>
          <Txt style={{ width: 18 }}>{c.tone === 'up' ? '▲' : '•'}</Txt>
          <Txt style={{ flex: 1 }} color={c.tone === 'up' ? p.good : undefined}><Txt v="bold">{c.name}</Txt> {c.text}</Txt>
        </View>
      ))}
      {!s.prs.length && !s.milestones.length && <Txt v="small">Every session counts. Records show up here when you beat your best.</Txt>}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <Button small kind="ghost" icon="share" title="Share" onPress={share} />
        {popup && <Button small title="Done" onPress={onClose} />}
      </View>
  </>);
  if (popup) return <Sheet visible onClose={onClose ?? (() => undefined)} title="Session complete 🎉">{body}</Sheet>;
  return <Card style={{ gap: 6 }}><Txt v="bold" color={p.focus}>What you achieved</Txt>{body}</Card>;
}
