import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipRow } from '@/components/chip-row';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { CareNote, fetchCareNotesSince } from '@/features/careNotes/api';
import { fetchDiapersSince } from '@/features/diapers/api';
import { DIAPER_TYPE_LABEL } from '@/features/diapers/logic';
import { fetchFeedsSince } from '@/features/feeds/api';
import { useHousehold } from '@/features/households/household-provider';
import { fetchAllMedications, fetchMedicationEventsSince } from '@/features/medications/api';
import {
  buildSummaryShareText,
  computeDiaperSummary,
  computeFeedSummary,
  computeMedicationAdherence,
  DiaperSummary,
  FeedSummary,
  MedicationAdherenceSummary,
} from '@/features/summary/logic';
import { formatDuration } from '@/lib/dates/format';
import { DiaperType } from '@/types';

const RANGE_OPTIONS: { key: number; label: string }[] = [
  { key: 7, label: '7 days' },
  { key: 14, label: '14 days' },
  { key: 30, label: '30 days' },
];

function sinceDate(rangeDays: number): Date {
  const since = new Date();
  since.setDate(since.getDate() - rangeDays);
  return since;
}

export default function SummaryScreen() {
  const { careRecipient } = useHousehold();
  const [rangeDays, setRangeDays] = useState(7);
  const [isLoading, setIsLoading] = useState(true);
  const [feedSummary, setFeedSummary] = useState<FeedSummary | null>(null);
  const [diaperSummary, setDiaperSummary] = useState<DiaperSummary | null>(null);
  const [medicationAdherence, setMedicationAdherence] = useState<MedicationAdherenceSummary[]>([]);
  const [notableNotes, setNotableNotes] = useState<CareNote[]>([]);
  const [totalNoteCount, setTotalNoteCount] = useState(0);

  const refetch = useCallback(
    async (days: number) => {
      if (!careRecipient) return;
      const since = sinceDate(days);
      const now = new Date();

      const [feeds, diapers, notes, medications] = await Promise.all([
        fetchFeedsSince(careRecipient.id, since),
        fetchDiapersSince(careRecipient.id, since),
        fetchCareNotesSince(careRecipient.id, since),
        fetchAllMedications(careRecipient.id),
      ]);
      const medicationEvents = await fetchMedicationEventsSince(
        medications.map((medication) => medication.id),
        since
      );

      setFeedSummary(computeFeedSummary(feeds));
      setDiaperSummary(computeDiaperSummary(diapers));
      setMedicationAdherence(computeMedicationAdherence(medications, medicationEvents, since, now));
      setNotableNotes(notes.filter((note) => note.is_notable));
      setTotalNoteCount(notes.length);
    },
    [careRecipient]
  );

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      refetch(rangeDays).finally(() => setIsLoading(false));
    }, [refetch, rangeDays])
  );

  if (!careRecipient) return null;

  const rangeLabel = `Last ${rangeDays} days`;

  const handleShare = async () => {
    if (!feedSummary || !diaperSummary) return;
    try {
      await Share.share({
        message: buildSummaryShareText(
          careRecipient.name,
          rangeLabel,
          feedSummary,
          diaperSummary,
          medicationAdherence,
          notableNotes,
          totalNoteCount
        ),
      });
    } catch (error) {
      console.warn('Share failed:', error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">Summary</ThemedText>

          <ChipRow options={RANGE_OPTIONS} activeKey={rangeDays} onSelect={setRangeDays} />

          {isLoading || !feedSummary || !diaperSummary ? null : (
            <>
              <ThemedView style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Feeds
                </ThemedText>
                {feedSummary.totalCount === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    No feeds logged.
                  </ThemedText>
                ) : (
                  <>
                    <ThemedText type="default">{feedSummary.totalCount} feeds logged</ThemedText>
                    {Object.entries(feedSummary.totalsByUnit).map(([unit, totals]) =>
                      totals ? (
                        <ThemedText key={unit} type="small" themeColor="textSecondary">
                          {totals.total} {unit} across {totals.count} feeds
                        </ThemedText>
                      ) : null
                    )}
                    {feedSummary.averageIntervalMinutes !== null ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        Average interval: {formatDuration(feedSummary.averageIntervalMinutes)}
                      </ThemedText>
                    ) : null}
                  </>
                )}
              </ThemedView>

              <ThemedView style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Diapers
                </ThemedText>
                {(Object.keys(diaperSummary) as DiaperType[]).map((type) => (
                  <ThemedText key={type} type="small" themeColor="textSecondary">
                    {DIAPER_TYPE_LABEL[type]}: {diaperSummary[type]}
                  </ThemedText>
                ))}
              </ThemedView>

              <ThemedView style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Medications
                </ThemedText>
                {medicationAdherence.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    No medications tracked.
                  </ThemedText>
                ) : (
                  medicationAdherence.map((medication) => (
                    <ThemedView key={medication.medicationId} style={styles.medicationRow}>
                      <ThemedText type="default">
                        {medication.name} · {medication.dosage}
                      </ThemedText>
                      {medication.isPrn ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {medication.prnGivenCount} given (PRN)
                        </ThemedText>
                      ) : (
                        <ThemedText type="small" themeColor="textSecondary">
                          {medication.givenCount}/
                          {medication.givenCount + medication.skippedCount + medication.missedCount}{' '}
                          given
                          {medication.adherencePercent !== null
                            ? ` (${medication.adherencePercent}%)`
                            : ''}
                          {medication.missedCount > 0 ? ` · ${medication.missedCount} missed` : ''}
                          {medication.skippedCount > 0
                            ? ` · ${medication.skippedCount} skipped`
                            : ''}
                        </ThemedText>
                      )}
                    </ThemedView>
                  ))
                )}
              </ThemedView>

              <ThemedView style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Notable Notes
                </ThemedText>
                {notableNotes.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    None notable.
                  </ThemedText>
                ) : (
                  notableNotes.map((note) => (
                    <ThemedText key={note.id} type="small">
                      ★ {note.note}
                    </ThemedText>
                  ))
                )}
                <ThemedText type="small" themeColor="textSecondary">
                  {totalNoteCount} note{totalNoteCount === 1 ? '' : 's'} logged,{' '}
                  {notableNotes.length} notable
                </ThemedText>
              </ThemedView>

              <PrimaryButton
                title="Share Summary"
                onPress={handleShare}
                style={styles.shareButton}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.one,
  },
  medicationRow: {
    gap: Spacing.half,
    marginTop: Spacing.one,
  },
  shareButton: {
    marginTop: Spacing.two,
  },
});
