import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { fetchCareNotesSince } from '@/features/careNotes/api';
import { fetchDiapersSince } from '@/features/diapers/api';
import { DIAPER_TYPE_LABEL } from '@/features/diapers/logic';
import { fetchFeedsSince } from '@/features/feeds/api';
import { useHousehold } from '@/features/households/household-provider';
import {
  fetchAllMedications,
  fetchMedicationEventsSince,
  Medication,
} from '@/features/medications/api';
import {
  buildTimeline,
  groupEntriesByDay,
  MEDICATION_EVENT_STATUS_LABEL,
  TimelineEntry,
  TimelineEntryType,
} from '@/features/timeline/logic';
import { useTheme } from '@/hooks/use-theme';
import { DiaperType, MedicationEventStatus } from '@/types';

const WINDOW_INCREMENT_DAYS = 7;

const FILTERS: { key: 'all' | TimelineEntryType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'feed', label: 'Feeds' },
  { key: 'diaper', label: 'Diapers' },
  { key: 'medication', label: 'Medications' },
  { key: 'note', label: 'Notes' },
];

function sinceDate(windowDays: number): Date {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  return since;
}

function entryTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function EntryRow({ entry }: { entry: TimelineEntry }) {
  switch (entry.type) {
    case 'feed':
      return (
        <ThemedView style={styles.entryRow}>
          <ThemedText type="default">
            Feed · {entry.feed.amount} {entry.feed.unit}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {entryTime(entry.timestamp)}
          </ThemedText>
        </ThemedView>
      );
    case 'diaper':
      return (
        <ThemedView style={styles.entryRow}>
          <ThemedText type="default">
            Diaper · {DIAPER_TYPE_LABEL[entry.diaper.type as DiaperType]}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {entryTime(entry.timestamp)}
          </ThemedText>
        </ThemedView>
      );
    case 'medication':
      return (
        <ThemedView style={styles.entryRow}>
          <ThemedText type="default">
            Medication · {entry.medicationName} ·{' '}
            {
              MEDICATION_EVENT_STATUS_LABEL[
                entry.event.status as Exclude<MedicationEventStatus, 'missed'>
              ]
            }
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {entryTime(entry.timestamp)}
          </ThemedText>
        </ThemedView>
      );
    case 'note':
      return (
        <ThemedView style={styles.entryRow}>
          <ThemedText type="default">
            Note · {entry.note.is_notable ? '★ ' : ''}
            {entry.note.note}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {entryTime(entry.timestamp)}
          </ThemedText>
        </ThemedView>
      );
  }
}

export default function TimelineScreen() {
  const theme = useTheme();
  const { careRecipient } = useHousehold();
  const [windowDays, setWindowDays] = useState(WINDOW_INCREMENT_DAYS);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | TimelineEntryType>('all');

  const refetch = useCallback(
    async (days: number) => {
      if (!careRecipient) return;
      const since = sinceDate(days);

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

      const medicationsById = new Map<string, Medication>(
        medications.map((medication) => [medication.id, medication])
      );

      setEntries(buildTimeline(feeds, diapers, medicationEvents, medicationsById, notes));
    },
    [careRecipient]
  );

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      refetch(windowDays).finally(() => setIsLoading(false));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetch])
  );

  const handleLoadEarlier = async () => {
    const nextWindowDays = windowDays + WINDOW_INCREMENT_DAYS;
    setIsLoadingMore(true);
    await refetch(nextWindowDays);
    setIsLoadingMore(false);
    setWindowDays(nextWindowDays);
  };

  const filteredEntries = useMemo(
    () =>
      activeFilter === 'all' ? entries : entries.filter((entry) => entry.type === activeFilter),
    [entries, activeFilter]
  );

  const groups = useMemo(() => groupEntriesByDay(filteredEntries, new Date()), [filteredEntries]);

  if (!careRecipient) return null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">Timeline</ThemedText>

          <ThemedView style={styles.filterRow}>
            {FILTERS.map((filter) => (
              <Pressable
                key={filter.key}
                onPress={() => setActiveFilter(filter.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      activeFilter === filter.key
                        ? theme.backgroundSelected
                        : theme.backgroundElement,
                  },
                ]}
              >
                <ThemedText type="small">{filter.label}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>

          {isLoading ? null : groups.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No care activity in the last {windowDays} days
              {activeFilter === 'all'
                ? ''
                : ` matching “${FILTERS.find((f) => f.key === activeFilter)?.label}”`}
              .
            </ThemedText>
          ) : (
            groups.map((group) => (
              <ThemedView key={group.label} style={styles.daySection}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {group.label}
                </ThemedText>
                {group.entries.map((entry) => (
                  <EntryRow key={`${entry.type}-${entry.id}`} entry={entry} />
                ))}
              </ThemedView>
            ))
          )}

          {!isLoading ? (
            <PrimaryButton
              title="Load earlier"
              onPress={handleLoadEarlier}
              isLoading={isLoadingMore}
              style={styles.loadMoreButton}
            />
          ) : null}
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },
  daySection: {
    gap: Spacing.two,
  },
  entryRow: {
    gap: Spacing.half,
  },
  loadMoreButton: {
    marginTop: Spacing.two,
  },
});
