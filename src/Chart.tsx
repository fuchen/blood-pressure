import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { chartPoints, COLORS, Measurement } from './domain';
import { styles } from './ui';

export function Chart({ records, aggregate = false, pulse = false, fixedWidth }: { records: Measurement[]; aggregate?: boolean; pulse?: boolean; fixedWidth?: number }) {
  const [width, setWidth] = useState(fixedWidth ?? 300);
  const [selected, setSelected] = useState<number | null>(null);
  const points = useMemo(() => chartPoints(records, aggregate), [records, aggregate]);
  const values = points.flatMap(point => pulse ? point.minP == null ? [] : [point.minP, point.maxP!] : [point.minD, point.maxS]);
  if (!values.length) return <Text allowFontScaling={!fixedWidth} style={styles.muted}>{pulse ? '暂无心率数据' : '暂无趋势数据'}</Text>;
  const low = Math.floor((Math.min(...values, pulse ? 60 : 60) - 15) / 10) * 10;
  const high = Math.ceil((Math.max(...values, pulse ? 100 : 135) + 15) / 10) * 10;
  const left = 34; const right = width - 14; const top = 22; const bottom = 180;
  const firstTime = points[0].time; const span = points[points.length - 1].time - firstTime;
  const horizontal = (index: number) => span ? left + (points[index].time - firstTime) / span * (right - left) : (left + right) / 2;
  const vertical = (value: number) => bottom - (value - low) / (high - low) * (bottom - top);
  const keys = pulse ? ['pulse'] as const : ['systolic', 'diastolic'] as const;
  const current = selected == null ? null : points[selected];
  return <View onLayout={event => { if (!fixedWidth) setWidth(event.nativeEvent.layout.width); }} style={{ gap: 8 }}>
    <View style={styles.between}><Text allowFontScaling={!fixedWidth} style={styles.heading}>{pulse ? '心率趋势' : '血压趋势'}</Text><Text allowFontScaling={!fixedWidth} style={styles.muted}>{pulse ? '次/分' : 'mmHg'}</Text></View>
    <Svg width={width} height={215}>
      {[low, Math.round((low + high) / 2), high].map(value => <React.Fragment key={value}><Line x1={left} y1={vertical(value)} x2={right} y2={vertical(value)} stroke={COLORS.line} /><SvgText x={left - 6} y={vertical(value) + 4} fill={COLORS.muted} fontSize={10} textAnchor="end">{value}</SvgText></React.Fragment>)}
      {(pulse ? [60, 100] : [60, 85, 90, 135]).map(value => {
        const color = pulse || value === 90 || value === 135 ? COLORS.primary : COLORS.low;
        return <React.Fragment key={value}><Line x1={left} y1={vertical(value)} x2={right} y2={vertical(value)} stroke={color} strokeOpacity={0.7} strokeDasharray="4 5" /><SvgText x={right} y={vertical(value) - 3} fill={color} fontSize={9} textAnchor="end">{value}</SvgText></React.Fragment>;
      })}
      {keys.map((key, series) => {
        const color = series === 0 ? COLORS.primary : COLORS.low;
        const valid = points.map((point, index) => ({ point, index })).filter(({ point }) => point[key] != null);
        return <React.Fragment key={key}>
          <Polyline points={valid.map(({ point, index }) => `${horizontal(index)},${vertical(point[key]!)}`).join(' ')} stroke={color} strokeWidth={2.2} fill="none" />
          {valid.map(({ point, index }) => <React.Fragment key={index}>
            {aggregate && <Line x1={horizontal(index)} x2={horizontal(index)} y1={vertical(pulse ? point.minP! : series ? point.minD : point.minS)} y2={vertical(pulse ? point.maxP! : series ? point.maxD : point.maxS)} stroke={color} strokeOpacity={0.35} strokeWidth={5} />}
            <Circle cx={horizontal(index)} cy={vertical(point[key]!)} r={selected === index ? 6 : 3.5} fill={(pulse ? point.pulseAbnormal : point.abnormal) ? COLORS.high : color} />
            <Circle cx={horizontal(index)} cy={vertical(point[key]!)} r={14} fill="transparent" onPress={() => setSelected(index)} />
          </React.Fragment>)}
        </React.Fragment>;
      })}
      <SvgText x={left} y={204} fontSize={10} fill={COLORS.muted}>{points[0].label.slice(5, 10)}</SvgText>
      <SvgText x={right} y={204} fontSize={10} fill={COLORS.muted} textAnchor="end">{points[points.length - 1].label.slice(5, 10)}</SvgText>
    </Svg>
    <Text allowFontScaling={!fixedWidth} style={styles.muted}>{pulse ? '心率 · 虚线 60–100' : '绿：收缩压 · 虚线 90–135\n蓝：舒张压 · 虚线 60–85'} · 橙点：异常{aggregate ? '\n日均值 · 竖线为范围' : ''}</Text>
    {current && <Text allowFontScaling={!fixedWidth} style={[styles.muted, { color: COLORS.primary }]}>{current.label} · {current.records.length} 次测量{'\n'}{pulse ? `心率 ${current.pulse}，范围 ${current.minP}–${current.maxP}` : `血压 ${current.systolic}/${current.diastolic}，收缩压范围 ${current.minS}–${current.maxS}，舒张压范围 ${current.minD}–${current.maxD}`}</Text>}
  </View>;
}
