import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Screen } from '@/components/shell';
import { Button, Card, Icon, Txt } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { GUIDES, markGuideSeen } from '@/lib/guide';
import { usePalette } from '@/lib/theme';

/** Quickstart guide: a brief, one-card-at-a-time intro for the signed-in person's role. */
export default function Guide() {
  const p = usePalette();
  const app = useApp();
  const [i, setI] = useState(0);
  if (!app.user || !app.mode) return <Redirect href="/" />;

  const g = GUIDES[app.mode];
  const step = g.steps[i];
  const last = i === g.steps.length - 1;
  const finish = () => { markGuideSeen(app.user!.id, app.mode!); router.replace(app.mode === 'coach' ? '/coach' : '/me'); };

  return (
    <Screen kicker={`${i + 1} of ${g.steps.length}`} title={g.title}>
      <View style={{ maxWidth: 560, gap: 16 }}>
        {i === 0 && <Txt color={p.muted}>{g.intro}</Txt>}
        <Card style={{ gap: 12, paddingVertical: 28, paddingHorizontal: 22, minHeight: 250 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={step.icon} size={30} color={p.focus} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Txt v="h2" accessibilityRole="header">{step.title}</Txt>
            {!step.ready && <Badge text="Coming soon" color={p.gold} />}
          </View>
          <Txt style={{ fontSize: 17, lineHeight: 26 }}>{step.body}</Txt>
        </Card>
        <View accessibilityLabel={`Step ${i + 1} of ${g.steps.length}`} style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
          {g.steps.map((s, n) => (
            <View key={s.title} style={{ width: n === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: n === i ? p.focus : p.line }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          {i > 0 ? <Button kind="ghost" title="Back" onPress={() => setI(i - 1)} /> : <Button kind="quiet" small title="Skip" onPress={finish} />}
          <Button title={last ? 'Get started' : 'Next'} onPress={last ? finish : () => setI(i + 1)} />
        </View>
      </View>
    </Screen>
  );
}
