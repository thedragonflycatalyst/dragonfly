import { router, Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Row, SectionLabel } from '@/components/bits';
import { Card, Txt } from '@/components/ui';
import { MAX_W, usePalette } from '@/lib/theme';

/** Help: the quickstart guide and how things work */
export default function Support() {
  const p = usePalette();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
      <Stack.Screen options={{ title: 'Support' }} />
      <View style={{ width: '100%', maxWidth: MAX_W }}>
        <Card style={{ padding: 0 }}>
          <Row icon="school" title="Quickstart guide" sub="A short tour of the main features" onPress={() => router.push('/guide')} />
          <Row icon="person" title="Account help" sub="Email, password, signing in on other devices" onPress={() => router.push('/account')} />
          <Row icon="lightbulb" title="Send feedback" sub="Suggest a feature or a design change, or report a problem" last onPress={() => router.push('/feedback?from=/support')} />
        </Card>
        <SectionLabel>Common questions</SectionLabel>
        <Card style={{ gap: 14 }}>
          {FAQ.map(([q, a]) => <View key={q} style={{ gap: 4 }}><Txt v="bold">{q}</Txt><Txt v="small" style={{ fontSize: 15 }}>{a}</Txt></View>)}
        </Card>
      </View>
    </ScrollView>
  );
}

const FAQ: [string, string][] = [
  ['How do clients sign in?', 'Add them in Contacts with their email. They get a code to set a password, then sign in on the same screen you use. The app shows them their side.'],
  ['A client didn’t get the email', 'Open their profile and tap Resend. Ask them to check spam. If they already have a Dragonfly account, they just sign in.'],
  ['How do I give a client a workout or meal plan?', 'Build it in Workouts or Nutrition, then use Assign (workouts and programs) or Share (meal plans). You can also do it from the client’s profile.'],
  ['Can I work with other trainers?', 'Yes. Menu → Team → Create team, then add trainers by email. Each has their own clients and library, and you can open their accounts to check in.'],
  ['What does freezing a client do?', 'They keep everything they’ve logged but can’t use the app until you unfreeze them. Clients can also be frozen automatically after a stretch with no sessions (Settings).'],
  ['Where does the food and exercise data come from?', 'Foods: USDA FoodData Central. Packaged foods: Open Food Facts. Exercises: the public-domain Free Exercise DB plus Dragonfly’s own suspension moves.'],
];
