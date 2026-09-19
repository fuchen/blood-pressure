import { useCallback, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { maskKey } from '../../src/domain';
import { readKey, removeKey, writeKey } from '../../src/storage';
import { testConnection } from '../../src/ai';
import { configureReminders, defaultReminders, getReminders } from '../../src/notifications';
import { Button, Card, confirm, Field, Page, showError, styles } from '../../src/ui';

export default function Settings() {
  const [masked, setMasked] = useState(''); const [input, setInput] = useState(''); const [busy, setBusy] = useState(false);
  const [reminders, setReminders] = useState(defaultReminders);
  useFocusEffect(useCallback(() => { readKey().then(key => setMasked(key ? maskKey(key) : '')).catch(showError); getReminders().then(setReminders).catch(showError); }, []));
  const action = async (task: () => Promise<void>) => { setBusy(true); try { await task(); } catch (error) { showError(error); } finally { setBusy(false); } };
  return <Page title="设置">
    <Card><Text style={styles.heading}>DeepSeek API Key</Text><Text style={styles.text}>{masked || '尚未设置'}</Text><Field label="设置 / 替换 Key" placeholder="粘贴你的 API Key" value={input} onChangeText={setInput} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="none" autoComplete="off" />
      <Button title="安全保存" disabled={busy || !input.trim()} onPress={() => action(async () => { if (input.trim().length < 13 || /\s/.test(input.trim())) throw new Error('API Key 格式不正确'); await writeKey(input); setMasked(maskKey(input.trim())); setInput(''); Alert.alert('已保存', '密钥已保存到系统安全存储'); })} />
      <Button title="测试连接" secondary disabled={busy || !masked} onPress={() => action(async () => { await testConnection(); Alert.alert('连接成功', 'deepseek-flash 已就绪'); })} />
      <Button title="删除 Key" secondary disabled={busy || !masked} onPress={() => action(async () => { if (await confirm('删除密钥', '之后使用 AI 需重新设置 API Key。')) { await removeKey(); setMasked(''); setInput(''); } })} />
    </Card>
    <Card><View style={styles.between}><Text style={styles.heading}>早晚测量提醒</Text><Switch accessibilityLabel="开启测量提醒" value={reminders.enabled} onValueChange={enabled => setReminders({ ...reminders, enabled })} /></View>
      <Field label="早间时间 · HH:mm" value={reminders.morning} onChangeText={morning => setReminders({ ...reminders, morning })} maxLength={5} />
      <Field label="晚间时间 · HH:mm" value={reminders.evening} onChangeText={evening => setReminders({ ...reminders, evening })} maxLength={5} />
      <Button title="保存提醒设置" secondary disabled={busy} onPress={() => action(async () => { await configureReminders(reminders); Alert.alert('已保存', reminders.enabled ? '提醒已开启，系统省电策略可能导致延迟。' : '提醒已关闭'); })} />
    </Card>
    <Card><Text style={styles.heading}>让测量更准确</Text><Text style={styles.text}>1. 测量前 30 分钟避免运动、吸烟和咖啡，先排空膀胱。{'\n'}2. 静坐休息至少 5 分钟，背部有支撑，双脚平放，不交叉双腿。{'\n'}3. 裸露上臂，选择合适袖带，手臂与心脏同高，测量时不说话。{'\n'}4. 每次可间隔约 1 分钟测量 2 次，分别记录；尽量固定早晚时间和手臂。</Text><Text style={styles.muted}>默认参考：家庭血压 ≥135/85 mmHg 偏高，&lt;90/60 偏低（任一项达到）；静息心率 60–100 次/分。孕期、儿童和特殊疾病请遵循医生指导。</Text></Card>
    <Card><Text style={styles.heading}>数据与隐私</Text><Text style={styles.text}>无需账号，记录保存在本机。主动使用 AI 时，相关内容会发送至 DeepSeek。卸载应用会丢失本机数据，请定期导出 Excel 备份。</Text><Button title="导出备份 / 分享报告" secondary onPress={() => router.push('/export')} /></Card>
    <Text style={[styles.muted, { textAlign: 'center' }]}>安心血压 1.0.0</Text>
  </Page>;
}
