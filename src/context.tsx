import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Measurement, COLORS } from './domain';
import { listMeasurements } from './storage';

const AppContext = createContext<{ records: Measurement[]; refresh: () => Promise<void> }>({ records: [], refresh: async () => undefined });
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<Measurement[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const refresh = async () => { setRecords(await listMeasurements()); };
  useEffect(() => { refresh().then(() => setReady(true)).catch(() => setError('无法打开本地数据库，请重启应用。')); }, []);
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg }}><ActivityIndicator color={COLORS.primary} /><Text>{error || '正在打开安心血压…'}</Text></View>;
  return <AppContext.Provider value={{ records, refresh }}>{children}</AppContext.Provider>;
}
export const useRecords = () => useContext(AppContext);
