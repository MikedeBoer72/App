// Daily reminder notifications.
//
// Two notifications per day, scheduled relative to the user's
// day_start_time (which is when "today" ends and a new day begins):
//   - 13h before day-start = gentle reminder
//   - 10h before day-start = "don't lose your streak" urgency
//
// Why 13 / 10? day_start_time is usually early morning (e.g. 6 AM)
// or late evening (e.g. 10 PM). Both offsets land squarely in
// normal waking hours from either of those:
//   day-start 06:00 -> reminders at 17:00 and 20:00 (afternoon/evening)
//   day-start 22:00 -> reminders at 09:00 and 12:00 (morning/noon)
//   day-start 00:00 -> reminders at 11:00 and 14:00
//
// Notifications are scheduled locally on the device (no server),
// repeat daily, and survive app close. They're cancelled when the
// user turns the toggle off or signs out.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const STORAGE_KEY = 'yourlevel:notifications-enabled';

const ID_SOFT   = 'yourlevel-daily-soft';
const ID_URGENT = 'yourlevel-daily-urgent';

// How many hours before day_start_time each reminder fires.
const SOFT_HOURS_BEFORE   = 13;
const URGENT_HOURS_BEFORE = 10;

// Show banner + play sound when a notification fires while the app
// is foregrounded. Set once at module load.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:   true,
    shouldPlaySound:   true,
    shouldSetBadge:    false,
    shouldShowBanner:  true,
    shouldShowList:    true,
  }),
});

// ---------------------------------------------------------------------------
// Pure helper
// ---------------------------------------------------------------------------

export interface Reminder {
  hour:   number;
  minute: number;
}

/**
 * Wall-clock time of the reminder, given the day_start_time
 * (HH:MM[:SS]) and how many hours before it should fire.
 */
export function reminderTimeFor(dayStartHms: string, hoursBefore: number): Reminder {
  const [h = '0', m = '0'] = dayStartHms.split(':');
  const startMinutes = (Number(h) || 0) * 60 + (Number(m) || 0);
  const offsetMinutes = startMinutes - hoursBefore * 60;
  const normalized = ((offsetMinutes % 1440) + 1440) % 1440;
  return {
    hour:   Math.floor(normalized / 60),
    minute: normalized % 60,
  };
}

// ---------------------------------------------------------------------------
// Persisted toggle
// ---------------------------------------------------------------------------

export async function getNotificationsEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  return v === 'true';
}

async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
}

// ---------------------------------------------------------------------------
// Permission + scheduling
// ---------------------------------------------------------------------------

export async function ensureNotificationPermissions(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  if (!existing.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

/**
 * Reschedules both daily reminders for the current day_start_time.
 * Cancels any previous schedule first so we never end up with stale
 * times after the user changes their day-start. Also persists the
 * "enabled = true" flag.
 */
export async function enableDailyReminders(dayStartTime: string): Promise<boolean> {
  const ok = await ensureNotificationPermissions();
  if (!ok) {
    await setNotificationsEnabled(false);
    return false;
  }

  await cancelDailyReminders();

  const soft   = reminderTimeFor(dayStartTime, SOFT_HOURS_BEFORE);
  const urgent = reminderTimeFor(dayStartTime, URGENT_HOURS_BEFORE);

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: ID_SOFT,
      content: {
        title: 'YourLevel',
        body:  "Don't forget today's tasks.",
      },
      trigger: {
        type:   Notifications.SchedulableTriggerInputTypes.DAILY,
        hour:   soft.hour,
        minute: soft.minute,
      },
    });
    await Notifications.scheduleNotificationAsync({
      identifier: ID_URGENT,
      content: {
        title: "Don't lose your streak",
        body:  "Finish today's tasks soon — your day resets in a few hours.",
      },
      trigger: {
        type:   Notifications.SchedulableTriggerInputTypes.DAILY,
        hour:   urgent.hour,
        minute: urgent.minute,
      },
    });
  } catch (err) {
    console.warn('[notifications] schedule failed', err);
    await setNotificationsEnabled(false);
    return false;
  }

  await setNotificationsEnabled(true);
  return true;
}

export async function cancelDailyReminders(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(ID_SOFT);
  } catch {
    // ignore - not scheduled
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(ID_URGENT);
  } catch {
    // ignore
  }
}

export async function disableDailyReminders(): Promise<void> {
  await cancelDailyReminders();
  await setNotificationsEnabled(false);
}

/**
 * Called whenever day_start_time changes. If notifications were
 * enabled, reschedules to the new times. No-op otherwise.
 */
export async function syncRemindersToDayStart(dayStartTime: string): Promise<void> {
  if (!(await getNotificationsEnabled())) return;
  await enableDailyReminders(dayStartTime);
}
