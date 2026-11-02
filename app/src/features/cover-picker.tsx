import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Cover, isUploaded } from '@/components/cover';
import { Button, Txt, useToast } from '@/components/ui';
import { bytesOf, rand } from '@/lib/files';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { R, usePalette } from '@/lib/theme';
import { Image } from 'expo-image';
import { ART_LABEL, WORKOUT_ART, WORKOUT_IMAGES } from '@/lib/art';

/** Choose a Dragonfly photo or upload your own art (stored in coach-media/{trainer}/covers). Left alone, the photo follows the name. */
export function CoverPicker({ name, value, trainerId, onChange }: { name: string; value: string | null; trainerId: string; onChange: (cover: string | null) => void }) {
  const p = usePalette();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const upload = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [1, 1] });
      if (res.canceled || !res.assets[0]) return;
      setBusy(true);
      const a = res.assets[0];
      const out = await ImageManipulator.manipulateAsync(a.uri, Math.max(a.width, a.height) > 1000 ? [{ resize: a.width >= a.height ? { width: 1000 } : { height: 1000 } }] : [],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
      const path = `${trainerId}/covers/${rand()}.jpg`;
      const { error } = await sb.storage.from('coach-media').upload(path, await bytesOf(out.uri), { contentType: 'image/jpeg' });
      if (error) throw error;
      onChange(`media:${path}`);
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  return (
    <View style={{ gap: 10, marginBottom: 16 }}>
      <Txt v="bold" style={{ fontSize: 15 }}>Cover</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Cover name={name || '?'} cover={value} size={84} photo />
        <View style={{ gap: 8 }}>
          <Button small kind="ghost" icon="photo_camera" title={isUploaded(value) ? 'Change image' : 'Upload your own art'} busy={busy} onPress={upload} />
          {value && <Button small kind="quiet" title="Match the name automatically" onPress={() => onChange(null)} />}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {WORKOUT_ART.map((k) => {
          const on = value === `art:${k}`;
          return (
            <Pressable key={k} accessibilityRole="radio" accessibilityLabel={`${ART_LABEL[k]} photo`} accessibilityState={{ selected: on }} onPress={() => onChange(`art:${k}`)}
              style={{ borderRadius: R.sm, borderWidth: 2, borderColor: on ? p.focus : 'transparent', padding: 1 }}>
              <Image source={WORKOUT_IMAGES[k]} style={{ width: 56, height: 56, borderRadius: R.sm - 2 }} contentFit="cover" />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
