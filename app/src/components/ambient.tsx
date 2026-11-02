import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { usePalette } from '@/lib/theme';

/** One dragonfly drawn in fine iridescent lines (the Uploader's ambient artwork) */
function Wings({ id, from, to }: { id: string; from: string; to: string }) {
  const veins = [-1, 1].flatMap((d) => [0, 1, 2, 3].map((i) => `M0 0 Q${d * (150 + i * 30)} ${-90 + i * 30} ${d * (300 + i * 22)} ${-115 + i * 60}`));
  return (
    <Svg width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <G fill="none" stroke={`url(#${id})`} strokeWidth={1.6} strokeLinecap="round" transform="translate(720 300) rotate(-22) scale(0.72)">
        <Path d="M0 0 C-155 -125 -370 -190 -460 -110 C-410 -20 -230 25 0 0 Z" />
        <Path d="M0 0 C-190 50 -380 85 -390 175 C-240 210 -90 100 0 0 Z" />
        <Path d="M0 0 C155 -125 370 -190 460 -110 C410 -20 230 25 0 0 Z" />
        <Path d="M0 0 C190 50 380 85 390 175 C240 210 90 100 0 0 Z" />
        {veins.map((d) => <Path key={d} d={d} />)}
        <Path d="M0 -34 L0 170 M0 -34 Q-20 -66 0 -75 Q20 -66 0 -34" strokeWidth={5} />
      </G>
      <G fill="none" stroke={`url(#${id})`} strokeWidth={1.2} strokeLinecap="round" opacity={0.6}>
        {Array.from({ length: 7 }, (_, i) => <Path key={i} d={`M-50 ${820 + i * 26} C 250 ${700 + i * 20} 520 ${930 - i * 12} 1050 ${760 + i * 18}`} />)}
      </G>
    </Svg>
  );
}

/**
 * The slowly drifting, colour-shifting artwork behind the main screens. Purely decorative: no text or controls,
 * hidden from screen readers, and still when the phone asks for reduced motion.
 */
export function Ambient() {
  const p = usePalette();
  const [still, setStill] = useState(false);
  const drift = useRef(new Animated.Value(0)).current;
  const hue = useRef(new Animated.Value(0)).current;
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {}); }, []);
  useEffect(() => {
    if (still) return;
    const loop = (v: Animated.Value, ms: number) => Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const a = loop(drift, 60_000), b = loop(hue, 40_000);
    a.start(); b.start();
    return () => { a.stop(); b.stop(); };
  }, [still, drift, hue]);
  const op = p.scheme === 'dark' ? 0.5 : 0.28;
  const move = { transform: [
    { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] }) },
    { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [10, -10] }) },
    { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] }) },
  ] };
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, move, { opacity: op }]}>
        <Wings id="dfA" from={p.art[0]} to={p.art[1]} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, move, { opacity: hue.interpolate({ inputRange: [0, 1], outputRange: [0, op] }) }]}>
        <Wings id="dfB" from={p.art[2]} to={p.art[0]} />
      </Animated.View>
    </View>
  );
}
