import { useState } from 'react';
import { View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Toggle } from '@/components/pickers';
import { Button, Card, Chip, Txt, useToast } from '@/components/ui';
import { Page, useTrainerSave } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { errText, type TeamMember } from '@/lib/model';
import { PERM_LABELS, type ClientPerms } from '@/lib/prefs';
import { sb } from '@/lib/supabase';

/** Permissions: what clients can do themselves, and (team owners) what each trainer can see */
export default function Permissions() {
  const toast = useToast();
  const app = useApp();
  const save = useTrainerSave();
  const [perms, setPerms] = useState<ClientPerms>(app.perms);
  const [hours, setHours] = useState(app.trainer?.cancel_hours ?? 12);
  const [busy, setBusy] = useState(false);
  const trainers = app.teamMembers.filter((m) => m.role === 'trainer' && m.status !== 'removed');
  const setMember = async (m: TeamMember, key: 'financials' | 'packages' | 'events', v: boolean) => {
    const { error } = await sb.from('coach_team_members').update({ perms: { financials: false, packages: true, events: true, ...(m.perms ?? {}), [key]: v } }).eq('id', m.id);
    if (error) toast(errText(error), false); else app.reloadTeam();
  };
  return (
    <Page title="Permissions">
      <SectionLabel>Clients can</SectionLabel>
      <Card>
        {PERM_LABELS.map(([k, label, sub]) => <Toggle key={k} label={label} sub={sub} value={perms[k]} onChange={(v) => setPerms({ ...perms, [k]: v })} />)}
      </Card>
      {perms.cancel_sessions && <Card>
        <Txt v="bold" style={{ marginBottom: 8 }}>Cancellation notice</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[0, 2, 6, 12, 24, 48].map((h) => <Chip key={h} label={h ? `${h} hours` : 'Any time'} selected={hours === h} onPress={() => setHours(h)} />)}</View>
        <Txt v="small" style={{ marginTop: 8 }}>Closer than this, clients have to message you to cancel.</Txt>
      </Card>}
      <Button title="Save" icon="check" busy={busy} style={{ alignSelf: 'center', minWidth: 200 }} onPress={async () => { setBusy(true); await save({ client_perms: perms, cancel_hours: hours }, 'Permissions saved'); setBusy(false); }} />
      {app.isOwner && trainers.length > 0 && <>
        <SectionLabel>Your trainers can see</SectionLabel>
        {trainers.map((m) => (
          <Card key={m.id}>
            <Txt v="h3" style={{ marginBottom: 4 }}>{m.display_name}</Txt>
            <Toggle label="Financials" sub="Their own payments and subscriptions" value={!!m.perms?.financials} onChange={(v) => setMember(m, 'financials', v)} />
            <Toggle label="Packages" sub="Create and sell their own packages" value={m.perms?.packages ?? true} onChange={(v) => setMember(m, 'packages', v)} />
            <Toggle label="Events" sub="Create and run their own events" value={m.perms?.events ?? true} onChange={(v) => setMember(m, 'events', v)} />
          </Card>
        ))}
      </>}
    </Page>
  );
}
