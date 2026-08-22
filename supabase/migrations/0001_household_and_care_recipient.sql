-- Households and care recipients (Milestone 2)

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index households_owner_id_idx on households(owner_id);

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'caregiver', 'viewer')),
  status text not null check (status in ('active', 'invited', 'removed')) default 'active',
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table care_recipients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  date_of_birth date,
  created_at timestamptz not null default now()
);

create index care_recipients_household_id_idx on care_recipients(household_id);

-- Helper used by RLS policies below. SECURITY DEFINER + a stable owner with
-- BYPASSRLS is what prevents "infinite recursion detected in policy for
-- relation household_members" when household_members' own SELECT policy
-- needs to query household_members.
create or replace function is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

revoke all on function is_household_member(uuid) from public;
grant execute on function is_household_member(uuid) to authenticated;

-- Atomic creation of a household plus its owner membership row. This is the
-- ONLY way household_members gets written to in this milestone — there is
-- deliberately no client-side INSERT policy on household_members, which
-- means no authenticated user can self-insert membership into a household
-- they don't own.
create or replace function create_household(household_name text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household households;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into households (name, owner_id)
  values (household_name, auth.uid())
  returning * into new_household;

  insert into household_members (household_id, user_id, role, status)
  values (new_household.id, auth.uid(), 'owner', 'active');

  return new_household;
end;
$$;

revoke all on function create_household(text) from public;
grant execute on function create_household(text) to authenticated;

-- RLS
alter table households enable row level security;
alter table household_members enable row level security;
alter table care_recipients enable row level security;

-- households: read-only via RLS; all writes go through create_household().
create policy "households_select_members" on households
  for select
  using (is_household_member(id));

-- household_members: read-only via RLS; no INSERT/UPDATE/DELETE policy at
-- all, so those operations are default-denied for every role except the
-- SECURITY DEFINER function above.
create policy "household_members_select_own" on household_members
  for select
  using (is_household_member(household_id));

-- care_recipients: members can read and create (per KNOWN_LIMITATIONS.md,
-- schema allows many per household even though the MVP UI only creates
-- one). No UPDATE/DELETE policy yet — no editing UI exists in this
-- milestone, so don't grant that surface until it's needed.
create policy "care_recipients_select_members" on care_recipients
  for select
  using (is_household_member(household_id));

create policy "care_recipients_insert_members" on care_recipients
  for insert
  with check (is_household_member(household_id));
