export const MISSED_GRACE_PERIOD_MINUTES = 30;

export type DoseSlotStatus = 'upcoming' | 'due' | 'missed' | 'given' | 'skipped';

type MedicationForScheduling = {
  id: string;
  schedule_times: string[];
};

type MedicationEventForScheduling = {
  medication_id: string;
  status: string;
  scheduled_for: string | null;
  created_at: string;
};

export type DoseSlot<TEvent> = {
  scheduledFor: Date;
  status: DoseSlotStatus;
  event: TEvent | null;
};

// Combines a stored "HH:MM:SS" clock time with a reference Date's local
// calendar day. Used identically at insert-time (to stamp scheduled_for) and
// at read-time (to match events to slots) so equality is exact. "Today" is
// deliberately the viewing device's local day — see the design notes on
// timezone semantics in the Milestone 7 plan.
export function getSlotTimestamp(scheduleTime: string, referenceDate: Date): Date {
  const [hours, minutes] = scheduleTime.split(':').map(Number);
  const slot = new Date(referenceDate);
  slot.setHours(hours, minutes, 0, 0);
  return slot;
}

export function computeTodaysDoseSlots<TEvent extends MedicationEventForScheduling>(
  medication: MedicationForScheduling,
  todaysEvents: TEvent[],
  now: Date
): DoseSlot<TEvent>[] {
  return medication.schedule_times.map((scheduleTime) => {
    const scheduledFor = getSlotTimestamp(scheduleTime, now);

    const matching = todaysEvents.filter(
      (event) =>
        event.medication_id === medication.id &&
        event.scheduled_for !== null &&
        new Date(event.scheduled_for).getTime() === scheduledFor.getTime()
    );
    // Most-recently-created event wins: a corrective re-log (fixing an
    // accidental Skip) supersedes the earlier row without needing an update.
    const event =
      matching.length > 0
        ? matching.reduce((latest, candidate) =>
            new Date(candidate.created_at) > new Date(latest.created_at) ? candidate : latest
          )
        : null;

    if (event) {
      return { scheduledFor, status: event.status as DoseSlotStatus, event };
    }

    const graceEndsAt = new Date(scheduledFor.getTime() + MISSED_GRACE_PERIOD_MINUTES * 60_000);
    if (now.getTime() >= graceEndsAt.getTime()) {
      return { scheduledFor, status: 'missed', event: null };
    }
    if (now.getTime() >= scheduledFor.getTime()) {
      return { scheduledFor, status: 'due', event: null };
    }
    return { scheduledFor, status: 'upcoming', event: null };
  });
}
