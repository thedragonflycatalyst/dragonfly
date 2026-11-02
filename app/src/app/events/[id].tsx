import * as WebBrowser from 'expo-web-browser';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import { Initials, SectionLabel } from '@/components/bits';
import { Cover } from '@/components/cover';
import { DateField } from '@/components/date-field';
import { ClientPicker, ColorPicker, TimeField, Toggle, useClientList } from '@/components/pickers';
import { Badge } from '@/components/shell';
import { Button, Card, Chip, Empty, Field, Txt, useToast } from '@/components/ui';
import { CoverPicker } from '@/features/cover-picker';
import { confirm } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { at, COLORS, eventCost, fmtDuration, fmtMoney, hhmm, spotsText, toCents, type CoachEvent, type Signup } from '@/lib/business';
import { dayKey } from '@/lib/dates';
import { callFn, fnText } from '@/lib/fn';
import { errText } from '@/lib/model';
import { store } from '@/lib/supabase';
import { sb } from '@/lib/supabase';
import { MAX_W, R, usePalette } from '@/lib/theme';

/** One event: the trainer edits it and manages who's coming; clients see details and sign up */
export default function EventScreen() {
  const app = useApp();
  return app.mode === 'coach' ? <EventEditor /> : <EventDetails />;
}

function EventEditor() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const tid = app.trainer?.user_id ?? '';
  const [e, setE] = useState<CoachEvent | null>(null);
  const [day, setDay] = useState<string | null>(dayKey(new Date()));
  const [time, setTime] = useState('18:00');
  const [spaces, setSpaces] = useState('');
  const [price, setPrice] = useState('');
  const [credits, setCredits] = useState('');
  const [paid, setPaid] = useState(false);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const { clients } = useClientList();

  const load = useCallback(async () => {
    if (isNew) {
      setE({ id: '', trainer_id: tid, title: '', description: null, cover: null, color: COLORS[0], location: null, starts_at: '', duration_min: 60, spaces: null, waitlist: true, price_cents: null, currency: 'usd', credits: null, visible: true, cancelled: false, booked: 0, waiting: 0 });
      return;
    }
    const [a, b] = await Promise.all([sb.from('coach_events').select('*').eq('id', id).maybeSingle(), sb.from('coach_event_signups').select('*').eq('event_id', id).order('created_at')]);
    const x = a.data as CoachEvent | null;
    setE(x); setSignups((b.data as Signup[]) ?? []);
    if (x) { setDay(dayKey(x.starts_at)); setTime(hhmm(new Date(x.starts_at))); setSpaces(x.spaces ? String(x.spaces) : ''); setPrice(x.price_cents ? String(x.price_cents / 100) : ''); setCredits(x.credits ? String(x.credits) : ''); setPaid(!!(x.price_cents || x.credits)); }
  }, [id, isNew, tid]);
  useEffect(() => { load(); }, [load]);
  if (!e) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  const set = (patch: Partial<CoachEvent>) => setE({ ...e, ...patch });

  const save = async () => {
    if (!e.title.trim()) return toast('Name the event', false);
    if (!day) return toast('Pick a date', false);
    const sp = spaces.trim() ? Number(spaces) : null;
    if (sp != null && !(Number.isInteger(sp) && sp > 0)) return toast('Spaces must be a whole number', false);
    const cents = paid && price.trim() ? toCents(price) : null;
    if (paid && price.trim() && !cents) return toast('Enter a price like 15', false);
    const cr = paid && credits.trim() ? Number(credits) : null;
    if (cr != null && !(Number.isInteger(cr) && cr > 0 && cr <= 100)) return toast('Credits must be 1 to 100', false);
    if (paid && !cents && !cr) return toast('Set a price, credits, or switch off “Costs something”', false);
    setBusy(true);
    const row = { trainer_id: tid, title: e.title.trim(), description: e.description?.trim() || null, cover: e.cover, color: e.color, location: e.location?.trim() || null,
      starts_at: at(day, time).toISOString(), duration_min: e.duration_min, spaces: sp, waitlist: e.waitlist, price_cents: cents, credits: cr, visible: e.visible };
    const { data, error } = isNew ? await sb.from('coach_events').insert(row).select('id').single() : await sb.from('coach_events').update(row).eq('id', e.id).select('id').single();
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast('Event saved');
    if (isNew) router.replace({ pathname: '/events/[id]', params: { id: data.id } }); else load();
  };
  const cancelEvent = async () => {
    if (!(await confirm(e.cancelled ? 'Reopen this event?' : 'Cancel this event?', e.cancelled ? undefined : 'Everyone signed up sees it’s cancelled. Give back credits or refunds from their profile if needed.', e.cancelled ? 'Reopen' : 'Cancel event', !e.cancelled))) return;
    await sb.from('coach_events').update({ cancelled: !e.cancelled }).eq('id', e.id); load();
  };
  const remove = async () => {
    if (!(await confirm(`Delete ${e.title}?`, 'Signups are removed too.', 'Delete', true))) return;
    await sb.from('coach_events').delete().eq('id', e.id); router.back();
  };
  const addPeople = async (ids: string[]) => {
    const have = new Set(signups.filter((s) => s.status !== 'cancelled').map((s) => s.client_id));
    const add = ids.filter((x) => !have.has(x));
    if (!add.length) return;
    const { error } = await sb.from('coach_event_signups').upsert(add.map((client_id) => ({ event_id: e.id, client_id, trainer_id: tid, status: 'booked' })), { onConflict: 'event_id,client_id' });
    if (error) toast(errText(error), false); else { toast(`${add.length} added`); load(); }
  };
  const drop = async (s: Signup) => {
    const { error } = await sb.rpc('coach_event_leave', { p_event: e.id, p_client: s.client_id });
    if (error) toast(errText(error), false); else load();
  };
  const markAttended = async (s: Signup, v: boolean) => {
    await sb.from('coach_event_signups').update({ attended: v }).match({ event_id: e.id, client_id: s.client_id }); load();
  };
  const nameOf = (cid: string) => clients?.find((c) => c.id === cid)?.name ?? 'Client';
  const going = signups.filter((s) => s.status === 'booked'), waiting = signups.filter((s) => s.status === 'waitlist');

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: isNew ? 'New event' : e.title, headerRight: () => <Button small title="Save" busy={busy} onPress={save} /> }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 720, gap: 12 }}>
          {e.cancelled && <Badge text="Cancelled" color={p.danger} />}
          <Card>
            <Txt v="bold" style={{ marginBottom: 8 }}>Image</Txt>
            <CoverPicker name={e.title || 'Event'} value={e.cover} trainerId={tid} onChange={(cover) => set({ cover })} />
            <View style={{ height: 14 }} />
            <Field label="Title" value={e.title} onChangeText={(title) => set({ title })} placeholder="Saturday bootcamp" />
            <Field label="Description" hint="(optional)" value={e.description ?? ''} onChangeText={(description) => set({ description })} multiline placeholder="Bring water and a mat. All levels welcome." />
            <Field label="Location" hint="(optional)" value={e.location ?? ''} onChangeText={(location) => set({ location })} />
            <Txt v="bold" style={{ marginBottom: 8 }}>Colour</Txt>
            <ColorPicker value={e.color} onChange={(color) => set({ color })} colors={COLORS} />
          </Card>
          <Card>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1.4 }}><DateField label="Date" value={day} onChange={setDay} /></View>
              <View style={{ flex: 1 }}><TimeField label="Time" value={time} onChange={setTime} /></View>
            </View>
            <Txt v="bold" style={{ marginBottom: 8 }}>Duration</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>{[30, 45, 60, 90, 120, 180, 240].map((m) => <Chip key={m} label={fmtDuration(m)} selected={e.duration_min === m} onPress={() => set({ duration_min: m })} />)}</View>
            <Field label="Spaces" hint="(blank for unlimited)" value={spaces} onChangeText={setSpaces} keyboardType="number-pad" />
            <Toggle label="Waiting list" sub="When it’s full, people can join a waiting list and move up if someone drops out" value={e.waitlist} onChange={(waitlist) => set({ waitlist })} />
            <Toggle label="Clients can see it" value={e.visible} onChange={(visible) => set({ visible })} />
          </Card>
          <Card>
            <Toggle label="Costs something" value={paid} onChange={setPaid} />
            {paid && <>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <View style={{ flex: 1 }}><Field label="Price ($)" hint="(optional)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Or credits" hint="(optional)" value={credits} onChangeText={setCredits} keyboardType="number-pad" /></View>
              </View>
              <Txt v="small">Credits come from packages. Clients need a package with credits to book with them; otherwise they pay the price by card.</Txt>
            </>}
          </Card>
          {!isNew && <>
            <SectionLabel>{`Going · ${spotsText({ ...e, booked: going.length, waiting: waiting.length })}`}</SectionLabel>
            <Card style={{ padding: 0 }}>
              {going.length === 0 ? <Txt v="small" style={{ padding: 14 }}>Nobody yet.</Txt> : going.map((s, i) => (
                <View key={s.client_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: i === going.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                  <Initials name={nameOf(s.client_id)} size={34} />
                  <View style={{ flex: 1 }}><Txt v="bold">{nameOf(s.client_id)}</Txt><Txt v="small">{s.paid ? 'Paid' : ''}</Txt></View>
                  {new Date(e.starts_at) < new Date() && <Chip label={s.attended ? 'Came ✓' : 'Mark came'} selected={!!s.attended} onPress={() => markAttended(s, !s.attended)} />}
                  <Button small kind="ghost" title="Remove" onPress={() => drop(s)} />
                </View>
              ))}
            </Card>
            {waiting.length > 0 && <>
              <SectionLabel>Waiting list</SectionLabel>
              <Card style={{ padding: 0 }}>{waiting.map((s, i) => (
                <View key={s.client_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: i === waiting.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                  <Txt v="bold" style={{ width: 24 }}>{i + 1}</Txt><Txt style={{ flex: 1 }}>{nameOf(s.client_id)}</Txt>
                  <Button small kind="ghost" title="Remove" onPress={() => drop(s)} />
                </View>))}</Card>
            </>}
            <Button kind="ghost" icon="person_add" title="Add clients" onPress={() => setAdding(true)} />
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Button kind="ghost" icon="close" title={e.cancelled ? 'Reopen event' : 'Cancel event'} onPress={cancelEvent} />
              <Button kind="danger" icon="delete" title="Delete" onPress={remove} />
            </View>
          </>}
          {isNew && <Button title="Create event" icon="check" busy={busy} onPress={save} />}
        </View>
      </ScrollView>
      <ClientPicker visible={adding} onClose={() => setAdding(false)} title="Add to this event" value={[]} onDone={addPeople} />
    </View>
  );
}

function EventDetails() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [e, setE] = useState<CoachEvent | null | undefined>(undefined);
  const [s, setS] = useState<Signup | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([sb.from('coach_events').select('*').eq('id', id).maybeSingle(), app.membership ? sb.from('coach_event_signups').select('*').eq('event_id', id).eq('client_id', app.membership.id).maybeSingle() : Promise.resolve({ data: null })]);
    setE((a.data as CoachEvent) ?? null); setS((b.data as Signup) ?? null);
  }, [id, app.membership]);
  useEffect(() => { load(); }, [load]);
  if (e === undefined) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  if (!e) return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="🎟️" title="Event not found" /></View>;
  const going = s && s.status !== 'cancelled';
  const past = new Date(e.starts_at) < new Date();
  const pay = async () => {
    const r = await callFn<{ url: string; id: string }>('coach-pay', { action: 'checkout', event_id: e.id });
    store('coach.lastCheckout', r.id);
    if (Platform.OS === 'web') { window.location.href = r.url; return; }
    await WebBrowser.openBrowserAsync(r.url);
    const c = await callFn<{ status: string }>('coach-pay', { action: 'confirm', session_id: r.id });
    if (c.status !== 'unpaid') toast('You’re in! See you there.');
  };
  const join = async () => {
    setBusy(true);
    try {
      const { data, error } = await sb.rpc('coach_event_join', { p_event: e.id });
      if (error) throw error;
      if (data === 'pay') await pay();
      else toast(data === 'waitlist' ? 'You’re on the waiting list. We’ll move you up if a space opens.' : data === 'already' ? 'You’re already signed up' : 'You’re in! See you there.');
      load();
    } catch (err) {
      const m = (err as Error).message ?? '';
      toast(/event_full/.test(m) ? 'Sorry, it’s full.' : /no_credits/.test(m) ? 'You need a package with credits for this. See Packages.' : /events_closed/.test(m) ? 'Ask your trainer to sign you up.' : /event_closed/.test(m) ? 'Sign-ups have closed.' : fnText(err), false);
    } finally { setBusy(false); }
  };
  const leave = async () => {
    if (!(await confirm('Cancel your place?', e.credits ? 'Your credits go back to your package.' : undefined, 'Cancel my place', true))) return;
    const { error } = await sb.rpc('coach_event_leave', { p_event: e.id });
    if (error) toast(/too_late/.test(error.message) ? `It’s too close to the start to cancel here. Message ${app.myTrainer?.display_name ?? 'your trainer'}.` : errText(error), false); else { toast('Cancelled'); load(); }
  };
  const d = new Date(e.starts_at);
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: e.title }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 720, gap: 12 }}>
          <View style={{ aspectRatio: 2, borderRadius: R.lg, overflow: 'hidden' }}><Cover name={e.title} cover={e.cover} size={720} /></View>
          <Txt v="h1">{e.title}</Txt>
          <Txt v="bold" color={e.color ?? p.focus}>{d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · {d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {fmtDuration(e.duration_min)}</Txt>
          {e.location ? <Txt>📍 {e.location}</Txt> : null}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Badge text={eventCost(e)} color={p.focus} />
            <Badge text={e.cancelled ? 'Cancelled' : spotsText(e)} color={e.cancelled ? p.danger : p.muted} />
            {going && <Badge text={s!.status === 'booked' ? 'You’re going' : 'Waiting list'} color={s!.status === 'booked' ? p.good : p.gold} />}
          </View>
          {e.description ? <Txt>{e.description}</Txt> : null}
          {!e.cancelled && !past && (going ? <Button kind="ghost" title="Cancel my place" onPress={leave} />
            : <Button title={e.price_cents && !e.credits ? `Sign up · ${fmtMoney(e.price_cents, e.currency)}` : e.spaces && e.booked >= e.spaces ? 'Join the waiting list' : 'Sign up'} icon="event_available" busy={busy} onPress={join} />)}
        </View>
      </ScrollView>
    </View>
  );
}
