import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { fetchLatestFeed, Feed } from '@/features/feeds/api';
import { calculateNextFeed } from '@/features/feeds/logic';
import { useHousehold } from '@/features/households/household-provider';
import {
  fetchActiveMedications,
  fetchMedicationEventsSince,
  Medication,
  MedicationEvent,
} from '@/features/medications/api';
import { buildWidgetPayload } from '@/features/widget/logic';
import { writeWidgetPayload } from '@/features/widget/native-storage';
import { supabase } from '@/lib/supabase/client';

function startOfToday(): Date {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return midnight;
}

// A sibling to useReconcileNotifications, not an extension of it —
// deliberately separate so an unrelated appointment change (which has no
// bearing on widget content) never triggers a widget reload. Invoked once
// from (app)/_layout.tsx, independent of which tab is focused, since the
// widget must stay in sync regardless of what's on screen.
export function useSyncWidgetStorage() {
  const { careRecipient } = useHousehold();
  const [latestFeed, setLatestFeed] = useState<Feed | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationEvents, setMedicationEvents] = useState<MedicationEvent[]>([]);

  const refetch = useCallback(async () => {
    if (!careRecipient) return;
    const [feed, activeMedications] = await Promise.all([
      fetchLatestFeed(careRecipient.id),
      fetchActiveMedications(careRecipient.id),
    ]);
    const events = await fetchMedicationEventsSince(
      activeMedications.map((medication) => medication.id),
      startOfToday()
    );

    setLatestFeed(feed);
    setMedications(activeMedications);
    setMedicationEvents(events);
  }, [careRecipient]);

  // useFocusEffect, not a plain useEffect — satisfies the
  // set-state-in-effect lint rule the same way useReconcileNotifications
  // does; this hook lives in (app)/_layout.tsx which never blurs from
  // switching between child tabs, so it still behaves like "on mount and
  // whenever refetch's identity changes".
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  useEffect(() => {
    if (!careRecipient?.id) return;

    const channel = supabase
      .channel(`widget-sync-${careRecipient.id}`)
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [careRecipient?.id, refetch]);

  const scheduledMedications = useMemo(() => medications.filter((m) => !m.is_prn), [medications]);

  // A derived signature, not the payload object itself — a freshly-built
  // payload has a new identity every render, which would write to native
  // widget storage (and burn part of the OS's widget-reload budget) on
  // every render for no reason.
  const payloadSignature = useMemo(() => {
    if (!careRecipient) return '';
    const payload = buildWidgetPayload(
      careRecipient.name,
      calculateNextFeed(
        latestFeed ? new Date(latestFeed.fed_at) : null,
        careRecipient.feed_interval_minutes
      ),
      scheduledMedications,
      medicationEvents,
      new Date()
    );
    return JSON.stringify(payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careRecipient, latestFeed?.fed_at, scheduledMedications, medicationEvents]);

  useEffect(() => {
    if (!careRecipient || !payloadSignature) return;
    writeWidgetPayload(JSON.parse(payloadSignature));
  }, [careRecipient, payloadSignature]);
}
