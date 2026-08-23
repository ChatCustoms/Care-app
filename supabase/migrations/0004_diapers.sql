-- Milestone 6: Diapers

create table diapers (
  id uuid primary key default gen_random_uuid(),
  care_recipient_id uuid not null references care_recipients(id) on delete cascade,
  type text not null check (type in ('wet', 'dirty', 'both', 'dry')),
  changed_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index diapers_care_recipient_changed_at_idx on diapers (care_recipient_id, changed_at desc);

alter table diapers enable row level security;

-- Same shape as feeds' RLS: scoped via a subquery from care_recipient_id to
-- care_recipients.household_id, never a denormalized household_id column
-- (see 0002_feeding.sql for why that shortcut is a cross-household hole).
create policy diapers_select on diapers
  for select using (
    is_household_member(
      (select household_id from care_recipients where id = diapers.care_recipient_id)
    )
  );

create policy diapers_insert on diapers
  for insert with check (
    created_by = auth.uid()
    and is_household_member(
      (select household_id from care_recipients where id = diapers.care_recipient_id)
    )
  );

-- No update/delete policy: no edit UI exists for logged diaper changes
-- (documented in KNOWN_LIMITATIONS.md, same gap as feeds).

alter publication supabase_realtime add table diapers;
