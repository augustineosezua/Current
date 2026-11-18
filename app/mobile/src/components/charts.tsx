// Charts drawn in code: SVG for the line and donut, plain views for bars. Colours come from the design tokens,
// so every chart follows light and dark mode and the Plus themes. Each chart is one accessible element with a
// sentence describing it, since screen readers can't read shapes.
import { useState, type ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';

import { Raised } from './raised';

// a card with a chart's title, an optional one-line summary, the chart and anything below it
export function ChartCard({ title, line, children }: { title: string; line?: string; children: ReactNode }) {
  return (
    <Raised>
      <View className="gap-3 p-5">
        <View className="gap-0.5">
          <Text className="font-display-bold text-lg text-ink">{title}</Text>
          {line ? <Text className="font-sans text-sm text-muted">{line}</Text> : null}
        </View>
        {children}
      </View>
    </Raised>
  );
}

// the chart's width, measured once it's laid out
function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  return [width, (e) => setWidth(Math.round(e.nativeEvent.layout.width))];
}

export interface LineSeries {
  values: readonly number[];
  // a CSS variable name, e.g. '--color-cta'
  color: string;
  dashed?: boolean;
  // shade the area under the line (the main series only)
  fill?: boolean;
}

// points for a series across the width, the max value at the top with a little headroom
function linePath(values: readonly number[], width: number, height: number, max: number, count: number): string {
  const step = count > 1 ? width / (count - 1) : 0;
  const pad = 3;
  return values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(pad + (height - 2 * pad) * (1 - v / max)).toFixed(1)}`)
    .join(' ');
}

// one or more lines sharing a scale; series can be different lengths (a shorter one stops early)
export function LineChart({
  series,
  height = 120,
  a11y,
  startLabel,
  endLabel,
}: {
  series: readonly LineSeries[];
  height?: number;
  a11y: string;
  startLabel?: string;
  endLabel?: string;
}) {
  const [width, onLayout] = useWidth();
  const colors = useCSSVariable(series.map((s) => s.color)) as string[];
  const [field] = useCSSVariable(['--color-field']) as string[];
  const count = Math.max(...series.map((s) => s.values.length));
  const max = Math.max(1, ...series.flatMap((s) => s.values)) * 1.08;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={a11y} className="gap-1.5">
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              {series.map((s, i) => (
                <LinearGradient key={i} id={`fill${i}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors[i]} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={colors[i]} stopOpacity={0} />
                </LinearGradient>
              ))}
            </Defs>
            {/* a quiet baseline */}
            <Path d={`M0,${height - 1} L${width},${height - 1}`} stroke={field} strokeWidth={2} />
            {series.map((s, i) => {
              if (s.values.length === 0) return null;
              const d = linePath(s.values, width, height, max, count);
              const lastX = ((s.values.length - 1) * width) / Math.max(1, count - 1);
              return (
                <G key={i}>
                  {s.fill ? <Path d={`${d} L${lastX.toFixed(1)},${height} L0,${height} Z`} fill={`url(#fill${i})`} /> : null}
                  <Path
                    d={d}
                    stroke={colors[i]}
                    strokeWidth={s.dashed ? 2 : 3}
                    strokeDasharray={s.dashed ? '5 5' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </G>
              );
            })}
          </Svg>
        ) : null}
      </View>
      {startLabel || endLabel ? (
        <View className="flex-row justify-between">
          <Text className="font-sans text-xs text-muted">{startLabel}</Text>
          <Text className="font-sans text-xs text-muted">{endLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

// a small key under a chart: a swatch and a label per series
export function Legend({ items }: { items: readonly { label: string; color: string; dashed?: boolean }[] }) {
  const colors = useCSSVariable(items.map((i) => i.color)) as string[];
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-1">
      {items.map((item, i) => (
        <View key={item.label} className="flex-row items-center gap-1.5">
          <View style={{ backgroundColor: colors[i], opacity: item.dashed ? 0.7 : 1 }} className="h-1 w-4 rounded-full" />
          <Text className="font-sans text-sm text-muted">{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

// vertical bars over labels; `highlight` draws one bar in ink (e.g. this week or this month)
export function BarChart({
  bars,
  height = 136,
  highlight,
  a11y,
}: {
  bars: readonly { key: string; value: number; label: string }[];
  height?: number;
  highlight?: number;
  a11y: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={a11y} className="gap-1.5">
      <View style={{ height }} className="flex-row items-end gap-2">
        {bars.map((b, i) => (
          <View key={b.key} className="h-full flex-1 justify-end">
            <View
              style={{ height: `${Math.max(3, Math.round((b.value / max) * 100))}%` }}
              className={`w-full rounded-sm ${i === highlight ? 'bg-cta' : b.value > 0 ? 'bg-cat-peach' : 'bg-field'}`}
            />
          </View>
        ))}
      </View>
      <View className="flex-row gap-2">
        {bars.map((b) => (
          <Text key={b.key} className="flex-1 text-center font-sans text-[11px] text-muted" numberOfLines={1}>
            {b.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export interface DonutSlice {
  key: string;
  value: number;
  // a CSS variable name
  color: string;
}

// a ring split by share, with a figure in the middle
export function Donut({ slices, size = 168, center, a11y }: { slices: readonly DonutSlice[]; size?: number; center: ReactNode; a11y: string }) {
  const colors = useCSSVariable(slices.map((s) => s.color)) as string[];
  const [field] = useCSSVariable(['--color-field']) as string[];
  const stroke = 22;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0);
  // a hairline gap between slices so neighbours with similar fills stay apart
  const gap = slices.length > 1 ? 2 : 0;
  let offset = 0;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={a11y} style={{ width: size, height: size }} className="items-center justify-center self-center">
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={field} strokeWidth={stroke} fill="none" />
        {total > 0
          ? slices.map((s, i) => {
              const length = (s.value / total) * circumference;
              const dash = Math.max(0, length - gap);
              const circle = (
                <Circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={colors[i]}
                  strokeWidth={stroke}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  fill="none"
                />
              );
              offset += length;
              return circle;
            })
          : null}
        </G>
      </Svg>
      {center}
    </View>
  );
}

// horizontal bars with a label and value on each row, longest first
export function RankBars({ rows }: { rows: readonly { key: string; label: string; detail?: string; value: number; valueLabel: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View className="gap-3">
      {rows.map((row, i) => (
        <View key={row.key} accessible accessibilityLabel={`${row.label}, ${row.valueLabel}${row.detail ? `, ${row.detail}` : ''}`} className="gap-1">
          <View className="flex-row items-baseline justify-between gap-3">
            <Text className="shrink font-sans-medium text-base text-ink" numberOfLines={1}>
              {row.label}
              {row.detail ? <Text className="font-sans text-sm text-muted">{`  ${row.detail}`}</Text> : null}
            </Text>
            <Text className="font-display-bold text-base tabular-nums text-ink">{row.valueLabel}</Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-field">
            <View style={{ width: `${Math.max(2, Math.round((row.value / max) * 100))}%` }} className={`h-full rounded-full ${i === 0 ? 'bg-cta' : 'bg-cat-peach'}`} />
          </View>
        </View>
      ))}
    </View>
  );
}
