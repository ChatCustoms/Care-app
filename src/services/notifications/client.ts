import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'feed-reminders';

// Without this, a notification that fires while the app is foregrounded is
// silently received with no banner/sound — this must be registered before
// any scheduling happens, so it runs at module load.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Feed reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

async function doReconcile(careRecipientName: string, nextFeedAt: Date | null) {
  await ensureAndroidChannel();

  const { status } = await Notifications.getPermissionsAsync();
  let granted = status === 'granted';
  if (status === 'undetermined') {
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    granted = requested.status === 'granted';
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!granted) return;
  if (!nextFeedAt || nextFeedAt.getTime() <= Date.now()) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Feed due',
      body: `Time to feed ${careRecipientName}.`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextFeedAt,
      channelId: CHANNEL_ID,
    },
  });
}

// Reconcile calls are serialized: two calls landing close together (e.g. a
// mount effect and an AppState-resume effect, or React Strict Mode's
// dev-mode double-invoke) could otherwise interleave overlapping
// cancelAll -> schedule sequences and produce two notifications for the
// same due time.
let queue: Promise<void> = Promise.resolve();

// This always cancels every scheduled notification before rescheduling
// (KNOWN_LIMITATIONS.md: local notification state is never trusted over the
// database, reconciled in full on every launch/resume). If a future
// milestone adds its own local notifications (diapers, medications), this
// must become "reconcile everything in one pass" rather than living
// alongside independent per-feature reconcile functions that each blindly
// cancel-all.
export function reconcileNextFeedNotification(
  careRecipientName: string,
  nextFeedAt: Date | null
): Promise<void> {
  queue = queue
    .then(() => doReconcile(careRecipientName, nextFeedAt))
    .catch((error) => console.warn('Failed to reconcile feed notification', error));
  return queue;
}
