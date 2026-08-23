import { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';
import { DiaperType } from '@/types';

export type Diaper = Database['public']['Tables']['diapers']['Row'];

export async function fetchLatestDiaper(careRecipientId: string): Promise<Diaper | null> {
  const { data, error } = await supabase
    .from('diapers')
    .select('*')
    .eq('care_recipient_id', careRecipientId)
    .order('changed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createDiaperChange(
  careRecipientId: string,
  type: DiaperType
): Promise<{ data: Diaper | null; error: PostgrestError | Error | null }> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { data: null, error: userError ?? new Error('Not authenticated') };
  }

  const { data, error } = await supabase
    .from('diapers')
    .insert({ care_recipient_id: careRecipientId, type, created_by: userData.user.id })
    .select()
    .single();

  return { data, error };
}
