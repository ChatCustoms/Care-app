import { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';

export type CareNote = Database['public']['Tables']['care_notes']['Row'];

export async function fetchLatestCareNote(careRecipientId: string): Promise<CareNote | null> {
  const { data, error } = await supabase
    .from('care_notes')
    .select('*')
    .eq('care_recipient_id', careRecipientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createCareNote(
  careRecipientId: string,
  note: string,
  isNotable: boolean
): Promise<{ data: CareNote | null; error: PostgrestError | Error | null }> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { data: null, error: userError ?? new Error('Not authenticated') };
  }

  const { data, error } = await supabase
    .from('care_notes')
    .insert({
      care_recipient_id: careRecipientId,
      note,
      is_notable: isNotable,
      created_by: userData.user.id,
    })
    .select()
    .single();

  return { data, error };
}

export async function updateCareNote(
  id: string,
  note: string,
  isNotable: boolean
): Promise<{ data: CareNote | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('care_notes')
    .update({ note, is_notable: isNotable })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteCareNote(id: string): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from('care_notes').delete().eq('id', id);
  return { error };
}
