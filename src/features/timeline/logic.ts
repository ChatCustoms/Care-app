import { Diaper } from '@/features/diapers/api';
import { Feed } from '@/features/feeds/api';
import { CareNote } from '@/features/careNotes/api';
import { Medication, MedicationEvent } from '@/features/medications/api';
import { MedicationEventStatus } from '@/types';

// 'missed' is excluded, same rationale as LoggableMedicationEventStatus in
// medications/api.ts — it's a client-computed status, never a stored row.
export const MEDICATION_EVENT_STATUS_LABEL: Record<
  Exclude<MedicationEventStatus, 'missed'>,
  string
> = {
  given: 'Given',
  skipped: 'Skipped',
  prn_given: 'Given (PRN)',
};

export type TimelineEntryType = 'feed' | 'diaper' | 'medication' | 'note';

export type TimelineEntry =
  | { type: 'feed'; id: string; timestamp: Date; feed: Feed }
  | { type: 'diaper'; id: string; timestamp: Date; diaper: Diaper }
  | {
      type: 'medication';
      id: string;
      timestamp: Date;
      event: MedicationEvent;
      medicationName: string;
    }
  | { type: 'note'; id: string; timestamp: Date; note: CareNote };

export function buildTimeline(
  feeds: Feed[],
  diapers: Diaper[],
  medicationEvents: MedicationEvent[],
  medicationsById: Map<string, Medication>,
  notes: CareNote[]
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...feeds.map((feed): TimelineEntry => ({
      type: 'feed',
      id: feed.id,
      timestamp: new Date(feed.fed_at),
      feed,
    })),
    ...diapers.map((diaper): TimelineEntry => ({
      type: 'diaper',
      id: diaper.id,
      timestamp: new Date(diaper.changed_at),
      diaper,
    })),
    ...medicationEvents.map((event): TimelineEntry => ({
      type: 'medication',
      id: event.id,
      timestamp: new Date(event.given_at),
      event,
      medicationName: medicationsById.get(event.medication_id)?.name ?? 'Unknown medication',
    })),
    ...notes.map((note): TimelineEntry => ({
      type: 'note',
      id: note.id,
      timestamp: new Date(note.created_at),
      note,
    })),
  ];

  return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function formatDayLabel(date: Date, now: Date): string {
  const startOfDay = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  };

  const dayDiffMs = startOfDay(now) - startOfDay(date);
  const dayDiff = Math.round(dayDiffMs / (24 * 60 * 60 * 1000));

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function groupEntriesByDay(
  entries: TimelineEntry[],
  now: Date
): { label: string; entries: TimelineEntry[] }[] {
  const groups: { label: string; entries: TimelineEntry[] }[] = [];

  for (const entry of entries) {
    const label = formatDayLabel(entry.timestamp, now);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.entries.push(entry);
    } else {
      groups.push({ label, entries: [entry] });
    }
  }

  return groups;
}
