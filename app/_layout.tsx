import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DataProvider } from '../src/context';
import { COLORS } from '../src/domain';
import '../src/notifications';

export default function Layout() {
  return <DataProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }}><Stack.Screen name="(tabs)" /><Stack.Screen name="record" /><Stack.Screen name="import" /><Stack.Screen name="export" /></Stack></DataProvider>;
}
