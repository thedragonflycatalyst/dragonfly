// A demo video at the top of an exercise: its thumbnail with a play button; tap and it plays right here.
// "Watch on YouTube" opens it where it was published. Links that aren't YouTube open in the browser.
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Button, Icon, Txt } from '@/components/ui';
import { youTubeId, youTubeThumb, youTubeWatch } from '@/lib/library';
import { R, usePalette } from '@/lib/theme';
import { VideoEmbed } from './video-embed';

const open = (url: string) => (Platform.OS === 'web' ? void window.open(url, '_blank', 'noopener') : void WebBrowser.openBrowserAsync(url));

export function DemoVideo({ url, name }: { url: string; name: string }) {
  const p = usePalette();
  const id = youTubeId(url);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setPlaying(false); }, [url]);
  if (!id) return <Button title="Watch the demo video" icon="play_arrow" style={{ alignSelf: 'flex-start', marginBottom: 12 }} onPress={() => open(url)} />;
  return (
    <View style={{ gap: 6, marginBottom: 12 }}>
      <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: R.md, overflow: 'hidden', backgroundColor: '#000' }}>
        {playing ? <VideoEmbed id={id} title={`${name} demo`} /> : (
          <Pressable onPress={() => setPlaying(true)} accessibilityRole="button" accessibilityLabel={`Play the ${name} demo video`} style={{ flex: 1 }}>
            <Image source={{ uri: youTubeThumb(url) ?? undefined }} style={{ flex: 1 }} contentFit="cover" accessibilityLabel={`${name} demo video`} />
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="play_arrow" size={44} color="#fff" />
              </View>
            </View>
          </Pressable>
        )}
      </View>
      <Pressable onPress={() => open(youTubeWatch(id))} accessibilityRole="link" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
        <Icon name="open_in_new" size={16} color={p.focus} />
        <Txt v="small" style={{ color: p.focus }}>Watch on YouTube</Txt>
      </Pressable>
    </View>
  );
}
