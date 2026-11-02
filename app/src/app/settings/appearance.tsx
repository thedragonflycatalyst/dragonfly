import { View } from 'react-native';
import { Card, Chip, Txt } from '@/components/ui';
import { Page } from '@/features/settings-page';
import { setAppearance, useAppearance, type Appearance } from '@/lib/theme';

export const APPEARANCES: [Appearance, string, string][] = [
  ['dark', 'Dark', 'The Dragonfly look: deep ink and violet'],
  ['light', 'Light', 'Easier to read outdoors and in bright rooms'],
  ['system', 'Match my phone', 'Follows your phone’s light or dark setting'],
];

/** Theme: dark by default, light, or follow the phone. Saved on this device. */
export default function AppearanceSettings() {
  const a = useAppearance();
  return (
    <Page title="Appearance">
      <Card style={{ gap: 10 }}>
        <Txt v="bold">Theme</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {APPEARANCES.map(([k, l]) => <Chip key={k} label={l} selected={a === k} onPress={() => setAppearance(k)} />)}
        </View>
        <Txt v="small">{APPEARANCES.find(([k]) => k === a)?.[2]}. Saved on this device.</Txt>
      </Card>
    </Page>
  );
}
