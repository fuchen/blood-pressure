import React from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { COLORS, localDateTime, MeasurementInput, status } from './domain';
import { Icon, styles } from './ui';

export type RecordRow = { id: string; data: Partial<MeasurementInput>; detail?: string; included?: boolean };
export function RecordTable({ rows, onPress, onToggle, disabled = false, compact = false }: { rows: RecordRow[]; onPress: (id: string) => void; onToggle?: (id: string) => void; disabled?: boolean; compact?: boolean }) {
  const { fontScale, width } = useWindowDimensions();
  const scale = Math.max(1, fontScale);
  const widths = [112, 88, 62, 102].map(value => value * scale);
  const cell = (text: string, column: number, color = COLORS.ink) => <Text style={[styles.text, { width: widths[column], padding: 10, color }]}>{text}</Text>;
  if (compact) return <View style={{ backgroundColor: 'white', borderRadius: 12, overflow: 'hidden' }}>
    <View style={{ flexDirection: 'row', backgroundColor: '#E6F0EB', padding: 14, gap: 16 }}><Text style={[styles.label, { flex: 1, marginBottom: 0 }]}>时间</Text><Text style={[styles.label, { flex: 1, marginBottom: 0 }]}>血压 / 心率</Text></View>
    {rows.map(row => {
      const state = row.data.systolic != null && row.data.diastolic != null ? status(row.data as MeasurementInput) : null;
      const [date, time] = row.data.measuredAt && Number.isFinite(Date.parse(row.data.measuredAt)) ? localDateTime(new Date(row.data.measuredAt)).split(' ') : ['待补充', '—'];
      const pulse = row.data.pulse;
      const pressureMark = state?.critical ? ' !' : state?.high && state?.low ? ' ↕' : state?.high ? ' ↑' : state?.low ? ' ↓' : '';
      const pulseMark = pulse != null && pulse < 60 ? ' ↓' : pulse != null && pulse > 100 ? ' ↑' : '';
      const fittedText = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.65, maxFontSizeMultiplier: 1.5 };
      return <Pressable key={row.id} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${date} ${time}，血压 ${row.data.systolic ?? '缺失'}/${row.data.diastolic ?? '缺失'}，${state?.label ?? ''}，心率 ${pulse ?? '未记录'}${pulseMark}，编辑`} onPress={() => onPress(row.id)} style={{ flexDirection: 'row', padding: 14, gap: 16, borderBottomWidth: 1, borderBottomColor: COLORS.line }}>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}><Text {...fittedText} style={styles.text}>{date}</Text><Text {...fittedText} style={styles.muted}>{time}</Text></View>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}><Text {...fittedText} style={[styles.text, { fontWeight: '700', color: state?.color }]}>{row.data.systolic ?? '—'}/{row.data.diastolic ?? '—'}{pressureMark}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="heart" size={17 * Math.min(scale, 1.5)} color={pulseMark ? COLORS.high : COLORS.muted} /><Text {...fittedText} style={[styles.muted, { flex: 1, color: pulseMark ? COLORS.high : COLORS.muted }]}>{pulse ?? '—'}{pulseMark}</Text></View>
        </View>
      </Pressable>;
    })}
  </View>;
  return <ScrollView horizontal showsHorizontalScrollIndicator persistentScrollbar>
    <View style={{ minWidth: width - 44, backgroundColor: 'white', borderRadius: 12, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', backgroundColor: '#E6F0EB' }}>{onToggle && <View style={{ width: 52 * scale }} />}{cell('时间', 0)}{cell('血压\nmmHg', 1)}{cell('心率', 2)}{cell('状态', 3)}</View>
      {rows.map(row => {
        const state = row.data.systolic != null && row.data.diastolic != null ? status(row.data as MeasurementInput) : null;
        const time = row.data.measuredAt && Number.isFinite(Date.parse(row.data.measuredAt)) ? localDateTime(new Date(row.data.measuredAt)).replace(' ', '\n') : '待补充';
        const pulse = row.data.pulse;
        return <View key={row.id} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.line }}>
          {onToggle && <Pressable disabled={disabled} accessibilityRole="checkbox" accessibilityLabel={`选择 ${time}`} accessibilityState={{ checked: row.included }} onPress={() => onToggle(row.id)} style={{ width: 52 * scale, justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontSize: 22, color: COLORS.primary }}>{row.included ? '☑' : '☐'}</Text></Pressable>}
          <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`${time}，血压 ${row.data.systolic ?? '缺失'}/${row.data.diastolic ?? '缺失'}，心率 ${pulse ?? '未记录'}，${row.detail || state?.label || '待核对'}，编辑`} onPress={() => onPress(row.id)} style={{ flexDirection: 'row' }}>
            {cell(time, 0)}{cell(`${row.data.systolic ?? '—'}/${row.data.diastolic ?? '—'}`, 1, state?.color)}{cell(`${pulse ?? '—'}${pulse != null && pulse < 60 ? ' ↓' : pulse != null && pulse > 100 ? ' ↑' : ''}`, 2, pulse != null && (pulse < 60 || pulse > 100) ? COLORS.high : COLORS.ink)}{cell(row.detail || state?.label.replace('参考范围内', '范围内') || '待核对', 3, row.detail ? COLORS.high : state?.color)}
          </Pressable>
        </View>;
      })}
    </View>
  </ScrollView>;
}
