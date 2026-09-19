export type Period = '7' | '30' | 'half' | 'year' | 'all';
export const PERIODS: { value: Period; label: string }[] = [
  { value: '7', label: '7 天' }, { value: '30', label: '30 天' },
  { value: 'half', label: '半年' }, { value: 'year', label: '一年' }, { value: 'all', label: '全部' },
];
export type MeasurementInput = {
  measuredAt: string;
  timezoneOffset: number;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  arm: string;
  medication: string;
  symptoms: string;
  note: string;
  source: string;
};
export type Measurement = MeasurementInput & { id: string; createdAt: string; updatedAt: string };
export type Candidate = {
  id: string;
  data: Partial<MeasurementInput>;
  sourceLabel: string;
  issues: string[];
  included: boolean;
  duplicate: boolean;
  timeConfirmed: boolean;
};
export type Assessment = {
  id: string; createdAt: string; model: string; period: Period; count: number;
  from: string; to: string; result: AssessmentResult;
};
export type AssessmentResult = {
  overview: string; trends: string[]; factors: string[];
  remeasure: string[]; medicalAdvice: string[]; limitations: string[];
};
export const EMERGENCY = '读数明显升高：请静坐后复测并及时联系医生。如伴胸痛、呼吸困难、严重头痛、肢体无力等症状，请立即拨打 120。';
export const DISCLAIMER = '仅供成年家庭自测参考。单次异常不等于确诊，请勿据此自行增减药量。';
export const COLORS = { primary: '#13776F', ink: '#153B38', muted: '#677D79', bg: '#F4F8F6', line: '#DCE7E3', high: '#B84C27', danger: '#B62D42', low: '#396EAE', normal: '#13776F' };
export function status(record: Pick<MeasurementInput, 'systolic' | 'diastolic'>) {
  const critical = record.systolic >= 180 || record.diastolic >= 120;
  const high = record.systolic >= 135 || record.diastolic >= 85;
  const low = record.systolic < 90 || record.diastolic < 60;
  return { critical, high, low, abnormal: high || low,
    label: critical ? '！明显升高' : high && low ? '！高低值并存' : high ? '↑ 偏高' : low ? '↓ 偏低' : '✓ 参考范围内',
    color: critical ? COLORS.danger : high ? COLORS.high : low ? COLORS.low : COLORS.normal };
}
export function pulseStatus(pulse: number | null | undefined) {
  return pulse == null ? '未记录心率' : pulse < 60 ? '↓ 心率偏慢' : pulse > 100 ? '↑ 心率偏快' : '✓ 静息心率参考范围内';
}
export function validateMeasurement(data: Partial<MeasurementInput>): string[] {
  const errors: string[] = [];
  if (!data.measuredAt || !parseZonedDateTime(data.measuredAt)) errors.push('请填写有效测量时间');
  if (!Number.isInteger(data.timezoneOffset) || Math.abs(data.timezoneOffset!) > 840) errors.push('时区无效');
  if (!Number.isInteger(data.systolic) || data.systolic! < 30 || data.systolic! > 350) errors.push('收缩压须为 30–350 的整数');
  if (!Number.isInteger(data.diastolic) || data.diastolic! < 20 || data.diastolic! > 250) errors.push('舒张压须为 20–250 的整数');
  if (data.systolic != null && data.diastolic != null && data.systolic <= data.diastolic) errors.push('收缩压应高于舒张压，请复核');
  if (data.pulse != null && (!Number.isInteger(data.pulse) || data.pulse < 20 || data.pulse > 300)) errors.push('心率须为 20–300 的整数，或留空');
  for (const field of ['arm', 'medication', 'symptoms', 'note', 'source'] as const) {
    if (data[field] != null && (typeof data[field] !== 'string' || data[field]!.length > 2000)) errors.push('备注或来源过长');
  }
  return errors;
}
export function isExtreme(data: MeasurementInput) {
  return status(data).critical || data.systolic < 70 || data.diastolic < 40 || (data.pulse != null && (data.pulse < 40 || data.pulse > 180));
}
export function periodStart(period: Period, now = new Date()): Date | null {
  if (period === 'all') return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'half' || period === 'year') {
    const day = start.getDate();
    start.setDate(1);
    start.setMonth(start.getMonth() - (period === 'year' ? 12 : 6));
    const last = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    start.setDate(Math.min(day, last));
  } else start.setDate(start.getDate() - Number(period) + 1);
  return start;
}
export function inPeriod(records: Measurement[], period: Period, now = new Date()) {
  const start = periodStart(period, now)?.getTime() ?? -Infinity;
  return records.filter(record => Date.parse(record.measuredAt) >= start && Date.parse(record.measuredAt) <= now.getTime())
    .sort((first, second) => Date.parse(second.measuredAt) - Date.parse(first.measuredAt));
}
export function stats(records: Measurement[]) {
  const pulses = records.flatMap(record => record.pulse == null ? [] : [record.pulse]);
  const mean = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  return { count: records.length, systolic: mean(records.map(record => record.systolic)),
    diastolic: mean(records.map(record => record.diastolic)), pulse: mean(pulses),
    abnormal: records.filter(record => status(record).abnormal).length,
    critical: records.filter(record => status(record).critical).length };
}
export function localDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function localDateTime(date: Date) {
  return `${localDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function parseLocalDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(value.replace(' ', 'T') + ':00');
  return Number.isFinite(parsed.getTime()) && localDateTime(parsed) === value ? parsed : null;
}
export function parseZonedDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, zone, , zoneHours, zoneMinutes] = match;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() + 1 !== Number(month) || calendar.getUTCDate() !== Number(day)) return null;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second ?? 0) > 59) return null;
  if (zone !== 'Z' && (Number(zoneHours) > 14 || Number(zoneMinutes) > 59 || (Number(zoneHours) === 14 && Number(zoneMinutes) !== 0))) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
export function fingerprint(data: Partial<MeasurementInput>) {
  return [data.measuredAt ? Date.parse(data.measuredAt) : '', data.systolic, data.diastolic, data.pulse ?? ''].join('|');
}
export function markDuplicates(candidates: Candidate[], existing: Measurement[]) {
  const seen = new Set(existing.map(fingerprint));
  return candidates.map(candidate => {
    const key = fingerprint(candidate.data);
    const duplicate = seen.has(key);
    seen.add(key);
    return { ...candidate, duplicate, included: !duplicate && candidate.included };
  });
}
export function maskKey(key: string) {
  return key.length <= 12 ? '*'.repeat(key.length) : `${key.slice(0, 4)}${'*'.repeat(12)}${key.slice(-4)}`;
}
export type ChartPoint = { time: number; label: string; systolic: number; diastolic: number; pulse: number | null; minS: number; maxS: number; minD: number; maxD: number; minP: number | null; maxP: number | null; abnormal: boolean; pulseAbnormal: boolean; records: Measurement[] };
export function chartPoints(records: Measurement[], aggregate: boolean): ChartPoint[] {
  const groups = new Map<string, Measurement[]>();
  [...records].sort((first, second) => Date.parse(first.measuredAt) - Date.parse(second.measuredAt)).forEach(record => {
    const key = aggregate ? localDate(new Date(record.measuredAt)) : record.id;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  });
  return [...groups.values()].map(group => {
    const summary = stats(group);
    const pulses = group.flatMap(record => record.pulse == null ? [] : [record.pulse]);
    return { time: Date.parse(group[0].measuredAt), label: aggregate ? localDate(new Date(group[0].measuredAt)) : localDateTime(new Date(group[0].measuredAt)),
      systolic: summary.systolic!, diastolic: summary.diastolic!, pulse: summary.pulse,
      minS: Math.min(...group.map(record => record.systolic)), maxS: Math.max(...group.map(record => record.systolic)),
      minD: Math.min(...group.map(record => record.diastolic)), maxD: Math.max(...group.map(record => record.diastolic)),
      minP: pulses.length ? Math.min(...pulses) : null, maxP: pulses.length ? Math.max(...pulses) : null,
      abnormal: group.some(record => status(record).abnormal), pulseAbnormal: pulses.some(pulse => pulse < 60 || pulse > 100), records: group };
  });
}
