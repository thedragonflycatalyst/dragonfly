import { Stack } from 'expo-router';
import { View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Toggle } from '@/components/pickers';
import { Button, Card, Chip, Txt } from '@/components/ui';
import { bell, say } from '@/features/lapis/audio';
import { BELLS, MUSIC, setPrefs, useLapisPrefs, VOICES, type BellStyle, type MusicMode } from '@/features/lapis/prefs';
import { Page } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { fmtSeconds } from '@/lib/workouts';

/** Lapis in Dragonfly: the rest timer and set timer sounds. Voice, music, volume, speed, vibration and bell match the Lapis app. */
export default function RestTimerSettings() {
  const app = useApp();
  const l = useLapisPrefs(app.user?.id);
  return (
    <Page title="Rest timer · Lapis">
      <Stack.Screen options={{ title: 'Rest timer · Lapis' }} />
      <Txt v="small">Tick a set and the rest timer starts from that set’s rest box: Lapis says “Rest”, counts 3, 2, 1 and rings the bell. It keeps going with the screen locked and plays with your music. Voice, music, volume, speed, vibration and bell are the same settings as your Lapis app, so changing them here changes them there too.</Txt>

      <SectionLabel>Voice</SectionLabel>
      <Card style={{ gap: 12 }}>
        <Toggle label="Spoken cues" sub="Off: only the bell and vibration" value={l.voiceOn} onChange={(v) => setPrefs({ voiceOn: v })} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {VOICES.map((v) => <Chip key={v.id} label={`${v.label} · ${v.accent}`} selected={l.voice === v.id} onPress={() => { void setPrefs({ voice: v.id }).then(() => say('Rest')); }} />)}
        </View>
        <Txt v="smallBold">Voice volume</Txt>
        <Txt v="small">Your phone’s volume buttons set the music; this sets the voice on top of it.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[0.25, 0.5, 0.75, 1].map((n) => <Chip key={n} label={`${n * 100}%`} selected={Math.abs(l.voiceLevel - n) < 0.01} onPress={() => setPrefs({ voiceLevel: n })} />)}
        </View>
        <Txt v="smallBold">Speaking speed</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[0.8, 0.9, 1, 1.1, 1.2, 1.3].map((n) => <Chip key={n} label={n === 1 ? 'Normal' : `${n}×`} selected={Math.abs(l.voiceSpeed - n) < 0.01} onPress={() => setPrefs({ voiceSpeed: n })} />)}
        </View>
        <Button small kind="ghost" icon="volume_up" title="Test the voice" onPress={() => { void say('Rest').then(() => say('3')).then(() => say('2')).then(() => say('1')).then(() => bell()); }} style={{ alignSelf: 'flex-start' }} />
      </Card>

      <SectionLabel>Your music</SectionLabel>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(MUSIC) as MusicMode[]).map((m) => <Chip key={m} label={MUSIC[m].label} selected={l.music === m} onPress={() => setPrefs({ music: m })} />)}
        </View>
        <Txt v="small">{MUSIC[l.music].hint}</Txt>
      </Card>

      <SectionLabel>Cues</SectionLabel>
      <Card>
        <Toggle label="Say “Rest”" sub="When you tick a set" value={l.sayRest} onChange={(v) => setPrefs({ sayRest: v })} />
        <Toggle label="Halfway" sub="Say “Halfway” on longer rests and timed sets" value={l.halfway} onChange={(v) => setPrefs({ halfway: v })} />
        <Toggle label="3, 2, 1 countdown" value={l.countdown} onChange={(v) => setPrefs({ countdown: v })} />
        <Toggle label="Bell" sub="When rest ends and timed sets start and stop" value={l.bellOn} onChange={(v) => setPrefs({ bellOn: v })} />
        <Toggle label="Vibration" value={l.haptics} onChange={(v) => setPrefs({ haptics: v })} />
      </Card>
      <Card style={{ gap: 10, marginTop: 10 }}>
        <Txt v="smallBold">Bell</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(BELLS) as BellStyle[]).map((b) => <Chip key={b} label={BELLS[b]} selected={l.bell === b} onPress={() => { void setPrefs({ bell: b }).then(() => bell()); }} />)}
        </View>
      </Card>

      <SectionLabel>Timer</SectionLabel>
      <Card style={{ gap: 10 }}>
        <Toggle label="Start rest automatically" sub="When a set is ticked off" value={l.autoRest} onChange={(v) => setPrefs({ autoRest: v })} />
        <Toggle label="Keep the screen on" sub="During workouts" value={l.keepAwake} onChange={(v) => setPrefs({ keepAwake: v })} />
        <Txt v="smallBold">Rest when a set has none</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[30, 45, 60, 90, 120, 180].map((n) => <Chip key={n} label={fmtSeconds(n)} selected={l.defaultRest === n} onPress={() => setPrefs({ defaultRest: n })} />)}
        </View>
      </Card>
    </Page>
  );
}
