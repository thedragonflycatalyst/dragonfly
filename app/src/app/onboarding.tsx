import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Pair } from '@/components/bits';
import { DateField } from '@/components/date-field';
import { Screen } from '@/components/shell';
import { Button, Card, Chip, Field, Txt, useToast } from '@/components/ui';
import { formComplete, QuestionInput } from '@/features/forms';
import { InterestPicker } from '@/features/goals';
import { useApp } from '@/lib/app-state';
import { dayKey } from '@/lib/dates';
import { errText, type FormRequest, type Sex } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { cmToFtIn, ftInToCm, num, showLength, toCm, toKg, weightUnit } from '@/lib/units';
import { usePalette } from '@/lib/theme';

type Step = 'welcome' | 'about' | 'goals' | 'health';

/** A client's first sign-in: confirm their details, set goals, answer the health questionnaire. Then the quickstart guide. */
export default function Onboarding() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const c = app.membership;
  const units = app.units;
  const [step, setStep] = useState<Step>('welcome');
  const [health, setHealth] = useState<FormRequest | null | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const ftIn = c?.height_cm ? cmToFtIn(Number(c.height_cm)) : null;
  const [f, setF] = useState({
    phone: c?.phone ?? '', sex: (c?.sex ?? null) as Sex | null, dob: c?.date_of_birth ?? null as string | null, weight: '',
    ft: ftIn ? String(ftIn.ft) : '', inch: ftIn ? String(ftIn.in) : '', cm: c?.height_cm ? String(showLength(Number(c.height_cm), 'metric')) : '',
    goals: c?.goals ?? '', interests: c?.interests ?? [] as string[],
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!c) return;
    sb.from('coach_form_requests').select('*').eq('client_id', c.id).eq('kind', 'health').eq('status', 'pending').maybeSingle()
      .then(({ data }) => setHealth((data as FormRequest) ?? null));
  }, [c]);

  if (!app.user) return <Redirect href="/sign-in" />;
  if (!c || c.status !== 'active') return <Redirect href="/" />;
  const steps: Step[] = ['welcome', 'about', 'goals', ...(health ? ['health' as Step] : [])];
  const n = steps.indexOf(step);
  const coach = app.myTrainer?.display_name ?? 'your trainer';

  const height = (): number | null | 'bad' => {
    if (units === 'imperial') {
      if (!f.ft && !f.inch) return null;
      const ft = num(f.ft || '0'), inch = num(f.inch || '0');
      if (ft === null || inch === null || inch >= 12) return 'bad';
      const cm = Math.round(ftInToCm(ft, inch) * 10) / 10;
      return cm < 50 || cm > 260 ? 'bad' : cm;
    }
    if (!f.cm) return null;
    const cm = toCm(f.cm, 'metric');
    return cm === null || cm < 50 || cm > 260 ? 'bad' : cm;
  };

  const finish = async (fromStep: Step) => {
    const h = height();
    if (h === 'bad') { setStep('about'); return toast('Check your height', false); }
    const w = f.weight ? toKg(f.weight, units) : null;
    if (f.weight && (w === null || w < 20 || w > 400)) { setStep('about'); return toast('Check your weight', false); }
    if (fromStep === 'health' && health && !formComplete(health.questions, answers)) return toast('Please answer every required question', false);
    setBusy(true);
    try {
      const { error } = await sb.rpc('coach_update_my_profile', {
        p_client: c.id, p_phone: f.phone, p_sex: f.sex, p_date_of_birth: f.dob, p_height_cm: h,
        p_goals: f.goals, p_interests: f.interests, p_finish_onboarding: true,
      });
      if (error) throw error;
      if (w) await sb.from('coach_measurements').insert({ client_id: c.id, trainer_id: c.trainer_id, weight_kg: w, note: 'Starting weight' });
      if (health) { const r = await sb.rpc('coach_submit_form', { p_request: health.id, p_answers: answers }); if (r.error) throw r.error; }
      await app.reloadMe();
      const flagged = health && health.questions.some((q) => q.type === 'yesno' && answers[q.id] === 'yes');
      toast(flagged ? 'All set. Please check with your doctor before becoming much more active.' : 'All set!');
      router.replace('/guide');
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  const next = () => (n < steps.length - 1 ? setStep(steps[n + 1]) : finish(step));

  return (
    <Screen kicker={`Step ${n + 1} of ${steps.length}`} title={step === 'welcome' ? 'Welcome to Dragonfly' : step === 'about' ? 'About you' : step === 'goals' ? 'Your goals' : 'Health questionnaire'}>
      <View style={{ maxWidth: 640, gap: 14 }}>
        {step === 'welcome' && (
          <Card style={{ gap: 10 }}>
            <Txt style={{ fontSize: 18, lineHeight: 27 }}>You’re training with <Txt v="bold">{coach}</Txt>. Let’s get you set up. It takes about two minutes.</Txt>
            <Txt v="small" style={{ fontSize: 15 }}>We’ll confirm a few details, ask about your goals{health ? ', and go through a short health questionnaire' : ''}. You can change any of it later.</Txt>
          </Card>
        )}
        {step === 'about' && (
          <Card>
            <Txt v="small" style={{ marginBottom: 14, fontSize: 15 }}>Your trainer may have filled some of this in. Fix anything that’s off. Everything here is optional.</Txt>
            <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>Sex</Txt>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {([['male', 'Male'], ['female', 'Female'], ['other', 'Other']] as [Sex, string][]).map(([k, l]) => (
                <Chip key={k} label={l} selected={f.sex === k} onPress={() => setF((x) => ({ ...x, sex: x.sex === k ? null : k }))} />
              ))}
            </View>
            <DateField label="Date of birth" optional value={f.dob} onChange={(v) => setF((x) => ({ ...x, dob: v }))} max={dayKey(new Date())} min="1900-01-01" />
            <Pair>
              <Field label={`Current weight (${weightUnit(units)})`} value={f.weight} onChangeText={(v) => setF((x) => ({ ...x, weight: v }))} keyboardType="decimal-pad" />
              {units === 'imperial' ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}><Field label="Height (ft)" value={f.ft} onChangeText={(v) => setF((x) => ({ ...x, ft: v }))} keyboardType="number-pad" /></View>
                  <View style={{ flex: 1 }}><Field label="(in)" value={f.inch} onChangeText={(v) => setF((x) => ({ ...x, inch: v }))} keyboardType="number-pad" /></View>
                </View>
              ) : <Field label="Height (cm)" value={f.cm} onChangeText={(v) => setF((x) => ({ ...x, cm: v }))} keyboardType="decimal-pad" />}
            </Pair>
            <Field label="Phone" value={f.phone} onChangeText={(v) => setF((x) => ({ ...x, phone: v }))} keyboardType="phone-pad" autoComplete="tel" />
          </Card>
        )}
        {step === 'goals' && (
          <Card>
            <Field label="What do you want to achieve?" value={f.goals} onChangeText={(v) => setF((x) => ({ ...x, goals: v }))} multiline placeholder="Lose 15 lb, run a 5K in March, feel stronger…" />
            <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>What are you interested in?</Txt>
            <InterestPicker value={f.interests} onChange={(v) => setF((x) => ({ ...x, interests: v }))} />
          </Card>
        )}
        {step === 'health' && health && (
          <>
            <Card><Txt v="small" style={{ fontSize: 15 }}>These questions help your trainer keep you safe. If you answer yes to any, check with your doctor before becoming much more physically active. This isn’t medical advice.</Txt></Card>
            <Card>{health.questions.map((q) => <QuestionInput key={q.id} q={q} value={answers[q.id] ?? ''} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />)}</Card>
          </>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          {n > 0 ? <Button kind="ghost" title="Back" onPress={() => setStep(steps[n - 1])} /> : <View />}
          <Button title={n === steps.length - 1 ? 'Finish' : 'Next'} busy={busy} disabled={health === undefined} onPress={next} />
        </View>
      </View>
    </Screen>
  );
}
