import { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';

export type Household = Database['public']['Tables']['households']['Row'];

export async function fetchHouseholdForUser(userId: string): Promise<Household | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('households(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.households as Household | undefined) ?? null;
}

export async function createHouseholdRpc(
  name: string
): Promise<{ data: Household | null; error: PostgrestError | null }> {
  const { data, error } = await supabase.rpc('create_household', { household_name: name }).single();
  return { data: data ?? null, error };
}
