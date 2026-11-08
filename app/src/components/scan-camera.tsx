// The Dragonfly live scanner, shared by every "point the camera at it" task (appointments in the calendar, gym machines in the
// exercise picker). The phone reads the text in view itself (free, offline); when the same fingerprint shows up in two frames
// in a row the camera is steady, so it takes the photo and hands it over. The shutter and "pick a photo" always work too.
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, Txt } from '@/components/ui';
import { readText } from '@/features/ocr';
import { F, R, usePalette } from '@/lib/theme';

const GAP_MS = 700;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ScanCameraProps = {
  title: string;
  /** Pill text while looking, once steady, and while the photo is read */
  words: { looking: string; steady: string; reading: string };
  /** Why the camera is needed (shown before permission is given) */
  why: string;
  /** Fingerprint of what the phone reads in a frame, or null when nothing useful is in view yet */
  keyOf: (text: string) => string | null;
  /** Reads a captured photo. Resolve true when it found something (scanning stops), false to keep looking, or a short
   *  message to show on the scanner (e.g. "nothing found") and keep looking. */
  onShot: (uri: string, width: number, height: number) => Promise<boolean | string>;
  /** True while the result is showing over the camera */
  paused?: boolean;
  /** Skip the steady-text capture and use the shutter only */
  manualOnly?: boolean;
  onClose: () => void;
  children?: ReactNode;
};

export function ScanCamera({ title, words, why, keyOf, onShot, paused, manualOnly, onClose, children }: ScanCameraProps) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [status, setStatus] = useState<'looking' | 'steady' | 'reading'>('looking');
  const [note, setNote] = useState<string | null>(null);
  const busy = useRef(false);
  const lastKey = useRef<string | null>(null);
  const keyRef = useRef(keyOf); keyRef.current = keyOf;
  const shotRef = useRef(onShot); shotRef.current = onShot;

  useEffect(() => { const s = AppState.addEventListener('change', (st) => setActive(st === 'active')); return () => s.remove(); }, []);
  useEffect(() => { if (perm && !perm.granted && perm.canAskAgain) requestPerm(); }, [perm, requestPerm]);
  useEffect(() => { if (!paused) lastKey.current = null; }, [paused]);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 3500); return () => clearTimeout(t); }, [note]);
  const live = !!perm?.granted && focused && active && !paused && status !== 'reading';

  const read = async (uri: string, w: number, h: number) => {
    setStatus('reading');
    let done: boolean | string = false;
    try { done = await shotRef.current(uri, w, h); } catch { done = false; }
    if (typeof done === 'string') setNote(done);
    else if (done) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    lastKey.current = null;
    setStatus('looking');
  };

  // Keep reading frames on the phone until the same fingerprint shows up twice in a row
  useEffect(() => {
    if (!live || !ready || manualOnly) return;
    let stop = false;
    void (async () => {
      while (!stop) {
        await sleep(GAP_MS);
        if (stop || busy.current) continue;
        busy.current = true;
        try {
          const shot = await cam.current?.takePictureAsync({ quality: 0.8, shutterSound: false });
          if (!shot || stop) continue;
          const key = keyRef.current(await readText(shot.uri));
          if (key && key === lastKey.current) { stop = true; void read(shot.uri, shot.width, shot.height); }
          else { lastKey.current = key; setStatus(key ? 'steady' : 'looking'); }
        } catch { /* camera busy or closing; try the next frame */ } finally { busy.current = false; }
      }
    })();
    return () => { stop = true; };
  }, [live, ready, manualOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const snapNow = async () => {
    if (busy.current) return;
    busy.current = true;
    try { const shot = await cam.current?.takePictureAsync({ quality: 0.9, shutterSound: false }); if (shot) await read(shot.uri, shot.width, shot.height); }
    finally { busy.current = false; }
  };
  const fromPhotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const a = res.canceled ? undefined : res.assets[0];
    if (a) await read(a.uri, a.width, a.height);
  };

  if (!perm) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  if (!perm.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, padding: 24, paddingTop: insets.top + 24, justifyContent: 'center', gap: 14 }}>
        <View style={{ alignSelf: 'center' }}><Icon name="document_scanner" size={48} color={p.focus} /></View>
        <Txt v="h2" center>Let Dragonfly use the camera</Txt>
        <Txt center>{why}</Txt>
        <Button title={perm.canAskAgain ? 'Allow camera' : 'Open Settings'} onPress={() => (perm.canAskAgain ? requestPerm() : Linking.openSettings())} />
        <Button kind="ghost" title="Not now" onPress={onClose} />
      </View>
    );
  }

  const pill = status !== 'reading' && note ? note : words[status];
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" active={live || status === 'reading'} enableTorch={torch} animateShutter={false}
        onCameraReady={() => setReady(true)} onMountError={() => setReady(false)} />
      <View style={[st.row, { position: 'absolute', top: insets.top + 8, left: 16, right: 16, justifyContent: 'space-between' }]}>
        <RoundBtn icon="close" label="Close scanner" onPress={onClose} />
        <Text style={st.title}>{title}</Text>
        <RoundBtn icon={torch ? 'flash_on' : 'flash_off'} label={torch ? 'Turn flashlight off' : 'Turn flashlight on'} onPress={() => setTorch((t) => !t)} />
      </View>
      {!paused && <Viewfinder scanning={live && ready && !manualOnly} color={status === 'steady' ? '#5be3a0' : p.focus} />}
      {!paused && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 24, alignItems: 'center', gap: 18 }}>
          <View style={st.pill}>
            {status === 'reading' ? <ActivityIndicator color="#fff" size="small" /> : <View style={[st.dot, { backgroundColor: status === 'steady' ? '#5be3a0' : '#fff' }]} />}
            <Text style={st.pillText}>{pill}</Text>
          </View>
          <View style={[st.row, { gap: 36 }]}>
            <RoundBtn icon="photo_library" label="Pick a photo" onPress={fromPhotos} />
            <Pressable onPress={snapNow} disabled={status === 'reading'} accessibilityRole="button" accessibilityLabel="Read this now"
              style={({ pressed }) => [st.shutter, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}><View style={st.shutterIn} /></Pressable>
            <View style={{ width: 48 }} />
          </View>
        </View>
      )}
      {children}
    </View>
  );
}

function RoundBtn({ icon, label, onPress }: { icon: Parameters<typeof Icon>[0]['name']; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={st.round}><Icon name={icon} size={24} color="#fff" /></Pressable>;
}

/** Corner brackets with a sweeping line, like a QR scanner; they turn green when the view is steady */
function Viewfinder({ scanning, color }: { scanning: boolean; color: string }) {
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!scanning) { sweep.stopAnimation(); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(sweep, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(sweep, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [scanning, sweep]);
  const H = 420;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      <View style={{ width: '84%', height: H, maxWidth: 420 }}>
        {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
          <View key={c} style={[st.corner, { borderColor: color,
            top: c[0] === 't' ? 0 : undefined, bottom: c[0] === 'b' ? 0 : undefined, left: c[1] === 'l' ? 0 : undefined, right: c[1] === 'r' ? 0 : undefined,
            borderTopWidth: c[0] === 't' ? 4 : 0, borderBottomWidth: c[0] === 'b' ? 4 : 0, borderLeftWidth: c[1] === 'l' ? 4 : 0, borderRightWidth: c[1] === 'r' ? 4 : 0,
            borderTopLeftRadius: c === 'tl' ? 22 : 0, borderTopRightRadius: c === 'tr' ? 22 : 0, borderBottomLeftRadius: c === 'bl' ? 22 : 0, borderBottomRightRadius: c === 'br' ? 22 : 0,
          }]} />
        ))}
        {scanning && <Animated.View style={[st.line, { backgroundColor: color, shadowColor: color, transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [16, H - 20] }) }] }]} />}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 18, color: '#fff', textShadowColor: 'rgba(0,0,0,.5)', textShadowRadius: 6 },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,.55)', borderRadius: R.pill, paddingHorizontal: 18, paddingVertical: 10 },
  pillText: { fontFamily: F.bodyBold, fontSize: 16, color: '#fff' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  corner: { position: 'absolute', width: 54, height: 54 },
  line: { position: 'absolute', left: 14, right: 14, height: 3, borderRadius: 2, shadowOpacity: 0.9, shadowRadius: 10, elevation: 6 },
});
