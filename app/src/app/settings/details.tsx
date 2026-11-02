import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Pair } from '@/components/bits';
import { DateField } from '@/components/date-field';
import { Button, Card, Chip, Field, Txt, useToast } from '@/components/ui';
import { Page, useTrainerSave } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { dayKey } from '@/lib/dates';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';

type Details = { first_name: string; last_name: string; phone: string; address1: string; address2: string; city: string; region: string; postcode: string; country: string; date_of_birth: string | null };
const ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Puerto_Rico', 'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin', 'Africa/Lagos', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'];
const offset = (tz: string) => { try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find((x) => x.type === 'timeZoneName')?.value.replace('GMT', 'UTC') ?? ''; } catch { return ''; } };

/** My details: private (address, birthday) plus the name clients see and your time zone */
export default function MyDetails() {
  const toast = useToast();
  const app = useApp();
  const save = useTrainerSave();
  const t = app.trainer;
  const [d, setD] = useState<Details>({ first_name: '', last_name: '', phone: '', address1: '', address2: '', city: '', region: '', postcode: '', country: 'United States', date_of_birth: null });
  const [name, setName] = useState(t?.display_name ?? '');
  const [business, setBusiness] = useState(t?.business_name ?? '');
  const [bio, setBio] = useState(t?.bio ?? '');
  const [tz, setTz] = useState(t?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!t) return;
    sb.from('coach_trainer_details').select('*').eq('user_id', t.user_id).maybeSingle().then(({ data }) => {
      if (data) setD(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? (k === 'date_of_birth' ? null : '')])) as unknown as Details);
    });
  }, [t]);
  if (!t) return null;
  const f = (k: keyof Details, label: string, extra: object = {}) => <Field label={label} value={(d[k] as string) ?? ''} onChangeText={(v) => setD({ ...d, [k]: v })} {...extra} />;
  const submit = async () => {
    if (!name.trim()) return toast('Enter the name clients see', false);
    setBusy(true);
    const row = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]));
    const { error } = await sb.from('coach_trainer_details').upsert({ ...row, user_id: t.user_id, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast(errText(error), false);
    await save({ display_name: name.trim(), business_name: business.trim() || null, bio: bio.trim() || null, timezone: tz }, 'Details updated');
  };
  const zones = ZONES.includes(tz) ? ZONES : [tz, ...ZONES];
  return (
    <Page title="Account details">
      <Card>
        <Pair>{f('first_name', 'First name')}{f('last_name', 'Last name')}</Pair>
        <Pair>
          <Field label="Name clients see" value={name} onChangeText={setName} />
          <Field label="Business name" hint="(optional)" value={business} onChangeText={setBusiness} />
        </Pair>
        <Field label="Bio" hint="(shown to clients)" value={bio} onChangeText={setBio} multiline placeholder="NASM-certified trainer helping busy people get strong." />
        {f('phone', 'Phone', { keyboardType: 'phone-pad' })}
      </Card>
      <Card>
        {f('address1', 'Address 1')}{f('address2', 'Address 2', { placeholder: 'Address 2' })}
        <Pair>{f('city', 'Town / City')}{f('region', 'County / State')}</Pair>
        <Pair>{f('postcode', 'Post code / ZIP code')}{f('country', 'Country')}</Pair>
        <DateField label="Date of birth" optional value={d.date_of_birth} onChange={(v) => setD({ ...d, date_of_birth: v })} max={dayKey(new Date())} />
        <Txt v="small">Your address and birthday are private: clients never see them.</Txt>
      </Card>
      <Card>
        <Txt v="bold" style={{ marginBottom: 8 }}>Time zone</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{zones.map((z) => <Chip key={z} label={`(${offset(z)}) ${z.split('/').pop()!.replace(/_/g, ' ')}`} selected={tz === z} onPress={() => setTz(z)} />)}</View>
      </Card>
      <Button title="Update details" icon="check" busy={busy} onPress={submit} style={{ alignSelf: 'center', minWidth: 220 }} />
    </Page>
  );
}
