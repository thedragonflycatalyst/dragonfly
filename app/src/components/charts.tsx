import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { F, usePalette } from '@/lib/theme';
import { Txt } from './ui';

export type Pt = { t: number; v: number };
export type Series = { key: string; label: string; color: string; points: Pt[]; raw?: Pt[]; end?: string };

const niceStep = (span: number, n = 5) => {
  const raw = span / n, mag = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
};
const pathOf = (pts: { x: number; y: number }[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join('');

/** Line chart over time: smoothed lines, faint raw points, optional goal line and projection, labels at the end of each line */
export function LineChart({ series, height = 300, from, to, goal, projection, fmtY, fmtPoint, label }: {
  series: Series[]; height?: number; from: number; to: number; goal?: number | null; projection?: { a: Pt; b: Pt } | null;
  fmtY: (v: number) => string; fmtPoint?: (v: number) => string; label: string;
}) {
  const p = usePalette();
  const [w, setW] = useState(0);
  const [viewport, setViewport] = useState<{ from: number; to: number } | null>(null);
  const [inspected, setInspected] = useState<number | null>(null);
  const gesture = useRef<{ x: number; from: number; to: number; moved: boolean; pinch: number | null; anchor: number } | null>(null);
  const day = 86_400_000;
  useEffect(() => { setViewport(null); setInspected(null); }, [from, to]);
  const viewFrom = viewport?.from ?? from, viewTo = viewport?.to ?? to;
  const allPoints = series.flatMap((s) => s.raw?.length ? s.raw : s.points);
  const firstReading = Math.min(...allPoints.map((q) => q.t), from);
  const lastReading = Math.max(...allPoints.map((q) => q.t), to);
  const minT = firstReading - 7 * day, maxT = Math.max(lastReading, Date.now()) + 30 * day;
  const minSpan = day * 2, maxSpan = Math.max(minSpan, maxT - minT);
  const clampView = (a: number, b: number) => {
    const width = Math.max(minSpan, Math.min(maxSpan, b - a));
    const start = Math.max(minT, Math.min(maxT - width, a));
    return { from: start, to: start + width };
  };
  const zoom = (factor: number, at = (viewFrom + viewTo) / 2) => {
    const span = (viewTo - viewFrom) * factor;
    const ratio = (at - viewFrom) / (viewTo - viewFrom);
    setViewport(clampView(at - span * ratio, at + span * (1 - ratio)));
  };
  const shift = (direction: number) => {
    const span = viewTo - viewFrom;
    setViewport(clampView(viewFrom + span * direction * 0.75, viewTo + span * direction * 0.75));
  };
  const plotWidth = Math.max(1, w - 46 - 92);
  const atX = (x: number, a = viewFrom, b = viewTo) => a + Math.max(0, Math.min(1, (x - 46) / plotWidth)) * (b - a);
  const inspect = (x: number) => {
    const at = atX(x);
    const candidates = series.flatMap((ss) => (ss.raw?.length ? ss.raw : ss.points).map((point) => ({ ...point, color: ss.color, series: ss.label })));
    const nearest = candidates.reduce<(typeof candidates)[number] | null>((best, point) => !best || Math.abs(point.t - at) < Math.abs(best.t - at) ? point : best, null);
    setInspected(nearest?.t ?? null);
  };
  const onTouchStart = (e: any) => {
    const touches = (e.nativeEvent.touches ?? []) as { pageX: number }[];
    const x = e.nativeEvent.locationX as number;
    if (!gesture.current) gesture.current = { x, from: viewFrom, to: viewTo, moved: false, pinch: null, anchor: 0 };
    if (touches.length >= 2) {
      gesture.current = { x, from: viewFrom, to: viewTo, moved: true,
        pinch: Math.abs(touches[1].pageX - touches[0].pageX), anchor: (viewFrom + viewTo) / 2 };
    }
  };
  const onTouchMove = (e: any) => {
    const g = gesture.current;
    if (!g) return;
    const touches = (e.nativeEvent.touches ?? []) as { pageX: number }[];
    if (touches.length >= 2) {
      const distance = Math.max(8, Math.abs(touches[1].pageX - touches[0].pageX));
      if (g.pinch == null) { gesture.current = { ...g, moved: true, pinch: distance, from: viewFrom, to: viewTo, anchor: (viewFrom + viewTo) / 2 }; return; }
      const span = (g.to - g.from) * (g.pinch / distance);
      setViewport(clampView(g.anchor - span / 2, g.anchor + span / 2));
      g.moved = true;
      setInspected(null);
    } else if (g.pinch == null) {
      const x = e.nativeEvent.locationX as number;
      const dx = x - g.x;
      if (Math.abs(dx) > 5) g.moved = true;
      if (g.moved) {
        const delta = -dx / plotWidth * (g.to - g.from);
        setViewport(clampView(g.from + delta, g.to + delta));
        setInspected(null);
      }
    }
  };
  const onTouchEnd = (e: any) => {
    const g = gesture.current;
    if (g && !g.moved) inspect(e.nativeEvent.locationX as number);
    gesture.current = null;
  };
  const all = series.flatMap((s) => [...s.points, ...(s.raw ?? [])]).filter((q) => q.t >= viewFrom && q.t <= viewTo).map((q) => q.v);
  if (goal != null) all.push(goal);
  const padL = 46, padR = 92, padT = 24, padB = 26;
  let lo = Math.min(...all), hi = Math.max(...all);
  if (!all.length) { lo = 0; hi = 1; }
  if (hi - lo < 1) { lo -= 1; hi += 1; }
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const X = (t: number) => padL + ((t - viewFrom) / Math.max(viewTo - viewFrom, 1)) * (w - padL - padR);
  const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (height - padT - padB);
  const ticks: number[] = []; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  // Month (or year) marks along the bottom
  const marks: { t: number; text: string }[] = [];
  const spanDays = (viewTo - viewFrom) / 86_400_000;
  const d0 = new Date(viewFrom); d0.setDate(1); d0.setHours(0, 0, 0, 0);
  const monthsStep = spanDays > 900 ? 12 : spanDays > 400 ? 3 : spanDays > 200 ? 2 : 1;
  for (let d = new Date(d0); d.getTime() <= viewTo; d.setMonth(d.getMonth() + monthsStep)) {
    if (d.getTime() < viewFrom) continue;
    marks.push({ t: d.getTime(), text: monthsStep === 12 || d.getMonth() === 0 ? String(d.getFullYear()) : d.toLocaleDateString(undefined, { month: 'short' }) });
  }
  if (spanDays <= 45) { marks.length = 0; for (let t = viewFrom; t <= viewTo; t += 7 * 86_400_000) marks.push({ t, text: new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }); }
  const ends = series.map((s) => { const last = [...s.points].reverse().find((q) => q.t >= viewFrom && q.t <= viewTo); return last ? { s, y: Y(last.v), x: X(last.t) } : null; }).filter(Boolean) as { s: Series; y: number; x: number }[];
  // Keep end labels from overlapping
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 34) ends[i].y = ends[i - 1].y + 34;
  const chosen = inspected == null ? null : series.flatMap((ss) => (ss.raw?.length ? ss.raw : ss.points).map((point) => ({ ...point, color: ss.color, series: ss.label })))
    .filter((point) => point.t === inspected);
  const selected = chosen?.[0];
  return (
    <View accessible accessibilityLabel={label} style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 8 }}>
        {([['‹', () => shift(-1), 'Earlier'], ['−', () => zoom(1.8), 'Zoom out'], ['Reset', () => { setViewport(null); setInspected(null); }, 'Reset chart'], ['+', () => zoom(0.55), 'Zoom in'], ['›', () => shift(1), 'Later']] as const).map(([title, onPress, hint]) =>
          <Pressable key={hint} onPress={onPress} accessibilityRole="button" accessibilityLabel={hint} style={{ minWidth: title === 'Reset' ? 54 : 34, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: p.soft }}>
            <Text style={{ color: p.ink, fontSize: title === 'Reset' ? 12 : 19, fontFamily: F.bodyBold }}>{title}</Text>
          </Pressable>)}
      </View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        onResponderGrant={onTouchStart} onResponderMove={onTouchMove}
        onResponderRelease={onTouchEnd} onResponderTerminate={() => { gesture.current = null; }}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <Defs>
            {series.map((s) => (
              <LinearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={s.color} stopOpacity={0.22} /><Stop offset="1" stopColor={s.color} stopOpacity={0} />
              </LinearGradient>
            ))}
          </Defs>
          {ticks.map((v) => (
            <G key={v}>
              <Line x1={padL} x2={w - padR + 10} y1={Y(v)} y2={Y(v)} stroke={p.line} strokeWidth={1} />
              <SvgText x={padL - 6} y={Y(v) + 4} fontSize={11} fill={p.muted} textAnchor="end" fontFamily={F.body}>{fmtY(v)}</SvgText>
            </G>
          ))}
          {marks.map((m) => (
            <G key={m.t}>
              <Line x1={X(m.t)} x2={X(m.t)} y1={padT} y2={height - padB} stroke={p.line} strokeWidth={1} strokeDasharray="2,4" />
              <SvgText x={X(m.t) + 3} y={height - 8} fontSize={11} fill={p.muted} fontFamily={F.body}>{m.text}</SvgText>
            </G>
          ))}
          {Date.now() >= viewFrom && Date.now() <= viewTo && <Line x1={X(Date.now())} x2={X(Date.now())} y1={padT - 10} y2={height - padB} stroke={p.gold} strokeWidth={1.5} />}
          {goal != null && goal >= lo && goal <= hi && (
            <G>
              <Line x1={padL} x2={w - padR + 10} y1={Y(goal)} y2={Y(goal)} stroke={p.good} strokeWidth={1.5} />
              <SvgText x={w - padR + 14} y={Y(goal) + 4} fontSize={13} fill={p.good} fontFamily={F.bodyBold}>Goal</SvgText>
            </G>
          )}
          {projection && projection.a.t <= viewTo && projection.b.t >= viewFrom && <Line x1={X(Math.max(projection.a.t, viewFrom))} y1={Y(projection.a.v + (projection.b.v - projection.a.v) * ((Math.max(projection.a.t, viewFrom) - projection.a.t) / Math.max(projection.b.t - projection.a.t, 1)))} x2={X(Math.min(projection.b.t, viewTo))}
            y2={Y(projection.a.v + (projection.b.v - projection.a.v) * ((Math.min(projection.b.t, viewTo) - projection.a.t) / Math.max(projection.b.t - projection.a.t, 1)))}
            stroke={p.muted} strokeWidth={2} strokeDasharray="6,5" />}
          {series.map((s) => {
            const pts = s.points.filter((q) => q.t >= viewFrom && q.t <= viewTo).map((q) => ({ x: X(q.t), y: Y(q.v) }));
            if (!pts.length) return null;
            const area = `${pathOf(pts)}L${pts[pts.length - 1].x},${height - padB}L${pts[0].x},${height - padB}Z`;
            return (
              <G key={s.key}>
                <Path d={area} fill={`url(#g-${s.key})`} />
                {(s.raw ?? []).filter((q) => q.t >= viewFrom && q.t <= viewTo).map((q) => <Circle key={q.t} cx={X(q.t)} cy={Y(q.v)} r={2.2} fill={s.color} opacity={0.45} />)}
                <Path d={pathOf(pts)} stroke={s.color} strokeWidth={2.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              </G>
            );
          })}
          {selected && selected.t >= viewFrom && selected.t <= viewTo && (
            <G>
              <Line x1={X(selected.t)} x2={X(selected.t)} y1={padT} y2={height - padB} stroke={p.ink} strokeWidth={1.5} strokeDasharray="4,3" />
              {chosen?.map((point, i) => <Circle key={point.series + i} cx={X(point.t)} cy={Y(point.v)} r={5} fill={point.color} stroke={p.surface} strokeWidth={2} />)}
            </G>
          )}
          {ends.map(({ s, y }) => (
            <G key={s.key}>
              <SvgText x={w - padR + 6} y={y - 2} fontSize={12} fill={s.color} fontFamily={F.bodyBold}>{s.label}</SvgText>
              {s.end ? <SvgText x={w - padR + 6} y={y + 13} fontSize={12} fill={s.color} fontFamily={F.bodyBold}>{s.end}</SvgText> : null}
            </G>
          ))}
        </Svg>
      )}
      </View>
      {selected ? (
        <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: p.soft }}>
          <Text style={{ color: p.ink, fontFamily: F.bodyBold, fontSize: 12 }}>{new Date(selected.t).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
          <Text style={{ color: p.muted, fontFamily: F.body, fontSize: 12 }}>{chosen?.map((point) => `${point.series}: ${(fmtPoint ?? fmtY)(point.v)}`).join(' · ')}</Text>
        </View>
      ) : <Text style={{ color: p.muted, fontSize: 11, textAlign: 'center', fontFamily: F.body }}>Tap for a reading · drag to explore · pinch or use +/− to zoom</Text>}
    </View>
  );
}

/** Bars above / below zero with their values (monthly or yearly change) */
export function ChangeBars({ data, height = 170, fmt, label }: { data: { label: string; v: number }[]; height?: number; fmt: (v: number) => string; label: string }) {
  const p = usePalette();
  const [w, setW] = useState(0);
  const max = Math.max(...data.map((d) => Math.abs(d.v)), 0.1);
  const mid = height / 2, bw = data.length ? Math.min(34, (w / data.length) * 0.6) : 0, scale = (height / 2 - 26) / max;
  return (
    <View accessible accessibilityLabel={label} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <Line x1={0} x2={w} y1={mid} y2={mid} stroke={p.line} strokeWidth={1} />
          {data.map((d, i) => {
            const cx = (i + 0.5) * (w / data.length), h = Math.max(Math.abs(d.v) * scale, 2);
            const up = d.v >= 0;
            return (
              <G key={d.label + i}>
                <Rect x={cx - bw / 2} y={up ? mid - h : mid} width={bw} height={h} rx={3} fill={up ? p.gold : p.focus} />
                <SvgText x={cx} y={up ? mid - h - 5 : mid + h + 13} fontSize={11} fill={p.ink} textAnchor="middle" fontFamily={F.bodyBold}>{fmt(d.v)}</SvgText>
                <SvgText x={cx} y={height - 2} fontSize={10.5} fill={p.muted} textAnchor="middle" fontFamily={F.body}>{d.label}</SvgText>
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

/** Simple vertical bars (money per month, counts) */
export function Bars({ data, height = 160, fmt, label, color }: { data: { label: string; v: number }[]; height?: number; fmt: (v: number) => string; label: string; color?: string }) {
  const p = usePalette();
  const [w, setW] = useState(0);
  const max = Math.max(...data.map((d) => d.v), 1);
  const bw = data.length ? Math.min(30, (w / data.length) * 0.6) : 0;
  return (
    <View accessible accessibilityLabel={label} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <Line x1={0} x2={w} y1={height - 18} y2={height - 18} stroke={p.line} strokeWidth={1} />
          {data.map((d, i) => {
            const cx = (i + 0.5) * (w / data.length), h = (d.v / max) * (height - 46);
            return (
              <G key={d.label + i}>
                <Rect x={cx - bw / 2} y={height - 18 - h} width={bw} height={Math.max(h, d.v ? 2 : 0)} rx={3} fill={color ?? p.focus} />
                {d.v ? <SvgText x={cx} y={height - 22 - h} fontSize={10} fill={p.ink} textAnchor="middle" fontFamily={F.bodyBold}>{fmt(d.v)}</SvgText> : null}
                <SvgText x={cx} y={height - 3} fontSize={10.5} fill={p.muted} textAnchor="middle" fontFamily={F.body}>{d.label}</SvgText>
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

/** Half-circle gauge (BMI): coloured bands, a marker at the value, the number and its class in the middle */
export function Gauge({ value, min, max, bands, caption, size = 150 }: { value: number; min: number; max: number; bands: { to: number; color: string }[]; caption: string; size?: number }) {
  const p = usePalette();
  const r = size / 2 - 10, cx = size / 2, cy = size / 2 + 4;
  const ang = (v: number) => Math.PI * (1 - (Math.min(Math.max(v, min), max) - min) / (max - min));
  const pt = (v: number) => ({ x: cx + r * Math.cos(ang(v)), y: cy - r * Math.sin(ang(v)) });
  let start = min;
  return (
    <View accessible accessibilityLabel={`${value.toFixed(1)}, ${caption}`} style={{ width: size, height: size / 2 + 28, alignItems: 'center' }}>
      <Svg width={size} height={size / 2 + 12}>
        {bands.map((b) => {
          const a = pt(start), z = pt(b.to); start = b.to;
          return <Path key={b.to} d={`M${a.x},${a.y} A${r},${r} 0 0 1 ${z.x},${z.y}`} stroke={b.color} strokeWidth={12} fill="none" />;
        })}
        <Circle cx={pt(value).x} cy={pt(value).y} r={7} fill={p.surface} stroke={p.ink} strokeWidth={2.5} />
      </Svg>
      <View style={{ position: 'absolute', top: size / 2 - 30, alignItems: 'center' }}>
        <Txt v="h2">{value.toFixed(1)}</Txt>
        <Txt v="small">{caption}</Txt>
      </View>
    </View>
  );
}
