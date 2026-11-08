// Reviews: client testimonials (published to the website only after the client approves), survey answers and referrals.
import * as Clipboard from 'expo-clipboard';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Share, ScrollView, View } from 'react-native';
import { QrCode } from '@/components/qr';
import { confirm } from '@/lib/ask';
import { Segmented } from '@/components/bits';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { errText } from '@/lib/model';
import { sb, WEB_URL } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

type T = { id: string; body: string | null; display_name: string | null; status: string; hidden_reason: string | null; created_at: string; published_at: string | null; coach_clients: { name: string } | null; coach_testimonial_shares: { platform: string }[] };
type L = { id: string; platform: string; label: string | null; url: string };
const PLATFORMS: [string, string][] = [['google', 'Google'], ['facebook', 'Facebook'], ['yelp', 'Yelp'], ['trustpilot', 'Trustpilot'], ['thumbtack', 'Thumbtack'], ['nextdoor', 'Nextdoor'], ['other', 'Other']];
type S = { id: string; rating: number | null; comment: string | null; created_at: string; source?: string; name?: string | null; coach_clients: { name: string } | null };
type R = { id: string; name: string; email: string | null; phone: string | null; message: string | null; status: string; created_at: string; coach_referrals: { coach_clients: { name: string } | null } | null };
const STATUS: Record<string, string> = { draft: 'Waiting for the client', published: 'On your website', withdrawn: 'Withdrawn by the client', hidden: 'Hidden by you' };

export default function Reviews() {
  const p = usePalette();
  const toast = useToast();
  const [tab, setTab] = useState<'testimonials' | 'surveys' | 'referrals' | 'sites'>('testimonials');
  const [links, setLinks] = useState<L[]>([]);
  const [platform, setPlatform] = useState('google');
  const [url, setUrl] = useState('');
  const [ts, setTs] = useState<T[]>([]);
  const [ss, setSs] = useState<S[]>([]);
  const [rs, setRs] = useState<R[]>([]);
  const [hiding, setHiding] = useState<{ id: string; reason: string } | null>(null);
  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      sb.from('coach_testimonials').select('id, body, display_name, status, hidden_reason, created_at, published_at, coach_clients(name), coach_testimonial_shares(platform)').order('created_at', { ascending: false }).limit(200),
      sb.from('coach_survey_responses').select('id, rating, comment, created_at, source, name, coach_clients(name)').order('created_at', { ascending: false }).limit(200),
      sb.from('coach_referral_signups').select('id, name, email, phone, message, status, created_at, coach_referrals(coach_clients(name))').order('created_at', { ascending: false }).limit(200),
    ]);
    const l = await sb.from('coach_review_links').select('id, platform, label, url').eq('active', true).order('sort');
    setLinks((l.data as L[]) ?? []);
    setTs((a.data as unknown as T[]) ?? []); setSs((b.data as unknown as S[]) ?? []); setRs((c.data as unknown as R[]) ?? []);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const setStatus = async (id: string, status: 'hidden' | 'published', hidden_reason?: string) => {
    const { error } = await sb.from('coach_testimonials').update({ status, hidden_reason: hidden_reason ?? null }).eq('id', id);
    if (error) toast(errText(error), false); else { setHiding(null); void load(); }
  };
  const addLink = async () => {
    if (!/^https:\/\//.test(url.trim())) return toast('Paste the full https:// link to your review page', false);
    const label = PLATFORMS.find(([k]) => k === platform)?.[1] ?? 'Other';
    const { error } = await sb.from('coach_review_links').insert({ platform, url: url.trim(), label });
    if (error) toast(errText(error), false); else { setUrl(''); void load(); }
  };
  const removeLink = async (id: string) => {
    const { error } = await sb.from('coach_review_links').delete().eq('id', id);
    if (error) toast(errText(error), false); else void load();
  };
  const referral = async (id: string, status: string) => {
    const { error } = await sb.from('coach_referral_signups').update({ status }).eq('id', id);
    if (error) toast(errText(error), false); else void load();
  };
  const rated = ss.filter((x) => x.rating);
  const avg = rated.length ? (rated.reduce((t, x) => t + (x.rating ?? 0), 0) / rated.length).toFixed(1) : null;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
      <Stack.Screen options={{ title: 'Reviews' }} />
      <View style={{ width: '100%', maxWidth: MAX_W, gap: 10 }}>
        <Segmented value={tab} onChange={setTab} options={[['testimonials', 'Testimonials'], ['surveys', 'Surveys'], ['referrals', 'Referrals'], ['sites', 'Review sites']]} />
        {tab === 'sites' && (<>
          <Txt v="small">Where clients can also review you. After a client writes a testimonial (or answers a survey), they see these with their words copied, ready to paste. Everyone asked sees them, happy or not, and there’s no reward: review sites don’t allow selective or paid asking. Yelp discourages asking for reviews at all; list it only if you’re comfortable with that.</Txt>
          {links.map((l) => (
            <Card key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Txt style={{ flex: 1 }}>{l.label ?? l.platform} · {l.url}</Txt>
              <Button small kind="ghost" title="Remove" onPress={() => removeLink(l.id)} />
            </Card>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {PLATFORMS.map(([k, label]) => <Button key={k} small kind={platform === k ? 'solid' : 'ghost'} title={label} onPress={() => setPlatform(k)} />)}
          </View>
          <Field label="Link to your review page" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" placeholder="https://g.page/r/…/review" />
          <Button small title="Add" onPress={addLink} style={{ alignSelf: 'flex-start' }} />
        </>)}
        {tab === 'testimonials' && (<>
          <Txt v="small">Clients write and approve their own words; you can hide one from your website with a reason. The website labels these “Client testimonials”.</Txt>
          {ts.length === 0 && <Txt>No testimonials yet. Turn on testimonial asks in Settings → Automatic messages.</Txt>}
          {ts.map((t) => (
            <Card key={t.id} style={{ gap: 6 }}>
              <Txt v="smallBold" color={t.status === 'published' ? p.good : p.focus}>{STATUS[t.status] ?? t.status} · {t.coach_clients?.name ?? ''}</Txt>
              {t.body ? <Txt>“{t.body}”{t.display_name ? ` — ${t.display_name}` : ''}</Txt> : <Txt v="small">No words yet.</Txt>}
              {t.coach_testimonial_shares?.length ? <Txt v="small">Also posted to: {t.coach_testimonial_shares.map((x) => PLATFORMS.find(([k]) => k === x.platform)?.[1] ?? x.platform).join(', ')}</Txt> : null}
              {t.status === 'hidden' && t.hidden_reason ? <Txt v="small">Hidden because: {t.hidden_reason}</Txt> : null}
              {t.status === 'published' && (hiding?.id === t.id ? (
                <View style={{ gap: 6 }}>
                  <Field label="Why hide it?" value={hiding.reason} onChangeText={(reason) => setHiding({ id: t.id, reason })} />
                  <Button small title="Hide from website" disabled={!hiding.reason.trim()} onPress={() => setStatus(t.id, 'hidden', hiding.reason.trim())} />
                </View>
              ) : <Button small kind="ghost" title="Hide…" onPress={() => setHiding({ id: t.id, reason: '' })} style={{ alignSelf: 'flex-start' }} />)}
              {t.status === 'hidden' && <Button small kind="ghost" title="Show again" onPress={() => setStatus(t.id, 'published')} style={{ alignSelf: 'flex-start' }} />}
            </Card>
          ))}
        </>)}
        {tab === 'surveys' && (<>
          <SurveyLink />
          <Txt v="small">{avg ? `Average ${avg} out of 5 from ${rated.length} answer${rated.length === 1 ? '' : 's'}.` : 'No answers yet.'}</Txt>
          {ss.map((s) => (
            <Card key={s.id} style={{ gap: 4 }}>
              <Txt v="bold">{s.rating ? `${s.rating}/5` : 'No rating'} · {s.coach_clients?.name ?? (s.name ? `${s.name} (not signed in)` : 'Not signed in')}{s.source === 'open' ? ' · survey link' : ''} · {new Date(s.created_at).toLocaleDateString()}</Txt>
              {s.comment ? <Txt>“{s.comment}”</Txt> : null}
            </Card>
          ))}
        </>)}
        {tab === 'referrals' && (<>
          {rs.length === 0 && <Txt>No referrals yet. Clients can share their link from their app (Me → Refer a friend).</Txt>}
          {rs.map((r) => (
            <Card key={r.id} style={{ gap: 4 }}>
              <Txt v="bold">{r.name} · referred by {r.coach_referrals?.coach_clients?.name ?? 'a client'}</Txt>
              <Txt v="small">{[r.email, r.phone, new Date(r.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}</Txt>
              {r.message ? <Txt>“{r.message}”</Txt> : null}
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {['new', 'contacted', 'joined', 'declined'].map((st) => <Button key={st} small kind={r.status === st ? 'solid' : 'ghost'} title={st[0].toUpperCase() + st.slice(1)} onPress={() => referral(r.id, st)} />)}
              </View>
            </Card>
          ))}
        </>)}
      </View>
    </ScrollView>
  );
}

/** The trainer's open survey: a link and QR code to hand out whenever they like (e.g. at the end of a class) */
function SurveyLink() {
  const toast = useToast();
  const p = usePalette();
  const [code, setCode] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [show, setShow] = useState(false);
  useEffect(() => {
    void sb.rpc('coach_survey_link').then(async ({ data, error }) => {
      if (error) return toast(errText(error), false);
      setCode(data as string);
      const { data: l } = await sb.from('coach_survey_links').select('question').maybeSingle();
      setQuestion((l as { question?: string } | null)?.question ?? '');
    });
  }, [toast]);
  if (!code) return <ActivityIndicator color={p.ink} />;
  const link = `${WEB_URL}s/q/${code}`;
  const saveQuestion = async () => {
    const { error } = await sb.from('coach_survey_links').update({ question: question.trim() }).eq('code', code);
    if (error) toast(errText(error), false); else toast('Saved');
  };
  const renew = async () => {
    if (!(await confirm('Make a new survey link?', 'The old link and QR code stop working.', 'New link', true))) return;
    const { data, error } = await sb.rpc('coach_survey_link', { p_new: true });
    if (error) toast(errText(error), false); else setCode(data as string);
  };
  return (
    <Card style={{ gap: 8 }}>
      <Txt v="bold">Survey link and QR code</Txt>
      <Txt v="small">Share it any time, or show the QR code at the end of a session or class. Clients who are signed in answer as themselves; anyone else answers anonymously.</Txt>
      {show && <View style={{ alignItems: 'center' }}><QrCode value={link} size={240} label="Survey QR code" /></View>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button small icon="qr_code" title={show ? 'Hide QR code' : 'Show QR code'} onPress={() => setShow(!show)} />
        <Button small kind="ghost" icon="content_copy" title="Copy link" onPress={async () => { await Clipboard.setStringAsync(link); toast('Copied'); }} />
        <Button small kind="ghost" icon="share" title="Share" onPress={() => Share.share({ message: `Quick question: how was your training? ${link}` }).catch(() => {})} />
        <Button small kind="quiet" title="New link" onPress={renew} />
      </View>
      <Field label="Question" value={question} onChangeText={setQuestion} maxLength={200} />
      <Button small kind="ghost" title="Save question" onPress={saveQuestion} style={{ alignSelf: 'flex-start' }} />
    </Card>
  );
}
