-- Milestone 7: Medications

create table medications (
  id uuid primary key default gen_random_uuid(),
  care_recipient_id uuid not null references care_recipients(id) on delete cascade,
  name text not null,
  dosage text not null,
  instructions text,
  is_prn boolean not null default false,
  schedule_times time[] not null default '{}',
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint medications_schedule_times_check check (
    (is_prn and cardinality(schedule_times) = 0) or
    (not is_prn and cardinality(schedule_times) > 0)
  )
);

comment on column medications.schedule_times is
  'Daily clock times, no date/timezone component. Interpreted against the viewing '
  'device''s local calendar day. Returned as text[] (e.g. {"08:00:00","20:00:00"}) '
  'by supabase-js, not a JS Date type.';
comment on column medications.deactivated_at is
  'Soft-delete marker. Null = active. Set (never physically deleted) when a '
  'caregiver removes a medication, to preserve medication_events history.';

create index medications_care_recipient_id_idx on medications (care_recipient_id);

create table medication_events (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references medications(id) on delete cascade,
  status text not null check (status in ('given', 'skipped', 'prn_given')),
  scheduled_for timestamptz,
  given_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint medication_events_prn_scheduled_check check (
    (status = 'prn_given' and scheduled_for is null) or
    (status in ('given', 'skipped') and scheduled_for is not null)
  )
);

comment on column medication_events.scheduled_for is
  'The dose slot this event answers, constructed client-side from schedule_times + '
  'the device''s local date at insert time. Null for PRN logs. Deliberately NOT '
  'unique per (medication_id, scheduled_for): a corrective re-log (e.g. fixing an '
  'accidental Skip) is a new row, not an edit — computeTodaysDoseSlots resolves the '
  'most-recently-created row per slot as authoritative, keeping both the mistake and '
  'the correction in the audit trail.';

create index medication_events_medication_id_scheduled_for_idx
  on medication_events (medication_id, scheduled_for);

alter table medications enable row level security;
alter table medication_events enable row level security;

-- medications: direct care_recipient_id FK, same one-hop shape as diapers/feeds.
create policy medications_select on medications
  for select using (
    is_household_member(
      (select household_id from care_recipients where id = medications.care_recipient_id)
    )
  );

create policy medications_insert on medications
  for insert with check (
    is_household_member(
      (select household_id from care_recipients where id = medications.care_recipient_id)
    )
  );

create policy medications_update on medications
  for update
  using (
    is_household_member(
      (select household_id from care_recipients where id = medications.care_recipient_id)
    )
  )
  with check (
    is_household_member(
      (select household_id from care_recipients where id = medications.care_recipient_id)
    )
  );
-- No delete policy: "Remove" in the UI is update(deactivated_at = now()).

-- medication_events: two-hop chain, medication_events -> medications -> care_recipients.
-- No client-supplied household_id or care_recipient_id anywhere on this table — the
-- household is derived entirely from medication_id via the FK chain, so the
-- Milestone 3 injection class of bug (a client-supplied household_id not verified
-- against the row's real parent) is structurally impossible here.
create policy medication_events_select on medication_events
  for select using (
    is_household_member(
      (select cr.household_id
         from medications m
         join care_recipients cr on cr.id = m.care_recipient_id
        where m.id = medication_events.medication_id)
    )
  );

create policy medication_events_insert on medication_events
  for insert with check (
    created_by = auth.uid()
    and is_household_member(
      (select cr.household_id
         from medications m
         join care_recipients cr on cr.id = m.care_recipient_id
        where m.id = medication_events.medication_id)
    )
  );
-- No update/delete policy: medication_events are immutable, insert-only —
-- mirrors feeds/diapers' documented "No Editing or Deleting Logged ..." limitation.

alter publication supabase_realtime add table medications;
alter publication supabase_realtime add table medication_events;
