import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRecords } from '../src/context';
import { Candidate, fingerprint, isExtreme, markDuplicates, MeasurementInput, validateMeasurement } from '../src/domain';
import { cleanTemporaryImages, ImportBatch, runBatch } from '../src/importing';
import { commitImport, loadDraft, newId, saveDraft } from '../src/storage';
import { readWorkbook } from '../src/workbook';
import { Button, Card, confirm, ensureAI, Field, Notice, Page, showError, styles } from '../src/ui';
import { RecordTable } from '../src/RecordTable';
import { RecordForm } from '../src/RecordForm';
import { importContext, ImportContext } from '../src/import-context';

type Job = { id: string; batch: ImportBatch; context?: ImportContext; state: 'pending' | 'running' | 'done' | 'failed'; message: string };
export default function ImportScreen() {
  const { records, refresh } = useRecords();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const draftRef = useRef<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const jobsRef = useRef<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);
  const [instructions, setInstructions] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const pendingSave = useRef(Promise.resolve());
  const updateDraft = (next: Candidate[]) => {
    draftRef.current = next; setCandidates(next);
    pendingSave.current = pendingSave.current.catch(() => undefined).then(() => saveDraft(next));
    pendingSave.current.catch(showError);
    return pendingSave.current;
  };
  const updateJobs = (next: Job[]) => { jobsRef.current = next; setJobs(next); };
  useEffect(() => {
    alive.current = true;
    loadDraft().then(draft => { if (alive.current) { const restored = markDuplicates(draft, records); draftRef.current = restored; setCandidates(restored); setReady(true); } }).catch(showError);
    return () => { alive.current = false; abortRef.current?.abort(); void cleanTemporaryImages(jobsRef.current.map(job => job.batch)); };
  }, []);
  const process = async (queue: Job[]) => {
    const context = importContext('', instructions);
    setBusy(true);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      for (const job of queue) {
        if (controller.signal.aborted || !alive.current) break;
        updateJobs(jobsRef.current.map(item => item.id === job.id ? { ...item, context, state: 'running', message: '' } : item));
        try {
          const result = await runBatch(job.batch, controller.signal, context);
          if (controller.signal.aborted || !alive.current) break;
          const additions = markDuplicates([...draftRef.current, ...result.candidates], records).slice(draftRef.current.length);
          await updateDraft([...draftRef.current, ...additions]);
          updateJobs(jobsRef.current.map(item => item.id === job.id ? { ...item, state: 'done', message: `${result.candidates.length} 条待核对。${result.warnings.join('；')}${result.candidates.length ? '' : '未找到可识别记录，请换图或手动录入。'}` } : item));
          await cleanTemporaryImages([job.batch]);
        } catch (error) {
          if (!alive.current) break;
          updateJobs(jobsRef.current.map(item => item.id === job.id ? { ...item, state: 'failed', message: error instanceof Error ? error.message : '识别失败' } : item));
        }
      }
    } finally {
      if (alive.current) { updateJobs(jobsRef.current.map(job => job.state === 'running' ? { ...job, state: 'failed', message: '已取消，可重试' } : job)); setBusy(false); }
      abortRef.current = null;
    }
  };
  const addBatches = async (batches: ImportBatch[]) => {
    const additions = batches.map(batch => ({ id: newId(), batch, state: 'pending' as const, message: '' }));
    updateJobs([...jobsRef.current, ...additions]);
  };
  const pickImages = async () => {
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 20, quality: 0.9 });
      if (result.canceled) return;
      await addBatches(result.assets.map((asset, index) => ({ kind: 'image', label: asset.fileName || `图片 ${index + 1}`, uri: asset.uri, width: asset.width, height: asset.height })));
    } catch (error) { showError(error); } finally { if (alive.current) setBusy(false); }
  };
  const pickExcel = async () => {
    setBusy(true);
    let uri: string | undefined;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0]; uri = file.uri;
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('请选择 .xls 或 .xlsx 文件');
      if ((file.size ?? 0) > 15 * 1024 * 1024) throw new Error('文件超过 15 MB，请拆分后导入');
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      const workbook = readWorkbook(base64);
      if (workbook.ownRecords) {
        await addBatches([{ kind: 'backup', label: file.name, records: workbook.ownRecords }]);
      } else {
        if (!workbook.batches.length) throw new Error('表格中没有可读取的行');
        await addBatches(workbook.batches);
      }
    } catch (error) { showError(error); } finally {
      if (uri && FileSystem.cacheDirectory && uri.startsWith(FileSystem.cacheDirectory)) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
      if (alive.current) setBusy(false);
    }
  };
  const commit = async () => {
    const selected = candidates.filter(candidate => candidate.included);
    const unresolved = selected.filter(candidate => !candidate.timeConfirmed || candidate.issues.length || validateMeasurement(candidate.data).length);
    if (unresolved.length) { Alert.alert('请先核对', `${unresolved.length} 条记录仍有疑问、缺失或格式错误。请编辑确认，或取消勾选。`); return; }
    if (!selected.length) return;
    if (selected.some(candidate => isExtreme(candidate.data as MeasurementInput)) && !await confirm('存在极端读数', '请确认识别数值无误。严重升高或伴危险症状时请及时就医。是否继续保存？')) return;
    setBusy(true);
    try {
      await pendingSave.current;
      const remaining = candidates.filter(candidate => !candidate.included);
      await commitImport(selected.map(candidate => candidate.data as MeasurementInput), remaining);
      draftRef.current = remaining; setCandidates(remaining);
      await refresh(); Alert.alert('已保存', `成功导入 ${selected.length} 条记录`);
    } catch (error) { showError(error); } finally { setBusy(false); }
  };
  const startImport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const queue = jobsRef.current.filter(job => job.state === 'pending' || job.state === 'failed');
      importContext('', instructions);
      if (queue.some(job => job.batch.kind !== 'backup') && !await ensureAI()) return;
      await process(queue);
    } catch (error) { showError(error); } finally { if (alive.current) setBusy(false); }
  };
  const active = candidates.find(candidate => candidate.id === editing);
  return <Page title="批量导入" back>
    <Card>
      <Button title="选择图片" secondary onPress={pickImages} disabled={busy || !ready} />
      <Button title="选择 Excel 文件" secondary onPress={pickExcel} disabled={busy || !ready} />
      <Field label="补充说明（可选）" testID="import-instructions" placeholder="例如：缺少年份时使用 2025 年；左列为早晨" multiline maxLength={2000} value={instructions} onChangeText={setInstructions} editable={!busy} />
      <Button title="开始导入" testID="start-import" onPress={startImport} busy={busy} disabled={!ready || !jobs.some(job => job.state === 'pending' || job.state === 'failed')} />
    </Card>
    {jobs.length > 0 && <Card>{jobs.map(job => <View key={job.id} style={{ gap: 8 }}>
      <Text style={styles.muted}>{job.state === 'done' ? '✓' : job.state === 'failed' ? '！' : job.state === 'running' ? '◌' : '·'} {job.batch.label}：{job.message || (job.state === 'running' ? '识别中…' : '待导入')}</Text>
      {!busy && job.state !== 'done' && <Pressable accessibilityRole="button" accessibilityLabel={`移除 ${job.batch.label}`} onPress={async () => { updateJobs(jobsRef.current.filter(item => item.id !== job.id)); await cleanTemporaryImages([job.batch]); }}><Text style={{ color: '#A44B2C' }}>移除</Text></Pressable>}
    </View>)}
      {busy && abortRef.current && <Button title="取消识别" secondary onPress={() => abortRef.current?.abort()} />}
    </Card>}
    {candidates.length > 0 && <>
      <View style={styles.between}><Text style={styles.heading}>识别结果 · {candidates.length} 条</Text><Pressable disabled={busy} onPress={async () => { if (await confirm('清空预览', '放弃当前未保存的结果？')) { await updateDraft([]); setEditing(null); } }}><Text style={styles.muted}>清空</Text></Pressable></View>
      <RecordTable disabled={busy} rows={candidates.slice(0, limit).map(candidate => ({ id: candidate.id, data: candidate.data, included: candidate.included, detail: candidate.duplicate ? '疑似重复' : !candidate.timeConfirmed ? '时间待确认' : candidate.issues.length || validateMeasurement(candidate.data).length ? '待核对' : '' }))} onPress={setEditing} onToggle={id => { void updateDraft(candidates.map(item => item.id === id ? { ...item, included: !item.included } : item)); }} />
      {active && !busy && <Modal visible transparent animationType="fade" onRequestClose={() => setEditing(null)}><View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#00000066' }}><Card style={{ maxHeight: '90%' }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
        <Text style={styles.muted}>{active.sourceLabel}</Text>
        {active.issues.length > 0 && <Notice>{active.issues.join('；')}</Notice>}
        <RecordForm key={active.id} initial={active.data} label="确认修改" onSave={async data => {
          const duplicate = records.some(record => fingerprint(record) === fingerprint(data)) || candidates.some(item => item.id !== active.id && fingerprint(item.data) === fingerprint(data));
          await updateDraft(candidates.map(item => item.id === active.id ? { ...item, data, timeConfirmed: true, issues: [], duplicate, included: !duplicate } : item)); setEditing(null);
        }} />
        <Button title="取消编辑" secondary onPress={() => setEditing(null)} />
      </ScrollView></Card></View></Modal>}
      {candidates.length > limit && <Button title="显示更多" secondary onPress={() => setLimit(limit + 30)} />}
      <Button title={`确认导入 ${candidates.filter(candidate => candidate.included).length} 条`} disabled={busy || !candidates.some(candidate => candidate.included)} onPress={commit} />
    </>}
  </Page>;
}
