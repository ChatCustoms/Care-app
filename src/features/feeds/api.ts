import { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';
import { FeedUnit } from '@/types';

export type Feed = Database['public']['Tables']['feeds']['Row'];
export type FeedPreset = Database['public']['Tables']['feed_presets']['Row'];

export async function fetchLatestFeed(careRecipientId: string): Promise<Feed | null> {
  const { data, error } = await supabase
    .from('feeds')
    .select('*')
    .eq('care_recipient_id', careRecipientId)
    .order('fed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchFeedsSince(careRecipientId: string, since: Date): Promise<Feed[]> {
  const { data, error } = await supabase
    .from('feeds')
    .select('*')
    .eq('care_recipient_id', careRecipientId)
    .gte('fed_at', since.toISOString())
    .order('fed_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchFeedPresets(careRecipientId: string): Promise<FeedPreset[]> {
  const { data, error } = await supabase
    .from('feed_presets')
    .select('*')
    .eq('care_recipient_id', careRecipientId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function createFeed(
  careRecipientId: string,
  amount: string,
  unit: FeedUnit
): Promise<{ data: Feed | null; error: PostgrestError | Error | null }> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { data: null, error: userError ?? new Error('Not authenticated') };
  }

  const { data, error } = await supabase
    .from('feeds')
    .insert({ care_recipient_id: careRecipientId, amount, unit, created_by: userData.user.id })
    .select()
    .single();

  return { data, error };
}

export async function createFeedPreset(
  careRecipientId: string,
  amount: string,
  unit: FeedUnit
): Promise<{ data: FeedPreset | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('feed_presets')
    .insert({ care_recipient_id: careRecipientId, amount, unit })
    .select()
    .single();

  return { data, error };
}

export async function deleteFeedPreset(id: string): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from('feed_presets').delete().eq('id', id);
  return { error };
}
