import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { BACKGROUND } from '@/lib/art';
import { usePalette } from '@/lib/theme';

/**
 * The engraved dragonfly behind the main screens, drifting very slowly. Purely decorative: no text or controls,
 * hidden from screen readers, and still when the phone asks for reduced motion. A fade keeps text readable.
 */
export function Ambient() {
  const p = usePalette();
  const [still, setStill] = useState(false);
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {}); }, []);
  useEffect(() => {
    if (still) return;
    const a = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 60_000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 60_000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [still, drift]);
  const move = { transform: [
    { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.1] }) },
    { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] }) },
  ] };
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, move, { opacity: 0.55 }]}>
        <Image source={BACKGROUND} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top right" accessible={false} accessibilityLabel="" />
      </Animated.View>
      <LinearGradient colors={['transparent', p.bg]} locations={[0.35, 0.95]} style={StyleSheet.absoluteFill} />
    </View>
  );
}
