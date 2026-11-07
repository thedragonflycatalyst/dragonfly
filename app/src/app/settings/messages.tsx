// Automatic messages: reminders and (when switched on) surveys, testimonial and referral asks; quiet hours and caps.
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Field, Txt, useToast } from '@/components/ui';
import { Page } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';

type S = {
  trainer_id: string; quiet_start: string; quiet_end: string; max_per_week: number; reminders_on: boolean; reminder_hours: number[];
  surveys_on: boolean; survey_every: number; survey_min_days: number; testimonials_on: boolean; referrals_on: boolean; referral_every_days: number;
  include_ca_clients: boolean; sms_enabled: boolean;
};
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

export default function MessageSettings() {
  const app = useApp();
  const toast = useToast();
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  const tid = app.trainer?.user_id;
  useEffect(() => {
    if (!tid) return;
    void sb.from('coach_message_settings').select('*').eq('trainer_id', tid).maybeSingle().then(({ data }) => setS((data as S) ?? {
      trainer_id: tid, quiet_start: '21:00', quiet_end: '08:00', max_per_week: 3, reminders_on: true, reminder_hours: [24], surveys_on: false, survey_every: 4,
      survey_min_days: 14, testimonials_on: false, referrals_on: false, referral_every_days: 90, include_ca_clients: false, sms_enabled: false,
    }));
  }, [tid]);
  if (!s) return <Page title="Automatic messages"><Txt>Loading…</Txt></Page>;
  const set = (patch: Partial<S>) => setS({ ...s, ...patch });
  const hours = (h: number) => set({ reminder_hours: s.reminder_hours.includes(h) ? s.reminder_hours.filter((x) => x !== h) : [...s.reminder_hours, h].sort((a, b) => b - a) });
  const save = async () => {
    if (!HHMM.test(s.quiet_start) || !HHMM.test(s.quiet_end)) return toast('Quiet hours look like 21:00 and 08:00', false);
    setBusy(true);
    const { sms_enabled: _ignored, ...mine } = s;
    const { error } = await sb.from('coach_message_settings').upsert(mine, { onConflict: 'trainer_id' });
    setBusy(false);
    if (error) toast(errText(error), false); else toast('Saved');
  };
  const Toggle = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => <Chip label={label} selected={on} onPress={onPress} />;
  return (
    <Page title="Automatic messages">
      <Stack.Screen options={{ title: 'Automatic messages' }} />
      <View style={{ gap: 12 }}>
        <Card style={{ gap: 6 }}>
          <Txt v="bold">How messages are sent</Txt>
          <Txt v="small">Each client chooses text, email or the app; the default is text, the hardest to miss. Until automatic texting is on, texts wait in your “To send” list so you can send them from your phone in one tap.</Txt>
          <Txt v="small">{s.sms_enabled ? 'Automatic texting is on for clients who agreed to texts.' : 'Automatic texting is off. It needs a texting service, which the owner approves and sets up.'}</Txt>
          <Button small kind="ghost" title="Open “To send”" onPress={() => router.push('/outbox')} style={{ alignSelf: 'flex-start' }} />
        </Card>
        <Card style={{ gap: 8 }}>
          <Txt v="bold">Session reminders</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Toggle on={s.reminders_on} label={s.reminders_on ? 'On' : 'Off'} onPress={() => set({ reminders_on: !s.reminders_on })} />
            {[48, 24, 2].map((h) => <Toggle key={h} on={s.reminder_hours.includes(h)} label={`${h} hours before`} onPress={() => hours(h)} />)}
          </View>
        </Card>
        <Card style={{ gap: 8 }}>
          <Txt v="bold">Feedback, testimonials and referrals</Txt>
          <Txt v="small">Only sent to clients who said yes to these messages. Testimonials are published only after the client approves the exact words.</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Toggle on={s.surveys_on} label="Short surveys" onPress={() => set({ surveys_on: !s.surveys_on })} />
            <Toggle on={s.testimonials_on} label="Ask for testimonials" onPress={() => set({ testimonials_on: !s.testimonials_on })} />
            <Toggle on={s.referrals_on} label="Ask for referrals" onPress={() => set({ referrals_on: !s.referrals_on })} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Field label="Survey every N sessions" keyboardType="number-pad" value={String(s.survey_every)} onChangeText={(v) => set({ survey_every: Math.min(20, Math.max(1, Number(v) || 1)) })} style={{ flex: 1 }} />
            <Field label="Referral ask at most every (days)" keyboardType="number-pad" value={String(s.referral_every_days)} onChangeText={(v) => set({ referral_every_days: Math.min(365, Math.max(30, Number(v) || 90)) })} style={{ flex: 1 }} />
          </View>
        </Card>
        <Card style={{ gap: 8 }}>
          <Txt v="bold">Limits</Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Field label="Quiet from" value={s.quiet_start.slice(0, 5)} onChangeText={(v) => set({ quiet_start: v })} style={{ flex: 1 }} />
            <Field label="Quiet until" value={s.quiet_end.slice(0, 5)} onChangeText={(v) => set({ quiet_end: v })} style={{ flex: 1 }} />
            <Field label="Max per week" keyboardType="number-pad" value={String(s.max_per_week)} onChangeText={(v) => set({ max_per_week: Math.min(14, Math.max(1, Number(v) || 1)) })} style={{ flex: 1 }} />
          </View>
          <Txt v="small">The weekly limit doesn’t apply to session reminders or open-slot offers.</Txt>
          <Toggle on={s.include_ca_clients} label="Include Columbia Association clients" onPress={() => set({ include_ca_clients: !s.include_ca_clients })} />
        </Card>
        <Button title="Save" busy={busy} onPress={save} />
      </View>
    </Page>
  );
}
