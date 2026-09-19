import * as XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('artifacts', { recursive: true });
const headers = ['测量时间', '收缩压(mmHg)', '舒张压(mmHg)', '心率(次/分)', '测量手臂', '服药前后', '症状', '备注', '异常提示', '来源', 'UTC时间', '时区偏移(分钟)', '记录ID'];
const rows = Array.from({ length: 24 }, (_, index) => {
  const date = new Date(); date.setHours(8, 0, 0, 0); date.setDate(date.getDate() - index);
  const systolic = index % 4 === 0 ? 145 : 118 + index % 15;
  const diastolic = index % 4 === 0 ? 92 : 74 + index % 10;
  return [date.toLocaleString(), systolic, diastolic, index % 5 === 0 ? null : 65 + index % 20, '左臂', '服药前', '无不适', '合成测试记录，不是真实健康数据', '', '合成测试', date.toISOString(), date.getTimezoneOffset(), `synthetic-${index}`];
});
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...rows]), '明细');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['pressure-journal', 1]]), '格式版本');
writeFileSync('artifacts/synthetic-records.xlsx', XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
