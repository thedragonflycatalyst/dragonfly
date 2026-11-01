import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { Pair, Row, SectionLabel, Segmented } from '@/components/bits';
import { Screen } from '@/components/shell';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { errText, type Units } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

/** Trainer menu: coaching profile, client settings, guide and account. */
export default function Menu() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const t = app.trainer;
  const [name, setName] = useState(t?.display_name ?? '');
  const [business, setBusiness] = useState(t?.business_name ?? '');
  const [freezeDays, setFreezeDays] = useState(String(t?.auto_freeze_days ?? 90));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(t?.display_name ?? ''); setBusiness(t?.business_name ?? ''); setFreezeDays(String(t?.auto_freeze_days ?? 90)); }, [t]);
  if (!t) return null;

  const save = async (patch: Record<string, unknown>, ok = 'Saved') => {
    setBusy(true);
    try {
      const { error } = await sb.from('coach_trainers').update(patch).eq('user_id', t.user_id);
      if (error) throw error;
      await app.reloadMe(); toast(ok);
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };

  return (
    <Screen title="Menu">
      <View style={{ maxWidth: 640 }}>
        <SectionLabel>Your coaching profile</SectionLabel>
        <Card>
          <Pair>
            <Field label="Name clients see" value={name} onChangeText={setName} />
            <Field label="Business name" hint="(optional)" value={business} onChangeText={setBusiness} />
          </Pair>
          <Button title="Save profile" busy={busy} style={{ alignSelf: 'flex-start' }}
            onPress={() => name.trim() ? save({ display_name: name.trim(), business_name: business.trim() || null }) : toast('Enter a name', false)} />
        </Card>

        <SectionLabel>Client settings</SectionLabel>
        <Card style={{ gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Txt v="bold">Units</Txt>
            <Segmented<Units> value={t.units} onChange={(u) => save({ units: u }, u === 'imperial' ? 'Showing pounds and inches' : 'Showing kilograms and centimeters')}
              options={[['imperial', 'lb, ft, in'], ['metric', 'kg, cm']]} />
            <Txt v="small">Your clients see the same units.</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Txt v="bold">Send the health questionnaire to new clients</Txt>
              <Txt v="small">They fill it in during their first sign-in. Any “yes” answer is flagged for you.</Txt>
            </View>
            <Switch value={t.auto_health_form} onValueChange={(v) => save({ auto_health_form: v })} accessibilityLabel="Send the health questionnaire to new clients"
              trackColor={{ true: p.focus, false: p.line }} thumbColor={p.surface} />
          </View>
          <View>
            <Txt v="bold">Freeze inactive clients automatically</Txt>
            <Txt v="small" style={{ marginBottom: 10 }}>
              A client with no session for this many days is frozen: they keep their history but lose access until you unfreeze them. This starts once session tracking from your schedule is set up.
            </Txt>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
              <View style={{ width: 140 }}><Field label="Days" value={freezeDays} onChangeText={setFreezeDays} keyboardType="number-pad" /></View>
              <Button kind="quiet" title="Save" style={{ marginBottom: 16 }} busy={busy} onPress={() => {
                const d = Number(freezeDays);
                if (!Number.isInteger(d) || d < 14 || d > 730) return toast('Use a number of days from 14 to 730', false);
                save({ auto_freeze_days: d });
              }} />
            </View>
          </View>
        </Card>

        <SectionLabel>Help and account</SectionLabel>
        <Card style={{ padding: 0 }}>
          <Row icon="school" title="Quickstart guide" onPress={() => router.push('/guide')} />
          <Row icon="person" title="Account" sub="Picture, email, password, devices" onPress={() => router.push('/account')} />
          <Row icon="logout" title="Sign out" last onPress={async () => { await app.signOut(); router.replace('/'); }} />
        </Card>
      </View>
    </Screen>
  );
}
