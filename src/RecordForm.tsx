import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Candidate, MeasurementInput, localDateTime, parseLocalDateTime, validateMeasurement, isExtreme, EMERGENCY, status } from './domain';
import { AdaptiveColumns, Button, Field, Notice, SelectField, confirm, ensureAI, showError, styles } from './ui';
import { cleanTemporaryImages, ImportBatch, runBatch } from './importing';
import { RecordTable } from './RecordTable';

export function RecordForm({ initial, onSave, label = '保存记录', source = '手动记录', allowPhoto = false }: { initial?: Partial<MeasurementInput>; onSave: (data: MeasurementInput) => Promise<void>; label?: string; source?: string; allowPhoto?: boolean }) {
  const [systolic, setSystolic] = useState(initial?.systolic?.toString() ?? '');
  const [diastolic, setDiastolic] = useState(initial?.diastolic?.toString() ?? '');
  const [pulse, setPulse] = useState(initial?.pulse?.toString() ?? '');
  const [time, setTime] = useState(initial ? initial.measuredAt && Number.isFinite(Date.parse(initial.measuredAt)) ? localDateTime(new Date(initial.measuredAt)) : '' : localDateTime(new Date()));
  const originalDisplayTime = initial?.measuredAt && Number.isFinite(Date.parse(initial.measuredAt)) ? localDateTime(new Date(initial.measuredAt)) : '';
  const [arm, setArm] = useState(initial?.arm ?? '');
  const [medication, setMedication] = useState(initial?.medication ?? '');
  const [symptoms, setSymptoms] = useState(initial?.symptoms ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [choices, setChoices] = useState<Candidate[]>([]);
  const [recordSource, setRecordSource] = useState(initial?.source ?? source);
  const alive = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controllerRef.current?.abort(); }; }, []);
  const fill = (candidate: Candidate) => {
    const data = candidate.data;
    setSystolic(data.systolic?.toString() ?? ''); setDiastolic(data.diastolic?.toString() ?? ''); setPulse(data.pulse?.toString() ?? '');
    setTime(data.measuredAt ? localDateTime(new Date(data.measuredAt)) : '');
    if (data.arm) setArm(data.arm);
    if (data.medication) setMedication(data.medication);
    if (data.symptoms) setSymptoms(data.symptoms);
    if (data.note) setNote(data.note);
    setRecordSource('图片识别'); setError(candidate.issues.join('\n')); setChoices([]);
  };
  const recognize = async (camera: boolean) => {
    setRecognizing(true);
    let batch: ImportBatch | undefined;
    const controller = new AbortController(); controllerRef.current = controller;
    try {
      if (!await ensureAI()) return;
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('请允许相机权限，或选择相册图片');
      const image = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (image.canceled || controller.signal.aborted) return;
      const asset = image.assets[0];
      batch = { kind: 'image', label: camera ? '拍照' : '相册', uri: asset.uri, width: asset.width, height: asset.height, cameraTime: camera ? new Date().toISOString() : undefined };
      const result = await runBatch(batch, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      if (!result.candidates.length) throw new Error('未识别到记录，请重试');
      const candidates = result.candidates.map(candidate => ({ ...candidate, issues: [...candidate.issues, ...result.warnings] }));
      if (candidates.length === 1) fill(candidates[0]); else setChoices(candidates);
    } catch (failure) { if (alive.current && !controller.signal.aborted) showError(failure); }
    finally { if (batch) await cleanTemporaryImages([batch]); if (alive.current) setRecognizing(false); controllerRef.current = null; }
  };
  const save = async () => {
    const date = parseLocalDateTime(time);
    const unchangedTime = time === originalDisplayTime && Boolean(initial?.measuredAt);
    const data: MeasurementInput = { measuredAt: unchangedTime ? initial!.measuredAt! : date?.toISOString() ?? '', timezoneOffset: unchangedTime ? initial!.timezoneOffset ?? date!.getTimezoneOffset() : date?.getTimezoneOffset() ?? 0,
      systolic: /^\d+$/.test(systolic) ? Number(systolic) : NaN, diastolic: /^\d+$/.test(diastolic) ? Number(diastolic) : NaN,
      pulse: pulse.trim() ? /^\d+$/.test(pulse) ? Number(pulse) : NaN : null, arm, medication, symptoms, note, source: recordSource };
    const errors = validateMeasurement(data);
    if (date && date.getTime() > Date.now() + 60000) errors.push('测量时间不能晚于当前时间');
    if (errors.length) { setError(errors.join('\n')); return; }
    if (isExtreme(data) && !await confirm('请复核这次读数', status(data).critical ? EMERGENCY : '读数超出常见范围，请确认数值和测量方法正确后保存。')) return;
    setBusy(true); setError('');
    try { await onSave(data); } catch (failure) { setError(failure instanceof Error ? failure.message : '保存失败'); }
    finally { setBusy(false); }
  };
  return <View style={{ gap: 18 }}>
    {allowPhoto && <Button title={recognizing ? '取消识别' : '拍照 / 相册'} secondary disabled={busy} onPress={() => recognizing ? controllerRef.current?.abort() : Alert.alert('添加图片', undefined, [{ text: '拍照', onPress: () => { void recognize(true); } }, { text: '从相册选择', onPress: () => { void recognize(false); } }, { text: '取消', style: 'cancel' }])} />}
    {recognizing && <Text style={styles.muted}>识别中…</Text>}
    <Modal visible={choices.length > 0} transparent animationType="fade" onRequestClose={() => setChoices([])}><View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#00000066' }}><View style={[styles.card, { maxHeight: '85%' }]}><Text style={styles.heading}>选择要填写的记录</Text><ScrollView><RecordTable rows={choices.map(candidate => ({ id: candidate.id, data: candidate.data }))} onPress={id => fill(choices.find(candidate => candidate.id === id)!)} /></ScrollView><Button title="取消" secondary onPress={() => setChoices([])} /></View></View></Modal>
    <View pointerEvents={recognizing ? 'none' : 'auto'} style={{ gap: 18, opacity: recognizing ? 0.5 : 1 }}>
    <AdaptiveColumns><Field label="收缩压 · mmHg" placeholder="120" keyboardType="number-pad" value={systolic} onChangeText={setSystolic} testID="systolic" /><Field label="舒张压 · mmHg" placeholder="80" keyboardType="number-pad" value={diastolic} onChangeText={setDiastolic} testID="diastolic" /></AdaptiveColumns>
    <Field label="心率 · 次/分（可选）" placeholder="例如 72" keyboardType="number-pad" value={pulse} onChangeText={setPulse} testID="pulse" />
    <Field label="测量时间" placeholder="2026-09-19 08:00" value={time} onChangeText={setTime} autoCapitalize="none" maxFontSizeMultiplier={1.3} testID="measuredAt" />
    <SelectField label="测量手臂（可选）" testID="select-arm" value={arm} onChange={setArm} options={[{ label: '未选择', value: '' }, { label: '左臂', value: '左臂' }, { label: '右臂', value: '右臂' }]} />
    <SelectField label="服药情况（可选）" testID="select-medication" value={medication} onChange={setMedication} options={[{ label: '未选择', value: '' }, { label: '服药前', value: '服药前' }, { label: '服药后', value: '服药后' }, { label: '未服药', value: '未服药' }]} />
    <Field label="症状（可选）" placeholder="例如：无不适、头晕" value={symptoms} onChangeText={setSymptoms} maxLength={2000} />
    <Field label="备注（可选）" placeholder="记录运动、睡眠或其他情况" value={note} onChangeText={setNote} multiline maxLength={2000} />
    {error ? <Notice>{error}</Notice> : null}
    <Button title={label} onPress={save} busy={busy} disabled={recognizing} testID="save-record" />
    </View>
  </View>;
}
