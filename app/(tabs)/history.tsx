import { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useRecords } from '../../src/context';
import { Button, Card, Empty, Page, styles } from '../../src/ui';
import { RecordTable } from '../../src/RecordTable';

export default function History() {
  const { records } = useRecords();
  const [limit, setLimit] = useState(60);
  const [menu, setMenu] = useState(false);
  const selected = [...records].sort((first, second) => Date.parse(second.measuredAt) - Date.parse(first.measuredAt));
  const navigate = (path: '/record' | '/import' | '/export') => { setMenu(false); router.push(path); };
  return <Page title="测量记录">
    <View style={styles.between}><Text style={styles.muted}>{records.length} 条记录</Text><Button title="菜单 ⋯" secondary onPress={() => setMenu(true)} /></View>
    <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#00000066' }}><Card>
        <Button title="记录血压" onPress={() => navigate('/record')} />
        <Button title="批量导入" secondary onPress={() => navigate('/import')} />
        <Button title="导出 / 分享" secondary onPress={() => navigate('/export')} />
        <Button title="取消" secondary onPress={() => setMenu(false)} />
      </Card></View>
    </Modal>
    {selected.length ? <RecordTable compact rows={selected.slice(0, limit).map(data => ({ id: data.id, data }))} onPress={id => router.push({ pathname: '/record', params: { id } })} /> : <Empty text="暂无记录" />}
    {selected.length > limit && <Button title="加载更多" secondary onPress={() => setLimit(limit + 60)} />}
  </Page>;
}
