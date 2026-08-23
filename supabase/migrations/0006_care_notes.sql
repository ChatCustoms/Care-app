-- Milestone 8: Care Notes / Notable Events

create table care_notes (
  id uuid primary key default gen_random_uuid(),
  care_recipient_id uuid not null references care_recipients(id) on delete cascade,
  note text not null,
  is_notable boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index care_notes_care_recipient_id_created_at_idx
  on care_notes (care_recipient_id, created_at desc);

alter table care_notes enable row level security;

-- Same one-hop shape as diapers/feeds: care_recipient_id only, checked via
-- is_household_member through care_recipients.household_id — no
-- denormalized household_id column.
create policy care_notes_select on care_notes
  for select using (
    is_household_member(
      (select household_id from care_recipients where id = care_notes.care_recipient_id)
    )
  );

create policy care_notes_insert on care_notes
  for insert with check (
    created_by = auth.uid()
    and is_household_member(
      (select household_id from care_recipients where id = care_notes.care_recipient_id)
    )
  );

-- Unlike feeds/diapers/medication_events (all insert-only), notes are
-- editable/deletable — but only by their own author, and only while still
-- a member of the household. Requiring current membership in addition to
-- authorship means a note's author can't still edit/delete it after being
-- removed from the household by some future removal flow.
create policy care_notes_update on care_notes
  for update
  using (
    created_by = auth.uid()
    and is_household_member(
      (select household_id from care_recipients where id = care_notes.care_recipient_id)
    )
  )
  with check (
    created_by = auth.uid()
    and is_household_member(
      (select household_id from care_recipients where id = care_notes.care_recipient_id)
    )
  );

create policy care_notes_delete on care_notes
  for delete using (
    created_by = auth.uid()
    and is_household_member(
      (select household_id from care_recipients where id = care_notes.care_recipient_id)
    )
  );

alter publication supabase_realtime add table care_notes;
