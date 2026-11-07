// Referral link: a friend leaves their name and how to reach them; the trainer gets them as a lead.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Button, Field, Txt } from '@/components/ui';
import { LinkPage } from '@/features/link-page';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

type V = { trainer_name: string; business_name: string | null; referrer_first: string };
const ERR: Record<string, string> = { name_required: 'Enter your name.', contact_required: 'Leave an email or phone number.', bad_email: 'That email doesn’t look right.', try_again_tomorrow: 'This link has had a lot of sign-ups today. Try again tomorrow.' };

export default function Referral() {
  const p = usePalette();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [v, setV] = useState<V | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => { void sb.rpc('coach_referral_view', { p_code: code }).then(({ data }) => setV(((data as V[] | null) ?? [])[0] ?? null)); }, [code]);
  const send = async () => {
    setBusy(true); setErr('');
    const { error } = await sb.rpc('coach_referral_submit', { p_code: code, p_name: name, p_email: email || null, p_phone: phone || null, p_message: message || null });
    setBusy(false);
    if (error) setErr(Object.entries(ERR).find(([k]) => error.message.includes(k))?.[1] ?? 'Couldn’t send that. Try again.'); else setDone(true);
  };
  if (v === undefined) return <LinkPage title="Training"><ActivityIndicator color={p.ink} /></LinkPage>;
  if (v === null) return <LinkPage title="Training"><Txt>This link isn’t valid any more.</Txt></LinkPage>;
  return (
    <LinkPage title={`Train with ${v.trainer_name}`}>
      {done ? <Txt>Thanks, {name.split(' ')[0]}! {v.trainer_name} will be in touch soon.</Txt> : (
        <>
          <Txt v="h2">Train with {v.trainer_name}</Txt>
          <Txt>{v.referrer_first} thought you might enjoy training with {v.trainer_name}{v.business_name ? ` (${v.business_name})` : ''}. Leave your details and they’ll get in touch.</Txt>
          <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" />
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
          <Field label="What are you looking for? (optional)" value={message} onChangeText={setMessage} multiline maxLength={1000} />
          <Txt v="small">Your details go only to {v.trainer_name}, to contact you about training.</Txt>
          {err ? <Txt color={p.danger}>{err}</Txt> : null}
          <Button title="Send" busy={busy} onPress={send} />
        </>
      )}
    </LinkPage>
  );
}
