import { localDateTime, Measurement, pulseStatus, status } from './domain';

export function detailPages(records: Measurement[], columns = 24, linesPerPage = 30): string[][] {
  const lines: string[] = [];
  const wrap = (text: string) => {
    for (const paragraph of text.split(/\r?\n/)) {
      const chars = Array.from(paragraph);
      if (!chars.length) lines.push('');
      for (let offset = 0; offset < chars.length; offset += columns) lines.push(chars.slice(offset, offset + columns).join(''));
    }
  };
  records.forEach((record, index) => {
    wrap(`${index + 1}. ${localDateTime(new Date(record.measuredAt))}`);
    wrap(`${record.systolic}/${record.diastolic} mmHg · 心率 ${record.pulse ?? '—'}`);
    wrap(`${status(record).label} · ${pulseStatus(record.pulse)}`);
    if (record.arm || record.medication) wrap(`背景：${record.arm} ${record.medication}`);
    if (record.symptoms) wrap(`症状：${record.symptoms}`);
    if (record.note) wrap(`备注：${record.note}`);
    wrap(`来源：${record.source}`);
    lines.push('');
  });
  const pages: string[][] = [];
  for (let offset = 0; offset < lines.length; offset += linesPerPage) pages.push(lines.slice(offset, offset + linesPerPage));
  return pages;
}
