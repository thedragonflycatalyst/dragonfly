import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { Row, SectionLabel } from '@/components/bits';
import { Screen } from '@/components/shell';
import { Card, Txt } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { allowed, FEATURES, GROUPS } from '@/lib/features';
import { usePalette } from '@/lib/theme';

/** Trainer menu: every part of Dragonfly in one list. */
export default function Menu() {
  const p = usePalette();
  const app = useApp();
  return (
    <Screen title="Menu">
      <View style={{ maxWidth: 640, width: '100%' }}>
        {GROUPS.map((g) => {
          const member = app.teamMembers.find((t) => t.trainer_id === app.user?.id && t.role === 'trainer');
          const items = FEATURES.filter((f) => f.group === g && allowed(f, member, app.isOwner));
          return (
            <View key={g}>
              <SectionLabel>{g}</SectionLabel>
              <Card style={{ padding: 0 }}>
                {items.map((f, i) => (
                  <Row key={f.key} icon={f.icon} title={f.title} last={i === items.length - 1}
                    right={f.href ? undefined : <Txt v="small" color={p.muted}>Soon</Txt>}
                    onPress={() => router.push((f.href ?? `/soon/${f.key}`) as Href)} />
                ))}
              </Card>
            </View>
          );
        })}
        <SectionLabel>Account</SectionLabel>
        <Card style={{ padding: 0 }}>
          <Row icon="groups" title={app.team ? app.team.name : 'Team'} sub={app.team ? 'Trainers on your team' : 'Solo trainer · add trainers'} onPress={() => router.push('/team')} />
          <Row icon="school" title="Quickstart guide" onPress={() => router.push('/guide')} />
          <Row icon="logout" title="Sign out" last onPress={async () => { await app.signOut(); router.replace('/'); }} />
        </Card>
      </View>
    </Screen>
  );
}
