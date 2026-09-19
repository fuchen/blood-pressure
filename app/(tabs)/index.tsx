import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useRecords } from '../../src/context';
import { COLORS, EMERGENCY, inPeriod, localDateTime, stats, status } from '../../src/domain';
import { AdaptiveColumns, BloodPressureValue, Button, Card, Empty, Notice, Page, RecordCard, styles, useLargeLayout } from '../../src/ui';

export default function Home() {
  const { records } = useRecords();
  const latest = records[0];
  const summary = stats(inPeriod(records, '7'));
  const stacked = useLargeLayout();
  return <Page title="安心血压">
    <Card style={{ backgroundColor: COLORS.primary, borderColor: COLORS.primary, padding: 24 }}>
      <View style={styles.between}><Text style={{ color: '#CCE5DD', fontSize: 14 }}>最近一次测量</Text><Text style={{ color: '#E8F4EE', fontSize: 12 }}>家庭自测</Text></View>
      <BloodPressureValue systolic={latest?.systolic} diastolic={latest?.diastolic} style={{ color: 'white', fontSize: 48, letterSpacing: -1 }} />
      <View style={{ gap: 10, flexDirection: stacked ? 'column' : 'row', flexWrap: stacked ? 'nowrap' : 'wrap', justifyContent: 'space-between' }}><Text style={{ color: '#CCE5DD', maxWidth: '100%' }}>收缩压 / 舒张压 · mmHg</Text><Text style={{ color: 'white', fontSize: 18, maxWidth: '100%' }}>心率 {latest?.pulse ?? '—'} 次/分</Text></View>
      <View style={{ height: 1, backgroundColor: '#408F85', marginVertical: 3 }} />
      <View style={{ gap: 10, flexDirection: stacked ? 'column' : 'row', flexWrap: stacked ? 'nowrap' : 'wrap', justifyContent: 'space-between' }}><Text style={{ color: '#EBF6F1', fontSize: 12, maxWidth: '100%' }}>{latest ? localDateTime(new Date(latest.measuredAt)) : '等待你的第一条记录'}</Text><Text style={{ color: 'white', fontWeight: '700', maxWidth: '100%' }}>{latest ? status(latest).label : ''}</Text></View>
    </Card>
    {latest && status(latest).critical && <Notice>{EMERGENCY}</Notice>}
    <Button title="＋ 记录血压" onPress={() => router.push('/record')} />
    <View style={styles.between}><Text style={styles.heading}>过去 7 天</Text><Text style={styles.muted}>{summary.count} 次测量</Text></View>
    <AdaptiveColumns><Card><Text style={styles.muted}>平均血压</Text><BloodPressureValue systolic={summary.systolic} diastolic={summary.diastolic} style={{ fontSize: 24 }} /><Text style={styles.muted}>mmHg</Text></Card><Card><Text style={styles.muted}>异常记录</Text><Text style={{ color: COLORS.high, fontWeight: '800', fontSize: 24 }}>{summary.abnormal} <Text style={{ fontSize: 13 }}>次</Text></Text></Card></AdaptiveColumns>
    <View style={styles.between}><Text style={styles.heading}>近期记录</Text><Text onPress={() => router.push('/history')} style={{ color: COLORS.primary }}>查看全部 ›</Text></View>
    {records.length ? records.slice(0, 3).map(record => <RecordCard key={record.id} record={record} />) : <Empty />}
  </Page>;
}
