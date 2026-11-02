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
import { COVERS } from '@/lib/workouts';

/** Choose a colour cover or upload your own art (stored in coach-media/{trainer}/covers) */
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
        <Cover name={name || '?'} cover={value} size={84} />
        <View style={{ gap: 8 }}>
          <Button small kind="ghost" icon="photo_camera" title={isUploaded(value) ? 'Change image' : 'Upload your own art'} busy={busy} onPress={upload} />
          {isUploaded(value) && <Button small kind="quiet" title="Use a colour instead" onPress={() => onChange('preset:0')} />}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {COVERS.map(([a, b], i) => (
          <Pressable key={i} accessibilityRole="radio" accessibilityLabel={`Colour cover ${i + 1}`} accessibilityState={{ selected: value === `preset:${i}` }} onPress={() => onChange(`preset:${i}`)}
            style={{ width: 44, height: 44, borderRadius: R.sm, backgroundColor: b, borderWidth: 4, borderColor: value === `preset:${i}` ? p.ink : a }} />
        ))}
      </View>
    </View>
  );
}
