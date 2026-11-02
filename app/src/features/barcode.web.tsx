import { View } from 'react-native';
import { Txt } from '@/components/ui';
import { ManualBarcode } from './barcode-manual';

/** In the browser: type the number under the barcode (scanning with the camera is in the phone app) */
export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <Txt v="small">Scanning with the camera works in the phone app. Here, type the number printed under the barcode.</Txt>
      <ManualBarcode onCode={onCode} />
    </View>
  );
}
