// Away note on a client's profile: why they're out (traveling, injured...), the dates and a note, so you don't try to get
// them back in the gym while they're gone. Shown on the profile and in the Clients list.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DateField } from '@/components/date-field';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Field, Txt, useToast } from '@/components/ui';
import { AWAY_REASONS, awayLine, awayState, dayKey, type AwayReason } from '@/lib/client-away';
import { errText, type Client } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

const CLEAR = { away_reason: null, away_from: null, away_until: null, away_note: null };

export function AwayCard({ client: c, onChanged }: { client: Client; onChanged: () => void }) {
  const p = usePalette();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = dayKey(new Date());
  const state = awayState(c, today);
  const line = awayLine(c, today);

  const clear = async () => {
    setBusy(true);
    const { error } = await sb.from('coach_clients').update(CLEAR).eq('id', c.id);
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast(`${c.first_name} is back on your active list`); onChanged();
  };

  return (
    <>
      {state ? (
        <Card style={{ marginTop: 16, gap: 6, borderWidth: 1.5, borderColor: state === 'back' ? p.good : p.gold }}>
          <Txt v="bold" color={state === 'back' ? p.good : p.gold}>{line}</Txt>
          {c.away_note ? <Txt style={{ fontSize: 15 }}>{c.away_note}</Txt> : null}
          {state === 'back' && <Txt v="small">Good time to check in and get {c.first_name} booked again.</Txt>}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <Button small kind="ghost" icon="edit" title="Edit" onPress={() => setEditing(true)} />
            <Button small kind="quiet" title={state === 'back' ? 'Done' : 'They’re back'} busy={busy} onPress={clear} />
          </View>
        </Card>
      ) : (
        <Button small kind="quiet" icon="flight_takeoff" title="Set away" style={{ alignSelf: 'center', marginTop: 10 }} onPress={() => setEditing(true)} />
      )}
      <AwayEditor client={c} visible={editing} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} />
    </>
  );
}

function AwayEditor({ client: c, visible, onClose, onSaved }: { client: Client; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState<AwayReason>('travel');
  const [from, setFrom] = useState<string | null>(null);
  const [until, setUntil] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setReason(c.away_reason ?? 'travel'); setFrom(c.away_from ?? dayKey(new Date())); setUntil(c.away_until ?? null); setNote(c.away_note ?? '');
  }, [visible, c]);

  const save = async () => {
    if (from && until && until < from) return toast('The return date is before the start date', false);
    setBusy(true);
    const { error } = await sb.from('coach_clients').update({ away_reason: reason, away_from: from, away_until: until, away_note: note.trim() || null }).eq('id', c.id);
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast(`Saved. ${c.first_name} moves to Away for those dates.`); onSaved();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`${c.first_name} is away`}>
      <Txt v="smallBold" style={{ marginBottom: 8 }}>Why</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {AWAY_REASONS.map(([k, l]) => <Chip key={k} label={l} selected={reason === k} onPress={() => setReason(k)} />)}
      </View>
      <DateField label="From" value={from} onChange={setFrom} optional />
      <DateField label="Back on" value={until} onChange={setUntil} min={from ?? undefined} optional />
      <Txt v="small" style={{ marginBottom: 12 }}>Leave “Back on” empty if they don’t know yet. Two weeks after they’re back, the note clears itself from the list.</Txt>
      <Field label="Note" hint="(only you see this)" value={note} onChangeText={setNote} multiline maxLength={500} placeholder="Visiting family in Ghana. Wants to restart 3x a week when back." />
      <Button title="Save" busy={busy} onPress={save} />
    </Sheet>
  );
}
