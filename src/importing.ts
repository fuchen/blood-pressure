import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Recognition } from './ai-schema';
import { recognizeImage, recognizeTable } from './ai';
import { Candidate, parseLocalDateTime, parseZonedDateTime, MeasurementInput } from './domain';
import { newId } from './storage';
import { TableBatch } from './workbook';
import { ImportContext } from './import-context';

export type ImportBatch = TableBatch | { kind: 'backup'; label: string; records: Partial<MeasurementInput>[] } | { kind: 'image'; label: string; uri: string; width?: number; height?: number; cameraTime?: string };
export function toCandidate(data: Partial<MeasurementInput>, sourceLabel: string, issues: string[] = [], timeConfirmed = true): Candidate {
  return { id: newId(), data, sourceLabel, issues, included: true, duplicate: false, timeConfirmed };
}
export function recognitionCandidates(result: Recognition, batch: ImportBatch): Candidate[] {
  return result.records.map(row => {
    const local = row.measuredAt ? parseLocalDateTime(row.measuredAt) : null;
    const zoned = row.measuredAt ? parseZonedDateTime(row.measuredAt) : null;
    const date = local ?? (zoned && Number.isFinite(zoned.getTime()) ? zoned : null);
    const cameraTime = batch.kind === 'image' ? batch.cameraTime : undefined;
    const issues = [...row.uncertainties];
    if (!date) issues.push(cameraTime ? '未识别到完整时间，已预填拍摄时间，需确认' : '缺少明确的测量日期时间，请补充');
    const offsetMatch = row.measuredAt?.match(/([+-])(\d{2}):(\d{2})$/);
    const timezoneOffset = offsetMatch ? (offsetMatch[1] === '+' ? -1 : 1) * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3])) : row.measuredAt?.endsWith('Z') ? 0 : (date ?? new Date()).getTimezoneOffset();
    return toCandidate({ measuredAt: date?.toISOString() ?? cameraTime ?? '', timezoneOffset,
      systolic: row.systolic ?? undefined, diastolic: row.diastolic ?? undefined, pulse: row.pulse,
      arm: row.arm, medication: row.medication, symptoms: row.symptoms, note: row.note,
      source: batch.kind === 'image' ? '图片识别' : 'Excel 智能导入' }, `${batch.label} · ${row.sourceLabel}`, issues, Boolean(date) && issues.length === 0);
  });
}
export async function runBatch(batch: ImportBatch, signal: AbortSignal, context?: ImportContext) {
  if (signal.aborted) throw new Error('已取消');
  if (batch.kind === 'backup') return { candidates: batch.records.map((data, index) => toCandidate(data, `${batch.label} · 行 ${index + 2}`, [], Boolean(data.measuredAt))), warnings: [] };
  if (batch.kind === 'table') {
    const result = await recognizeTable(batch.table, signal, context);
    return { candidates: recognitionCandidates(result, batch), warnings: result.warnings };
  }
  const actions: ImageManipulator.Action[] = [];
  if (batch.width && batch.height && Math.max(batch.width, batch.height) > 2400) {
    actions.push({ resize: batch.width > batch.height ? { width: 2400 } : { height: 2400 } });
  }
  const image = await ImageManipulator.manipulateAsync(batch.uri, actions, { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  try {
    if (!image.base64 || image.base64.length > 12000000) throw new Error('图片过大，请裁剪后重试');
    const result = await recognizeImage(image.base64, signal, context);
    return { candidates: recognitionCandidates(result, batch), warnings: result.warnings };
  } finally { await FileSystem.deleteAsync(image.uri, { idempotent: true }).catch(() => undefined); }
}
export async function cleanTemporaryImages(batches: ImportBatch[]) {
  for (const batch of batches) {
    if (batch.kind === 'image' && FileSystem.cacheDirectory && batch.uri.startsWith(FileSystem.cacheDirectory)) {
      await FileSystem.deleteAsync(batch.uri, { idempotent: true }).catch(() => undefined);
    }
  }
}
