// Live appointment scanner: point the camera at a booking screen, a paper schedule or a text thread. The phone reads the
// text itself; once it sees an appointment time held steady, it takes the photo and the AI lists the sessions to add.
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClientList } from '@/components/pickers';
import { Button, Icon, Txt, useToast } from '@/components/ui';
import { readAppointments, type FoundSession } from '@/features/calendar-import';
import { ImportReview } from '@/features/import-review';
import { readText } from '@/features/ocr';
import { fnText } from '@/lib/fn';
import { appointmentKey } from '@/lib/scan-text';
import { F, R, usePalette } from '@/lib/theme';

const GAP_MS = 700;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function CalendarScan() {
  const p = usePalette();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { clients } = useClientList();
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [status, setStatus] = useState<'looking' | 'steady' | 'reading'>('looking');
  const [found, setFound] = useState<FoundSession[] | null>(null);
  const busy = useRef(false);
  const lastKey = useRef<string | null>(null);
  const clientsRef = useRef(clients); clientsRef.current = clients;

  useEffect(() => { const s = AppState.addEventListener('change', (st) => setActive(st === 'active')); return () => s.remove(); }, []);
  useEffect(() => { if (perm && !perm.granted && perm.canAskAgain) requestPerm(); }, [perm, requestPerm]);
  const live = !!perm?.granted && focused && active && !found && status !== 'reading';

  /** Sends one photo to be read and shows what it found */
  const read = async (uri: string, w: number, h: number) => {
    setStatus('reading');
    try {
      const sessions = await readAppointments(uri, w, h, clientsRef.current ?? []);
      if (!sessions.length) { toast('No appointments found there. Hold the camera over one.', false); lastKey.current = null; setStatus('looking'); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setFound(sessions); setStatus('looking');
    } catch (e) { toast(fnText(e), false); lastKey.current = null; setStatus('looking'); }
  };

  // Keep reading frames on the phone until the same appointment time shows up twice in a row
  useEffect(() => {
    if (!live || !ready) return;
    let stop = false;
    void (async () => {
      while (!stop) {
        await sleep(GAP_MS);
        if (stop || busy.current) continue;
        busy.current = true;
        try {
          const shot = await cam.current?.takePictureAsync({ quality: 0.8, shutterSound: false });
          if (!shot || stop) continue;
          const key = appointmentKey(await readText(shot.uri));
          if (key && key === lastKey.current) { stop = true; void read(shot.uri, shot.width, shot.height); }
          else { lastKey.current = key; setStatus(key ? 'steady' : 'looking'); }
        } catch { /* camera busy or closing; try the next frame */ } finally { busy.current = false; }
      }
    })();
    return () => { stop = true; };
  }, [live, ready]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/calendar'); };
  if (!perm) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  if (!perm.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, padding: 24, paddingTop: insets.top + 24, justifyContent: 'center', gap: 14 }}>
        <View style={{ alignSelf: 'center' }}><Icon name="document_scanner" size={48} color={p.focus} /></View>
        <Txt v="h2" center>Let Dragonfly use the camera</Txt>
        <Txt center>The scanner reads appointments on your phone. Only the photo it captures is sent to be read.</Txt>
        <Button title={perm.canAskAgain ? 'Allow camera' : 'Open Settings'} onPress={() => (perm.canAskAgain ? requestPerm() : Linking.openSettings())} />
        <Button kind="ghost" title="Not now" onPress={close} />
      </View>
    );
  }

  const pill = status === 'reading' ? 'Reading the appointment…' : status === 'steady' ? 'Hold steady…' : 'Point at an appointment';
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" active={live || status === 'reading'} enableTorch={torch} animateShutter={false}
        onCameraReady={() => setReady(true)} onMountError={() => setReady(false)} />
      <View style={[st.row, { position: 'absolute', top: insets.top + 8, left: 16, right: 16, justifyContent: 'space-between' }]}>
        <RoundBtn icon="close" label="Close scanner" onPress={close} />
        <Text style={st.title}>Scan appointments</Text>
        <RoundBtn icon={torch ? 'flash_on' : 'flash_off'} label={torch ? 'Turn flashlight off' : 'Turn flashlight on'} onPress={() => setTorch((t) => !t)} />
      </View>
      {!found && <Viewfinder scanning={live && ready} color={status === 'steady' ? '#5be3a0' : p.focus} />}
      {!found && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 24, alignItems: 'center', gap: 18 }}>
          <View style={st.pill}>
            {status === 'reading' ? <ActivityIndicator color="#fff" size="small" /> : <View style={[st.dot, { backgroundColor: status === 'steady' ? '#5be3a0' : '#fff' }]} />}
            <Text style={st.pillText}>{pill}</Text>
          </View>
          <View style={[st.row, { gap: 36 }]}>
            <RoundBtn icon="photo_library" label="Pick a screenshot" onPress={fromPhotos} />
            <Pressable onPress={snapNow} disabled={status === 'reading'} accessibilityRole="button" accessibilityLabel="Read this now"
              style={({ pressed }) => [st.shutter, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}><View style={st.shutterIn} /></Pressable>
            <View style={{ width: 48 }} />
          </View>
        </View>
      )}
      <ImportReview found={found} clients={clients ?? []} onClose={() => { lastKey.current = null; setFound(null); }}
        onAdded={(n) => { toast(`Added ${n} to your calendar`); setFound(null); close(); }} />
    </View>
  );
}

function RoundBtn({ icon, label, onPress }: { icon: Parameters<typeof Icon>[0]['name']; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={st.round}><Icon name={icon} size={24} color="#fff" /></Pressable>;
}

/** Corner brackets with a sweeping line, like a QR scanner; they turn green when the text is steady */
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
