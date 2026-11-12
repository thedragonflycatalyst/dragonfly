// "Report a problem" on any exercise (issue #58). The tester picks what's wrong, adds details and (optionally) the
// correction they expect and a screenshot. The exercise, its variant and revision, the screen and the app version go
// along automatically. The draft is kept on the device until it's sent, so a dropped connection loses nothing, and
// sending the same draft twice can't make two reports (the server matches its draft id).
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, Field, Icon, Txt, useToast } from '@/components/ui';
import { draftKey, emptyDraft, hasContent, refLabel, REPORT_CATEGORIES, reportPayload, type Draft, type ReportContext } from '@/lib/exercise-report';
import { bytesOf } from '@/lib/files';
import { errText } from '@/lib/model';
import { recall, sb, store } from '@/lib/supabase';
import { R, usePalette } from '@/lib/theme';

type Ctx = Omit<ReportContext, 'appVersion'>;

export function ReportProblem({ ctx }: { ctx: Ctx }) {
  const p = usePalette();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Draft>(() => recall<Draft | null>(draftKey(ctx.ref), null) ?? emptyDraft(Crypto.randomUUID()));
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Switching exercises picks up that exercise's own draft
  useEffect(() => {
    const saved = recall<Draft | null>(draftKey(ctx.ref), null);
    setD(saved ?? emptyDraft(Crypto.randomUUID())); setOpen(!!saved && hasContent(saved)); setSent(null); setFailed(false);
  }, [ctx.ref]);
  const edit = (patch: Partial<Draft>) => setD((x) => { const n = { ...x, ...patch }; store(draftKey(ctx.ref), hasContent(n) ? n : null); return n; });

  const pickShot = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      const out = await ImageManipulator.manipulateAsync(a.uri, Math.max(a.width, a.height) > 1400 ? [{ resize: a.width >= a.height ? { width: 1400 } : { height: 1400 } }] : [],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
      edit({ shot: out.uri });
    } catch (e) { toast(errText(e), false); }
  };

  const send = async () => {
    if (busy) return;
    let payload: ReturnType<typeof reportPayload>;
    try { payload = reportPayload(d, { ...ctx, appVersion: Constants.expoConfig?.version ?? '' }, null); } catch (e) { return toast(errText(e), false); }
    setBusy(true); setFailed(false);
    try {
      let shotPath: string | null = null;
      if (d.shot) {
        const { data: u } = await sb.auth.getUser();
        if (!u.user) throw new Error('Sign in again to send');
        shotPath = `${u.user.id}/${d.client_key}.jpg`;
        // upsert: a retry after a dropped connection replaces the half-sent file instead of failing
        const { error } = await sb.storage.from('coach-reports').upload(shotPath, await bytesOf(d.shot), { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
      }
      const { data, error } = await sb.rpc('coach_report_exercise', { p: { ...payload, screenshot_path: shotPath ?? '' } });
      if (error) throw error;
      const ref = refLabel((data as { ref_no: number }).ref_no);
      store(draftKey(ctx.ref), null);
      setD(emptyDraft(Crypto.randomUUID())); setOpen(false); setSent(ref);
      toast(`Thanks! Report ${ref} sent for review`);
    } catch (e) {
      setFailed(true);
      toast(/report_limit/.test(errText(e)) ? 'That’s the most reports for today. Your draft is saved.' : 'Couldn’t send. Your report is saved here; try again.', false);
    } finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 8 }}>
      <Button small kind="ghost" icon="flag" title="Report a problem" onPress={() => setOpen((o) => !o)} style={{ alignSelf: 'flex-start' }} />
      {sent && !open && <Txt v="small" color={p.good}>Sent. Your reference is {sent}. See its status in Support → My problem reports.</Txt>}
      {open && (
        <View style={{ gap: 8, backgroundColor: p.soft, borderRadius: R.md, padding: 12 }}>
          <Txt v="small">What’s wrong with “{ctx.name}”{ctx.variant ? ` (${ctx.variant})` : ''}?</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {REPORT_CATEGORIES.map(([k, l]) => <Chip key={k} label={l} selected={d.kind === k} onPress={() => edit({ kind: k })} />)}
          </View>
          <Field label="Details" hint={d.kind === 'other' ? '(needed)' : '(optional)'} value={d.note} onChangeText={(note) => edit({ note })} multiline
            placeholder={d.kind === 'duplicate' ? 'Which exercise is it the same as?' : 'What did you see?'} />
          <Field label="What it should be" hint="(optional)" value={d.expected} onChangeText={(expected) => edit({ expected })} multiline />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Button small kind="quiet" icon={d.shot ? 'check' : 'add_photo_alternate'} title={d.shot ? 'Screenshot added' : 'Add a screenshot'} onPress={pickShot} />
            {d.shot && <Button small kind="quiet" title="Remove" onPress={() => edit({ shot: null })} />}
          </View>
          {failed && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="cloud_off" size={18} color={p.muted} />
              <Txt v="small" style={{ flex: 1 }}>Not sent yet. It’s saved on this device.</Txt>
            </View>
          )}
          <Button small title={failed ? 'Try again' : 'Send report'} icon="send" busy={busy} disabled={busy} onPress={send} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}
    </View>
  );
}
