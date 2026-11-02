import { useState } from 'react';
import { View } from 'react-native';
import { Pair, SectionLabel, Segmented } from '@/components/bits';
import { DateField } from '@/components/date-field';
import { Button, Card, Chip, Field, Txt } from '@/components/ui';
import { dayKey } from '@/lib/dates';
import { isEmail, type Client, type Group, type Sex } from '@/lib/model';
import { cmToFtIn, ftInToCm, num, showLength, toCm, toKg, weightUnit, type Units } from '@/lib/units';
import { usePalette } from '@/lib/theme';
import { CONTACT_LABEL, type ContactVia } from '@/lib/contact';

export type ClientFormValues = {
  first_name: string; last_name: string; phone: string | null; email: string; sex: Sex | null; date_of_birth: string | null;
  height_cm: number | null; goals: string | null; source: string | null; weight_kg: number | null; groupIds: string[]; asLead: boolean;
  contact_via: ContactVia;
};

/** Client details form: used for Add client (and the client pool) and for editing a client. */
export function ClientForm({ initial, groups, initialGroups = [], units, mode, pool, busy, onSubmit }: {
  initial?: Client; groups: Group[]; initialGroups?: string[]; units: Units; mode: 'new' | 'edit'; pool?: boolean; busy?: boolean;
  onSubmit: (v: ClientFormValues) => void;
}) {
  const p = usePalette();
  const ftIn = initial?.height_cm ? cmToFtIn(Number(initial.height_cm)) : null;
  const [f, setF] = useState({
    first: initial?.first_name ?? '', last: initial?.last_name ?? '', phone: initial?.phone ?? '', email: initial?.email ?? '',
    sex: (initial?.sex ?? null) as Sex | null, dob: initial?.date_of_birth ?? null as string | null, weight: '',
    ft: ftIn ? String(ftIn.ft) : '', inch: ftIn ? String(ftIn.in) : '', cm: initial?.height_cm ? String(showLength(Number(initial.height_cm), 'metric')) : '',
    goals: initial?.goals ?? '', source: initial?.source ?? '', via: (initial?.contact_via ?? 'app') as ContactVia,
  });
  const [groupIds, setGroupIds] = useState<string[]>(initialGroups);
  const [asLead, setAsLead] = useState(!!pool);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const linked = !!initial?.user_id;

  const submit = () => {
    setErr('');
    if (!f.first.trim()) return setErr('Enter a first name.');
    if (!isEmail(f.email)) return setErr('Enter a valid email address. It’s how they sign in.');
    let height: number | null = null;
    if (units === 'imperial' && (f.ft || f.inch)) {
      const ft = num(f.ft || '0'), inch = num(f.inch || '0');
      if (ft === null || inch === null || inch >= 12) return setErr('Enter height as feet and inches (0–11).');
      height = Math.round(ftInToCm(ft, inch) * 10) / 10;
    } else if (units === 'metric' && f.cm) {
      height = toCm(f.cm, 'metric');
      if (height === null) return setErr('Enter height as a number of centimeters.');
    }
    if (height !== null && (height < 50 || height > 260)) return setErr('That height looks off. Check it and try again.');
    const weight = f.weight ? toKg(f.weight, units) : null;
    if (f.weight && (weight === null || weight < 20 || weight > 400)) return setErr('That weight looks off. Check it and try again.');
    onSubmit({
      first_name: f.first.trim(), last_name: f.last.trim(), phone: f.phone.trim() || null, email: f.email.trim().toLowerCase(),
      sex: f.sex, date_of_birth: f.dob, height_cm: height, goals: f.goals.trim() || null, source: f.source.trim() || null,
      weight_kg: weight, groupIds, asLead, contact_via: f.via,
    });
  };

  return (
    <View style={{ maxWidth: 720 }}>
      {mode === 'new' && (
        <View style={{ gap: 8, marginBottom: 6 }}>
          <Segmented value={asLead ? 'lead' : 'client'} onChange={(v) => setAsLead(v === 'lead')}
            options={[['client', 'Add and invite'], ['lead', 'Client pool only']]} />
          <Txt v="small">{asLead ? 'Saved to your client pool. No email is sent until you invite them.' : 'They get an email with a code to set their password.'}</Txt>
        </View>
      )}

      <SectionLabel>Contact</SectionLabel>
      <Card>
        <Pair>
          <Field label="First name" value={f.first} onChangeText={set('first')} autoComplete="off" />
          <Field label="Last name" value={f.last} onChangeText={set('last')} autoComplete="off" />
        </Pair>
        <Pair>
          <Field label="Email" hint={linked ? '(set by their account)' : undefined} value={f.email} onChangeText={set('email')} editable={!linked}
            autoCapitalize="none" keyboardType="email-address" autoComplete="off" />
          <Field label="Phone" hint="(optional)" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="off" />
        </Pair>
        <Txt v="bold" style={{ marginBottom: 8, fontSize: 14 }}>Message them by</Txt>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {(['app', 'sms', 'whatsapp'] as ContactVia[]).map((k) => <Chip key={k} label={CONTACT_LABEL[k]} selected={f.via === k} onPress={() => setF((x) => ({ ...x, via: k }))} />)}
        </View>
        <Txt v="small" style={{ marginBottom: 14 }}>{f.via === 'app' ? 'Messages stay in Dragonfly.' : f.phone.trim() ? `Message buttons open ${CONTACT_LABEL[f.via]} on your phone with your message ready to send.` : 'Add their phone number above to use this.'}</Txt>
        {(asLead || initial?.status === 'lead') && <Field label="Where they came from" hint="(optional)" value={f.source} onChangeText={set('source')} placeholder="Website, referral, Instagram…" />}
      </Card>

      <SectionLabel>About them</SectionLabel>
      <Card>
        <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Sex <Txt v="small">(optional, used for body-fat and calorie estimates)</Txt></Txt>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([['male', 'Male'], ['female', 'Female'], ['other', 'Other']] as [Sex, string][]).map(([k, l]) => (
            <Chip key={k} label={l} selected={f.sex === k} onPress={() => setF((x) => ({ ...x, sex: x.sex === k ? null : k }))} />
          ))}
        </View>
        <DateField label="Date of birth" optional value={f.dob} onChange={(v) => setF((x) => ({ ...x, dob: v }))} max={dayKey(new Date())} min="1900-01-01" />
        <Pair>
          {mode === 'new' ? <Field label={`Starting weight (${weightUnit(units)})`} hint="(optional)" value={f.weight} onChangeText={set('weight')} keyboardType="decimal-pad" /> : null}
          {units === 'imperial' ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="Height (ft)" value={f.ft} onChangeText={set('ft')} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label="(in)" value={f.inch} onChangeText={set('inch')} keyboardType="number-pad" /></View>
            </View>
          ) : <Field label="Height (cm)" value={f.cm} onChangeText={set('cm')} keyboardType="decimal-pad" />}
        </Pair>
        <Field label="Goal" hint="(optional)" value={f.goals} onChangeText={set('goals')} multiline placeholder="Lose 15 lb, run a 5K in March, pain-free squats" />
      </Card>

      {groups.length > 0 && (
        <>
          <SectionLabel>Groups</SectionLabel>
          <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {groups.map((g) => (
              <Chip key={g.id} label={g.name} selected={groupIds.includes(g.id)}
                onPress={() => setGroupIds((ids) => (ids.includes(g.id) ? ids.filter((x) => x !== g.id) : [...ids, g.id]))} />
            ))}
          </Card>
        </>
      )}

      {err ? <Txt v="bold" color={p.danger} style={{ marginTop: 14 }} accessibilityLiveRegion="polite">{err}</Txt> : null}
      <Button title={mode === 'edit' ? 'Save changes' : asLead ? 'Add to client pool' : 'Add client and send email'} busy={busy}
        style={{ marginTop: 18, alignSelf: 'flex-start' }} onPress={submit} />
    </View>
  );
}
