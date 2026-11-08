import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Toggle } from '@/components/pickers';
import { Button, Card, Txt } from '@/components/ui';
import { crashReportsOn, setCrashReportsOn } from '@/features/crash-reporter';
import { Page } from '@/features/settings-page';
import { sb, WEB_URL } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

type Report = { id: string; body: string; app: string; context: Record<string, string>; resolved: boolean; created_at: string };

/** About Dragonfly, credits, privacy, and (for the app's owner) reported issues */
export default function About() {
  const p = usePalette();
  const [admin, setAdmin] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [crashes, setCrashes] = useState(crashReportsOn);
  const load = async () => {
    const { data: a } = await sb.rpc('dragonfly_is_admin');
    setAdmin(!!a);
    if (a) { const { data } = await sb.from('dragonfly_issue_reports').select('*').order('created_at', { ascending: false }).limit(100); setReports((data as Report[]) ?? []); }
  };
  useEffect(() => { load(); }, []);
  return (
    <Page title="About">
      <View style={{ alignItems: 'center', gap: 6, marginVertical: 10 }}>
        <Txt v="display" color={p.focus}>Dragonfly</Txt>
        <Txt center>Coaching software by The Dragonfly Catalyst: workouts, nutrition, check-ins, programs, scheduling, payments and community in one place, for solo trainers and teams.</Txt>
        <Txt v="small">Version {Constants.expoConfig?.version ?? '1.0.0'}</Txt>
      </View>
      <Card style={{ gap: 6 }}>
        <Txt v="bold">Your privacy</Txt>
        <Txt v="small">Your data is yours. Clients’ information is visible only to their own trainer (and the team owner when they open that trainer’s account). Payments are handled by Stripe; Dragonfly never sees card numbers. AI features send only what’s needed for that one request.</Txt>
        <Button small kind="ghost" title="Privacy policy" onPress={() => Linking.openURL(`${WEB_URL}privacy`)} style={{ alignSelf: 'flex-start' }} />
        <Toggle label="Send crash reports" sub="If the app crashes, send the error and where it happened in the code. Never your name, email, clients, health or payment details." value={crashes} onChange={(v) => { setCrashReportsOn(v); setCrashes(v); }} />
      </Card>
      <Card style={{ gap: 4 }}>
        <Txt v="bold">Credits</Txt>
        <Txt v="small">Food data: USDA FoodData Central (public domain) and Open Food Facts (ODbL). Exercise library: Free Exercise DB (public domain). GIFs: GIPHY.</Txt>
      </Card>
      {admin && <>
        <SectionLabel>{`Reported issues · ${reports.filter((r) => !r.resolved).length} open`}</SectionLabel>
        {reports.length === 0 ? <Txt v="small">No reports yet.</Txt> : reports.map((r) => (
          <Card key={r.id} style={{ gap: 4, opacity: r.resolved ? 0.6 : 1 }}>
            <Txt v="small">{new Date(r.created_at).toLocaleString()} · {r.context?.username ?? 'someone'} · {r.context?.platform ?? ''} {r.context?.version ?? ''}</Txt>
            <Txt>{r.body}</Txt>
            <Button small kind="quiet" title={r.resolved ? 'Reopen' : 'Mark resolved'} style={{ alignSelf: 'flex-start' }} onPress={async () => { await sb.from('dragonfly_issue_reports').update({ resolved: !r.resolved }).eq('id', r.id); load(); }} />
          </Card>
        ))}
      </>}
    </Page>
  );
}
