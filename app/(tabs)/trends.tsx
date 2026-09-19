import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text } from 'react-native';
import { useRecords } from '../../src/context';
import { inPeriod, Period, PERIODS, stats } from '../../src/domain';
import { Card, Empty, Page, SelectField, showError, styles } from '../../src/ui';
import { getSetting, setSetting } from '../../src/storage';
import { Chart } from '../../src/Chart';

export default function Trends() {
  const { records } = useRecords();
  const [period, setPeriod] = useState<Period>('7');
  const revision = useRef(0);
  const pendingSave = useRef(Promise.resolve());
  useFocusEffect(useCallback(() => {
    let active = true;
    const current = revision.current;
    pendingSave.current.then(() => getSetting<string>('trendPeriod', '7')).then(value => {
      if (active && current === revision.current) setPeriod(PERIODS.some(option => option.value === value) ? value as Period : '7');
    }).catch(showError);
    return () => { active = false; };
  }, []));
  const changePeriod = (value: string) => {
    if (!PERIODS.some(option => option.value === value)) return;
    revision.current += 1;
    setPeriod(value as Period);
    pendingSave.current = pendingSave.current.catch(() => undefined).then(() => setSetting('trendPeriod', value));
    pendingSave.current.catch(showError);
  };
  const selected = inPeriod(records, period);
  const summary = stats(selected);
  return <Page title="趋势">
    <SelectField label="时间范围" testID="trend-period" value={period} onChange={changePeriod} options={PERIODS} />
    <Card><Text style={styles.heading}>{summary.count} 次测量 · {summary.abnormal} 次血压异常</Text><Text style={styles.text}>平均血压 {summary.systolic ?? '—'}/{summary.diastolic ?? '—'} mmHg{ '\n' }平均心率 {summary.pulse ?? '—'} 次/分</Text></Card>
    {selected.length ? <><Card><Chart key={period} records={selected} aggregate={period === 'half' || period === 'year' || period === 'all' || selected.length > 100} /></Card><Card><Chart key={`pulse-${period}`} records={selected} pulse aggregate={period === 'half' || period === 'year' || period === 'all' || selected.length > 100} /></Card></> : <Empty />}
  </Page>;
}
