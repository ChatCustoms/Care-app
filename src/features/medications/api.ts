import { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';
import { MedicationEventStatus } from '@/types';

export type Medication = Database['public']['Tables']['medications']['Row'];
export type MedicationEvent = Database['public']['Tables']['medication_events']['Row'];

// 'missed' is a client-computed status (see features/medications/logic.ts) —
// the medication_events check constraint only allows these three, so it's
// excluded here to keep an attempted 'missed' insert a type error, not a
// runtime rejection.
export type LoggableMedicationEventStatus = Exclude<MedicationEventStatus, 'missed'>;

export async function fetchActiveMedications(careRecipientId: string): Promise<Medication[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('care_recipient_id', careRecipientId)
    .is('deactivated_at', null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

// Unlike fetchActiveMedications, includes deactivated medications — Timeline
// needs names for historical doses even after a medication is removed.
export async function fetchAllMedications(careRecipientId: string): Promise<Medication[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('care_recipient_id', careRecipientId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

// Scoped by medication ids (not a direct care_recipient_id column — that
// column doesn't exist on medication_events, only on medications) rather
// than an embedded join, to keep the query simple: fetch active
// medications first, then their events.
export async function fetchMedicationEventsSince(
  medicationIds: string[],
  since: Date
): Promise<MedicationEvent[]> {
  if (medicationIds.length === 0) return [];

  const { data, error } = await supabase
    .from('medication_events')
    .select('*')
    .in('medication_id', medicationIds)
    .gte('given_at', since.toISOString());

  if (error) throw error;
  return data;
}

export async function createMedication(
  careRecipientId: string,
  name: string,
  dosage: string,
  instructions: string | null,
  isPrn: boolean,
  scheduleTimes: string[]
): Promise<{ data: Medication | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('medications')
    .insert({
      care_recipient_id: careRecipientId,
      name,
      dosage,
      instructions,
      is_prn: isPrn,
      schedule_times: scheduleTimes,
    })
    .select()
    .single();

  return { data, error };
}

export async function updateMedication(
  id: string,
  name: string,
  dosage: string,
  instructions: string | null,
  isPrn: boolean,
  scheduleTimes: string[]
): Promise<{ data: Medication | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('medications')
    .update({ name, dosage, instructions, is_prn: isPrn, schedule_times: scheduleTimes })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deactivateMedication(id: string): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('medications')
    .update({ deactivated_at: new Date().toISOString() })
    .eq('id', id);
  return { error };
}

export async function logMedicationEvent(
  medicationId: string,
  status: LoggableMedicationEventStatus,
  scheduledFor: Date | null
): Promise<{ data: MedicationEvent | null; error: PostgrestError | Error | null }> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { data: null, error: userError ?? new Error('Not authenticated') };
  }

  const { data, error } = await supabase
    .from('medication_events')
    .insert({
      medication_id: medicationId,
      status,
      scheduled_for: scheduledFor ? scheduledFor.toISOString() : null,
      created_by: userData.user.id,
    })
    .select()
    .single();

  return { data, error };
}
