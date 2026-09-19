import { forwardRef, useEffect } from 'react';
import { Text, View } from 'react-native';
import { Chart } from './Chart';
import { COLORS, DISCLAIMER, Measurement, Period, PERIODS, stats, localDate } from './domain';

export type ReportPayload = { records: Measurement[]; period: Period; page: number; total: number; lines?: string[]; width: number; ready: () => void };
export const ReportPage = forwardRef<View, ReportPayload>(function ReportPage({ records, period, page, total, lines, width, ready }, ref) {
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(ready); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [ready]);
  const summary = stats(records);
  return <View ref={ref} collapsable={false} style={{ width, height: 1060, padding: 20, backgroundColor: 'white', gap: 14 }}>
    <Text allowFontScaling={false} style={{ color: COLORS.primary, fontSize: 23, fontWeight: '800' }}>安心血压 · {page === 0 ? '健康报告' : '测量明细'}</Text>
    <Text allowFontScaling={false} style={{ fontSize: 12, color: COLORS.muted }}>{PERIODS.find(item => item.value === period)!.label} · 共 {records.length} 次测量 · {page + 1}/{total} 页</Text>
    {page === 0 ? <>
      <View style={{ backgroundColor: '#EFF6F1', padding: 18, borderRadius: 15, gap: 8 }}><Text allowFontScaling={false} style={{ fontSize: 13, color: COLORS.muted }}>平均血压 · mmHg</Text><Text allowFontScaling={false} style={{ color: COLORS.primary, fontSize: 34, fontWeight: '800' }}>{summary.systolic}/{summary.diastolic}</Text><Text allowFontScaling={false} style={{ color: COLORS.ink, fontSize: 13 }}>平均心率 {summary.pulse ?? '—'} · 血压异常 {summary.abnormal} 次</Text></View>
      <Chart records={records} aggregate fixedWidth={width - 40} />
      <Chart records={records} aggregate pulse fixedWidth={width - 40} />
      <Text allowFontScaling={false} style={{ color: COLORS.muted, fontSize: 12, lineHeight: 20 }}>范围：{localDate(new Date(records[records.length - 1].measuredAt))} 至 {localDate(new Date(records[0].measuredAt))}（当地日期）{'\n'}家庭血压 ≥135/85 偏高，&lt;90/60 偏低；任一项达到均标记。静息心率参考 60–100 次/分。</Text>
    </> : <View>{lines!.map((line, index) => <Text allowFontScaling={false} key={index} style={{ height: 23, fontSize: 12, color: COLORS.ink, lineHeight: 23 }}>{line || ' '}</Text>)}</View>}
    <View style={{ position: 'absolute', left: 20, right: 20, bottom: 22, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 14 }}><Text allowFontScaling={false} style={{ color: COLORS.muted, fontSize: 11, lineHeight: 18 }}>{DISCLAIMER}{'\n'}{page > 0 ? '明细连续分页，跨页内容接续上一页。' : '趋势按日均值与范围呈现，详细记录见后续页面。'}</Text></View>
  </View>;
});
