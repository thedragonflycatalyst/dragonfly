import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Txt } from '@/components/ui';
import { Page, useTrainerSave } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { UNIT_OPTIONS, type UnitPrefs } from '@/lib/prefs';

/** Unit of measurement: each kind of number separately. Clients see your choices. */
export default function Units() {
  const app = useApp();
  const save = useTrainerSave();
  const [u, setU] = useState<UnitPrefs>(app.prefs);
  const [busy, setBusy] = useState(false);
  return (
    <Page title="Unit of measurement">
      {UNIT_OPTIONS.map((o) => (
        <Card key={o.key}>
          <Txt v="bold" style={{ marginBottom: 8 }}>{o.label}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {o.options.map(([v, l]) => <Chip key={v} label={l} selected={u[o.key] === v} onPress={() => setU({ ...u, [o.key]: v })} />)}
          </View>
        </Card>
      ))}
      <Txt v="small">Your clients see the same units. Everything is stored precisely, so you can switch any time.</Txt>
      <Button title="Save" icon="check" busy={busy} style={{ alignSelf: 'center', minWidth: 200 }} onPress={async () => {
        setBusy(true); await save({ unit_prefs: u, units: u.weights === 'lb' ? 'imperial' : 'metric' }, 'Units saved'); setBusy(false);
      }} />
    </Page>
  );
}
