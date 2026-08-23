import { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';
import { AppointmentStatus } from '@/types';

export type Appointment = Database['public']['Tables']['appointments']['Row'];

export async function fetchAppointments(careRecipientId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('care_recipient_id', careRecipientId)
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return data;
}

// Bounded to a lookahead window (not just "status = scheduled") — used only
// by the notification reconcile hook. Unlike medication doses (naturally
// bounded to "today"), appointments have no natural bound, and iOS caps
// pending local notifications at 64 system-wide — see KNOWN_LIMITATIONS.md.
export async function fetchUpcomingAppointmentsForReminders(
  careRecipientId: string,
  now: Date
): Promise<Appointment[]> {
  const lookaheadEnd = new Date(now.getTime() + 14 * 24 * 60 * 60_000);

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('care_recipient_id', careRecipientId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', lookaheadEnd.toISOString());

  if (error) throw error;
  return data;
}

export async function createAppointment(
  careRecipientId: string,
  title: string,
  provider: string | null,
  location: string | null,
  scheduledAt: Date
): Promise<{ data: Appointment | null; error: PostgrestError | Error | null }> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { data: null, error: userError ?? new Error('Not authenticated') };
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      care_recipient_id: careRecipientId,
      title,
      provider,
      location,
      scheduled_at: scheduledAt.toISOString(),
      created_by: userData.user.id,
    })
    .select()
    .single();

  return { data, error };
}

export async function updateAppointment(
  id: string,
  title: string,
  provider: string | null,
  location: string | null,
  scheduledAt: Date,
  status: AppointmentStatus,
  notes: string | null
): Promise<{ data: Appointment | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('appointments')
    .update({
      title,
      provider,
      location,
      scheduled_at: scheduledAt.toISOString(),
      status,
      notes,
    })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function cancelAppointment(
  id: string
): Promise<{ data: Appointment | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}
