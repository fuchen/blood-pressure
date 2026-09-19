import * as FileSystem from 'expo-file-system/legacy';
import Share from 'react-native-share';
import { Measurement, Period } from './domain';
import { makeWorkbook } from './workbook';

export type ExportFile = { uri: string; name: string; mime: string };
export async function exportDirectory() {
  const directory = `${FileSystem.cacheDirectory}reports/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
}
export async function exportExcel(records: Measurement[], period: Period): Promise<ExportFile> {
  const name = `安心血压-${period}-${Date.now()}.xlsx`;
  const uri = `${await exportDirectory()}${name}`;
  await FileSystem.writeAsStringAsync(uri, makeWorkbook(records, period), { encoding: FileSystem.EncodingType.Base64 });
  return { uri, name, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}
export async function shareFiles(files: ExportFile[]) {
  if (!files.length) return;
  await Share.open({ urls: files.map(file => file.uri), type: files[0].mime, title: '分享血压报告', failOnCancel: false });
}
export async function saveFiles(files: ExportFile[]) {
  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return false;
  let count = 0;
  try {
    for (const file of files) {
      const target = await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, file.name, file.mime);
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.writeAsStringAsync(target, content, { encoding: FileSystem.EncodingType.Base64 });
      count++;
    }
    return true;
  } catch { throw new Error(`保存中断，已保存 ${count}/${files.length} 个文件，请检查空间和目录权限。`); }
}
export async function cleanOldReports() {
  const directory = await exportDirectory();
  for (const name of await FileSystem.readDirectoryAsync(directory)) {
    const file = `${directory}${name}`;
    const info = await FileSystem.getInfoAsync(file);
    if (info.exists && info.modificationTime && Date.now() / 1000 - info.modificationTime > 86400) await FileSystem.deleteAsync(file, { idempotent: true });
  }
}
export async function clearReportCache() {
  const directory = await exportDirectory();
  await FileSystem.deleteAsync(directory, { idempotent: true });
}
