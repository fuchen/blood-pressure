import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle, ActivityIndicator, ColorValue, Modal, Keyboard, useWindowDimensions, TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { COLORS, Period, PERIODS, Measurement, localDateTime, status, pulseStatus } from './domain';
import { getSetting, readKey, setSetting } from './storage';

export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg }, content: { padding: 22, paddingBottom: 36, gap: 18 },
  title: { fontSize: 29, fontWeight: '800', color: COLORS.ink, letterSpacing: 0.5 },
  subtitle: { fontSize: 14, color: COLORS.muted, lineHeight: 22 },
  heading: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  text: { fontSize: 15, color: COLORS.ink, lineHeight: 24 },
  muted: { fontSize: 13, color: COLORS.muted, lineHeight: 21 },
  card: { backgroundColor: 'white', borderRadius: 22, padding: 20, gap: 12, borderWidth: 1, borderColor: '#E6EEEA' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  input: { borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#FAFCFB', paddingHorizontal: 14, paddingVertical: 13, borderRadius: 13, color: COLORS.ink, fontSize: 17, minHeight: 50 },
  label: { fontSize: 14, color: COLORS.ink, fontWeight: '600', marginBottom: 7 },
  button: { minHeight: 50, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  buttonText: { fontSize: 16, fontWeight: '700', color: 'white', textAlign: 'center', flexShrink: 1 },
  pill: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#EAF2EE', minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  warning: { padding: 16, backgroundColor: '#FFF0E7', borderRadius: 16, borderLeftWidth: 3, borderLeftColor: COLORS.high },
});
export function useLargeLayout() {
  const { width, fontScale } = useWindowDimensions();
  return (width - 44) / fontScale < 300;
}
export function AdaptiveColumns({ children }: { children: React.ReactNode }) {
  const stacked = useLargeLayout();
  return <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 12 }}>{React.Children.map(children, child => <View style={stacked ? { width: '100%' } : { flex: 1, minWidth: 0 }}>{child}</View>)}</View>;
}
export function BloodPressureValue({ systolic, diastolic, style }: { systolic?: number | null; diastolic?: number | null; style?: TextStyle }) {
  return <Text accessibilityLabel={`收缩压 ${systolic ?? '未记录'}，舒张压 ${diastolic ?? '未记录'}，毫米汞柱`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4} maxFontSizeMultiplier={1.5} style={[{ fontSize: 28, fontWeight: '800', color: COLORS.ink, fontVariant: ['tabular-nums'] }, style]}>{systolic ?? '—'} / {diastolic ?? '—'}</Text>;
}
export function Page({ title, subtitle, children, back = false }: { title: string; subtitle?: string; children: React.ReactNode; back?: boolean }) {
  return <SafeAreaView style={styles.page} edges={['top', 'left', 'right']}><ScrollView removeClippedSubviews={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    {back && <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ paddingVertical: 6 }}><Text style={{ color: COLORS.primary, fontSize: 16 }}>‹ 返回</Text></Pressable>}
    <View style={{ gap: 6 }}><Text style={styles.title}>{title}</Text>{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}</View>{children}
  </ScrollView></SafeAreaView>;
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) { return <View style={[styles.card, style]}>{children}</View>; }
export function Button({ title, onPress, secondary, danger, disabled, busy, testID }: { title: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean; busy?: boolean; testID?: string }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && { backgroundColor: '#E6F0EB' }, danger && { backgroundColor: COLORS.danger }, { opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1 }]}>
    {busy ? <ActivityIndicator color={secondary ? COLORS.primary : 'white'} /> : <Text style={[styles.buttonText, secondary && { color: COLORS.primary }]}>{title}</Text>}
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) { return <View><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#95A5A0" style={styles.input} {...props} /></View>; }
export function SelectField({ label, value, onChange, options, testID }: { label: string; value: string; onChange: (value: string) => void; options: { label: string; value: string }[]; testID: string }) {
  const [open, setOpen] = useState(false);
  const choices = options.some(option => option.value === value) ? options : [...options, { label: `原有记录：${value}`, value }];
  const selected = choices.find(option => option.value === value)!;
  return <View><Text style={styles.label}>{label}</Text>
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${label}：${selected.label}`} accessibilityHint="打开选项列表" accessibilityState={{ expanded: open }} onPress={() => { Keyboard.dismiss(); setOpen(true); }} style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
      <Text style={[styles.text, { flex: 1, minWidth: 0 }]}>{selected.label}</Text><Text allowFontScaling={false} style={{ fontSize: 18, color: COLORS.primary }}>⌄</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 20 }}>
        <View accessibilityViewIsModal style={{ backgroundColor: 'white', borderRadius: 22, padding: 20, gap: 16, maxHeight: '90%' }}>
          <Text accessibilityRole="header" style={styles.heading}>{label}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
            {choices.map((option, index) => <Pressable key={option.value} testID={`${testID}-option-${index}`} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: option.value === value }} onPress={() => { onChange(option.value); setOpen(false); }} style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: option.value === value ? COLORS.primary : COLORS.line }]}>
              <Text allowFontScaling={false} style={{ fontSize: 22, color: COLORS.primary }}>{option.value === value ? '◉' : '○'}</Text><Text style={[styles.text, { flex: 1, minWidth: 0 }]}>{option.label}</Text>
            </Pressable>)}
          </ScrollView>
          <Button title="取消" secondary onPress={() => setOpen(false)} />
        </View>
      </SafeAreaView>
    </Modal>
  </View>;
}
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (period: Period) => void }) {
  const stacked = useLargeLayout();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{PERIODS.map(period => <Pressable key={period.value} accessibilityRole="button" accessibilityState={{ selected: value === period.value }} onPress={() => onChange(period.value)} style={[styles.pill, { flexGrow: 1, flexBasis: stacked ? '45%' : '20%' }, value === period.value && { backgroundColor: COLORS.primary }]}>
    <Text style={{ color: value === period.value ? 'white' : COLORS.muted, fontWeight: '600' }}>{period.label}</Text></Pressable>)}</View>;
}
export function Notice({ children }: { children: React.ReactNode }) { return <View style={styles.warning}><Text style={[styles.text, { color: '#854728', fontSize: 14 }]}>{children}</Text></View>; }
export function RecordCard({ record, onPress }: { record: Measurement; onPress?: () => void }) {
  const state = status(record);
  const stacked = useLargeLayout();
  return <Pressable accessibilityRole="button" onPress={onPress ?? (() => router.push({ pathname: '/record', params: { id: record.id } }))}>
    <Card><View style={styles.between}><Text style={styles.muted}>{localDateTime(new Date(record.measuredAt))}</Text><Text style={{ color: state.color, fontWeight: '700' }}>{state.label}</Text></View>
      <View style={{ gap: 10, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'stretch' : 'center' }}><View style={stacked ? {} : { flex: 1, minWidth: 0 }}><BloodPressureValue systolic={record.systolic} diastolic={record.diastolic} style={{ color: state.color }} /><Text style={styles.muted}>mmHg</Text></View><Text style={styles.text}>心率 {record.pulse ?? '—'} 次/分</Text></View>
      {record.pulse != null && (record.pulse < 60 || record.pulse > 100) && <Text style={{ color: COLORS.high }}>{pulseStatus(record.pulse)}</Text>}
      {Boolean(record.symptoms || record.note) && <Text numberOfLines={2} style={styles.muted}>{record.symptoms || record.note}</Text>}
    </Card></Pressable>;
}
export function Empty({ text = '还没有记录，从第一次测量开始吧。' }: { text?: string }) { return <Card><Text style={[styles.muted, { paddingVertical: 20, textAlign: 'center' }]}>{text}</Text></Card>; }
export function showError(error: unknown) { Alert.alert('暂时无法完成', error instanceof Error ? error.message : '操作失败，请重试'); }
export const confirm = (title: string, message: string, destructive = false) => new Promise<boolean>(resolve => Alert.alert(title, message, [
  { text: '取消', style: 'cancel', onPress: () => resolve(false) }, { text: '确认', style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
], { cancelable: true, onDismiss: () => resolve(false) }));
export async function ensureAI() {
  if (!await readKey()) {
    Alert.alert('需要 API Key', '请先在设置中配置你的 DeepSeek API Key。', [{ text: '稍后', style: 'cancel' }, { text: '前往设置', onPress: () => router.push('/settings') }]);
    return false;
  }
  if (!await getSetting('aiConsent', false)) {
    if (!await confirm('启用 AI 功能', '所选图片、表格内容或健康记录将通过 HTTPS 发送至 DeepSeek 处理，并可能产生 API 费用。只上传当前任务所需信息。是否同意？')) return false;
    await setSetting('aiConsent', true);
  }
  return true;
}
export function Icon({ name, color = COLORS.primary, size = 23 }: { name: string; color?: ColorValue; size?: number }) {
  const paths: Record<string, string> = {
    heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8M3 12h4l2-4 4 8 2-4h6',
    home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
    chart: 'M4 3v17h17M7 14l4-5 4 3 5-7',
    records: 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h4',
    ai: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
    settings: 'M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2 2m8.8 8.8 2 2m0-12.8-2 2m-8.8 8.8-2 2M16 12a4 4 0 1 1-8 0 4 4 0 1 1 8 0',
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d={paths[name] ?? paths.home} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
