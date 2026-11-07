// Health data consent: asked before anything is read from Health Connect. Declining keeps the app fully usable.
// Also where people withdraw consent and download their own health data (JSON or CSV).
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Button, Card, Txt, useToast } from '@/components/ui';
import { healthConsent, setHealthConsent } from '@/features/health-consent';
import { deviceSync, setDeviceSync } from '@/features/health-sync';
import { healthSync, setHealthSync } from '@/features/scale-sync';
import { Page } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { confirm } from '@/lib/ask';
import { exportCsv, exportJson, grantConsent, hasConsent, HEALTH_READS, withdrawConsent, type HealthExport } from '@/lib/health-consent';
import { errText } from '@/lib/model';
import { sb, WEB_URL } from '@/lib/supabase';

const when = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

// Pages of 1,000 rows (the API's cap per request) until a short page: every row, not just the first page (L-027)
async function every(table: string, col: 'user_id' | 'client_id', id: string, order: string, tiebreak: string | null = 'id') {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select('*').eq(col, id).order(order);
    if (tiebreak) q = q.order(tiebreak);
    const { data, error } = await q.range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) return out;
  }
}

async function loadExport(uid: string, clientId: string | undefined): Promise<HealthExport> {
  const [daily, activities, weighins, food] = await Promise.all([
    every('coach_health_daily', 'user_id', uid, 'day', null), // one row per day
    every('coach_activities', 'user_id', uid, 'started_at'),
    every('coach_weighins', 'user_id', uid, 'measured_at'),
    clientId ? every('coach_food_logs', 'client_id', clientId, 'created_at') : Promise.resolve([]),
  ]);
  return { daily, activities, weighins, food };
}

async function deliver(text: string, name: string, type: string) {
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
    return 'Downloaded';
  }
  const { File, Paths } = await import('expo-file-system');
  const f = new File(Paths.document, name);
  if (f.exists) f.delete();
  f.create(); f.write(text);
  // Big exports stay as a file in Dragonfly's documents folder; the share sheet can't carry them
  if (text.length < 200_000) await Share.share({ message: text, title: name });
  return `Saved ${name} to Dragonfly’s documents`;
}

export default function HealthConsentScreen() {
  const app = useApp();
  const toast = useToast();
  const uid = app.user!.id;
  const [c, setC] = useState(() => healthConsent(uid));
  const [busy, setBusy] = useState<'json' | 'csv' | null>(null);
  const on = hasConsent(c);

  const allow = () => {
    const next = grantConsent(); setHealthConsent(uid, next); setC(next);
    toast('Thanks. Tap Connect to choose what Health Connect shares.');
    if (router.canGoBack()) router.back();
  };
  const decline = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  const withdraw = async () => {
    if (!(await confirm('Withdraw consent?', 'Dragonfly stops reading Health Connect on this phone right away. What was already synced stays in your account until you remove it; you can download it below.', 'Withdraw', true))) return;
    const next = withdrawConsent(c); setHealthConsent(uid, next); setC(next);
    setDeviceSync(uid, { ...deviceSync(uid), on: false });
    setHealthSync(uid, { ...healthSync(uid), on: false });
    toast('Consent withdrawn. Nothing more is read from Health Connect.');
  };
  const download = async (kind: 'json' | 'csv') => {
    setBusy(kind);
    try {
      const data = await loadExport(uid, app.membership?.id);
      const day = new Date().toISOString().slice(0, 10);
      toast(kind === 'json'
        ? await deliver(exportJson(data, c), `dragonfly-health-${day}.json`, 'application/json')
        : await deliver(exportCsv(data), `dragonfly-health-${day}.csv`, 'text/csv'));
    } catch (e) { toast(errText(e), false); } finally { setBusy(null); }
  };

  return (
    <Page title="Health data">
      <Card style={{ gap: 10 }}>
        <Txt v="h3">{on ? 'You’ve allowed Health Connect' : 'Share health data with Dragonfly?'}</Txt>
        <Txt v="small">With your permission, Dragonfly reads these from Health Connect on this phone and saves them to your account so you{app.membership ? ' and your trainer' : ''} can track progress:</Txt>
        {HEALTH_READS.map(([k, v]) => <Txt key={k} v="small"><Txt v="bold">{k}: </Txt>{v}</Txt>)}
        <Txt v="small">Dragonfly only reads; it never writes to Health Connect, and never sells or shares this data for ads. You pick exactly which types to allow in the next step, and you can withdraw at any time.</Txt>
        <Txt v="small">If you withdraw, nothing more is read, but what was already synced stays in your account. You can download it below, delete entries in the Scale, Activity and Food screens, or delete your whole account in Account.</Txt>
        <Button small kind="ghost" title="Privacy policy" onPress={() => Linking.openURL(`${WEB_URL}privacy`)} style={{ alignSelf: 'flex-start' }} />
        {on ? <>
          <Txt v="small">Allowed {when(c.granted_at)}.</Txt>
          <Button kind="ghost" icon="block" title="Withdraw consent" onPress={withdraw} style={{ alignSelf: 'flex-start' }} />
        </> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button title="Allow" icon="check" onPress={allow} />
          <Button kind="quiet" title="Not now" onPress={decline} />
        </View>}
        {!on && c.withdrawn_at && <Txt v="small">You withdrew consent {when(c.withdrawn_at)}. Nothing is read from Health Connect.</Txt>}
      </Card>
      <SectionLabel>Your data</SectionLabel>
      <Card style={{ gap: 10 }}>
        <Txt v="small">Download everything health-related in your account: daily totals, workouts, weigh-ins and synced food.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button kind="ghost" icon="download" title="Download JSON" busy={busy === 'json'} onPress={() => download('json')} />
          <Button kind="ghost" icon="download" title="Download CSV" busy={busy === 'csv'} onPress={() => download('csv')} />
        </View>
      </Card>
    </Page>
  );
}
