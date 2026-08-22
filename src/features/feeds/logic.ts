import { FEED_DUE_SOON_MINUTES, FEED_OVERDUE_GRACE_MINUTES } from '@/constants/feeding';
import { FeedStatus } from '@/types';

export function calculateNextFeed(lastFeedAt: Date | null, intervalMinutes: number): Date | null {
  if (!lastFeedAt) return null;
  return new Date(lastFeedAt.getTime() + intervalMinutes * 60_000);
}

export function getFeedStatus(nextFeedAt: Date | null, now: Date): FeedStatus | null {
  if (!nextFeedAt) return null;

  const dueSoonAt = new Date(nextFeedAt.getTime() - FEED_DUE_SOON_MINUTES * 60_000);
  const overdueAt = new Date(nextFeedAt.getTime() + FEED_OVERDUE_GRACE_MINUTES * 60_000);

  if (now.getTime() >= overdueAt.getTime()) return 'overdue';
  if (now.getTime() >= nextFeedAt.getTime()) return 'due';
  if (now.getTime() >= dueSoonAt.getTime()) return 'due_soon';
  return 'upcoming';
}
