import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const FEED_CHANNEL_ID = 'feed-reminders';
const MEDICATION_CHANNEL_ID = 'medication-reminders';
const APPOINTMENT_CHANNEL_ID = 'appointment-reminders';

// How far ahead of an appointment's scheduled_at to fire its reminder —
// "time to leave" is the useful signal, not a same-instant ping.
const APPOINTMENT_REMINDER_LEAD_MS = 60 * 60_000;

export type MedicationDoseNotification = {
  medicationId: string;
  medicationName: string;
  scheduledFor: Date;
};

export type AppointmentReminder = {
  appointmentId: string;
  title: string;
  scheduledFor: Date;
};

type ReconcileNotificationsInput = {
  careRecipientName: string;
  nextFeedAt: Date | null;
  upcomingDoses: MedicationDoseNotification[];
  upcomingAppointments: AppointmentReminder[];
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
  await Notifications.setNotificationChannelAsync(APPOINTMENT_CHANNEL_ID, {
    name: 'Appointment reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

async function doReconcile({
  careRecipientName,
  nextFeedAt,
  upcomingDoses,
  upcomingAppointments,
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

  for (const appointment of upcomingAppointments) {
    const appointmentTime = appointment.scheduledFor.getTime();
    if (appointmentTime <= now) continue;

    // If the natural lead-time trigger has already passed (the appointment
    // was booked, or reconciliation ran, inside its own lead window), clamp
    // to fire almost immediately rather than silently dropping the
    // reminder — this app's ethos is "no care event is silently lost".
    const naturalTrigger = appointmentTime - APPOINTMENT_REMINDER_LEAD_MS;
    const triggerDate = new Date(naturalTrigger > now ? naturalTrigger : now + 5_000);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Upcoming appointment',
        body: `${appointment.title} for ${careRecipientName} at ${appointment.scheduledFor.toLocaleTimeString(
          [],
          { hour: 'numeric', minute: '2-digit' }
        )}.`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: APPOINTMENT_CHANNEL_ID,
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
