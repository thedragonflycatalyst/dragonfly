import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { useApp } from '@/lib/app-state';
import { F, usePalette } from '@/lib/theme';

/** The person's shared Dragonfly profile picture, or their initial. */
export function Avatar({ size = 40 }: { size?: number }) {
  const p = usePalette();
  const { avatar, username } = useApp();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: p.ink, alignItems: 'center', justifyContent: 'center' }}>
      {avatar ? <Image source={{ uri: avatar }} style={{ width: size, height: size }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
        : <Text style={{ fontFamily: F.display, fontSize: size * 0.42, color: p.bg }}>{(username ?? '?').replace(/^@/, '').charAt(0).toUpperCase()}</Text>}
    </View>
  );
}
