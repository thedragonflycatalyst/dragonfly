import Constants from 'expo-constants';
import { Image } from 'expo-image';
import type { AndroidSymbol } from 'expo-symbols';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { coverUrl } from '@/components/cover';
import { Sheet } from '@/components/sheet';
import { Button, Card, Field, Icon, Txt, useToast } from '@/components/ui';
import { Page } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { canSee } from '@/lib/features';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

type Group = { key: string; title: string; icon: AndroidSymbol; items: [string, string, string][] };
const GROUPS: Group[] = [
  { key: 'general', title: 'General', icon: 'person', items: [['My details', 'Name, address, time zone, birthday', '/settings/details'], ['Account', 'Picture, email, password, devices', '/account'], ['Credentials', 'Your certifications, renewals and what to earn next', '/credentials']] },
  { key: 'custom', title: 'Customisation', icon: 'star', items: [['Branding', 'Your logo and colour in your clients’ app', '/settings/branding']] },
  { key: 'features', title: 'Feature settings', icon: 'notifications', items: [['Notifications', 'What you’re told about, and how', '/settings/notifications'], ['Unit of measurement', 'Weights, bodyweight, lengths, distance', '/settings/units'], ['Rest timer · Lapis', 'Voice, bell, countdown and music during workouts', '/settings/rest-timer'], ['Permissions', 'What clients (and your trainers) can do', '/settings/permissions'], ['Hidden exercises', 'Library exercises you’ve hidden from your lists', '/settings/hidden-exercises'], ['Photos and AI', 'Machine scans and meal estimates', '/settings/privacy'], ['Automatic messages', 'Reminders, surveys, testimonials, referrals', '/settings/messages'], ['To send', 'Texts waiting for you and replies', '/outbox'], ['Reviews', 'Testimonials, survey answers and referrals', '/reviews']] },
  { key: 'money', title: 'Payments & packages', icon: 'payments', items: [['Packages & vouchers', 'Session packs, memberships, discount codes', '/packages'], ['Payments', 'Income, payments, refunds, subscriptions', '/financials'], ['Session payments', 'Single-session price, card payments (Stripe), or billed by your club', '/settings/payments'], ['Refund policy', 'What can be refunded, prorating, fees and limits', '/settings/refunds']] },
  { key: 'coaching', title: 'Coaching', icon: 'fitness_center', items: [['Check-ins', 'Who’s due a personal check-in, with AI talking points', '/checkins'], ['Coaching settings', 'Profile, health questionnaire, freezing, check-in rhythm', '/settings/coaching'], ['Team', 'Your trainers, invites, viewing their accounts', '/team']] },
];

/** Settings home: profile header, grouped sections that open, report an issue, about, log out */
export default function Settings() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  const [issue, setIssue] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (app.trainer?.logo) coverUrl(app.trainer.logo.replace(/^media:/, '')).then(setLogo); else setLogo(null); }, [app.trainer?.logo]);
  const t = app.trainer;
  const member = app.teamMembers.find((x) => x.trainer_id === app.user?.id && x.role === 'trainer');
  const send = async () => {
    if (!issue.trim()) return toast('Describe the issue first', false);
    setBusy(true);
    const { error } = await sb.from('dragonfly_issue_reports').insert({ body: issue.trim(), app: 'coach', context: { platform: Platform.OS, version: Constants.expoConfig?.version ?? '', mode: app.mode, username: app.username } });
    setBusy(false);
    if (error) return toast(errText(error), false);
    setIssue(''); setReport(false); toast('Thanks! We got your report.');
  };
  return (
    <Page title="Settings">
      <View style={{ alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {logo ? <Image source={{ uri: logo }} style={{ width: 120, height: 120, borderRadius: 60 }} contentFit="cover" accessibilityLabel="Your logo" /> : <Avatar size={96} />}
        <Txt v="h2" center>{t?.business_name || t?.display_name || app.username}</Txt>
        <Txt v="small" center>{app.user?.email}</Txt>
      </View>
      <Card style={{ padding: 0 }}>
        {GROUPS.map((g) => (
          <View key={g.key}>
            <Pressable onPress={() => setOpen(open === g.key ? null : g.key)} accessibilityRole="button" accessibilityState={{ expanded: open === g.key }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: p.line }}>
              <Icon name={g.icon} color={p.ink} /><Txt v="bold" style={{ flex: 1 }}>{g.title}</Txt><Icon name={open === g.key ? 'expand_less' : 'expand_more'} color={p.muted} />
            </Pressable>
            {open === g.key && g.items.filter(([, , href]) => href === '/packages' ? canSee('packages', member, app.isOwner) : href === '/financials' ? canSee('financials', member, app.isOwner) : true).map(([title, sub, href]) => (
              <Pressable key={href} onPress={() => router.push(href as never)} accessibilityRole="link"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingLeft: 52, paddingRight: 16, borderBottomWidth: 1, borderBottomColor: p.line, backgroundColor: p.raise }}>
                <View style={{ flex: 1 }}><Txt v="bold">{title}</Txt><Txt v="small">{sub}</Txt></View><Icon name="chevron_right" color={p.muted} />
              </Pressable>
            ))}
          </View>
        ))}
        <Pressable onPress={() => setReport(true)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: p.line }}>
          <Icon name="mail" /><Txt v="bold" style={{ flex: 1 }}>Report an issue</Txt><Icon name="chevron_right" color={p.muted} />
        </Pressable>
        <Pressable onPress={() => router.push('/settings/about')} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
          <Icon name="info" /><Txt v="bold" style={{ flex: 1 }}>About</Txt><Icon name="chevron_right" color={p.muted} />
        </Pressable>
      </Card>
      <Button kind="ghost" title="Log out" onPress={async () => { await app.signOut(); router.replace('/'); }} style={{ alignSelf: 'center', minWidth: 200 }} />
      <Txt v="small" center>Dragonfly v{Constants.expoConfig?.version ?? '1.0.0'}</Txt>
      <Sheet visible={report} onClose={() => setReport(false)} title="Sorry to hear you’re having trouble!">
        <Field label="Please describe the issue you’re having" value={issue} onChangeText={setIssue} multiline placeholder="What happened, and what did you expect?" autoFocus />
        <Txt v="small" style={{ marginBottom: 12 }}>We include your device type and app version so we can look into it.</Txt>
        <Button title="Send" icon="send" busy={busy} disabled={!issue.trim()} onPress={send} />
      </Sheet>
    </Page>
  );
}
