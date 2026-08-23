import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { CareCard } from '@/components/care-card';
import { Icon } from '@/components/icon';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import {
  CareNote,
  createCareNote,
  deleteCareNote,
  fetchLatestCareNote,
  updateCareNote,
} from '@/features/careNotes/api';
import { createDiaperChange, Diaper, fetchLatestDiaper } from '@/features/diapers/api';
import { DIAPER_TYPE_LABEL } from '@/features/diapers/logic';
import {
  createFeed,
  Feed,
  FeedPreset,
  fetchFeedPresets,
  fetchLatestFeed,
} from '@/features/feeds/api';
import { calculateNextFeed, getFeedStatus } from '@/features/feeds/logic';
import { useHousehold } from '@/features/households/household-provider';
import {
  fetchActiveMedications,
  fetchMedicationEventsSince,
  logMedicationEvent,
  Medication,
  MedicationEvent,
} from '@/features/medications/api';
import { computeTodaysDoseSlots, DoseSlotStatus } from '@/features/medications/logic';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/dates/format';
import { supabase } from '@/lib/supabase/client';
import { DiaperType, FeedStatus, FeedUnit } from '@/types';

const DIAPER_TYPES: DiaperType[] = ['wet', 'dirty', 'both', 'dry'];

const STATUS_LABEL: Record<FeedStatus, string> = {
  upcoming: 'Next feed in',
  due_soon: 'Due soon, in',
  due: 'Due now',
  overdue: 'Overdue by',
};

const DOSE_STATUS_LABEL: Partial<Record<DoseSlotStatus, string>> = {
  upcoming: 'Upcoming',
  due: 'Due now',
  missed: 'Missed',
};

function startOfToday(): Date {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return midnight;
}

function getGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const { careRecipient } = useHousehold();
  const [latestFeed, setLatestFeed] = useState<Feed | null>(null);
  const [presets, setPresets] = useState<FeedPreset[]>([]);
  const [latestDiaper, setLatestDiaper] = useState<Diaper | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationEvents, setMedicationEvents] = useState<MedicationEvent[]>([]);
  const [latestNote, setLatestNote] = useState<CareNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loggingPresetId, setLoggingPresetId] = useState<string | null>(null);
  const [loggingDiaperType, setLoggingDiaperType] = useState<DiaperType | null>(null);
  const [loggingDoseKey, setLoggingDoseKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diaperErrorMessage, setDiaperErrorMessage] = useState<string | null>(null);
  const [medicationErrorMessage, setMedicationErrorMessage] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteIsNotable, setNoteIsNotable] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteErrorMessage, setNoteErrorMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const refetch = useCallback(async () => {
    if (!careRecipient) return;
    setIsLoading(true);
    const [fetchedFeed, fetchedPresets, fetchedDiaper, fetchedMedications, fetchedNote] =
      await Promise.all([
        fetchLatestFeed(careRecipient.id),
        fetchFeedPresets(careRecipient.id),
        fetchLatestDiaper(careRecipient.id),
        fetchActiveMedications(careRecipient.id),
        fetchLatestCareNote(careRecipient.id),
      ]);
    const fetchedEvents = await fetchMedicationEventsSince(
      fetchedMedications.map((medication) => medication.id),
      startOfToday()
    );
    setLatestFeed(fetchedFeed);
    setPresets(fetchedPresets);
    setLatestDiaper(fetchedDiaper);
    setMedications(fetchedMedications);
    setMedicationEvents(fetchedEvents);
    setLatestNote(fetchedNote);
    setIsLoading(false);
  }, [careRecipient]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // useFocusEffect only fires on navigation focus (mount, tab switch) — it
  // does not fire when the app is merely backgrounded and foregrounded
  // again without a navigation change. Without this, a phone that's left
  // backgrounded (not force-quit) would never notice another caregiver
  // logging a feed on a different device, and would fire a stale
  // notification at the old time.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  // Makes the common case (another caregiver logs a feed or edits a
  // preset while this screen is open) near-instant. The focus/resume
  // polling above stays as a correctness fallback — a dropped or
  // never-reconnected websocket must not mean permanently stale data.
  useEffect(() => {
    if (!careRecipient?.id) return;

    const channel = supabase
      .channel(`feeds-changes-${careRecipient.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feeds',
          filter: `care_recipient_id=eq.${careRecipient.id}`,
        },
        () => refetch()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feed_presets',
          filter: `care_recipient_id=eq.${careRecipient.id}`,
        },
        () => refetch()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'diapers',
          filter: `care_recipient_id=eq.${careRecipient.id}`,
        },
        () => refetch()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medications',
          filter: `care_recipient_id=eq.${careRecipient.id}`,
        },
        () => refetch()
      )
      .on(
        // medication_events has no care_recipient_id column to filter on
        // directly — RLS already scopes delivered rows to the caller's own
        // household (verified in Milestone 5), so an unfiltered
        // subscription here is still correctly scoped, not a broad listen.
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'medication_events' },
        () => refetch()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'care_notes',
          filter: `care_recipient_id=eq.${careRecipient.id}`,
        },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [careRecipient?.id, refetch]);

  const lastFeedAt = latestFeed ? new Date(latestFeed.fed_at) : null;
  const nextFeedAt = careRecipient
    ? calculateNextFeed(lastFeedAt, careRecipient.feed_interval_minutes)
    : null;
  const status = getFeedStatus(nextFeedAt, now);

  const scheduledMedications = useMemo(() => medications.filter((m) => !m.is_prn), [medications]);

  const medicationSlotsByMedication = useMemo(
    () =>
      scheduledMedications.map((medication) => ({
        medication,
        slots: computeTodaysDoseSlots<MedicationEvent>(medication, medicationEvents, now),
      })),
    [scheduledMedications, medicationEvents, now]
  );

  // Urgency colors are looked up by render (not module-level constants)
  // since they come from the active theme/palette — status-color and its
  // paired text label (STATUS_LABEL/DOSE_STATUS_LABEL) are shown together
  // everywhere below, never color alone.
  const statusColor: Record<FeedStatus, string | undefined> = {
    upcoming: undefined,
    due_soon: theme.statusWarning,
    due: theme.statusUrgent,
    overdue: theme.statusCritical,
  };
  const doseStatusColor: Partial<Record<DoseSlotStatus, string>> = {
    due: theme.statusUrgent,
    missed: theme.statusCritical,
  };

  if (!careRecipient) return null;

  const handleLogPreset = async (preset: FeedPreset) => {
    setErrorMessage(null);
    setLoggingPresetId(preset.id);
    const { data, error } = await createFeed(
      careRecipient.id,
      preset.amount,
      preset.unit as FeedUnit
    );
    setLoggingPresetId(null);
    if (error) {
      setErrorMessage('Something went wrong logging that feed. Please try again.');
      return;
    }
    if (data) setLatestFeed(data);
  };

  const handleLogDiaper = async (type: DiaperType) => {
    setDiaperErrorMessage(null);
    setLoggingDiaperType(type);
    const { data, error } = await createDiaperChange(careRecipient.id, type);
    setLoggingDiaperType(null);
    if (error) {
      setDiaperErrorMessage('Something went wrong logging that change. Please try again.');
      return;
    }
    if (data) setLatestDiaper(data);
  };

  const handleLogDose = async (
    medicationId: string,
    scheduledFor: Date,
    status: 'given' | 'skipped'
  ) => {
    setMedicationErrorMessage(null);
    const key = `${medicationId}:${scheduledFor.getTime()}:${status}`;
    setLoggingDoseKey(key);
    const { data, error } = await logMedicationEvent(medicationId, status, scheduledFor);
    setLoggingDoseKey(null);
    if (error) {
      setMedicationErrorMessage('Something went wrong logging that dose. Please try again.');
      return;
    }
    if (data) setMedicationEvents((current) => [...current, data]);
  };

  const handleLogPrn = async (medicationId: string) => {
    setMedicationErrorMessage(null);
    const key = `${medicationId}:prn`;
    setLoggingDoseKey(key);
    const { data, error } = await logMedicationEvent(medicationId, 'prn_given', null);
    setLoggingDoseKey(null);
    if (error) {
      setMedicationErrorMessage('Something went wrong logging that dose. Please try again.');
      return;
    }
    if (data) setMedicationEvents((current) => [...current, data]);
  };

  const startEditingNote = (note: CareNote) => {
    setEditingNoteId(note.id);
    setNoteText(note.note);
    setNoteIsNotable(note.is_notable);
    setNoteErrorMessage(null);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setNoteText('');
    setNoteIsNotable(false);
    setNoteErrorMessage(null);
  };

  const handleSaveNote = async () => {
    setNoteErrorMessage(null);
    if (noteText.trim().length === 0) {
      setNoteErrorMessage('Please enter a note.');
      return;
    }
    setIsSavingNote(true);
    const { data, error } = editingNoteId
      ? await updateCareNote(editingNoteId, noteText.trim(), noteIsNotable)
      : await createCareNote(careRecipient.id, noteText.trim(), noteIsNotable);
    setIsSavingNote(false);
    if (error) {
      setNoteErrorMessage('Something went wrong saving that note. Please try again.');
      return;
    }
    if (data) {
      setLatestNote(data);
      cancelEditingNote();
    }
  };

  const handleDeleteNote = async (note: CareNote) => {
    setNoteErrorMessage(null);
    const { error } = await deleteCareNote(note.id);
    if (error) {
      setNoteErrorMessage('Something went wrong deleting that note. Please try again.');
      return;
    }
    if (editingNoteId === note.id) cancelEditingNote();
    // The next-most-recent note (if any) needs a fresh fetch — deleting
    // doesn't tell us what it is, only that this one is gone.
    if (latestNote?.id === note.id) {
      setLatestNote(await fetchLatestCareNote(careRecipient.id));
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText type="small" themeColor="textSecondary">
                Today
              </ThemedText>
              <ThemedText type="subtitle">
                {getGreeting(now)}, {careRecipient.name}
              </ThemedText>
            </View>
            <Avatar name={careRecipient.name} size={48} />
          </View>

          {/* Feeding is the hero card — the next-feed countdown is the
              highest-priority information on this screen. */}
          <View
            style={[
              styles.heroCard,
              { backgroundColor: theme.feedAccentSoft, borderColor: theme.border },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Icon name="feed" size={22} color={theme.feedAccent} />
              <ThemedText type="smallBold" style={{ color: theme.feedAccent }}>
                Feeding
              </ThemedText>
            </View>

            {isLoading ? null : nextFeedAt && status ? (
              <View style={styles.heroStatusBlock}>
                <View style={styles.heroStatusLabelRow}>
                  {status !== 'upcoming' ? (
                    <Icon
                      name="warning"
                      size={16}
                      color={statusColor[status] ?? theme.textSecondary}
                    />
                  ) : null}
                  <ThemedText type="default" themeColor="textSecondary">
                    {STATUS_LABEL[status]}
                  </ThemedText>
                </View>
                {status !== 'due' ? (
                  <ThemedText
                    type="title"
                    style={statusColor[status] ? { color: statusColor[status] } : undefined}
                  >
                    {formatDuration(Math.abs(nextFeedAt.getTime() - now.getTime()) / 60_000)}
                  </ThemedText>
                ) : null}
              </View>
            ) : (
              <ThemedText type="default" themeColor="textSecondary">
                Log your first feed to start tracking.
              </ThemedText>
            )}

            {latestFeed ? (
              <ThemedText type="small" themeColor="textSecondary">
                Last fed: {latestFeed.amount} {latestFeed.unit} ·{' '}
                {formatDuration((now.getTime() - new Date(latestFeed.fed_at).getTime()) / 60_000)}{' '}
                ago
              </ThemedText>
            ) : null}

            {errorMessage ? (
              <ThemedText type="small" themeColor="statusCritical">
                {errorMessage}
              </ThemedText>
            ) : null}

            {presets.length > 0 ? (
              <View style={styles.presetRow}>
                {presets.map((preset) => (
                  <PrimaryButton
                    key={preset.id}
                    title={`${preset.amount} ${preset.unit}`}
                    onPress={() => handleLogPreset(preset)}
                    isLoading={loggingPresetId === preset.id}
                    disabled={loggingPresetId !== null}
                    style={styles.presetButton}
                  />
                ))}
              </View>
            ) : !isLoading ? (
              <ThemedText type="small" themeColor="textSecondary">
                Add quick-log presets in Settings to log feeds with one tap.
              </ThemedText>
            ) : null}
          </View>

          <CareCard category="diaper" title="Diapers">
            {latestDiaper ? (
              <ThemedText type="small" themeColor="textSecondary">
                Last changed: {DIAPER_TYPE_LABEL[latestDiaper.type as DiaperType]} ·{' '}
                {formatDuration(
                  (now.getTime() - new Date(latestDiaper.changed_at).getTime()) / 60_000
                )}{' '}
                ago
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                No diaper changes logged yet.
              </ThemedText>
            )}

            {diaperErrorMessage ? (
              <ThemedText type="small" themeColor="statusCritical">
                {diaperErrorMessage}
              </ThemedText>
            ) : null}

            <View style={styles.diaperActionsRow}>
              {DIAPER_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => handleLogDiaper(type)}
                  disabled={loggingDiaperType !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Log ${DIAPER_TYPE_LABEL[type]} diaper change`}
                  style={[styles.diaperActionButton, { backgroundColor: theme.backgroundElement }]}
                >
                  {loggingDiaperType === type ? (
                    <ActivityIndicator color={theme.diaperAccent} />
                  ) : (
                    <>
                      <Icon name="diaper" size={22} color={theme.diaperAccent} />
                      <ThemedText type="small" style={{ color: theme.diaperAccent }}>
                        {DIAPER_TYPE_LABEL[type]}
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              ))}
            </View>
          </CareCard>

          <CareCard category="medication" title="Medications">
            {medicationErrorMessage ? (
              <ThemedText type="small" themeColor="statusCritical">
                {medicationErrorMessage}
              </ThemedText>
            ) : null}

            {medications.length === 0 ? (
              <View style={styles.emptyStateRow}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyStateText}>
                  No medications tracked yet.
                </ThemedText>
                <Link href="/settings/medications" asChild>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add a medication"
                    style={styles.addMedicationButton}
                  >
                    <Icon name="add" size={18} color={theme.medicationAccent} />
                    <ThemedText type="smallBold" style={{ color: theme.medicationAccent }}>
                      Add medication
                    </ThemedText>
                  </Pressable>
                </Link>
              </View>
            ) : null}

            {medicationSlotsByMedication.map(({ medication, slots }) => {
              const resolvedCount = slots.filter(
                (slot) => slot.status === 'given' || slot.status === 'skipped'
              ).length;
              const nextSlot = slots.find(
                (slot) =>
                  slot.status === 'upcoming' || slot.status === 'due' || slot.status === 'missed'
              );

              return (
                <View key={medication.id} style={styles.medicationRow}>
                  <ThemedText type="default">
                    {medication.name} · {medication.dosage}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {resolvedCount} of {slots.length} doses given today
                  </ThemedText>

                  {nextSlot ? (
                    <View style={styles.doseRow}>
                      <View style={styles.doseStatusLabelRow}>
                        {nextSlot.status !== 'upcoming' ? (
                          <Icon
                            name="warning"
                            size={14}
                            color={doseStatusColor[nextSlot.status] ?? theme.textSecondary}
                          />
                        ) : null}
                        <ThemedText
                          type="small"
                          style={
                            doseStatusColor[nextSlot.status]
                              ? { color: doseStatusColor[nextSlot.status] }
                              : undefined
                          }
                        >
                          {DOSE_STATUS_LABEL[nextSlot.status]} ·{' '}
                          {nextSlot.scheduledFor.toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </ThemedText>
                      </View>
                      <View style={styles.presetRow}>
                        <PrimaryButton
                          title="Given"
                          onPress={() =>
                            handleLogDose(medication.id, nextSlot.scheduledFor, 'given')
                          }
                          isLoading={
                            loggingDoseKey ===
                            `${medication.id}:${nextSlot.scheduledFor.getTime()}:given`
                          }
                          disabled={loggingDoseKey !== null}
                          style={styles.presetButton}
                        />
                        <PrimaryButton
                          title="Skip"
                          onPress={() =>
                            handleLogDose(medication.id, nextSlot.scheduledFor, 'skipped')
                          }
                          isLoading={
                            loggingDoseKey ===
                            `${medication.id}:${nextSlot.scheduledFor.getTime()}:skipped`
                          }
                          disabled={loggingDoseKey !== null}
                          style={styles.presetButton}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {medications
              .filter((medication) => medication.is_prn)
              .map((medication) => (
                <View key={medication.id} style={styles.medicationRow}>
                  <ThemedText type="default">
                    {medication.name} · {medication.dosage}
                  </ThemedText>
                  <PrimaryButton
                    title="Log now"
                    onPress={() => handleLogPrn(medication.id)}
                    isLoading={loggingDoseKey === `${medication.id}:prn`}
                    disabled={loggingDoseKey !== null}
                    style={styles.presetButton}
                  />
                </View>
              ))}
          </CareCard>

          <CareCard category="note" title="Care Notes">
            {latestNote ? (
              <View style={styles.noteRow}>
                <View style={styles.noteInfo}>
                  <ThemedText type="default">
                    {latestNote.is_notable ? '★ ' : ''}
                    {latestNote.note}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDuration(
                      (now.getTime() - new Date(latestNote.created_at).getTime()) / 60_000
                    )}{' '}
                    ago
                  </ThemedText>
                </View>
                {session?.user?.id === latestNote.created_by ? (
                  <View style={styles.rowActions}>
                    <Pressable
                      onPress={() => startEditingNote(latestNote)}
                      accessibilityRole="button"
                      accessibilityLabel="Edit note"
                    >
                      <ThemedText type="link">Edit</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteNote(latestNote)}
                      accessibilityRole="button"
                      accessibilityLabel="Delete note"
                    >
                      <ThemedText type="link" themeColor="statusCritical">
                        Delete
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                No notes yet.
              </ThemedText>
            )}

            {noteErrorMessage ? (
              <ThemedText type="small" themeColor="statusCritical">
                {noteErrorMessage}
              </ThemedText>
            ) : null}

            <View style={styles.noteForm}>
              <TextField
                label={editingNoteId ? 'Edit note' : 'Add a note'}
                value={noteText}
                onChangeText={setNoteText}
                multiline
              />
              <View style={styles.prnRow}>
                <ThemedText type="default">Notable</ThemedText>
                <Switch value={noteIsNotable} onValueChange={setNoteIsNotable} />
              </View>
              <View style={styles.presetRow}>
                <PrimaryButton
                  title={editingNoteId ? 'Save Changes' : 'Add Note'}
                  onPress={handleSaveNote}
                  isLoading={isSavingNote}
                  style={styles.presetButton}
                />
                {editingNoteId ? (
                  <Pressable
                    onPress={cancelEditingNote}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel editing note"
                  >
                    <ThemedText type="link">Cancel</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </CareCard>
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
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    gap: Spacing.half,
  },
  heroCard: {
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  heroStatusBlock: {
    gap: Spacing.one,
  },
  heroStatusLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  doseStatusLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  medicationRow: {
    gap: Spacing.one,
  },
  doseRow: {
    gap: Spacing.one,
  },
  diaperActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  diaperActionButton: {
    minWidth: Spacing.touchTarget * 1.6,
    minHeight: Spacing.touchTarget,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  emptyStateRow: {
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  emptyStateText: {
    flexShrink: 1,
  },
  addMedicationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: Spacing.touchTarget,
  },
  noteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  noteInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  noteForm: {
    gap: Spacing.two,
  },
  prnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  presetButton: {
    minWidth: 100,
  },
});
