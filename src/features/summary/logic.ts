import { CareNote } from '@/features/careNotes/api';
import { Diaper } from '@/features/diapers/api';
import { DIAPER_TYPE_LABEL } from '@/features/diapers/logic';
import { Feed } from '@/features/feeds/api';
import { Medication, MedicationEvent } from '@/features/medications/api';
import { computeTodaysDoseSlots } from '@/features/medications/logic';
import { formatDuration } from '@/lib/dates/format';
import { DiaperType, FeedUnit } from '@/types';

export type FeedSummary = {
  totalCount: number;
  totalsByUnit: Partial<Record<FeedUnit, { count: number; total: number }>>;
  averageIntervalMinutes: number | null;
};

export type DiaperSummary = Record<DiaperType, number>;

export type MedicationAdherenceSummary =
  | {
      isPrn: false;
      medicationId: string;
      name: string;
      dosage: string;
      givenCount: number;
      skippedCount: number;
      missedCount: number;
      adherencePercent: number | null;
    }
  | { isPrn: true; medicationId: string; name: string; dosage: string; prnGivenCount: number };

export function computeFeedSummary(feeds: Feed[]): FeedSummary {
  const totalsByUnit: Partial<Record<FeedUnit, { count: number; total: number }>> = {};

  for (const feed of feeds) {
    const unit = feed.unit as FeedUnit;
    const existing = totalsByUnit[unit] ?? { count: 0, total: 0 };
    existing.count += 1;
    existing.total += parseFloat(feed.amount);
    totalsByUnit[unit] = existing;
  }

  let averageIntervalMinutes: number | null = null;
  if (feeds.length >= 2) {
    const sorted = [...feeds].sort(
      (a, b) => new Date(a.fed_at).getTime() - new Date(b.fed_at).getTime()
    );
    let totalGapMinutes = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalGapMinutes +=
        (new Date(sorted[i].fed_at).getTime() - new Date(sorted[i - 1].fed_at).getTime()) / 60_000;
    }
    averageIntervalMinutes = totalGapMinutes / (sorted.length - 1);
  }

  return { totalCount: feeds.length, totalsByUnit, averageIntervalMinutes };
}

export function computeDiaperSummary(diapers: Diaper[]): DiaperSummary {
  const summary: DiaperSummary = { wet: 0, dirty: 0, both: 0, dry: 0 };
  for (const diaper of diapers) {
    summary[diaper.type as DiaperType] += 1;
  }
  return summary;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function eachDayInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor);
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// Walks each calendar day in range and reuses computeTodaysDoseSlots (the
// existing grace-period/status logic from Milestone 7) per day, rather than
// duplicating that logic here. For a past day, "now" is that day's end —
// grace periods have certainly elapsed, so every unresolved slot resolves to
// 'missed'. For today, the real `now` is used so still-upcoming slots are
// correctly excluded rather than counted as missed.
export function computeMedicationAdherence(
  medications: Medication[],
  events: MedicationEvent[],
  rangeStart: Date,
  now: Date
): MedicationAdherenceSummary[] {
  return medications.map((medication) => {
    if (medication.is_prn) {
      const prnGivenCount = events.filter(
        (event) => event.medication_id === medication.id && event.status === 'prn_given'
      ).length;
      return {
        isPrn: true,
        medicationId: medication.id,
        name: medication.name,
        dosage: medication.dosage,
        prnGivenCount,
      };
    }

    let givenCount = 0;
    let skippedCount = 0;
    let missedCount = 0;

    for (const day of eachDayInRange(rangeStart, now)) {
      const dayReferenceNow = isSameDay(day, now) ? now : endOfDay(day);
      const slots = computeTodaysDoseSlots(medication, events, dayReferenceNow);
      for (const slot of slots) {
        if (slot.status === 'given') givenCount += 1;
        else if (slot.status === 'skipped') skippedCount += 1;
        else if (slot.status === 'missed') missedCount += 1;
      }
    }

    const totalResolved = givenCount + skippedCount + missedCount;
    return {
      isPrn: false,
      medicationId: medication.id,
      name: medication.name,
      dosage: medication.dosage,
      givenCount,
      skippedCount,
      missedCount,
      adherencePercent: totalResolved > 0 ? Math.round((givenCount / totalResolved) * 100) : null,
    };
  });
}

export function buildSummaryShareText(
  careRecipientName: string,
  rangeLabel: string,
  feedSummary: FeedSummary,
  diaperSummary: DiaperSummary,
  medicationAdherence: MedicationAdherenceSummary[],
  notableNotes: CareNote[],
  totalNoteCount: number
): string {
  const lines: string[] = [`Care Summary — ${careRecipientName}`, rangeLabel, ''];

  lines.push('FEEDS');
  if (feedSummary.totalCount === 0) {
    lines.push('No feeds logged.');
  } else {
    lines.push(`${feedSummary.totalCount} feeds logged`);
    for (const [unit, totals] of Object.entries(feedSummary.totalsByUnit)) {
      if (!totals) continue;
      lines.push(`  ${totals.total} ${unit} across ${totals.count} feeds`);
    }
    if (feedSummary.averageIntervalMinutes !== null) {
      lines.push(`  Average interval: ${formatDuration(feedSummary.averageIntervalMinutes)}`);
    }
  }
  lines.push('');

  lines.push('DIAPERS');
  const diaperTotal = Object.values(diaperSummary).reduce((sum, count) => sum + count, 0);
  if (diaperTotal === 0) {
    lines.push('No diaper changes logged.');
  } else {
    (Object.keys(diaperSummary) as DiaperType[]).forEach((type) => {
      lines.push(`  ${DIAPER_TYPE_LABEL[type]}: ${diaperSummary[type]}`);
    });
  }
  lines.push('');

  lines.push('MEDICATIONS');
  if (medicationAdherence.length === 0) {
    lines.push('No medications tracked.');
  } else {
    medicationAdherence.forEach((medication) => {
      if (medication.isPrn) {
        lines.push(
          `  ${medication.name} (${medication.dosage}, PRN): ${medication.prnGivenCount} given`
        );
      } else {
        const total = medication.givenCount + medication.skippedCount + medication.missedCount;
        const percent =
          medication.adherencePercent !== null ? ` (${medication.adherencePercent}%)` : '';
        lines.push(
          `  ${medication.name} (${medication.dosage}): ${medication.givenCount}/${total} given${percent}`
        );
        if (medication.missedCount > 0) lines.push(`    ${medication.missedCount} missed`);
        if (medication.skippedCount > 0) lines.push(`    ${medication.skippedCount} skipped`);
      }
    });
  }
  lines.push('');

  lines.push('NOTES');
  if (notableNotes.length === 0) {
    lines.push(`${totalNoteCount} note${totalNoteCount === 1 ? '' : 's'} logged, none notable.`);
  } else {
    notableNotes.forEach((note) => lines.push(`  ★ ${note.note}`));
    lines.push(
      `${totalNoteCount} note${totalNoteCount === 1 ? '' : 's'} logged, ${notableNotes.length} notable.`
    );
  }

  return lines.join('\n');
}
