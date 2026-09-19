import { Tabs } from 'expo-router';
import { COLORS } from '../../src/domain';
import { Icon } from '../../src/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, useWindowDimensions } from 'react-native';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: COLORS.primary, tabBarInactiveTintColor: '#84948D', tabBarStyle: { borderTopColor: '#E6EEEA', backgroundColor: '#FFFFFF', height: 66 + Math.max(0, Math.min(fontScale, 1.4) - 1) * 20 + insets.bottom, paddingBottom: 9 + insets.bottom, paddingTop: 7 }, tabBarLabel: ({ color, children }) => <Text maxFontSizeMultiplier={1.4} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 11, fontWeight: '600', color }}>{children}</Text> }}>
    <Tabs.Screen name="index" options={{ title: '今日', tabBarIcon: ({ color }) => <Icon name="home" color={color} /> }} />
    <Tabs.Screen name="history" options={{ title: '记录', tabBarIcon: ({ color }) => <Icon name="records" color={color} /> }} />
    <Tabs.Screen name="trends" options={{ title: '趋势', tabBarIcon: ({ color }) => <Icon name="chart" color={color} /> }} />
    <Tabs.Screen name="settings" options={{ title: '设置', tabBarIcon: ({ color }) => <Icon name="settings" color={color} /> }} />
  </Tabs>;
}
