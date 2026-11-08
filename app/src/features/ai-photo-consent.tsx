// Before a photo goes to AI (machine scan, meal estimate), the person reads what happens to it and agrees once.
// The answer is stored with the notice version and time (coach_user_consents); a new version asks again.
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Txt, useToast } from '@/components/ui';
import { sb } from '@/lib/supabase';

/** Bump when the notice text changes in a way people should re-read */
export const AI_PHOTO_NOTICE_VERSION = 1;

export const AI_PHOTO_NOTICE = [
  'When you scan a machine or ask for a meal estimate, the photo is sent to an AI service to read it.',
  'Machine scans: the photo is used only to identify the equipment and is not saved.',
  'Meal photos: the photo is used to estimate the foods. If you save the meal, the photo is stored in your diary, where only you and your trainer can see it.',
  'Don’t include people’s faces, documents or anything private in the photo.',
  'You can change your mind in Settings at any time; you can always search or add things yourself instead.',
];

let cached: boolean | null = null;

async function currentAnswer(): Promise<boolean> {
  if (cached !== null) return cached;
  const { data } = await sb.rpc('coach_consent_current', { p_kind: 'ai_photos' });
  const row = (data as { version: number; granted: boolean }[] | null)?.[0];
  cached = !!row && row.granted && row.version >= AI_PHOTO_NOTICE_VERSION;
  return cached;
}

export async function recordAiPhotoConsent(granted: boolean): Promise<void> {
  const { error } = await sb.from('coach_user_consents').insert({ kind: 'ai_photos', version: AI_PHOTO_NOTICE_VERSION, granted });
  if (error) throw error;
  cached = granted;
}

/** `ask()` resolves true when the person has agreed (now or before); render `sheet` once in the screen */
export function useAiPhotoConsent(): { ask: () => Promise<boolean>; sheet: ReactNode } {
  const toast = useToast();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const ask = useCallback(async () => {
    try { if (await currentAnswer()) return true; } catch { /* fall through to asking */ }
    return new Promise<boolean>((resolve) => { resolver.current = resolve; setVisible(true); });
  }, []);
  const finish = (ok: boolean) => { setVisible(false); resolver.current?.(ok); resolver.current = null; };
  const agree = async () => {
    setBusy(true);
    try { await recordAiPhotoConsent(true); finish(true); } catch { toast('Couldn’t save your answer. Check your connection and try again.', false); } finally { setBusy(false); }
  };
  const sheet = (
    <Sheet visible={visible} onClose={() => finish(false)} title="Photos and AI">
      <View style={{ gap: 10 }}>
        {AI_PHOTO_NOTICE.map((line) => <Txt key={line}>{line}</Txt>)}
        <Button title="I agree" onPress={agree} busy={busy} />
        <Button title="Not now" kind="ghost" onPress={() => finish(false)} />
      </View>
    </Sheet>
  );
  return { ask, sheet };
}
