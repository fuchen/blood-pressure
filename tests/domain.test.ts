import { describe, expect, it } from 'vitest';
import { chartPoints, fingerprint, inPeriod, maskKey, markDuplicates, Measurement, parseLocalDateTime, parseZonedDateTime, periodStart, stats, status, validateMeasurement } from '../src/domain';

export const sample = (extra: Partial<Measurement> = {}): Measurement => ({ id: 'one', measuredAt: '2026-09-19T08:00:00.000Z', timezoneOffset: 0, systolic: 120, diastolic: 80, pulse: 72, arm: '左臂', medication: '服药前', symptoms: '', note: '', source: '手动记录', createdAt: '2026-09-19T08:00:00.000Z', updatedAt: '2026-09-19T08:00:00.000Z', ...extra });
describe('家庭血压规则', () => {
  it.each([[134, 84, false], [135, 84, true], [134, 85, true], [90, 60, false], [89, 60, true], [90, 59, true]])('边界 %s/%s', (systolic, diastolic, abnormal) => expect(status({ systolic, diastolic }).abnormal).toBe(abnormal));
  it('任一危险阈值触发，并保留高低并存状态', () => {
    expect(status({ systolic: 180, diastolic: 80 }).critical).toBe(true);
    expect(status({ systolic: 170, diastolic: 120 }).critical).toBe(true);
    expect(status({ systolic: 179, diastolic: 119 }).critical).toBe(false);
    expect(status({ systolic: 140, diastolic: 55 }).label).toContain('并存');
  });
  it('拒绝倒置、非整数、缺失时间，同时允许心率空值', () => {
    expect(validateMeasurement(sample({ pulse: null }))).toEqual([]);
    expect(validateMeasurement(sample({ systolic: 80, diastolic: 120 })).length).toBeGreaterThan(0);
    expect(validateMeasurement(sample({ pulse: 72.5 })).length).toBeGreaterThan(0);
    expect(validateMeasurement({ systolic: 120, diastolic: 80 }).length).toBeGreaterThan(0);
  });
});
describe('时间与统计', () => {
  it('7天包含今天并排除未来', () => {
    const now = new Date(2026, 8, 19, 12);
    const edge = new Date(2026, 8, 13);
    const rows = [sample({ id: 'edge', measuredAt: edge.toISOString() }), sample({ id: 'early', measuredAt: new Date(edge.getTime() - 1).toISOString() }), sample({ id: 'future', measuredAt: new Date(now.getTime() + 1).toISOString() })];
    expect(inPeriod(rows, '7', now).map(row => row.id)).toEqual(['edge']);
    expect(periodStart('30', now)).toEqual(new Date(2026, 7, 21));
  });
  it('半年在月底正确回溯到二月末', () => {
    expect(periodStart('half', new Date(2026, 7, 31))).toEqual(new Date(2026, 1, 28));
    expect(periodStart('all')).toBeNull();
  });
  it('一年按日历月回溯，闰日夹取并包含起点', () => {
    const now = new Date(2024, 1, 29, 12);
    const edge = new Date(2023, 1, 28);
    expect(periodStart('year', now)).toEqual(edge);
    expect(inPeriod([sample({ id: 'edge', measuredAt: edge.toISOString() }), sample({ id: 'early', measuredAt: new Date(edge.getTime() - 1).toISOString() })], 'year', now).map(row => row.id)).toEqual(['edge']);
  });
  it('拒绝无效日期，解析不改变本地时间', () => {
    expect(parseLocalDateTime('2026-02-30 08:00')).toBeNull();
    expect(parseLocalDateTime('2026-09-19 24:00')).toBeNull();
    expect(parseLocalDateTime('2026-09-19 08:30')?.getHours()).toBe(8);
  });
  it('拒绝带时区的无效日历日期，避免自动顺延', () => {
    expect(parseZonedDateTime('2026-02-30T08:00:00+08:00')).toBeNull();
    expect(parseZonedDateTime('2026-09-19T24:00:00Z')).toBeNull();
    expect(parseZonedDateTime('2026-09-19T08:00:00+15:00')).toBeNull();
    expect(parseZonedDateTime('2026-09-19T08:00:00+08:00')?.toISOString()).toBe('2026-09-19T00:00:00.000Z');
  });
  it('缺失心率不作为0参与均值，日聚合保留危险峰值', () => {
    const rows = [sample({ systolic: 120, pulse: null }), sample({ id: 'two', systolic: 180, pulse: 80 })];
    expect(stats(rows)).toMatchObject({ systolic: 150, pulse: 80, abnormal: 1, critical: 1 });
    expect(chartPoints(rows, true)[0]).toMatchObject({ minS: 120, maxS: 180, abnormal: true, systolic: 150 });
    expect(stats([]).pulse).toBeNull();
  });
});
describe('重复检测与密钥', () => {
  it('等价ISO时间能识别重复，心率不同则保留', () => {
    const record = sample();
    expect(fingerprint(record)).toBe(fingerprint({ ...record, measuredAt: '2026-09-19T16:00:00+08:00' }));
    const candidates = [record, { ...record, pulse: 80 }, { ...record, pulse: 80 }].map((data, index) => ({ id: String(index), data, sourceLabel: '测试', issues: [], included: true, duplicate: false, timeConfirmed: true }));
    expect(markDuplicates(candidates, [record]).map(candidate => candidate.included)).toEqual([false, true, false]);
  });
  it('短密钥不显示，长密钥仅显示头尾', () => {
    expect(maskKey('123456')).toBe('******');
    expect(maskKey('abcd-SECRET-efgh')).toBe('abcd************efgh');
  });
});
