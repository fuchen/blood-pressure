import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View, useWindowDimensions } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import { useRecords } from '../src/context';
import { inPeriod, Period } from '../src/domain';
import { cleanOldReports, exportDirectory, exportExcel, ExportFile, saveFiles, shareFiles } from '../src/exporting';
import { detailPages } from '../src/report';
import { ReportPage, ReportPayload } from '../src/ReportPage';
import { Button, Card, Page, PeriodPicker, showError, styles } from '../src/ui';

export default function ExportScreen() {
  const { records } = useRecords();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<Period>('7'); const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<ExportFile[]>([]); const [progress, setProgress] = useState('');
  const [report, setReport] = useState<ReportPayload | null>(null);
  const reportRef = useRef<View>(null); const alive = useRef(true);
  useEffect(() => { alive.current = true; cleanOldReports().catch(() => undefined); return () => { alive.current = false; }; }, []);
  const selected = inPeriod(records, period);
  const action = async (task: () => Promise<void>) => { setBusy(true); try { await task(); } catch (error) { showError(error); } finally { if (alive.current) { setBusy(false); setProgress(''); } } };
  const images = async () => {
    const snapshot = selected;
    const pageWidth = Math.floor(width - 44);
    const pages = detailPages(snapshot, Math.max(12, Math.floor((pageWidth - 40) / 12)), 32);
    const output: ExportFile[] = [];
    const directory = await exportDirectory(); const stamp = Date.now();
    try {
      for (let page = 0; page <= pages.length; page++) {
        if (!alive.current) throw new Error('已取消图片生成');
        setProgress(`正在生成图片 ${page + 1}/${pages.length + 1}`);
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('报告渲染超时，请重试')), 15000);
          setReport({ records: snapshot, period, page, total: pages.length + 1, lines: page ? pages[page - 1] : undefined, width: pageWidth,
            ready: () => { clearTimeout(timeout); resolve(); } });
        });
        if (!alive.current) throw new Error('已取消图片生成');
        const temporary = await captureRef(reportRef, { format: 'png', result: 'tmpfile', width: pageWidth * 2, height: 2120 });
        const name = `安心血压-${stamp}-${String(page + 1).padStart(3, '0')}.png`; const uri = directory + name;
        try { await FileSystem.copyAsync({ from: temporary, to: uri }); } finally { releaseCapture(temporary); }
        output.push({ uri, name, mime: 'image/png' });
      }
      setFiles(output);
    } catch (error) {
      for (const file of output) await FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => undefined);
      throw error;
    }
  };
  return <Page title="导出与分享" back>
    <PeriodPicker value={period} onChange={value => { if (!busy) { setPeriod(value); setFiles([]); setReport(null); } }} />
    <Card><Text style={styles.heading}>将导出 {selected.length} 条记录</Text><Button title="生成 Excel" disabled={busy || !selected.length} onPress={() => action(async () => { setReport(null); setFiles([await exportExcel(selected, period)]); })} /><Button title="生成报告图片" secondary disabled={busy || !selected.length} onPress={() => action(images)} />{progress ? <Text style={styles.text}>{progress}</Text> : null}</Card>
    {files.length > 0 && <Card><Text style={styles.heading}>已生成 {files.length} 个文件</Text><Text style={styles.muted}>{files[0].name}{files.length > 1 ? ' 等' : ''}</Text><Button title="分享给其他 App" disabled={busy} onPress={() => action(() => shareFiles(files))} /><Button title="保存到文件夹" secondary disabled={busy} onPress={() => action(async () => { if (await saveFiles(files)) Alert.alert('保存成功', `已保存 ${files.length} 个文件`); })} /></Card>}
    {report && <ReportPage key={`${report.page}-${report.total}`} ref={reportRef} {...report} />}
  </Page>;
}
