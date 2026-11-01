import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Field, Txt, useToast } from '@/components/ui';
import { errText, INTERESTS, type Client } from '@/lib/model';
import { sb } from '@/lib/supabase';
import type { SectionProps } from './common';

/** Saves goals and interests as the trainer (direct) or as the client (through their own-profile function). */
export async function saveGoals(client: Client, role: 'coach' | 'client', goals: string, interests: string[], finish = false) {
  if (role === 'coach') {
    const { error } = await sb.from('coach_clients').update({ goals: goals.trim() || null, interests }).eq('id', client.id);
    if (error) throw error;
    return;
  }
  const { error } = await sb.rpc('coach_update_my_profile', {
    p_client: client.id, p_phone: client.phone, p_sex: client.sex, p_date_of_birth: client.date_of_birth, p_height_cm: client.height_cm,
    p_goals: goals, p_interests: interests, p_finish_onboarding: finish,
  });
  if (error) throw error;
}

/** Interest chips (preset list plus any custom ones already chosen) */
export function InterestPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [custom, setCustom] = useState('');
  const all = [...INTERESTS, ...value.filter((v) => !INTERESTS.includes(v))];
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {all.map((i) => <Chip key={i} label={i} selected={value.includes(i)} onPress={() => onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i])} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}><Field label="Something else" hint="(optional)" value={custom} onChangeText={setCustom} placeholder="Hiking, kayaking…" /></View>
        <Button kind="quiet" title="Add" style={{ marginBottom: 16 }} onPress={() => { const c = custom.trim(); if (c && !value.includes(c)) onChange([...value, c.slice(0, 40)]); setCustom(''); }} />
      </View>
    </View>
  );
}

export function Goals({ client, role }: SectionProps) {
  const toast = useToast();
  const [goals, setGoals] = useState(client.goals ?? '');
  const [interests, setInterests] = useState<string[]>(client.interests ?? []);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <Field label={role === 'coach' ? `${client.first_name}’s goals` : 'Your goals'} value={goals} onChangeText={setGoals} multiline
        placeholder="Lose 15 lb, run a 5K in March, pain-free squats" />
      <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Interests</Txt>
      <InterestPicker value={interests} onChange={setInterests} />
      <Button title="Save" busy={busy} style={{ alignSelf: 'flex-start' }} onPress={async () => {
        setBusy(true);
        try { await saveGoals(client, role, goals, interests); toast('Saved'); } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
      }} />
    </Card>
  );
}
