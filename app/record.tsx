import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { useRecords } from '../src/context';
import { deleteMeasurement, saveMeasurements } from '../src/storage';
import { RecordForm } from '../src/RecordForm';
import { Button, Card, confirm, Page, showError, styles } from '../src/ui';

export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { records, refresh } = useRecords();
  const record = records.find(item => item.id === id);
  return <Page title={id ? '编辑测量' : '记录血压'} back>
    {id && !record ? <Text style={styles.text}>这条记录已不存在。</Text> : <Card><RecordForm allowPhoto initial={record} onSave={async data => { await saveMeasurements([{ ...data, id: record?.id, createdAt: record?.createdAt }]); await refresh(); router.back(); }} /></Card>}
    {record && <Button title="删除这条记录" danger onPress={async () => { if (!await confirm('删除记录', '删除后无法撤销，是否继续？', true)) return; try { await deleteMeasurement(record.id); await refresh(); router.back(); } catch (error) { showError(error); } }} />}
  </Page>;
}
