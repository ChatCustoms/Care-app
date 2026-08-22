-- Milestone 3: Feeding MVP

alter table care_recipients
  add column feed_interval_minutes integer not null default 180
    check (feed_interval_minutes > 0 and feed_interval_minutes <= 1440);

create table feeds (
  id uuid primary key default gen_random_uuid(),
  care_recipient_id uuid not null references care_recipients(id) on delete cascade,
  amount numeric not null check (amount > 0),
  unit text not null check (unit in ('mL', 'oz', 'g')),
  fed_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index feeds_care_recipient_fed_at_idx on feeds (care_recipient_id, fed_at desc);

alter table feeds enable row level security;

-- No household_id column on this table — membership is checked via a
-- subquery from care_recipient_id to care_recipients.household_id, never
-- from a client-supplied household_id. A denormalized household_id here
-- would let a member of household A insert a row whose household_id passes
-- their own membership check while care_recipient_id secretly points at
-- household B's recipient — this subquery form closes that off entirely.
create policy feeds_select on feeds
  for select
  using (
    is_household_member(
      (select household_id from care_recipients where id = feeds.care_recipient_id)
    )
  );

create policy feeds_insert on feeds
  for insert
  with check (
    created_by = auth.uid()
    and is_household_member(
      (select household_id from care_recipients where id = feeds.care_recipient_id)
    )
  );

-- No update/delete policy: no edit UI exists for logged feeds this
-- milestone (documented as a deliberate gap in KNOWN_LIMITATIONS.md).

create table feed_presets (
  id uuid primary key default gen_random_uuid(),
  care_recipient_id uuid not null references care_recipients(id) on delete cascade,
  amount numeric not null check (amount > 0),
  unit text not null check (unit in ('mL', 'oz', 'g')),
  created_at timestamptz not null default now()
);

create index feed_presets_care_recipient_idx on feed_presets (care_recipient_id);

alter table feed_presets enable row level security;

create policy feed_presets_select on feed_presets
  for select
  using (
    is_household_member(
      (select household_id from care_recipients where id = feed_presets.care_recipient_id)
    )
  );

create policy feed_presets_insert on feed_presets
  for insert
  with check (
    is_household_member(
      (select household_id from care_recipients where id = feed_presets.care_recipient_id)
    )
  );

create policy feed_presets_update on feed_presets
  for update
  using (
    is_household_member(
      (select household_id from care_recipients where id = feed_presets.care_recipient_id)
    )
  )
  with check (
    is_household_member(
      (select household_id from care_recipients where id = feed_presets.care_recipient_id)
    )
  );

create policy feed_presets_delete on feed_presets
  for delete
  using (
    is_household_member(
      (select household_id from care_recipients where id = feed_presets.care_recipient_id)
    )
  );

-- Scoped write path for the one editable care_recipients column this
-- milestone ships. Mirrors the create_household() RPC pattern from
-- 0001_household_and_care_recipient.sql rather than a blanket UPDATE policy
-- on care_recipients, which would also expose name/date_of_birth to
-- household-member edits before that feature exists.
create or replace function update_feed_interval_minutes(
  target_care_recipient_id uuid,
  new_interval_minutes integer
) returns care_recipients
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row care_recipients;
begin
  if new_interval_minutes <= 0 or new_interval_minutes > 1440 then
    raise exception 'feed_interval_minutes must be between 1 and 1440';
  end if;

  if not exists (select 1 from care_recipients where id = target_care_recipient_id) then
    raise exception 'care recipient not found';
  end if;

  if not is_household_member(
    (select household_id from care_recipients where id = target_care_recipient_id)
  ) then
    raise exception 'not a member of this household';
  end if;

  update care_recipients
    set feed_interval_minutes = new_interval_minutes
    where id = target_care_recipient_id
  returning * into updated_row;

  return updated_row;
end;
$$;

revoke all on function update_feed_interval_minutes(uuid, integer) from public;
grant execute on function update_feed_interval_minutes(uuid, integer) to authenticated;
