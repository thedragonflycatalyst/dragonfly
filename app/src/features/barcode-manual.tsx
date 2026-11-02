import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field } from '@/components/ui';
import { validBarcode } from '@/lib/diary';

export function ManualBarcode({ onCode }: { onCode: (code: string) => void }) {
  const [code, setCode] = useState('');
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
      <View style={{ flex: 1 }}><Field label="Barcode number" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="012345678905" /></View>
      <Button title="Look up" disabled={!validBarcode(code)} onPress={() => onCode(code.trim())} style={{ marginBottom: 16 }} />
    </View>
  );
}
