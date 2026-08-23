import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { fetchUpcomingAppointmentsForReminders } from '@/features/appointments/api';
import { fetchLatestFeed, Feed } from '@/features/feeds/api';
import { calculateNextFeed } from '@/features/feeds/logic';
import { useHousehold } from '@/features/households/household-provider';
import {
  fetchActiveMedications,
  fetchMedicationEventsSince,
  Medication,
  MedicationEvent,
} from '@/features/medications/api';
import { computeTodaysDoseSlots } from '@/features/medications/logic';
import { supabase } from '@/lib/supabase/client';
import {
  AppointmentReminder,
  MedicationDoseNotification,
  reconcileNotifications,
} from '@/services/notifications/client';

function startOfToday(): Date {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return midnight;
}

// The single owner of reconcileNotifications() app-wide — invoked once from
// (app)/_layout.tsx so reminders stay correct regardless of which tab is
// focused. reconcileNotifications() cancels every scheduled local
// notification and reschedules only what it's given each call, so a second
// caller (e.g. a screen reconciling only its own slice of data) would
// silently wipe out reminders this hook already scheduled — see the plan
// for Milestone 11 for the bug this fixes.
export function useReconcileNotifications() {
  const { careRecipient } = useHousehold();
  const [latestFeed, setLatestFeed] = useState<Feed | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationEvents, setMedicationEvents] = useState<MedicationEvent[]>([]);
  const [appointments, setAppointments] = useState<AppointmentReminder[]>([]);

  const refetch = useCallback(async () => {
    if (!careRecipient) return;
    const now = new Date();
    const [feed, activeMedications, upcomingAppointments] = await Promise.all([
      fetchLatestFeed(careRecipient.id),
      fetchActiveMedications(careRecipient.id),
      fetchUpcomingAppointmentsForReminders(careRecipient.id, now),
    ]);
    const events = await fetchMedicationEventsSince(
      activeMedications.map((medication) => medication.id),
      startOfToday()
    );

    setLatestFeed(feed);
    setMedications(activeMedications);
    setMedicationEvents(events);
    setAppointments(
      upcomingAppointments.map((appointment) => ({
        appointmentId: appointment.id,
        title: appointment.title,
        scheduledFor: new Date(appointment.scheduled_at),
      }))
    );
  }, [careRecipient]);

  // useFocusEffect, not a plain useEffect, purely to satisfy the
  // set-state-in-effect lint rule (calling a setState-triggering async
  // function synchronously in a bare useEffect body is disallowed) — this
  // hook lives in (app)/_layout.tsx, which per Tabs' focus semantics never
  // blurs from switching between child tabs, so in practice this still
  // behaves like "fetch on mount and whenever refetch's identity changes",
  // not "refetch on tab focus".
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Mirrors Today's own AppState-resume listener (pre-Milestone-11 this
  // logic lived there) — a backgrounded-not-terminated app must still
  // notice another caregiver's changes.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  useEffect(() => {
    if (!careRecipient?.id) return;

    const channel = supabase
      .channel(`reminder-reconcile-${careRecipient.id}`)
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
          table: 'medications',
          filter: `care_recipient_id=eq.${careRecipient.id}`,
        },
        () => refetch()
      )
      .on(
        // medication_events has no care_recipient_id column — RLS already
        // scopes delivered rows to the caller's own household.
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'medication_events' },
        () => refetch()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `care_recipient_id=eq.${careRecipient.id}`,
        },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [careRecipient?.id, refetch]);

  const nextFeedAt = careRecipient
    ? calculateNextFeed(
        latestFeed ? new Date(latestFeed.fed_at) : null,
        careRecipient.feed_interval_minutes
      )
    : null;

  const scheduledMedications = useMemo(() => medications.filter((m) => !m.is_prn), [medications]);

  const upcomingDoses: MedicationDoseNotification[] = useMemo(
    () =>
      scheduledMedications.flatMap((medication) =>
        computeTodaysDoseSlots<MedicationEvent>(medication, medicationEvents, new Date())
          .filter((slot) => slot.status === 'upcoming')
          .map((slot) => ({
            medicationId: medication.id,
            medicationName: medication.name,
            scheduledFor: slot.scheduledFor,
          }))
      ),
    [scheduledMedications, medicationEvents]
  );

  // Derived signature strings, not the arrays themselves — reconcile only
  // needs to re-run when the underlying data changes, not on every render
  // (a freshly-mapped array has a new identity every time).
  const upcomingDoseSignature = useMemo(
    () =>
      upcomingDoses
        .map((dose) => `${dose.medicationId}:${dose.scheduledFor.getTime()}`)
        .sort()
        .join(','),
    [upcomingDoses]
  );
  const upcomingAppointmentSignature = useMemo(
    () =>
      appointments
        .map((appointment) => `${appointment.appointmentId}:${appointment.scheduledFor.getTime()}`)
        .sort()
        .join(','),
    [appointments]
  );

  useEffect(() => {
    if (!careRecipient) return;
    reconcileNotifications({
      careRecipientName: careRecipient.name,
      nextFeedAt,
      upcomingDoses,
      upcomingAppointments: appointments,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    careRecipient?.id,
    careRecipient?.feed_interval_minutes,
    latestFeed?.fed_at,
    upcomingDoseSignature,
    upcomingAppointmentSignature,
  ]);
}
