import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { DateField } from '@/components/date-field';
import { ClientPicker, ColorPicker, TimeField, Toggle, useClientList } from '@/components/pickers';
import { ActionMenu, Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { confirm } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { at, COLORS, fmtDuration, hhmm, KINDS, occurrences, openSlots, REPEATS, weekOf, type Availability, type Booking, type CoachEvent, type Occurrence } from '@/lib/business';
import { addDays, dayKey, fromKey } from '@/lib/dates';
import { callFn, fnText } from '@/lib/fn';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, R, usePalette } from '@/lib/theme';

const t12 = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Calendar: trainers see their week of sessions and events and book activities; clients see their sessions and book themselves in */
export default function Calendar() {
  const app = useApp();
  return app.mode === 'coach' ? <CoachCalendar /> : <ClientCalendar />;
}

function CoachCalendar() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const [anchor, setAnchor] = useState(new Date());
  const [day, setDay] = useState(dayKey(new Date()));
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [events, setEvents] = useState<CoachEvent[]>([]);
  const [book, setBook] = useState<{ day: string; edit?: Booking } | null>(null);
  const [menu, setMenu] = useState<Occurrence | null>(null);
  const [hours, setHours] = useState(false);
  const [importing, setImporting] = useState(false);
  const { clients, groups } = useClientList();
  const week = weekOf(anchor);

  const load = useCallback(async () => {
    const [b, e] = await Promise.all([
      sb.from('coach_bookings').select('*').order('starts_at'),
      sb.from('coach_events').select('*').eq('cancelled', false).gte('starts_at', addDays(new Date(), -60).toISOString()).order('starts_at'),
    ]);
    if (b.error) toast(errText(b.error), false);
    setBookings((b.data as Booking[]) ?? []); setEvents((e.data as CoachEvent[]) ?? []);
  }, [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const occ = useMemo(() => occurrences(bookings ?? [], week[0], week[6]), [bookings, week[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  const who = (b: Booking) => b.client_id ? clients?.find((c) => c.id === b.client_id)?.name : b.group_id ? groups.find((g) => g.id === b.group_id)?.name : null;
  const go = (n: number) => { const a = addDays(anchor, n), w = weekOf(a), t = dayKey(new Date()); setAnchor(a); setDay(w.includes(t) ? t : w[0]); };
  const month = fromKey(week[3]).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const toggleDone = async (o: Occurrence) => {
    const done = o.done ? o.booking.done.filter((d) => d !== o.day) : [...o.booking.done, o.day];
    const { error } = await sb.from('coach_bookings').update({ done }).eq('id', o.booking.id);
    if (error) toast(errText(error), false); else { toast(o.done ? 'Marked not done' : 'Done ✓'); load(); }
  };
  const skip = async (o: Occurrence) => {
    const { error } = o.booking.repeat === 'none' ? await sb.from('coach_bookings').delete().eq('id', o.booking.id)
      : await sb.from('coach_bookings').update({ skipped: [...o.booking.skipped, o.day] }).eq('id', o.booking.id);
    if (error) toast(errText(error), false); else { toast('Cancelled'); load(); }
  };
  const removeSeries = async (o: Occurrence) => {
    if (!(await confirm('Delete every session in this series?', 'Past ones are removed from your calendar too.', 'Delete all', true))) return;
    const { error } = await sb.from('coach_bookings').delete().eq('id', o.booking.id);
    if (error) toast(errText(error), false); else load();
  };
  const endSeries = async (o: Occurrence) => {
    const { error } = await sb.from('coach_bookings').update({ repeat_until: dayKey(addDays(fromKey(o.day), -1)) }).eq('id', o.booking.id);
    if (error) toast(errText(error), false); else { toast('Stopped repeating from this date'); load(); }
  };
  const importShot = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (res.canceled || !res.assets[0]) return;
      setImporting(true);
      const a = res.assets[0];
      const out = await ImageManipulator.manipulateAsync(a.uri, Math.max(a.width, a.height) > 1600 ? [{ resize: a.width >= a.height ? { width: 1600 } : { height: 1600 } }] : [], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      const r = await callFn<{ sessions: { client: string; title: string; date: string; time: string; minutes: number; location: string }[] }>('coach-calendar-import', {
        image: out.base64, today: dayKey(new Date()), clients: (clients ?? []).map((c) => c.name) });
      if (!r.sessions.length) return toast('No sessions found in that picture', false);
      const rows = r.sessions.map((s) => {
        const c = (clients ?? []).find((x) => x.name.toLowerCase() === s.client.toLowerCase()) ?? (clients ?? []).find((x) => s.client && x.name.toLowerCase().startsWith(s.client.toLowerCase().split(' ')[0]));
        return { trainer_id: app.trainer?.user_id, client_id: c?.id ?? null, title: c ? `Session with ${c.first_name}` : s.client ? `${s.title} · ${s.client}` : s.title, kind: 'session', starts_at: at(s.date, s.time).toISOString(), duration_min: s.minutes, location: s.location || null };
      });
      const list = rows.map((x) => `• ${new Date(x.starts_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}: ${x.title}`).join('\n');
      if (!(await confirm(`Add ${rows.length} session${rows.length === 1 ? '' : 's'}?`, list, 'Add them'))) return;
      const { error } = await sb.from('coach_bookings').insert(rows);
      if (error) throw error;
      toast('Added to your calendar'); load();
    } catch (e) { toast(fnText(e), false); } finally { setImporting(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Calendar' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous week" onPress={() => go(-7)} hitSlop={10}><Icon name="chevron_left" size={28} /></Pressable>
            <Txt v="h2" style={{ flex: 1, textAlign: 'center' }}>{month}</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Next week" onPress={() => go(7)} hitSlop={10}><Icon name="chevron_right" size={28} /></Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {week.map((d) => {
              const on = d === day, today = d === dayKey(new Date()), busy = occ.some((o) => o.day === d) || events.some((e) => dayKey(e.starts_at) === d);
              return (
                <Pressable key={d} onPress={() => setDay(d)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={fromKey(d).toDateString()}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: R.md, backgroundColor: on ? p.focus : p.surface, borderWidth: today && !on ? 1.5 : 0, borderColor: p.focus }}>
                  <Txt v="small" color={on ? p.onAccent : p.muted}>{fromKey(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</Txt>
                  <Txt v="bold" color={on ? p.onAccent : p.ink}>{fromKey(d).getDate()}</Txt>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: busy ? (on ? p.onAccent : p.gold) : 'transparent', marginTop: 2 }} />
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button small kind="quiet" title="Today" onPress={() => { setAnchor(new Date()); setDay(dayKey(new Date())); }} />
            <Button small kind="ghost" icon="document_scanner" title="Import from screenshot" busy={importing} onPress={importShot} />
            <Button small kind="ghost" icon="schedule" title="Open hours" onPress={() => setHours(true)} />
          </View>
          {bookings === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : week.filter((d) => d >= day).map((d) => {
            const items = occ.filter((o) => o.day === d), evs = events.filter((e) => dayKey(e.starts_at) === d);
            const all = [...items.map((o) => ({ t: o.start.getTime(), o })), ...evs.map((e) => ({ t: new Date(e.starts_at).getTime(), e }))].sort((a, b) => a.t - b.t);
            return (
              <View key={d} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Txt v="h3" style={{ flex: 1 }}>{fromKey(d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Txt>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Book something on ${fromKey(d).toDateString()}`} onPress={() => setBook({ day: d })} hitSlop={10}><Icon name="add" size={26} color={p.focus} /></Pressable>
                </View>
                {all.length === 0 ? <Card style={{ paddingVertical: 12 }}><Txt v="small">Nothing booked</Txt></Card> : all.map((x) => 'o' in x && x.o ? (
                  <Pressable key={`${x.o.booking.id}-${d}`} onPress={() => setMenu(x.o!)} accessibilityRole="button">
                    <Card style={{ flexDirection: 'row', gap: 12, padding: 12, opacity: x.o.done ? 0.65 : 1 }}>
                      <View style={{ width: 5, borderRadius: 3, backgroundColor: x.o.booking.color ?? (x.o.booking.kind === 'block' ? p.muted : p.focus) }} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt v="bold">{x.o.booking.title}{x.o.done ? ' ✓' : ''}</Txt>
                        <Txt v="small">{t12(x.o.start)} – {t12(x.o.end)}{who(x.o.booking) ? ` · ${who(x.o.booking)}` : ''}{x.o.booking.location ? ` · ${x.o.booking.location}` : ''}</Txt>
                        {x.o.booking.repeat !== 'none' || x.o.booking.booked_by === 'client' ? <Txt v="small" color={p.muted}>{[x.o.booking.repeat !== 'none' ? REPEATS.find(([k]) => k === x.o!.booking.repeat)?.[1] : null, x.o.booking.booked_by === 'client' ? 'Booked by client' : null].filter(Boolean).join(' · ')}</Txt> : null}
                      </View>
                    </Card>
                  </Pressable>
                ) : 'e' in x && x.e ? (
                  <Pressable key={x.e.id} onPress={() => router.push({ pathname: '/events/[id]', params: { id: x.e!.id } })} accessibilityRole="link">
                    <Card style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
                      <View style={{ width: 5, borderRadius: 3, backgroundColor: x.e.color ?? p.gold }} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt v="bold">{x.e.title}</Txt>
                        <Txt v="small">{t12(new Date(x.e.starts_at))} · Event · {x.e.booked}{x.e.spaces ? `/${x.e.spaces}` : ''} going</Txt>
                      </View>
                    </Card>
                  </Pressable>
                ) : null)}
              </View>
            );
          })}
          {bookings && <Txt v="small" center>Tap a day above to jump to it. Past days of this week are hidden.</Txt>}
        </View>
      </ScrollView>
      <BookSheet open={book} onClose={() => setBook(null)} onSaved={() => { setBook(null); load(); }} events={events} />
      <ActionMenu visible={!!menu} onClose={() => setMenu(null)} title={menu ? `${menu.booking.title} · ${t12(menu.start)}` : ''} items={menu ? [
        { label: menu.done ? 'Mark not done' : 'Mark done', icon: 'task_alt', onPress: () => toggleDone(menu) },
        { label: 'Edit', icon: 'edit', onPress: () => setBook({ day: menu.day, edit: menu.booking }) },
        { label: 'Message client', icon: 'chat_bubble', hidden: !menu.booking.client_id, onPress: () => router.push({ pathname: '/chat/new', params: { client: menu.booking.client_id! } }) },
        { label: menu.booking.repeat === 'none' ? 'Cancel session' : 'Cancel just this one', icon: 'close', onPress: () => skip(menu) },
        { label: 'Stop repeating from here', icon: 'stop_circle', hidden: menu.booking.repeat === 'none', onPress: () => endSeries(menu) },
        { label: 'Delete the whole series', icon: 'delete', danger: true, hidden: menu.booking.repeat === 'none', onPress: () => removeSeries(menu) },
      ] : []} />
      <HoursSheet visible={hours} onClose={() => setHours(false)} />
    </View>
  );
}

/** Book an activity (or put an event template on the calendar) */
function BookSheet({ open, onClose, onSaved, events }: { open: { day: string; edit?: Booking } | null; onClose: () => void; onSaved: () => void; events: CoachEvent[] }) {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { clients, groups } = useClientList();
  const ed = open?.edit;
  const blank = { fromEvent: false, eventId: null as string | null, title: '', kind: 'session' as Booking['kind'], forWho: 'client' as 'client' | 'group' | 'none', client: null as string | null, group: null as string | null,
    location: '', day: null as string | null, time: '09:00', minutes: 60, repeat: 'none' as Booking['repeat'], until: null as string | null, notes: '', color: null as string | null };
  const [f, setF] = useState(blank);
  const [seen, setSeen] = useState<typeof open>(null);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  if (open !== seen) {
    setSeen(open);
    if (open) setF(ed ? { ...blank, title: ed.title, kind: ed.kind, forWho: ed.client_id ? 'client' : ed.group_id ? 'group' : 'none', client: ed.client_id, group: ed.group_id, location: ed.location ?? '',
      day: dayKey(ed.starts_at), time: hhmm(new Date(ed.starts_at)), minutes: ed.duration_min, repeat: ed.repeat, until: ed.repeat_until, notes: ed.notes ?? '', color: ed.color } : { ...blank, day: open.day });
  }
  const templates = [...new Map(events.map((e) => [e.title, e])).values()];
  const save = async () => {
    if (!f.day) return toast('Pick a date', false);
    const start = at(f.day, f.time);
    setBusy(true);
    try {
      if (f.fromEvent) {
        const t = events.find((e) => e.id === f.eventId);
        if (!t) throw new Error('Choose an event');
        const { id: _i, booked: _b, waiting: _w, ...rest } = t as CoachEvent & Record<string, unknown>;
        const { error } = await sb.from('coach_events').insert({ ...rest, created_at: undefined, updated_at: undefined, starts_at: start.toISOString(), cancelled: false });
        if (error) throw error;
      } else {
        const title = f.title.trim() || (f.forWho === 'client' && f.client ? `Session with ${clients?.find((c) => c.id === f.client)?.first_name}` : KINDS.find(([k]) => k === f.kind)?.[1] ?? 'Session');
        const row = { trainer_id: app.trainer?.user_id, title, kind: f.kind, client_id: f.forWho === 'client' ? f.client : null, group_id: f.forWho === 'group' ? f.group : null,
          location: f.location.trim() || null, starts_at: start.toISOString(), duration_min: f.minutes, repeat: f.repeat, repeat_until: f.repeat === 'none' ? null : f.until, notes: f.notes.trim() || null, color: f.color };
        const { error } = ed ? await sb.from('coach_bookings').update(row).eq('id', ed.id) : await sb.from('coach_bookings').insert(row);
        if (error) throw error;
      }
      toast('Booked'); onSaved();
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={!!open} onClose={onClose} title={ed ? 'Edit booking' : 'Book activity'}>
      {!ed && templates.length > 0 && <Toggle label="Use an event template" sub="Put one of your events (a class or bootcamp) on this date" value={f.fromEvent} onChange={(fromEvent) => setF({ ...f, fromEvent })} />}
      {f.fromEvent ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }}>
          {templates.map((e) => <Chip key={e.id} label={e.title} selected={f.eventId === e.id} onPress={() => setF({ ...f, eventId: e.id, minutes: e.duration_min, time: hhmm(new Date(e.starts_at)) })} />)}
        </View>
      ) : <>
        <Field label="Name" hint="(optional)" value={f.title} onChangeText={(title) => setF({ ...f, title })} placeholder="Session with Ana" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>{KINDS.map(([k, l]) => <Chip key={k} label={l} selected={f.kind === k} onPress={() => setF({ ...f, kind: k })} />)}</View>
        <Txt v="bold" style={{ marginBottom: 8 }}>Who’s it for</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <Chip label={f.forWho === 'client' && f.client ? clients?.find((c) => c.id === f.client)?.name ?? 'A client' : 'A client'} selected={f.forWho === 'client'} onPress={() => { setF({ ...f, forWho: 'client' }); setPick(true); }} />
          {groups.map((g) => <Chip key={g.id} label={g.name} selected={f.forWho === 'group' && f.group === g.id} onPress={() => setF({ ...f, forWho: 'group', group: g.id })} />)}
          <Chip label="Just me" selected={f.forWho === 'none'} onPress={() => setF({ ...f, forWho: 'none' })} />
        </View>
        <Field label="Location" hint="(optional)" value={f.location} onChangeText={(location) => setF({ ...f, location })} placeholder="Gym floor, Zoom, Centennial Park" />
      </>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1.4 }}><DateField label="Date" value={f.day} onChange={(day) => setF({ ...f, day })} /></View>
        <View style={{ flex: 1 }}><TimeField label="Time" value={f.time} onChange={(time) => setF({ ...f, time })} /></View>
      </View>
      {!f.fromEvent && <>
        <Txt v="bold" style={{ marginBottom: 8 }}>Length</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>{[30, 45, 60, 75, 90, 120].map((m) => <Chip key={m} label={fmtDuration(m)} selected={f.minutes === m} onPress={() => setF({ ...f, minutes: m })} />)}</View>
        <Txt v="bold" style={{ marginBottom: 8 }}>Repeat</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>{REPEATS.map(([k, l]) => <Chip key={k} label={l} selected={f.repeat === k} onPress={() => setF({ ...f, repeat: k })} />)}</View>
        {f.repeat !== 'none' && <DateField label="Until" optional value={f.until} onChange={(until) => setF({ ...f, until })} min={f.day ?? undefined} />}
        <Field label="Notes" hint="(only you see these)" value={f.notes} onChangeText={(notes) => setF({ ...f, notes })} />
        <Txt v="bold" style={{ marginBottom: 8 }}>Colour</Txt>
        <ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} colors={COLORS} />
      </>}
      <Button title={ed ? 'Save' : 'Book'} icon="check" busy={busy} onPress={save} style={{ marginTop: 16, alignSelf: 'flex-start' }} />
      <ClientPicker visible={pick} onClose={() => setPick(false)} single value={f.client ? [f.client] : []} onDone={(ids) => setF((x) => ({ ...x, client: ids[0] ?? null, forWho: 'client' }))} />
      {!ed && <Txt v="small" color={p.muted} style={{ marginTop: 10 }}>Tip: clients can book themselves into your open hours from their app.</Txt>}
    </Sheet>
  );
}

/** Weekly open hours that clients can book into */
function HoursSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const app = useApp();
  const [rows, setRows] = useState<Availability[] | null>(null);
  const [seen, setSeen] = useState(false);
  const [add, setAdd] = useState({ weekday: 1, start: '06:00', end: '12:00' });
  const load = useCallback(async () => { const { data } = await sb.from('coach_availability').select('*').order('weekday').order('start_time'); setRows((data as Availability[]) ?? []); }, []);
  if (visible !== seen) { setSeen(visible); if (visible) load(); }
  const names = [0, 1, 2, 3, 4, 5, 6].map((d) => new Date(2026, 10, 1 + d).toLocaleDateString(undefined, { weekday: 'short' }));  // Nov 1 2026 is a Sunday
  const save = async () => {
    if (add.end <= add.start) return toast('End after the start', false);
    const { error } = await sb.from('coach_availability').insert({ trainer_id: app.trainer?.user_id, weekday: add.weekday, start_time: add.start, end_time: add.end });
    if (error) toast(errText(error), false); else load();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Open hours">
      <Txt v="small" style={{ marginBottom: 10 }}>Clients can book 30–90 minute sessions inside these hours (if you allow it in Settings → Permissions). Anything already on your calendar is blocked out.</Txt>
      {rows === null ? <ActivityIndicator /> : rows.length === 0 ? <Txt v="small">No open hours yet.</Txt> : rows.map((r) => (
        <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
          <Txt v="bold" style={{ width: 60 }}>{names[r.weekday]}</Txt>
          <Txt style={{ flex: 1 }}>{t12(at('2026-11-02', r.start_time.slice(0, 5)))} – {t12(at('2026-11-02', r.end_time.slice(0, 5)))}</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="Remove" hitSlop={8} onPress={async () => { await sb.from('coach_availability').delete().eq('id', r.id); load(); }}><Icon name="delete" size={20} /></Pressable>
        </View>
      ))}
      <SectionLabel>Add hours</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>{names.map((n, i) => <Chip key={n} label={n} selected={add.weekday === i} onPress={() => setAdd({ ...add, weekday: i })} />)}</View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><TimeField label="From" value={add.start} onChange={(start) => setAdd({ ...add, start })} /></View>
        <View style={{ flex: 1 }}><TimeField label="To" value={add.end} onChange={(end) => setAdd({ ...add, end })} /></View>
      </View>
      <Button title="Add" icon="add" onPress={save} style={{ alignSelf: 'flex-start' }} />
    </Sheet>
  );
}

/* ---------------- client ---------------- */
function ClientCalendar() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const c = app.membership;
  const [mine, setMine] = useState<Booking[] | null>(null);
  const [avail, setAvail] = useState<Availability[]>([]);
  const [busyTimes, setBusy] = useState<{ start: Date; end: Date }[]>([]);
  const [day, setDay] = useState(dayKey(addDays(new Date(), 1)));
  const [mins, setMins] = useState(60);
  const [picked, setPicked] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    if (!c) return;
    const [b, a, busy] = await Promise.all([
      sb.from('coach_bookings').select('*').order('starts_at'),
      sb.from('coach_availability').select('*').eq('trainer_id', c.trainer_id),
      sb.rpc('coach_trainer_busy', { p_trainer: c.trainer_id, p_days: 21 }),
    ]);
    setMine((b.data as Booking[]) ?? []); setAvail((a.data as Availability[]) ?? []);
    setBusy(((busy.data ?? []) as { starts_at: string; ends_at: string }[]).map((x) => ({ start: new Date(x.starts_at), end: new Date(x.ends_at) })));
  }, [c]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!c) return null;
  const today = dayKey(new Date());
  const upcoming = occurrences(mine ?? [], today, dayKey(addDays(new Date(), 60))).filter((o) => o.end.getTime() > Date.now());
  const days = Array.from({ length: 14 }, (_, i) => dayKey(addDays(new Date(), i + (new Date().getHours() >= 20 ? 1 : 0))));
  const slots = openSlots(day, mins, avail, busyTimes);
  const bookIt = async () => {
    if (!picked) return;
    setSaving(true);
    const { error } = await sb.rpc('coach_book_session', { p_trainer: c.trainer_id, p_starts: picked.toISOString(), p_minutes: mins });
    setSaving(false);
    if (error) return toast(/slot_taken/.test(error.message) ? 'That time was just taken. Pick another.' : /booking_closed/.test(error.message) ? 'Your trainer books sessions for you. Send them a message.' : errText(error), false);
    toast(`Booked for ${picked.toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })}`); setPicked(null); load();
  };
  const cancel = async (o: Occurrence) => {
    if (!(await confirm('Cancel this session?', `${o.start.toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`, 'Cancel session', true))) return;
    const { error } = await sb.rpc('coach_cancel_session', { p_booking: o.booking.id, p_on: o.day });
    if (error) return toast(/too_late/.test(error.message) ? `Too close to the session to cancel here. Message ${app.myTrainer?.display_name ?? 'your trainer'}.` : /cancel_closed/.test(error.message) ? 'Message your trainer to cancel.' : errText(error), false);
    toast('Cancelled'); load();
  };
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Sessions' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <SectionLabel>Coming up</SectionLabel>
          {mine === null ? <ActivityIndicator color={p.ink} /> : upcoming.length === 0 ? <Empty emoji="📅" title="Nothing booked" body="Your sessions with your trainer show here." /> : (
            <Card style={{ padding: 0 }}>
              {upcoming.slice(0, 10).map((o, i, a) => (
                <View key={`${o.booking.id}-${o.day}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i === a.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                  <View style={{ flex: 1 }}>
                    <Txt v="bold">{o.start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Txt>
                    <Txt v="small">{t12(o.start)} · {fmtDuration(o.booking.duration_min)}{o.booking.location ? ` · ${o.booking.location}` : ''}</Txt>
                  </View>
                  {app.perms.cancel_sessions && o.booking.client_id && <Button small kind="ghost" title="Cancel" onPress={() => cancel(o)} />}
                </View>
              ))}
            </Card>
          )}
          {app.perms.book_sessions && avail.length > 0 && <>
            <SectionLabel>Book a session</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {days.map((d) => (
                <Pressable key={d} onPress={() => { setDay(d); setPicked(null); }} accessibilityRole="button" accessibilityState={{ selected: d === day }}
                  style={{ width: 54, alignItems: 'center', paddingVertical: 8, borderRadius: R.md, backgroundColor: d === day ? p.focus : p.surface }}>
                  <Txt v="small" color={d === day ? p.onAccent : p.muted}>{fromKey(d).toLocaleDateString(undefined, { weekday: 'short' })}</Txt>
                  <Txt v="bold" color={d === day ? p.onAccent : p.ink}>{fromKey(d).getDate()}</Txt>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8 }}>{[30, 45, 60, 90].map((m) => <Chip key={m} label={fmtDuration(m)} selected={mins === m} onPress={() => { setMins(m); setPicked(null); }} />)}</View>
            {slots.length === 0 ? <Txt v="small">No open times that day. Try another.</Txt> : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {slots.map((s) => <Chip key={s.toISOString()} label={t12(s)} selected={picked?.getTime() === s.getTime()} onPress={() => setPicked(s)} />)}
              </View>
            )}
            {picked && <Button title={`Book ${t12(picked)}`} icon="check" busy={saving} onPress={bookIt} />}
          </>}
          {app.perms.book_sessions && avail.length === 0 && mine !== null && <Txt v="small">Your trainer hasn’t opened booking times yet. Message them to set up a session.</Txt>}
        </View>
      </ScrollView>
    </View>
  );
}

