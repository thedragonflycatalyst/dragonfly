import { ActivityIndicator, View } from 'react-native';
import { Button, Icon, Txt } from '@/components/ui';
import { useBiometricSecurity } from '@/features/biometric-security';
import { useApp } from '@/lib/app-state';
import { usePalette } from '@/lib/theme';

/** Opaque top-level gate: private Coach screens are never briefly exposed
 * while we check whether this account enabled biometric locking.
 */
export function BiometricGate() {
  const p = usePalette();
  const app = useApp();
  const security = useBiometricSecurity();
  if (!app.user || (!security.checking && !security.locked)) return null;
  return (
    <View style={{
      position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
      zIndex: 999, backgroundColor: p.bg,
      alignItems: 'center', justifyContent: 'center', padding: 28,
    }}>
      {security.checking ? <ActivityIndicator color={p.ink} /> : (
        <View style={{ width: '100%', maxWidth: 340, gap: 16, alignItems: 'center' }}>
          <Icon name="fingerprint" size={52} color={p.focus} />
          <Txt v="h1" center>Unlock Dragonfly</Txt>
          <Txt center>Use your phone’s enrolled fingerprint or Face ID to continue.</Txt>
          <Button title="Unlock with biometrics" onPress={() => { void security.unlock(); }} />
          <Button kind="quiet" title="Sign out and use password"
            onPress={() => { void app.signOut(); }} />
        </View>
      )}
    </View>
  );
}
