-- Milestone 5: Multi-caregiver realtime — caregiver invitations

create table household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);

-- Normalize casing/whitespace once at write time so every downstream
-- comparison (RLS, the accept RPC, the dedupe index) can assume
-- lower-cased/trimmed values without repeating lower()/trim() everywhere.
create or replace function normalize_household_invite_email()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

create trigger household_invites_normalize_email
  before insert or update on household_invites
  for each row execute function normalize_household_invite_email();

-- One pending invite per household+email at a time; lets the client
-- reliably distinguish "already invited" (23505) from any other error.
create unique index household_invites_pending_unique
  on household_invites (household_id, email)
  where accepted_at is null;

alter table household_invites enable row level security;

-- Household members see all invites for their household; an invitee sees
-- their own pending invite by email match even before they're a member.
-- auth.email() is not a documented Supabase helper (only auth.uid() and
-- auth.jwt() are) — the email claim is read directly from the JWT instead.
create policy household_invites_select on household_invites
  for select using (
    is_household_member(household_id)
    or email = lower(auth.jwt() ->> 'email')
  );

-- Any active member can invite (flat, role-picker-free model — every
-- invite grants a fixed 'caregiver' role). Inviter identity must match the
-- caller; self-invites are blocked here so the DB enforces it even if a
-- client-side check is bypassed.
create policy household_invites_insert on household_invites
  for insert with check (
    is_household_member(household_id)
    and invited_by = auth.uid()
    and email <> lower(auth.jwt() ->> 'email')
  );

create policy household_invites_delete on household_invites
  for delete using (is_household_member(household_id));

-- Blocks inviting an email that's already an active member of the same
-- household. security definer because it needs to read auth.users, same
-- justification as list_household_caregivers below.
create or replace function prevent_duplicate_caregiver_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from household_members hm
    join auth.users u on u.id = hm.user_id
    where hm.household_id = new.household_id
      and hm.status = 'active'
      and lower(u.email) = new.email
  ) then
    raise exception 'this person is already a caregiver in this household';
  end if;
  return new;
end;
$$;

create trigger household_invites_prevent_duplicate
  before insert on household_invites
  for each row execute function prevent_duplicate_caregiver_invite();

-- Atomic accept: never trust a client-supplied invite id alone — the
-- caller's own authenticated email must match the invite (same reasoning
-- 0001's create_household RPC exists for: a write gated only by "who," not
-- "which record," is the privilege-escalation shape this app has already
-- had to close once).
create or replace function accept_household_invite(target_invite_id uuid)
returns household_members
language plpgsql
security definer
set search_path = public
as $$
declare
  invite household_invites;
  new_member household_members;
begin
  select * into invite
  from household_invites
  where id = target_invite_id
  for update;

  if invite is null then
    raise exception 'invite not found';
  end if;
  if invite.accepted_at is not null then
    raise exception 'invite already accepted';
  end if;
  if invite.expires_at < now() then
    raise exception 'invite has expired';
  end if;
  if invite.email <> lower(auth.jwt() ->> 'email') then
    raise exception 'not authorized to accept this invite';
  end if;
  if exists (
    select 1 from household_members
    where user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'you already belong to a household';
  end if;

  insert into household_members (household_id, user_id, role, status)
  values (invite.household_id, auth.uid(), 'caregiver', 'active')
  on conflict (household_id, user_id) do update set status = 'active', role = 'caregiver'
  returning * into new_member;

  update household_invites set accepted_at = now() where id = target_invite_id;

  return new_member;
end;
$$;

revoke all on function accept_household_invite(uuid) from public;
grant execute on function accept_household_invite(uuid) to authenticated;

-- Caregiver list for Settings. auth.users isn't exposed to clients any
-- other way; this must only ever return emails for a household the CALLER
-- is also a member of — never an open user lookup.
create or replace function list_household_caregivers(target_household_id uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_household_member(target_household_id) then
    raise exception 'not a member of this household';
  end if;

  return query
    select hm.user_id, u.email::text, hm.role, hm.created_at
    from household_members hm
    join auth.users u on u.id = hm.user_id
    where hm.household_id = target_household_id
      and hm.status = 'active'
    order by hm.created_at asc;
end;
$$;

revoke all on function list_household_caregivers(uuid) from public;
grant execute on function list_household_caregivers(uuid) to authenticated;

alter publication supabase_realtime add table feeds;
alter publication supabase_realtime add table feed_presets;
