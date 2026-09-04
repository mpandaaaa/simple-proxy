import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { settingsStore } from '../save';

/**
 * The one notification this app will ever send.
 *
 * A reminder that today's Daily is there, at a time somebody chose, off
 * unless they turned it on. No marketing, no "we miss you", no badge
 * counts, and nothing scheduled without being asked.
 *
 * Everything here is wrapped. A phone that refuses permission, an
 * simulator with no notification support, an iPad in a drawer: none of
 * those may take down the settings screen, so every call swallows its own
 * failure and reports what it managed rather than throwing.
 */

/** The one identifier, so scheduling twice replaces rather than stacks. */
const TAG = 'daily-reminder';

/*
 * How it behaves when the app is open.
 *
 * It does not. A reminder that fires while you are already playing is
 * noise, so it is delivered silently and the app carries on.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type Permission = 'granted' | 'denied' | 'undetermined';

export async function permission(): Promise<Permission> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'denied';
  }
}

/** Ask, once. Returns what the answer was. */
export async function ask(): Promise<Permission> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'denied';
  }
}

/** Take it all down. Safe to call whether anything is scheduled or not. */
export async function clearReminder(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    /* Nothing scheduled is the same outcome as cancelling it. */
  }
}

/**
 * Put it up for the hour that was chosen.
 *
 * A daily trigger rather than a date, so it repeats without the app ever
 * being opened again, and it is cleared first so changing the time moves
 * the reminder rather than adding a second one.
 */
export async function scheduleReminder(hour: number): Promise<boolean> {
  const at = Math.max(0, Math.min(23, Math.round(hour)));
  try {
    await clearReminder();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(TAG, {
        name: 'Daily reminder',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.scheduleNotificationAsync({
      identifier: TAG,
      content: {
        title: "Today's XI is up",
        body: 'One draft, one attempt, everybody gets the same players.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: at,
        minute: 0,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Make what is scheduled match what the settings say.
 *
 * Called when the app opens, because a reminder can be cancelled by the
 * system, by a restore from a backup, or by somebody turning
 * notifications off in the phone's own settings and back on again.
 */
export async function syncReminder(): Promise<void> {
  try {
    const s = settingsStore.read();
    if (!s.remind) {
      await clearReminder();
      return;
    }
    if ((await permission()) !== 'granted') return;
    await scheduleReminder(s.remindAt);
  } catch {
    /* A reminder that will not schedule is not worth a crash. */
  }
}
