import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const FEED_CHANNEL_ID = 'feed-reminders';
const MEDICATION_CHANNEL_ID = 'medication-reminders';

export type MedicationDoseNotification = {
  medicationId: string;
  medicationName: string;
  scheduledFor: Date;
};

type ReconcileNotificationsInput = {
  careRecipientName: string;
  nextFeedAt: Date | null;
  upcomingDoses: MedicationDoseNotification[];
};

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

async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(FEED_CHANNEL_ID, {
    name: 'Feed reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(MEDICATION_CHANNEL_ID, {
    name: 'Medication reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

async function doReconcile({
  careRecipientName,
  nextFeedAt,
  upcomingDoses,
}: ReconcileNotificationsInput) {
  await ensureAndroidChannels();

  const { status } = await Notifications.getPermissionsAsync();
  let granted = status === 'granted';
  if (status === 'undetermined') {
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    granted = requested.status === 'granted';
  }

  // Local notification state is never trusted over the database
  // (KNOWN_LIMITATIONS.md) — every reconcile call cancels everything, then
  // reschedules everything currently due in one pass. This is why feed and
  // medication reminders are scheduled together in a single function rather
  // than as independent per-feature reconcilers: two functions that each
  // blindly cancel-all would race and clobber each other's schedules.
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!granted) return;

  const now = Date.now();

  if (nextFeedAt && nextFeedAt.getTime() > now) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Feed due',
        body: `Time to feed ${careRecipientName}.`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextFeedAt,
        channelId: FEED_CHANNEL_ID,
      },
    });
  }

  for (const dose of upcomingDoses) {
    if (dose.scheduledFor.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Medication due',
        body: `Time for ${dose.medicationName}.`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: dose.scheduledFor,
        channelId: MEDICATION_CHANNEL_ID,
      },
    });
  }
}

// Reconcile calls are serialized: two calls landing close together (e.g. a
// mount effect and an AppState-resume effect, or React Strict Mode's
// dev-mode double-invoke) could otherwise interleave overlapping
// cancelAll -> schedule sequences and produce duplicate notifications for
// the same due time.
let queue: Promise<void> = Promise.resolve();

export function reconcileNotifications(input: ReconcileNotificationsInput): Promise<void> {
  queue = queue
    .then(() => doReconcile(input))
    .catch((error) => console.warn('Failed to reconcile notifications', error));
  return queue;
}
