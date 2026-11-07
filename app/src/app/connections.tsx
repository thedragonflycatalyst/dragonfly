import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Toggle } from '@/components/pickers';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { connectHealth, healthStatus, openHealthSettings, type HealthStatus } from '@/features/health-connect';
import { checkHealthConsent } from '@/features/health-consent';
import { deviceSync, saveFood, setDeviceSync, syncDevice } from '@/features/health-sync';
import { syncHealth } from '@/features/scale-sync';
import type { Weighin } from '@/lib/scale';
import { Page } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { confirm } from '@/lib/ask';
import { callFn, fnText } from '@/lib/fn';
import { foodRows, parseFoodCsv } from '@/lib/health';
import { errText } from '@/lib/model';
import { sb, SUPABASE_URL } from '@/lib/supabase';
import { randomCode } from '@/lib/random';
import { usePalette } from '@/lib/theme';

type Conn = { provider: 'strava' | 'oura' | 'whoop'; account: string | null; last_sync_at: string | null; status: string };
const ACCOUNTS: { key: Conn['provider']; name: string; what: string }[] = [
  { key: 'strava', name: 'Strava', what: 'Runs, rides, swims and every other workout' },
  { key: 'oura', name: 'Oura', what: 'Sleep, readiness, HRV, steps and workouts' },
  { key: 'whoop', name: 'WHOOP', what: 'Recovery, sleep, HRV, resting heart rate and workouts' },
];
const when = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'not yet');
const secret = () => randomCode(24, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');

/** Everything Dragonfly can sync with: the phone's health store, Strava/Oura/WHOOP, food trackers and calendars */
export default function Connections() {
  const app = useApp();
  const toast = useToast();
  const params = useLocalSearchParams<{ connected?: string; error?: string; provider?: string }>();
  useEffect(() => {
    if (params.connected) toast(`${ACCOUNTS.find((a) => a.key === params.connected)?.name ?? 'App'} connected`);
    else if (params.error) toast(params.error === 'denied' ? 'Connection cancelled' : 'That didn’t connect. Try again.', false);
  }, [params.connected, params.error]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!app.user) return null;
  return (
    <Page title="Connected apps">
      <Txt v="small">Bring in data from the apps and devices you already use. Your trainer sees it alongside everything else in Dragonfly.</Txt>
      <PhoneCard />
      <AccountsCard />
      <FoodCard />
      {app.trainer && !app.viewing && <CalendarCard />}
    </Page>
  );
}

/* ---------------- Health Connect / Apple Health ---------------- */
function PhoneCard() {
  const app = useApp();
  const toast = useToast();
  const uid = app.user!.id;
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [st, setSt] = useState(() => deviceSync(uid));
  const consented = checkHealthConsent(uid);
  const [busy, setBusy] = useState<'sync' | 'history' | null>(null);
  useEffect(() => { healthStatus().then(setStatus); }, []);
  const save = (s: typeof st) => { setDeviceSync(uid, s); setSt(s); };
  const run = async (kind: 'sync' | 'history') => {
    // Nothing is read until they've said yes on the consent screen
    if (!checkHealthConsent(uid)) { router.push('/health-consent'); return; }
    setBusy(kind);
    try {
      if ((!st.on || !consented) && !(await connectHealth())) return toast('Allow Dragonfly to read your data in Health Connect to sync', false);
      const r = await syncDevice(uid, app.membership, kind === 'history' ? new Date(Date.now() - 365 * 864e5) : undefined);
      setSt(deviceSync(uid));
      // Weigh-ins (and height) too, so one Connect covers the Scale as well
      const { data: wl } = await sb.from('coach_weighins').select('*').eq('user_id', uid).gte('measured_at', new Date(Date.now() - 800 * 864e5).toISOString());
      const w = await syncHealth(uid, (wl ?? []) as Weighin[], kind === 'history' ? new Date(Date.now() - 10 * 365 * 864e5) : undefined).catch(() => 0);
      const parts = [r.days && `${r.days} day${r.days === 1 ? '' : 's'}`, r.workouts && `${r.workouts} workout${r.workouts === 1 ? '' : 's'}`, r.food && `${r.food} food${r.food === 1 ? '' : 's'}`, w && `${w} weigh-in${w === 1 ? '' : 's'}`].filter(Boolean);
      toast(parts.length ? `Synced ${parts.join(', ')}` : 'All caught up');
    } catch (e) { toast(errText(e), false); } finally { setBusy(null); }
  };
  const feeds = 'Garmin Connect, Fitbit, Samsung Health, Google Fit, Strava, Oura, WHOOP, Withings, Polar, COROS, Peloton, MyFitnessPal, Cronometer, MacroFactor, Lose It and more';
  return (
    <>
      <SectionLabel>On your phone</SectionLabel>
      <Card style={{ gap: 10 }}>
        <Txt v="h3">{Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'}</Txt>
        {status === null ? null : status === 'unsupported' ? <>
          <Txt v="small">Android phones share health data through Health Connect: open Dragonfly’s Android app and switch it on here. That brings in steps, sleep, heart rate, water, workouts and food from {feeds}.</Txt>
          <Txt v="small">Apple Health comes with the iPhone app.</Txt>
        </> : status !== 'ready' ? <>
          <Txt>{status === 'update_needed' ? 'Health Connect needs an update first.' : 'Install Health Connect (free from Google) to sync with your other apps.'}</Txt>
          <Button kind="ghost" icon="open_in_new" title="Open Health Connect" onPress={openHealthSettings} style={{ alignSelf: 'flex-start' }} />
        </> : <>
          <Txt v="small">Steps, sleep, resting heart rate, HRV, water, workouts and food from {feeds}. In each app, switch on sharing to Health Connect.</Txt>
          {st.on && consented ? <>
            <Txt v="bold">✓ Syncing · last checked {when(st.last)}</Txt>
            {app.membership && <Toggle label="Bring in food" sub="Meals you log in another app appear in your Dragonfly food diary" value={st.food} onChange={(food) => save({ ...st, food })} />}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button kind="ghost" icon="sync" title="Sync now" busy={busy === 'sync'} onPress={() => run('sync')} />
              <Button kind="ghost" icon="download" title="Bring in the last year" busy={busy === 'history'} onPress={() => run('history')} />
              <Button kind="quiet" title="Permissions" onPress={openHealthSettings} />
              <Button kind="quiet" title="Turn off" onPress={() => save({ ...st, on: false })} />
            </View>
          </> : <Button title="Connect Health Connect" icon="favorite" busy={busy === 'sync'} onPress={() => run('sync')} style={{ alignSelf: 'flex-start' }} />}
        </>}
        <Txt v="small">Weigh-ins from your smart scale sync in the Scale tab.</Txt>
        <Button kind="quiet" icon="shield" title="Health data: consent and export" onPress={() => router.push('/health-consent')} style={{ alignSelf: 'flex-start' }} />
      </Card>
    </>
  );
}

/* ---------------- Strava, Oura, WHOOP ---------------- */
function AccountsCard() {
  const app = useApp();
  const toast = useToast();
  const p = usePalette();
  const [conns, setConns] = useState<Conn[]>([]);
  const [avail, setAvail] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await sb.from('coach_connections').select('provider,account,last_sync_at,status').eq('user_id', app.user!.id);
    setConns((data ?? []) as Conn[]);
  }, [app.user]);
  useEffect(() => {
    load();
    callFn<{ providers: string[] }>('coach-connect', { action: 'available' }).then((r) => setAvail(r.providers)).catch(() => setAvail([]));
  }, [load]);
  const connect = async (key: Conn['provider']) => {
    setBusy(key);
    try {
      const back = Platform.OS === 'web' ? `${window.location.origin}${window.location.pathname}` : 'dragonfly://connections';
      const { url } = await callFn<{ url: string }>('coach-connect', { action: 'start', provider: key, return_to: back });
      if (Platform.OS === 'web') { window.location.assign(url); return; }
      const r = await WebBrowser.openAuthSessionAsync(url, 'dragonfly://connections');
      if (r.type === 'success') {
        const q = new URL(r.url).searchParams;
        toast(q.get('connected') ? `${ACCOUNTS.find((a) => a.key === key)!.name} connected` : 'That didn’t connect. Try again.', !!q.get('connected'));
      }
      await load();
    } catch (e) { toast(fnText(e), false); } finally { setBusy(null); }
  };
  const sync = async (key: Conn['provider']) => {
    setBusy(key);
    try {
      const r = await callFn<{ added: number; failed: string[] }>('coach-connect', { action: 'sync', provider: key });
      toast(r.failed.length ? 'Couldn’t reach it. Try reconnecting.' : r.added ? 'Synced' : 'All caught up', !r.failed.length); await load();
    } catch (e) { toast(fnText(e), false); } finally { setBusy(null); }
  };
  const disconnect = async (a: (typeof ACCOUNTS)[number]) => {
    if (!(await confirm(`Disconnect ${a.name}?`, 'New data stops coming in. What’s already synced stays.', 'Disconnect', true))) return;
    setBusy(a.key);
    try { await callFn('coach-connect', { action: 'disconnect', provider: a.key }); await load(); } catch (e) { toast(fnText(e), false); } finally { setBusy(null); }
  };
  // Only accounts that are switched on (their keys are in Supabase) or already linked
  const shown = ACCOUNTS.filter((a) => avail?.includes(a.key) || conns.some((c) => c.provider === a.key));
  if (!shown.length) return null;
  return (
    <>
      <SectionLabel>Accounts</SectionLabel>
      <Card style={{ padding: 0 }}>
        {shown.map((a) => {
          const c = conns.find((x) => x.provider === a.key);
          const ready = avail?.includes(a.key);
          return (
            <View key={a.key} style={{ padding: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: p.line }}>
              <Txt v="bold">{a.name}</Txt>
              <Txt v="small">{c ? `${c.status === 'expired' ? '⚠️ Needs reconnecting' : `✓ Connected${c.account ? ` as ${c.account}` : ''}`} · last synced ${when(c.last_sync_at)}` : a.what}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {c ? <>
                  {c.status === 'expired' ? <Button small title="Reconnect" busy={busy === a.key} onPress={() => connect(a.key)} /> : <Button small kind="ghost" icon="sync" title="Sync now" busy={busy === a.key} onPress={() => sync(a.key)} />}
                  <Button small kind="quiet" title="Disconnect" onPress={() => disconnect(a)} />
                </> : ready ? <Button small icon="link" title={`Connect ${a.name}`} busy={busy === a.key} onPress={() => connect(a.key)} /> : null}
              </View>
            </View>
          );
        })}
      </Card>
    </>
  );
}

/* ---------------- food trackers ---------------- */
function FoodCard() {
  const app = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!app.membership) return null;
  const importCsv = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets[0]) return;
      setBusy(true);
      const text = Platform.OS === 'web' ? await (await fetch(res.assets[0].uri)).text() : await new (await import('expo-file-system')).File(res.assets[0].uri).text();
      const { rows, skipped, app: from } = parseFoodCsv(text);
      if (!rows.length) return toast('No food found. Export your diary as a CSV from Cronometer, MyFitnessPal or Lose It and try again.', false);
      const days = new Set(rows.map((r) => r.start.slice(0, 10))).size;
      if (!(await confirm(`Import ${rows.length} foods from ${from}?`, `Covers ${days} day${days === 1 ? '' : 's'}.${skipped ? ` ${skipped} rows couldn’t be read.` : ''} Foods you’ve already imported are skipped.`, 'Import'))) return;
      const n = await saveFood(app.membership!, foodRows({ food: rows }, `csv-${from.toLowerCase().replace(/\W+/g, '')}`), 'import');
      toast(n ? `Added ${n} food${n === 1 ? '' : 's'} to your diary` : 'Already imported');
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  return (
    <>
      <SectionLabel>Food tracker</SectionLabel>
      <Card style={{ gap: 10 }}>
        <Txt v="small">Prefer logging in MyFitnessPal, Cronometer, MacroFactor or Lose It? Keep using it. On Android, switch on its Health Connect sharing and your meals come into your Dragonfly diary automatically. Or import its diary export any time:</Txt>
        <Txt v="small">Cronometer: More → Account → Export Data → Food &amp; Recipe Entries. MyFitnessPal: Settings → Export Data (Premium). Lose It: Insights → Export.</Txt>
        <Button kind="ghost" icon="upload_file" title="Import a food diary CSV" busy={busy} onPress={importCsv} style={{ alignSelf: 'flex-start' }} />
      </Card>
    </>
  );
}

/* ---------------- calendars (trainers) ---------------- */
function CalendarCard() {
  const app = useApp();
  const toast = useToast();
  const tid = app.trainer!.user_id;
  const [d, setD] = useState<{ calendar_token: string | null; busy_ics_url: string | null } | null>(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<number | null>(null);
  useEffect(() => {
    sb.from('coach_trainer_details').select('calendar_token,busy_ics_url').eq('user_id', tid).maybeSingle().then(({ data }) => {
      setD(data ?? { calendar_token: null, busy_ics_url: null }); setLink(data?.busy_ics_url ?? '');
    });
    sb.from('coach_external_busy').select('id', { count: 'exact', head: true }).eq('trainer_id', tid).then(({ count }) => setBlocks(count ?? 0));
  }, [tid]);
  if (!d) return null;
  const feed = d.calendar_token ? `${SUPABASE_URL}/functions/v1/coach-calendar?token=${d.calendar_token}` : null;
  const save = async (patch: Record<string, unknown>) => {
    const { error } = await sb.from('coach_trainer_details').upsert({ user_id: tid, ...patch, updated_at: new Date().toISOString() });
    if (error) { toast(errText(error), false); return false; }
    setD({ ...d, ...patch } as typeof d); return true;
  };
  const makeFeed = async (reset: boolean) => {
    if (reset && !(await confirm('Make a new link?', 'Calendars using the old link stop updating. You’ll need to subscribe again with the new one.', 'New link', true))) return;
    setBusy('feed'); await save({ calendar_token: secret() }); setBusy(null);
  };
  const saveBusy = async () => {
    const v = link.trim();
    if (v && !/^(https|webcal):\/\//i.test(v)) return toast('Paste the calendar’s private address (it starts with https:// or webcal://)', false);
    setBusy('busy');
    try {
      if (!(await save({ busy_ics_url: v || null }))) return;
      const r = await callFn<{ blocks: number }>('coach-calendar', { action: 'refresh_busy' });
      setBlocks(r.blocks); toast(v ? `Blocked ${r.blocks} busy time${r.blocks === 1 ? '' : 's'} over the next 60 days` : 'Removed');
    } catch (e) {
      const code = (e as { code?: string }).code;
      toast(code === 'calendar_link_not_allowed' ? 'Use the private link from Google Calendar, Outlook or iCloud.' : code === 'calendar_unreachable' ? 'Couldn’t read that calendar. Check the link is the private iCal address.' : fnText(e), false);
    } finally { setBusy(null); }
  };
  return (
    <>
      <SectionLabel>Calendar</SectionLabel>
      <Card style={{ gap: 10 }}>
        <Txt v="h3">See Dragonfly in your calendar</Txt>
        <Txt v="small">Subscribe from Google Calendar (Other calendars → + → From URL), Outlook (Add calendar → Subscribe from web) or Apple Calendar (File → New Calendar Subscription). Sessions and events update on their own. Keep this link private.</Txt>
        {feed ? <>
          <Txt v="small" selectable numberOfLines={2}>{feed}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button small kind="ghost" icon="content_copy" title="Copy link" onPress={async () => { await Clipboard.setStringAsync(feed); toast('Copied'); }} />
            <Button small kind="quiet" title="Make a new link" busy={busy === 'feed'} onPress={() => makeFeed(true)} />
          </View>
        </> : <Button small icon="event" title="Create calendar link" busy={busy === 'feed'} onPress={() => makeFeed(false)} style={{ alignSelf: 'flex-start' }} />}
      </Card>
      <Card style={{ gap: 10 }}>
        <Txt v="h3">Block out your own busy times</Txt>
        <Txt v="small">Paste your calendar’s private iCal address and clients can’t book over those times. Google: Settings → your calendar → Secret address in iCal format. Outlook: Settings → Calendar → Shared calendars → Publish → ICS. iCloud: share the calendar as Public and copy the link.</Txt>
        <Field label="Private calendar link" value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} placeholder="https://calendar.google.com/calendar/ical/…" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Button small icon="sync" title={d.busy_ics_url && link.trim() === d.busy_ics_url ? 'Refresh' : 'Save'} busy={busy === 'busy'} onPress={saveBusy} />
          {blocks != null && d.busy_ics_url ? <Txt v="small">{blocks} busy time{blocks === 1 ? '' : 's'} blocked · refreshes when you open your calendar</Txt> : null}
        </View>
      </Card>
    </>
  );
}
