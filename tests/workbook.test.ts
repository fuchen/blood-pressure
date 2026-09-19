import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { makeWorkbook, readWorkbook } from '../src/workbook';
import { detailPages } from '../src/report';
import { Measurement, Period } from '../src/domain';

const record: Measurement = { id: 'excel-test', measuredAt: '2026-09-19T03:45:12.000Z', timezoneOffset: -480, systolic: 135, diastolic: 85, pulse: null, arm: '左臂', medication: '服药后', symptoms: '无', note: '=HYPERLINK("https://example.com")', source: '图片识别', createdAt: '2026-09-19T03:45:12.000Z', updatedAt: '2026-09-19T03:45:12.000Z' };
describe('Excel 导入导出', () => {
  it.each<Period>(['7', '30', 'half', 'all'])('范围 %s 可往返，不丢失时间精度、时区和中文备注', period => {
    const base64 = makeWorkbook([record], period);
    const parsed = readWorkbook(base64);
    const { id, createdAt, updatedAt, ...input } = record;
    expect(parsed.ownRecords).toEqual([input]);
    const workbook = XLSX.read(base64, { type: 'base64' });
    expect(workbook.Sheets['明细']['H2'].t).toBe('s');
    expect(workbook.Sheets['明细']['H2'].f).toBeUndefined();
  });
  it('多工作表、中文表头、Excel日期按40行切分，不遗漏行', () => {
    const workbook = XLSX.utils.book_new();
    const rows = [['时间', '收缩压', '舒张压'], ...Array.from({ length: 85 }, () => [new Date(2026, 8, 19, 8), 120, 80])];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), '早间');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['日期', '血压'], ['2026-09-19 20:00', '130/85']]), '晚间');
    const result = readWorkbook(XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }));
    expect(result.ownRecords).toBeNull();
    expect(result.batches).toHaveLength(4);
    expect(result.batches.reduce((sum, batch) => sum + batch.table.rows.length, 0)).toBe(88);
    expect(JSON.stringify(result.batches)).toContain('2026-09-19');
  });
  it('支持旧版 xls 工作簿', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['血压'], ['120/80']]), '测量');
    expect(readWorkbook(XLSX.write(workbook, { type: 'base64', bookType: 'biff8' })).batches).toHaveLength(1);
  });
  it('备注很长时分页仍保留完整文本', () => {
    const note = '这是一段很长的中文备注'.repeat(120);
    const pages = detailPages([{ ...record, note }], 24, 32);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every(page => page.length <= 32)).toBe(true);
    expect(pages.flat().join('')).toContain(note);
  });
});
