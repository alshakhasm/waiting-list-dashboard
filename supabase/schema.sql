-- Supabase schema for OR Waiting List & Scheduling
-- Usage: Copy/paste into Supabase SQL editor and Run once per project.

-- Ensure UUID generation is available
create extension if not exists pgcrypto;

-- Tables
create table if not exists backlog (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null,
  mrn text not null,
  masked_mrn text not null,
  procedure text not null,
  est_duration_min int not null,
  surgeon_id text,
  case_type_id text,
  phone1 text,
  phone2 text,
  preferred_date date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists schedule (
  id uuid primary key default gen_random_uuid(),
  waiting_list_item_id uuid not null references backlog(id) on delete cascade,
  room_id text not null,
  surgeon_id text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'tentative',
  notes text,
  created_at timestamptz default now()
);

create table if not exists app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','member')),
  status text not null check (status in ('approved','pending','revoked')),
  invited_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','expired')),
  invited_by uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Optional owner profile details captured during account creation
create table if not exists owner_profiles (
  user_id uuid primary key references app_users(user_id) on delete cascade,
  full_name text not null,
  workspace_name text not null,
  org_name text,
  phone text,
  timezone text,
  locale text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table backlog enable row level security;
alter table schedule enable row level security;
alter table app_users enable row level security;
alter table invitations enable row level security;
alter table owner_profiles enable row level security;

-- Helper policy predicates
-- Owner or approved member check
create or replace function public.is_owner_or_approved() returns boolean
language sql stable as $$
  select exists (
    select 1 from app_users au
    where au.user_id = auth.uid() and (au.role = 'owner' or au.status = 'approved')
  );
$$;

-- Bootstrap helpers (enable safe self-service owner creation)
-- 1) Check whether app_users is empty (callable by unauthenticated to gate sign-up UI)
create or replace function public.app_users_is_empty()
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from public.app_users);
$$;

grant execute on function public.app_users_is_empty() to anon, authenticated;

-- 2) Insert first owner for the first authenticated user when table is empty
create or replace function public.app_users_bootstrap_owner()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_email text;
begin
  v_uid := auth.uid();
  v_email := auth.jwt() ->> 'email';
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  -- Only allow when table is empty
  if exists (select 1 from public.app_users) then
    return;
  end if;
  insert into public.app_users (user_id, email, role, status)
  values (v_uid, coalesce(v_email, ''), 'owner', 'approved')
  on conflict do nothing;
end;
$$;

grant execute on function public.app_users_bootstrap_owner() to authenticated;

-- 3) Allow any authenticated user to become an owner (their own list/tenancy at app level)
create or replace function public.app_users_become_owner()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.app_users (user_id, email, role, status)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', ''), 'owner', 'approved')
  on conflict (user_id) do update set role = 'owner', status = 'approved', email = excluded.email;
$$;

grant execute on function public.app_users_become_owner() to authenticated;

-- Policies
-- Backlog: read allowed to owner or approved; adjust if you want it public
create policy backlog_read on backlog
  for select using (public.is_owner_or_approved());

-- Schedule: read allowed to owner or approved
create policy schedule_read on schedule
  for select using (public.is_owner_or_approved());

-- Schedule: insert allowed to owner or approved
create policy schedule_insert on schedule
  for insert with check (public.is_owner_or_approved());

-- Schedule: update/delete allowed to owner only
create policy schedule_update_owner on schedule
  for update using (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner'
  )) with check (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner'
  ));

create policy schedule_delete_owner on schedule
  for delete using (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner'
  ));

-- app_users: self can read; owner can manage all
create policy app_users_read_self on app_users
  for select using (user_id = auth.uid());

create policy app_users_owner_all on app_users
  for all using (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner'
  )) with check (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner'
  ));

-- app_users bootstrap: allow inserting the first row when the table is empty
drop policy if exists app_users_bootstrap_first on app_users;
create policy app_users_bootstrap_first on app_users
  for insert with check (not exists (select 1 from app_users));

-- invitations: owner can manage all; invitee can read their own invite by email
create policy invitations_owner_all on invitations
  for all using (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner'
  )) with check (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner'
  ));

-- Allow an authenticated user to read invitations addressed to their email
create policy invitations_read_self on invitations
  for select using ((auth.jwt() ->> 'email') is not null and lower(email) = lower(auth.jwt() ->> 'email'));

-- owner_profiles: users can manage their own profile only
create policy owner_profiles_self_rw on owner_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Notes:
-- - If you want stricter mutations (e.g., only owner can insert schedule), change schedule_insert policy accordingly.
-- - If you want backlog to be public-read, replace the backlog_read policy with `using (true)`.
-- - The app bootstraps the first signed-in user as owner when app_users is empty.
