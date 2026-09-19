import * as Notifications from 'expo-notifications';
import { getSetting, setSetting } from './storage';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

export type ReminderSettings = { enabled: boolean; morning: string; evening: string };
export const defaultReminders: ReminderSettings = { enabled: false, morning: '08:00', evening: '20:00' };
export const getReminders = () => getSetting('reminders', defaultReminders);
export async function configureReminders(settings: ReminderSettings) {
  if (![settings.morning, settings.evening].every(time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error('提醒时间请使用 HH:mm 格式');
  if (settings.enabled) {
    await Notifications.setNotificationChannelAsync('measurements', { name: '测量提醒', importance: Notifications.AndroidImportance.DEFAULT });
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) throw new Error('未允许通知权限。记录功能不受影响，可在系统设置中开启后重试。');
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  try {
    if (settings.enabled) for (const time of [settings.morning, settings.evening]) {
      const [hour, minute] = time.split(':').map(Number);
      await Notifications.scheduleNotificationAsync({ content: { title: '留一点时间，关心自己', body: '静坐休息 5 分钟后，记录今天的血压。', sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'measurements' } });
    }
    await setSetting('reminders', settings);
  } catch (error) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await setSetting('reminders', { ...settings, enabled: false });
    throw error;
  }
}
