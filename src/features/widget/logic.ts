import { FEED_DUE_SOON_MINUTES, FEED_OVERDUE_GRACE_MINUTES } from '@/constants/feeding';
import { getFeedStatus } from '@/features/feeds/logic';
import { Medication, MedicationEvent } from '@/features/medications/api';
import { computeTodaysDoseSlots, MISSED_GRACE_PERIOD_MINUTES } from '@/features/medications/logic';
import { FeedStatus } from '@/types';

export const WIDGET_PAYLOAD_VERSION = 1;

export type WidgetFeedEntry = { status: FeedStatus; validFrom: string };
export type WidgetMedicationEntry = {
  status: 'upcoming' | 'due' | 'missed';
  validFrom: string;
  medicationName: string;
};

export type WidgetPayload = {
  version: typeof WIDGET_PAYLOAD_VERSION;
  careRecipientName: string;
  feedEntries: WidgetFeedEntry[];
  medicationEntries: WidgetMedicationEntry[];
};

// The four canonical transition timestamps derived from nextFeedAt alone —
// mirrors getFeedStatus's exact threshold logic so the widget never
// duplicates this math in Swift. Including the current-status entry (valid
// from `now`) alongside already-past thresholds is deliberate, not
// redundant: WidgetKit always shows whichever entry's date has most
// recently passed, so a past-dated threshold is harmless.
export function computeFeedWidgetEntries(nextFeedAt: Date | null, now: Date): WidgetFeedEntry[] {
  if (!nextFeedAt) return [];

  const dueSoonAt = new Date(nextFeedAt.getTime() - FEED_DUE_SOON_MINUTES * 60_000);
  const overdueAt = new Date(nextFeedAt.getTime() + FEED_OVERDUE_GRACE_MINUTES * 60_000);
  const currentStatus = getFeedStatus(nextFeedAt, now);

  const entries: WidgetFeedEntry[] = [
    { status: currentStatus as FeedStatus, validFrom: now.toISOString() },
    { status: 'due_soon', validFrom: dueSoonAt.toISOString() },
    { status: 'due', validFrom: nextFeedAt.toISOString() },
    { status: 'overdue', validFrom: overdueAt.toISOString() },
  ];

  return entries.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
}

// Collects every currently-unresolved dose slot (not just the soonest)
// across all scheduled medications, emitting each one's due/missed
// transition entries — a widget built from only the soonest slot would go
// stale the moment that slot resolves if a second medication's dose comes
// due later the same day with no new Supabase event to trigger a resync.
export function computeMedicationWidgetEntries(
  scheduledMedications: Medication[],
  medicationEvents: MedicationEvent[],
  now: Date
): WidgetMedicationEntry[] {
  const unresolvedSlots = scheduledMedications.flatMap((medication) =>
    computeTodaysDoseSlots<MedicationEvent>(medication, medicationEvents, now)
      .filter((slot) => slot.status !== 'given' && slot.status !== 'skipped')
      .map((slot) => ({ medication, slot }))
  );

  if (unresolvedSlots.length === 0) return [];

  const soonest = unresolvedSlots.reduce((a, b) =>
    a.slot.scheduledFor.getTime() <= b.slot.scheduledFor.getTime() ? a : b
  );

  const currentEntry: WidgetMedicationEntry = {
    status: soonest.slot.status as 'upcoming' | 'due' | 'missed',
    validFrom: now.toISOString(),
    medicationName: soonest.medication.name,
  };

  const transitionEntries: WidgetMedicationEntry[] = unresolvedSlots.flatMap(
    ({ medication, slot }) => [
      {
        status: 'due' as const,
        validFrom: slot.scheduledFor.toISOString(),
        medicationName: medication.name,
      },
      {
        status: 'missed' as const,
        validFrom: new Date(
          slot.scheduledFor.getTime() + MISSED_GRACE_PERIOD_MINUTES * 60_000
        ).toISOString(),
        medicationName: medication.name,
      },
    ]
  );

  return [currentEntry, ...transitionEntries].sort((a, b) =>
    a.validFrom.localeCompare(b.validFrom)
  );
}

export function buildWidgetPayload(
  careRecipientName: string,
  nextFeedAt: Date | null,
  scheduledMedications: Medication[],
  medicationEvents: MedicationEvent[],
  now: Date
): WidgetPayload {
  return {
    version: WIDGET_PAYLOAD_VERSION,
    careRecipientName,
    feedEntries: computeFeedWidgetEntries(nextFeedAt, now),
    medicationEntries: computeMedicationWidgetEntries(scheduledMedications, medicationEvents, now),
  };
}
