import { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';

export type CareRecipient = Database['public']['Tables']['care_recipients']['Row'];

export async function fetchCareRecipient(householdId: string): Promise<CareRecipient | null> {
  const { data, error } = await supabase
    .from('care_recipients')
    .select('*')
    .eq('household_id', householdId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createCareRecipient(
  householdId: string,
  name: string,
  dateOfBirth: string | null
): Promise<{ data: CareRecipient | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('care_recipients')
    .insert({ household_id: householdId, name, date_of_birth: dateOfBirth })
    .select()
    .single();

  return { data, error };
}

export async function updateFeedIntervalMinutes(
  careRecipientId: string,
  minutes: number
): Promise<{ data: CareRecipient | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .rpc('update_feed_interval_minutes', {
      target_care_recipient_id: careRecipientId,
      new_interval_minutes: minutes,
    })
    .single();

  return { data: data ?? null, error };
}
