import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { coverUrl } from '@/components/cover';
import { ColorPicker } from '@/components/pickers';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { Page, useTrainerSave } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { COLORS } from '@/lib/business';
import { bytesOf, rand } from '@/lib/files';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

/** Branding: your logo, colour and welcome message, shown in your clients' app */
export default function Branding() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const save = useTrainerSave();
  const t = app.trainer;
  const [logo, setLogo] = useState<string | null>(t?.logo ?? null);
  const [url, setUrl] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(t?.brand_color ?? null);
  const [welcome, setWelcome] = useState(t?.welcome ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (logo) coverUrl(logo.replace(/^media:/, '')).then(setUrl); else setUrl(null); }, [logo]);
  if (!t) return null;
  const upload = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [1, 1] });
      if (res.canceled || !res.assets[0]) return;
      setBusy(true);
      const out = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: 600 } }], { compress: 0.9, format: ImageManipulator.SaveFormat.PNG });
      const path = `${t.user_id}/branding/${rand()}.png`;
      const { error } = await sb.storage.from('coach-media').upload(path, await bytesOf(out.uri), { contentType: 'image/png' });
      if (error) throw error;
      setLogo(`media:${path}`);
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  return (
    <Page title="Branding">
      <Card style={{ alignItems: 'center', gap: 12 }}>
        {url ? <Image source={{ uri: url }} style={{ width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderColor: color ?? p.line }} contentFit="cover" accessibilityLabel="Your logo" />
          : <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: color ?? p.soft, alignItems: 'center', justifyContent: 'center' }}><Txt v="h1" color={p.onAccent}>{(t.business_name || t.display_name)[0]}</Txt></View>}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button kind="ghost" icon="image" title={logo ? 'Change logo' : 'Upload logo'} busy={busy} onPress={upload} />
          {logo && <Button kind="quiet" title="Remove" onPress={() => setLogo(null)} />}
        </View>
      </Card>
      <Card>
        <Txt v="bold" style={{ marginBottom: 8 }}>Brand colour</Txt>
        <ColorPicker value={color} onChange={setColor} colors={[...COLORS, '#111111', '#b8860b']} />
        <Txt v="small" style={{ marginTop: 10 }}>Used for highlights in your clients’ app.</Txt>
      </Card>
      <Card>
        <Field label="Welcome message" hint="(clients see it on their home screen)" value={welcome} onChangeText={setWelcome} multiline placeholder="Welcome to the team! Message me any time." />
      </Card>
      <Button title="Sync branding" icon="sync" style={{ alignSelf: 'center', minWidth: 220 }} onPress={() => save({ logo, brand_color: color, welcome: welcome.trim() || null }, 'Branding updated for your clients')} />
    </Page>
  );
}
