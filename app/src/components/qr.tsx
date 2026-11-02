import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

/** A QR code, always dark on white (phones scan that best, in either theme) */
export function QrCode({ value, size = 240, label }: { value: string; size?: number; label: string }) {
  const { path, n } = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(value);
    q.make();
    const count = q.getModuleCount();
    let d = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { path: d, n: count };
  }, [value]);
  const pad = 4;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ backgroundColor: '#ffffff', padding: 10, borderRadius: 16 }}>
      <Svg width={size} height={size} viewBox={`${-pad} ${-pad} ${n + pad * 2} ${n + pad * 2}`}>
        <Rect x={-pad} y={-pad} width={n + pad * 2} height={n + pad * 2} fill="#ffffff" />
        <Path d={path} fill="#0b0b10" />
      </Svg>
    </View>
  );
}
