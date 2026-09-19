import * as XLSX from 'xlsx';
import { Measurement, MeasurementInput, Period, PERIODS, stats, status, localDateTime } from './domain';

export const HEADERS = ['测量时间', '收缩压(mmHg)', '舒张压(mmHg)', '心率(次/分)', '测量手臂', '服药前后', '症状', '备注', '异常提示', '来源', 'UTC时间', '时区偏移(分钟)', '记录ID'];
export function makeWorkbook(records: Measurement[], period: Period): string {
  const summary = stats(records);
  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['安心血压 · 健康记录'], ['导出范围', PERIODS.find(item => item.value === period)!.label],
    ['生成时间', localDateTime(new Date())], ['记录数', summary.count], ['平均收缩压', summary.systolic],
    ['平均舒张压', summary.diastolic], ['平均心率', summary.pulse], ['异常血压记录数', summary.abnormal],
    ['参考标准', '中国成年家庭血压：≥135/85 偏高；<90/60 偏低（任一项达到）'],
    ['说明', '单次异常不代表确诊。时间按导出设备当地时区显示，原始 UTC 时间与时区偏移保留在明细中。'],
  ]);
  summarySheet['!cols'] = [{ wch: 26 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, '汇总');
  const detail = XLSX.utils.aoa_to_sheet([HEADERS, ...records.map(record => [
    localDateTime(new Date(record.measuredAt)), record.systolic, record.diastolic, record.pulse,
    record.arm, record.medication, record.symptoms, record.note, status(record).label,
    record.source, record.measuredAt, record.timezoneOffset, record.id,
  ])]);
  detail['!cols'] = HEADERS.map((_, index) => ({ wch: index === 0 || index === 10 ? 27 : index >= 6 ? 30 : 18 }));
  detail['!autofilter'] = { ref: detail['!ref']! };
  XLSX.utils.book_append_sheet(workbook, detail, '明细');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['pressure-journal', 1]]), '格式版本');
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
}
export type TableBatch = { kind: 'table'; label: string; table: { sheet: string; headerContext: unknown[][]; rows: { row: number; cells: unknown[] }[] } };
export type WorkbookData = { ownRecords: Partial<MeasurementInput>[] | null; batches: TableBatch[] };
export function readWorkbook(base64: string): WorkbookData {
  const workbook = XLSX.read(base64, { type: 'base64', cellDates: false });
  const version = workbook.Sheets['格式版本'] ? XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['格式版本'], { header: 1 }) : [];
  if (version[0]?.[0] === 'pressure-journal' && version[0]?.[1] === 1 && workbook.Sheets['明细']) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets['明细'], { defval: null });
    const ownRecords = rows.map(row => ({
      measuredAt: String(row['UTC时间'] ?? ''), timezoneOffset: Number(row['时区偏移(分钟)']),
      systolic: Number(row['收缩压(mmHg)']), diastolic: Number(row['舒张压(mmHg)']),
      pulse: row['心率(次/分)'] == null ? null : Number(row['心率(次/分)']),
      arm: String(row['测量手臂'] ?? ''), medication: String(row['服药前后'] ?? ''),
      symptoms: String(row['症状'] ?? ''), note: String(row['备注'] ?? ''), source: String(row['来源'] ?? 'Excel 备份'),
    }));
    return { ownRecords, batches: [] };
  }
  const batches: TableBatch[] = [];
  let total = 0;
  for (const sheet of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, raw: false, defval: '', blankrows: true, dateNF: 'yyyy-mm-dd hh:mm' });
    total += rows.length;
    if (total > 10000) throw new Error('单次最多导入 10000 行，请拆分文件');
    const nonempty = rows.map((cells, index) => ({ row: index + 1, cells })).filter(row => row.cells.some(cell => cell !== ''));
    const headerContext = rows.slice(0, 3);
    for (let offset = 0; offset < nonempty.length; offset += 40) {
      const section = nonempty.slice(offset, offset + 40);
      const table = { sheet, headerContext, rows: section };
      if (JSON.stringify(table).length > 60000) throw new Error(`工作表「${sheet}」内容过宽，请移除无关列后重试`);
      batches.push({ kind: 'table', label: `${sheet} · 行 ${section[0].row}–${section[section.length - 1].row}`, table });
    }
  }
  return { ownRecords: null, batches };
}
