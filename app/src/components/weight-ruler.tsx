import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Line, Text as SvgText } from 'react-native-svg';
import { fromKg, fmtNum, unitLabel, weightRulerValue, type BodyUnit } from '@/lib/scale';
import { F, usePalette } from '@/lib/theme';

/** A lightweight, locally rendered weight ruler: drag the markings under the fixed marker.
 *  The companion numeric field remains the source of truth and supports precise keyboard input. */
export function WeightRuler({ value, fallbackKg, unit, format, onChange }: {
  value: string; fallbackKg?: number; unit: BodyUnit; format: 'dot' | 'comma'; onChange: (v: string) => void;
}) {
  const p = usePalette();
  const [width, setWidth] = useState(300);
  const start = useRef<{ pageX: number; value: number; moved: boolean } | null>(null);
  const min = Math.ceil(fromKg(20, unit) * 10) / 10;
  const max = Math.floor(fromKg(400, unit) * 10) / 10;
  const parsed = Number(value.replace(',', '.'));
  const fallback = fallbackKg != null ? fromKg(fallbackKg, unit) : fromKg(70, unit);
  const current = Number.isFinite(parsed) && value.trim() ? parsed : fallback;
  const clamp = (v: number) => weightRulerValue(v, unit);
  const selected = clamp(current);
  const pxPerTenth = 12;
  const count = Math.ceil(width / pxPerTenth / 2) + 2;
  const set = (v: number) => onChange(clamp(v).toFixed(1));
  const drag = (pageX: number) => {
    if (!start.current) return;
    const delta = pageX - start.current.pageX;
    if (Math.abs(delta) < 3 && !start.current.moved) return;
    start.current.moved = true;
    // Pulling the ruler right reveals smaller numbers under the central marker.
    set(start.current.value - Math.round(delta / pxPerTenth) / 10);
  };
  const finish = () => {
    if (start.current?.moved) Haptics.selectionAsync().catch(() => {});
    start.current = null;
  };
  const ticks = Array.from({ length: count * 2 + 1 }, (_, i) => {
    const offset = i - count;
    const tenth = Math.round(selected * 10) + offset;
    const n = tenth / 10;
    return { n, offset, major: tenth % 10 === 0, medium: tenth % 5 === 0 };
  }).filter((q) => q.n >= min && q.n <= max);
  const control = (label: string, delta: number) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`Adjust weight ${delta > 0 ? 'up' : 'down'} by ${Math.abs(delta)} ${unitLabel(unit)}`}
      onPress={() => { set(selected + delta); Haptics.selectionAsync().catch(() => {}); }}
      style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: p.soft }}>
      <Text style={{ fontSize: 22, fontFamily: F.bodyBold, color: p.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ marginBottom: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 1 }}>
          <Text style={{ fontSize: 13, color: p.muted, fontFamily: F.body }}>Slide to set weight</Text>
          <Text style={{ fontSize: 26, color: p.ink, fontFamily: F.display }}>
            {fmtNum(selected, 1, format)} <Text style={{ fontSize: 14, color: p.muted }}>{unitLabel(unit)}</Text>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {control('−', -0.1)}
          {control('+', 0.1)}
        </View>
      </View>
      <View accessibilityRole="adjustable" accessibilityLabel="Weight ruler"
        accessibilityValue={{ min, max, now: selected, text: `${fmtNum(selected, 1, format)} ${unitLabel(unit)}` }}
        accessibilityActions={[{ name: 'increment', label: 'Increase by 0.1' }, { name: 'decrement', label: 'Decrease by 0.1' }]}
        onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'increment') set(selected + 0.1); if (e.nativeEvent.actionName === 'decrement') set(selected - 0.1); }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => { start.current = { pageX: e.nativeEvent.pageX, value: selected, moved: false }; }}
        onResponderMove={(e) => drag(e.nativeEvent.pageX)}
        onResponderRelease={finish} onResponderTerminate={finish}
        style={{ height: 84, backgroundColor: p.soft, borderRadius: 12, overflow: 'hidden' }}>
        <Svg width={width} height={84} pointerEvents="none">
          <Line x1={0} y1={45} x2={width} y2={45} stroke={p.line} strokeWidth={1} />
          {ticks.map(({ n, offset, major, medium }) => {
            // Fractional offset ensures the visual marker remains aligned to precise keyboard entries.
            const x = width / 2 + offset * pxPerTenth - (current - selected) * 10 * pxPerTenth;
            return <Line key={offset} x1={x} y1={45} x2={x} y2={major ? 13 : medium ? 24 : 33}
              stroke={major ? p.ink : p.muted} strokeWidth={major ? 2 : 1} />;
          })}
          {ticks.filter((t) => t.major).map(({ n, offset }) => (
            <SvgText key={offset} x={width / 2 + offset * pxPerTenth - (current - selected) * 10 * pxPerTenth}
              y={65} fontSize={11} fill={p.muted} fontFamily={F.body} textAnchor="middle">{fmtNum(n, 0, format)}</SvgText>
          ))}
          <Line x1={width / 2} x2={width / 2} y1={5} y2={48} stroke={p.focus} strokeWidth={3.5} strokeLinecap="round" />
        </Svg>
      </View>
      <Text style={{ fontSize: 11, color: p.muted, textAlign: 'center', fontFamily: F.body }}>
        Drag the ruler or use ±0.1 · Type an exact value below
      </Text>
    </View>
  );
}
