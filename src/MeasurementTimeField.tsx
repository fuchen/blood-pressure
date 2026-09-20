import React, { useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { localDateTime, parseLocalDateTime } from './domain';
import { AdaptiveColumns, Button, Field, styles } from './ui';

export function MeasurementTimeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const date = parseLocalDateTime(value);
  const choose = (mode: 'date' | 'time') => {
    Keyboard.dismiss();
    const initial = date ?? new Date();
    if (Platform.OS !== 'android') {
      setDraft(initial); setOpen(true); return;
    }
    const show = (part: 'date' | 'time', current: Date, next?: 'date' | 'time') => {
      DateTimePickerAndroid.open({
        value: current, mode: part, is24Hour: true,
        maximumDate: part === 'date' ? new Date() : undefined,
        positiveButton: { label: '确定' }, negativeButton: { label: '取消' },
        onValueChange: (_event, selected) => {
          const updated = new Date(current);
          if (part === 'date') updated.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
          else updated.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
          if (next) show(next, updated);
          else onChange(localDateTime(updated));
        },
      });
    };
    show(mode, initial, date ? undefined : mode === 'date' ? 'time' : 'date');
  };
  return <View style={{ gap: 10 }}>
    <Text style={styles.label}>测量时间</Text>
    {Platform.OS === 'web' ? <Field label="日期时间" value={value} onChangeText={onChange} placeholder="2026-09-19 08:00" testID="measuredAt" /> : <AdaptiveColumns>
      <Pressable testID="measurement-date" accessibilityRole="button" accessibilityLabel={`测量日期：${date ? value.slice(0, 10) : '未选择'}`} accessibilityHint="打开日期选择器" onPress={() => choose('date')} style={styles.input}>
        <Text style={styles.muted}>日期</Text><Text style={styles.text}>{date ? value.slice(0, 10) : '选择日期'} ▾</Text>
      </Pressable>
      <Pressable testID="measurement-time" accessibilityRole="button" accessibilityLabel={`测量时刻：${date ? value.slice(11, 16) : '未选择'}`} accessibilityHint="打开时间选择器" onPress={() => choose('time')} style={styles.input}>
        <Text style={styles.muted}>时间 · 24 小时制</Text><Text style={styles.text}>{date ? value.slice(11, 16) : '选择时间'} ▾</Text>
      </Pressable>
    </AdaptiveColumns>}
    <Button title="设为现在" secondary onPress={() => onChange(localDateTime(new Date()))} testID="measurement-now" />
    {Platform.OS === 'ios' && <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#00000066' }}>
        <View accessibilityViewIsModal style={styles.card}>
          <Text style={styles.heading}>选择测量时间</Text>
          <DateTimePicker value={draft} mode="datetime" display="spinner" locale="zh-CN" maximumDate={new Date()} onValueChange={(_event, selected) => setDraft(selected)} />
          <Button title="确定" onPress={() => { onChange(localDateTime(draft)); setOpen(false); }} />
          <Button title="取消" secondary onPress={() => setOpen(false)} />
        </View>
      </SafeAreaView>
    </Modal>}
  </View>;
}
