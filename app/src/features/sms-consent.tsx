// The texting opt-in, word for word what carriers require: unticked by default, who sends, what, how often, rates,
// HELP/STOP, not a condition of service, and links to the terms and privacy policy. Used in sign-up and Messages.
import { Linking, Pressable, View } from 'react-native';
import { Icon, Txt } from '@/components/ui';
import { usePalette } from '@/lib/theme';

export const SMS_TERMS_URL = 'https://thedragonflycatalyst.org/sms-terms';
export const PRIVACY_URL = 'https://thedragonflycatalyst.org/sms-terms#your-privacy';

export function smsConsentText(trainer: string) {
  return `Text me session reminders, booking updates and open-spot offers from ${trainer} (The Dragonfly Catalyst) at the number above. ` +
    'Message frequency varies. Message and data rates may apply. Reply HELP for help or STOP to cancel at any time. Agreeing is not required to train.';
}

export function SmsConsent({ checked, onChange, trainer }: { checked: boolean; onChange: (v: boolean) => void; trainer: string }) {
  const p = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: checked ? p.focus : p.muted, backgroundColor: checked ? p.focus : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
          {checked && <Icon name="check" size={18} color={p.onAccent} />}
        </View>
        <Txt style={{ flex: 1, fontSize: 15 }}>{smsConsentText(trainer)}</Txt>
      </Pressable>
      <Txt v="small" style={{ marginLeft: 34 }}>
        <Txt v="small" color={p.focus} onPress={() => Linking.openURL(SMS_TERMS_URL)}>Text message terms</Txt>{' · '}
        <Txt v="small" color={p.focus} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy policy</Txt>
      </Txt>
    </View>
  );
}
