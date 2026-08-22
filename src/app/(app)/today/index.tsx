import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  createFeed,
  Feed,
  FeedPreset,
  fetchFeedPresets,
  fetchLatestFeed,
} from '@/features/feeds/api';
import { calculateNextFeed, getFeedStatus } from '@/features/feeds/logic';
import { useHousehold } from '@/features/households/household-provider';
import { formatDuration } from '@/lib/dates/format';
import { reconcileNextFeedNotification } from '@/services/notifications/client';
import { FeedStatus, FeedUnit } from '@/types';

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

export default function TodayScreen() {
  const { careRecipient } = useHousehold();
  const [latestFeed, setLatestFeed] = useState<Feed | null>(null);
  const [presets, setPresets] = useState<FeedPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loggingPresetId, setLoggingPresetId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const refetch = useCallback(async () => {
    if (!careRecipient) return;
    setIsLoading(true);
    const [fetchedFeed, fetchedPresets] = await Promise.all([
      fetchLatestFeed(careRecipient.id),
      fetchFeedPresets(careRecipient.id),
    ]);
    setLatestFeed(fetchedFeed);
    setPresets(fetchedPresets);
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

  const lastFeedAt = latestFeed ? new Date(latestFeed.fed_at) : null;
  const nextFeedAt = careRecipient
    ? calculateNextFeed(lastFeedAt, careRecipient.feed_interval_minutes)
    : null;
  const status = getFeedStatus(nextFeedAt, now);

  // Deliberately keyed on the primitives nextFeedAt is derived from, not on
  // nextFeedAt itself — a freshly-constructed Date has a new identity every
  // render, which would refire this on every render for no reason.
  useEffect(() => {
    if (!careRecipient) return;
    reconcileNextFeedNotification(careRecipient.name, nextFeedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careRecipient?.id, careRecipient?.feed_interval_minutes, latestFeed?.fed_at]);

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

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.content}>
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
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  statusBlock: {
    gap: Spacing.one,
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
