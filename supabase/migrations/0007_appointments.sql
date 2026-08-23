-- Milestone 11: Appointments

create table appointments (
  id uuid primary key default gen_random_uuid(),
  care_recipient_id uuid not null references care_recipients(id) on delete cascade,
  title text not null,
  provider text,
  location text,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index appointments_care_recipient_id_scheduled_at_idx
  on appointments (care_recipient_id, scheduled_at);

alter table appointments enable row level security;

-- Same one-hop shape as every child table since Milestone 3:
-- care_recipient_id only, checked via is_household_member through
-- care_recipients.household_id — no denormalized household_id column.
create policy appointments_select on appointments
  for select using (
    is_household_member(
      (select household_id from care_recipients where id = appointments.care_recipient_id)
    )
  );

create policy appointments_insert on appointments
  for insert with check (
    created_by = auth.uid()
    and is_household_member(
      (select household_id from care_recipients where id = appointments.care_recipient_id)
    )
  );

-- Household-wide update (not author-restricted, unlike care_notes): the
-- caregiver who creates an appointment is often not the one who attends it
-- and needs to write post-visit notes afterward, so author-scoping update
-- would block exactly that caregiver.
create policy appointments_update on appointments
  for update
  using (
    is_household_member(
      (select household_id from care_recipients where id = appointments.care_recipient_id)
    )
  )
  with check (
    is_household_member(
      (select household_id from care_recipients where id = appointments.care_recipient_id)
    )
  );

-- No delete policy: cancellation is status = 'cancelled', the same
-- soft-state-over-hard-delete precedent as medications.deactivated_at —
-- keeps cancelled/completed appointments visible in history.

alter publication supabase_realtime add table appointments;
