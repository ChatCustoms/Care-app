import { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';

export type Household = Database['public']['Tables']['households']['Row'];
export type HouseholdInvite = Database['public']['Tables']['household_invites']['Row'];
export type HouseholdMember = Database['public']['Tables']['household_members']['Row'];
export type HouseholdCaregiver =
  Database['public']['Functions']['list_household_caregivers']['Returns'][number];

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

export async function fetchPendingInviteForEmail(email: string): Promise<HouseholdInvite | null> {
  const { data, error } = await supabase
    .from('household_invites')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .is('accepted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function acceptHouseholdInviteRpc(
  inviteId: string
): Promise<{ data: HouseholdMember | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .rpc('accept_household_invite', { target_invite_id: inviteId })
    .single();
  return { data: data ?? null, error };
}

export async function createHouseholdInvite(
  householdId: string,
  email: string
): Promise<{ error: PostgrestError | Error | null }> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { error: userError ?? new Error('Not authenticated') };
  }

  const { error } = await supabase.from('household_invites').insert({
    household_id: householdId,
    email: email.trim().toLowerCase(),
    invited_by: userData.user.id,
  });
  return { error };
}

export async function fetchHouseholdCaregivers(householdId: string): Promise<HouseholdCaregiver[]> {
  const { data, error } = await supabase.rpc('list_household_caregivers', {
    target_household_id: householdId,
  });
  if (error) throw error;
  return data ?? [];
}
