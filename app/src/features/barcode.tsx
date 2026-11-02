import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { View } from 'react-native';
import { Button, Txt } from '@/components/ui';
import { R } from '@/lib/theme';
import { ManualBarcode } from './barcode-manual';

/** Phone camera barcode scanner, with typing the number as a fallback */
export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const [perm, ask] = useCameraPermissions();
  const done = useRef(false);
  if (!perm) return null;
  if (!perm.granted) {
    return (
      <View style={{ gap: 12 }}>
        <Txt>Dragonfly needs the camera to scan barcodes.</Txt>
        <Button title="Allow camera" icon="photo_camera" onPress={ask} style={{ alignSelf: 'flex-start' }} />
        <ManualBarcode onCode={onCode} />
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <CameraView style={{ width: '100%', aspectRatio: 1, borderRadius: R.md, overflow: 'hidden' }} facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={({ data }) => { if (!done.current && /^\d{8,14}$/.test(data)) { done.current = true; onCode(data); } }} />
      <Txt v="small">Point the camera at the barcode on the package.</Txt>
      <ManualBarcode onCode={onCode} />
    </View>
  );
}
