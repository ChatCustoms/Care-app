import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { formatDuration } from '@/lib/dates/format';
import { supabase } from '@/lib/supabase/client';
import {
  MedicationDoseNotification,
  reconcileNotifications,
} from '@/services/notifications/client';
import { DiaperType, FeedStatus, FeedUnit } from '@/types';

const DIAPER_TYPE_LABEL: Record<DiaperType, string> = {
  wet: 'Wet',
  dirty: 'Dirty',
  both: 'Both',
  dry: 'Dry',
};

const DIAPER_TYPES: DiaperType[] = ['wet', 'dirty', 'both', 'dry'];

const STATUS_COLOR: Record<FeedStatus, string | undefined> = {
  upcoming: undefined,
  due_soon: '#D97706',
  due: '#2563EB',
  overdue: '#D92D20',
};

const STATUS_LABEL: Record<FeedStatus, string> = {
  upcoming: 'Next feed in',
  due_soon: 'Due soon, in',
  due: 'Due now',
  overdue: 'Overdue by',
};

const DOSE_STATUS_COLOR: Partial<Record<DoseSlotStatus, string>> = {
  due: '#2563EB',
  missed: '#D92D20',
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

export default function TodayScreen() {
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

  const upcomingDoses: MedicationDoseNotification[] = useMemo(
    () =>
      medicationSlotsByMedication.flatMap(({ medication, slots }) =>
        slots
          .filter((slot) => slot.status === 'upcoming')
          .map((slot) => ({
            medicationId: medication.id,
            medicationName: medication.name,
            scheduledFor: slot.scheduledFor,
          }))
      ),
    [medicationSlotsByMedication]
  );

  // A derived primitive, not the medications/events arrays themselves —
  // reconcile only needs to re-run when the underlying data changes (a
  // schedule edited, an event logged), not on every 30s `now` tick that
  // moves a slot from upcoming to due (its notification was already
  // scheduled ahead of time and fires at the OS level regardless).
  const upcomingDoseSignature = useMemo(
    () =>
      upcomingDoses
        .map((dose) => `${dose.medicationId}:${dose.scheduledFor.getTime()}`)
        .sort()
        .join(','),
    [upcomingDoses]
  );

  // Deliberately keyed on the primitives nextFeedAt/upcomingDoses are
  // derived from, not on nextFeedAt itself or the medications/events
  // arrays — a freshly-constructed Date (or array) has a new identity
  // every render, which would refire this on every render for no reason.
  useEffect(() => {
    if (!careRecipient) return;
    reconcileNotifications({ careRecipientName: careRecipient.name, nextFeedAt, upcomingDoses });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    careRecipient?.id,
    careRecipient?.feed_interval_minutes,
    latestFeed?.fed_at,
    upcomingDoseSignature,
  ]);

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
          <ThemedText type="title">Today</ThemedText>

          {isLoading ? null : nextFeedAt && status ? (
            <ThemedView style={styles.statusBlock}>
              <ThemedText type="default" themeColor="textSecondary">
                {STATUS_LABEL[status]}
              </ThemedText>
              {status !== 'due' ? (
                <ThemedText
                  type="subtitle"
                  style={STATUS_COLOR[status] ? { color: STATUS_COLOR[status] } : undefined}
                >
                  {formatDuration(Math.abs(nextFeedAt.getTime() - now.getTime()) / 60_000)}
                </ThemedText>
              ) : null}
            </ThemedView>
          ) : (
            <ThemedText type="default" themeColor="textSecondary">
              Log your first feed to start tracking.
            </ThemedText>
          )}

          {latestFeed ? (
            <ThemedText type="small" themeColor="textSecondary">
              Last fed: {latestFeed.amount} {latestFeed.unit} ·{' '}
              {formatDuration((now.getTime() - new Date(latestFeed.fed_at).getTime()) / 60_000)} ago
            </ThemedText>
          ) : null}

          {errorMessage ? (
            <ThemedText type="small" style={styles.errorText}>
              {errorMessage}
            </ThemedText>
          ) : null}

          {presets.length > 0 ? (
            <ThemedView style={styles.presetRow}>
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
            </ThemedView>
          ) : !isLoading ? (
            <ThemedText type="small" themeColor="textSecondary">
              Add quick-log presets in Settings to log feeds with one tap.
            </ThemedText>
          ) : null}

          <ThemedView style={styles.diaperSection}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Diapers
            </ThemedText>

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
              <ThemedText type="small" style={styles.errorText}>
                {diaperErrorMessage}
              </ThemedText>
            ) : null}

            <ThemedView style={styles.presetRow}>
              {DIAPER_TYPES.map((type) => (
                <PrimaryButton
                  key={type}
                  title={DIAPER_TYPE_LABEL[type]}
                  onPress={() => handleLogDiaper(type)}
                  isLoading={loggingDiaperType === type}
                  disabled={loggingDiaperType !== null}
                  style={styles.presetButton}
                />
              ))}
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.diaperSection}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Medications
            </ThemedText>

            {medicationErrorMessage ? (
              <ThemedText type="small" style={styles.errorText}>
                {medicationErrorMessage}
              </ThemedText>
            ) : null}

            {medications.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Add medications in Settings to track doses here.
              </ThemedText>
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
                <ThemedView key={medication.id} style={styles.medicationRow}>
                  <ThemedText type="default">
                    {medication.name} · {medication.dosage}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {resolvedCount} of {slots.length} doses given today
                  </ThemedText>

                  {nextSlot ? (
                    <ThemedView style={styles.doseRow}>
                      <ThemedText
                        type="small"
                        style={
                          DOSE_STATUS_COLOR[nextSlot.status]
                            ? { color: DOSE_STATUS_COLOR[nextSlot.status] }
                            : undefined
                        }
                      >
                        {DOSE_STATUS_LABEL[nextSlot.status]} ·{' '}
                        {nextSlot.scheduledFor.toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </ThemedText>
                      <ThemedView style={styles.presetRow}>
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
                      </ThemedView>
                    </ThemedView>
                  ) : null}
                </ThemedView>
              );
            })}

            {medications
              .filter((medication) => medication.is_prn)
              .map((medication) => (
                <ThemedView key={medication.id} style={styles.medicationRow}>
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
                </ThemedView>
              ))}
          </ThemedView>

          <ThemedView style={styles.diaperSection}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Care Notes
            </ThemedText>

            {latestNote ? (
              <ThemedView style={styles.noteRow}>
                <ThemedView style={styles.noteInfo}>
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
                </ThemedView>
                {session?.user?.id === latestNote.created_by ? (
                  <ThemedView style={styles.rowActions}>
                    <Pressable onPress={() => startEditingNote(latestNote)}>
                      <ThemedText type="link">Edit</ThemedText>
                    </Pressable>
                    <Pressable onPress={() => handleDeleteNote(latestNote)}>
                      <ThemedText type="link" style={styles.errorText}>
                        Delete
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                ) : null}
              </ThemedView>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                No notes yet.
              </ThemedText>
            )}

            {noteErrorMessage ? (
              <ThemedText type="small" style={styles.errorText}>
                {noteErrorMessage}
              </ThemedText>
            ) : null}

            <ThemedView style={styles.noteForm}>
              <TextField
                label={editingNoteId ? 'Edit note' : 'Add a note'}
                value={noteText}
                onChangeText={setNoteText}
                multiline
              />
              <ThemedView style={styles.prnRow}>
                <ThemedText type="default">Notable</ThemedText>
                <Switch value={noteIsNotable} onValueChange={setNoteIsNotable} />
              </ThemedView>
              <ThemedView style={styles.presetRow}>
                <PrimaryButton
                  title={editingNoteId ? 'Save Changes' : 'Add Note'}
                  onPress={handleSaveNote}
                  isLoading={isSavingNote}
                  style={styles.presetButton}
                />
                {editingNoteId ? (
                  <Pressable onPress={cancelEditingNote}>
                    <ThemedText type="link">Cancel</ThemedText>
                  </Pressable>
                ) : null}
              </ThemedView>
            </ThemedView>
          </ThemedView>
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
  statusBlock: {
    gap: Spacing.one,
  },
  diaperSection: {
    gap: Spacing.one,
    marginTop: Spacing.four,
  },
  medicationRow: {
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  doseRow: {
    gap: Spacing.one,
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
    marginTop: Spacing.two,
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
    marginTop: Spacing.three,
  },
  presetButton: {
    minWidth: 100,
  },
  errorText: {
    color: '#D92D20',
  },
});
