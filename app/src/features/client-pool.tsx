// Client pool pieces shared by the trainer's client page and the client's own "When I'm free" page:
// the tier picker, the free-times editor and the short-notice opt-in.
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { DateField } from '@/components/date-field';
import { Button, Card, Chip, Field, Txt, useToast } from '@/components/ui';
import { TIERS, type Tier, type Window } from '@/lib/client-pool';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const short = (t: string) => t.slice(0, 5);

/** The client's usual free times: list, add, remove */
export function FreeTimes({ clientId }: { clientId: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<(Window & { id: string })[]>([]);
  const [day, setDay] = useState(1);
  const [from, setFrom] = useState('06:00');
  const [to, setTo] = useState('09:00');
  const load = useCallback(() => {
    void sb.from('coach_client_availability').select('id, client_id, weekday, start_time, end_time').eq('client_id', clientId).order('weekday').order('start_time')
      .then(({ data }) => setRows((data as (Window & { id: string })[]) ?? []));
  }, [clientId]);
  useEffect(load, [load]);
  const add = async () => {
    if (!HHMM.test(from) || !HHMM.test(to) || from.padStart(5, '0') >= to.padStart(5, '0')) return toast('Use times like 06:00 and 09:00, start before end', false);
    const { error } = await sb.from('coach_client_availability').insert({ client_id: clientId, weekday: day, start_time: from, end_time: to });
    if (error) toast(errText(error), false); else load();
  };
  const remove = async (id: string) => {
    const { error } = await sb.from('coach_client_availability').delete().eq('id', id);
    if (error) toast(errText(error), false); else load();
  };
  return (
    <View style={{ gap: 8 }}>
      {rows.length === 0 && <Txt v="small">No free times saved yet.</Txt>}
      {rows.map((r) => (
        <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt style={{ flex: 1 }}>{WEEKDAYS[r.weekday]} {short(r.start_time)}–{short(r.end_time)}</Txt>
          <Button small kind="ghost" title="Remove" onPress={() => remove(r.id)} />
        </View>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {WEEKDAYS.map((d, i) => <Chip key={d} label={d} selected={day === i} onPress={() => setDay(i)} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Field label="From" value={from} onChangeText={setFrom} style={{ flex: 1 }} autoCapitalize="none" />
        <Field label="To" value={to} onChangeText={setTo} style={{ flex: 1 }} autoCapitalize="none" />
      </View>
      <Button small title="Add free time" onPress={add} />
    </View>
  );
}

/** Trainer view: tier, short-notice status (they can switch it off, only the client can switch it on), free times */
export function PoolCard({ client, onChanged }: {
  client: { id: string; frequency_tier?: Tier; short_notice_ok?: boolean; client_of?: string }; onChanged: () => void;
}) {
  const toast = useToast();
  const set = async (patch: Record<string, unknown>) => {
    const { error } = await sb.from('coach_clients').update(patch).eq('id', client.id);
    if (error) toast(errText(error), false); else onChanged();
  };
  return (
    <Card style={{ gap: 10 }}>
      <Txt v="bold">Roster</Txt>
      <Txt v="small">Used when you fill a cancelled slot. Regulars are left out of offers unless you include them.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {TIERS.map((t) => <Chip key={t.key} label={t.label} selected={(client.frequency_tier ?? 'regular') === t.key} onPress={() => set({ frequency_tier: t.key })} />)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Chip label="Private client" selected={(client.client_of ?? 'private') === 'private'} onPress={() => set({ client_of: 'private' })} />
        <Chip label="Columbia Association" selected={client.client_of === 'ca'} onPress={() => set({ client_of: 'ca' })} />
      </View>
      {client.short_notice_ok
        ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt style={{ flex: 1 }}>Wants short-notice offers</Txt>
            <Button small kind="ghost" title="Turn off" onPress={() => set({ short_notice_ok: false })} />
          </View>
        : <Txt v="small">Hasn’t opted in to short-notice offers. They can do it in their app under “When I’m free”.</Txt>}
      <FreeTimes clientId={client.id} />
      <Txt v="bold">Waitlist</Txt>
      <Waitlist clientId={client.id} />
    </Card>
  );
}

export type WaitEntry = { id: string; client_id: string; starts_at: string | null; weekday: number | null; start_time: string | null; duration_min: number; mode: 'notify' | 'auto_book'; active: boolean };
const hhmm12 = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
export const waitText = (w: WaitEntry) =>
  `${w.starts_at ? new Date(w.starts_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : `Every ${WEEKDAYS[w.weekday ?? 0]} at ${hhmm12(w.start_time ?? '00:00')}`} · ${w.duration_min} min · ${w.mode === 'auto_book' ? 'book me automatically' : 'tell me first'}`;

/** A client's waitlist for times that are taken. `editable` lets them add entries (the client's own page). */
export function Waitlist({ clientId, editable }: { clientId: string; editable?: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<WaitEntry[]>([]);
  const [weekly, setWeekly] = useState(true);
  const [day, setDay] = useState(2);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState('07:00');
  const [mins, setMins] = useState(60);
  const [mode, setMode] = useState<'notify' | 'auto_book'>('notify');
  const load = useCallback(() => {
    void sb.from('coach_slot_waitlist').select('*').eq('client_id', clientId).eq('active', true).order('created_at')
      .then(({ data }) => setRows((data as WaitEntry[]) ?? []));
  }, [clientId]);
  useEffect(load, [load]);
  const add = async () => {
    if (!HHMM.test(time)) return toast('Use a time like 07:00', false);
    if (!weekly && !date) return toast('Pick a date', false);
    const row: Record<string, unknown> = weekly ? { client_id: clientId, weekday: day, start_time: time, duration_min: mins, mode }
      : { client_id: clientId, starts_at: new Date(`${date}T${time.padStart(5, '0')}:00`).toISOString(), duration_min: mins, mode };
    const { error } = await sb.from('coach_slot_waitlist').insert(row);
    if (error) toast(/waitlist_limit/.test(error.message) ? 'You can wait for up to 10 times at once.' : errText(error), false);
    else { toast('You’re on the waitlist'); load(); }
  };
  const remove = async (id: string) => {
    const { error } = await sb.from('coach_slot_waitlist').update({ active: false }).eq('id', id);
    if (error) toast(errText(error), false); else load();
  };
  return (
    <View style={{ gap: 8 }}>
      {rows.length === 0 && <Txt v="small">{editable ? 'Not waiting for any times.' : 'Not on any waitlist.'}</Txt>}
      {rows.map((w) => (
        <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt style={{ flex: 1 }}>{waitText(w)}</Txt>
          <Button small kind="ghost" title="Remove" onPress={() => remove(w.id)} />
        </View>
      ))}
      {editable && <>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Chip label="Every week" selected={weekly} onPress={() => setWeekly(true)} />
          <Chip label="One date" selected={!weekly} onPress={() => setWeekly(false)} />
        </View>
        {weekly
          ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{WEEKDAYS.map((d, i) => <Chip key={d} label={d} selected={day === i} onPress={() => setDay(i)} />)}</View>
          : <DateField label="Date" value={date} onChange={setDate} min={new Date().toISOString().slice(0, 10)} />}
        <Field label="Time" value={time} onChangeText={setTime} autoCapitalize="none" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[30, 45, 60, 90].map((m) => <Chip key={m} label={`${m} min`} selected={mins === m} onPress={() => setMins(m)} />)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="Book me automatically" selected={mode === 'auto_book'} onPress={() => setMode('auto_book')} />
          <Chip label="Tell me first" selected={mode === 'notify'} onPress={() => setMode('notify')} />
        </View>
        <Txt v="small">When this time opens up, you’re first in line. “Book me automatically” puts you straight in; “Tell me first” sends you a link to grab it.</Txt>
        <Button small title="Join the waitlist" onPress={add} />
      </>}
    </View>
  );
}
