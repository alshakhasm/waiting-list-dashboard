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
  -- Optional explicit category to override heuristic grouping (see apps/ui/src/ui/procedureGroups.ts)
  category_key text,
  est_duration_min int not null,
  surgeon_id text,
  case_type_id text,
  phone1 text,
  phone2 text,
  preferred_date date,
  notes text,
  -- Soft-delete flag: when true, item is hidden from backlog/list views but preserved in archive triggers
  is_removed boolean not null default false,
  created_at timestamptz default now()
);

-- Backfill for existing projects: add the column if it doesn't exist
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'backlog' and column_name = 'is_removed'
  ) then
    alter table public.backlog add column is_removed boolean not null default false;
  end if;
end $$;

-- Patients archive: one row per MRN, persists forever (logical archive)
create table if not exists patients_archive (
  mrn text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_patient_name text,
  total_backlog_entries int not null default 0,
  last_category_key text,
  last_case_type_id text,
  last_procedure text
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

-- Public intake links to allow external teams to submit backlog items via tokenized link
create table if not exists intake_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  label text,
  active boolean not null default true,
  default_category_key text,
  default_case_type_id text,
  default_surgeon_id text,
  created_by uuid not null references app_users(user_id) on delete cascade,
  created_at timestamptz default now()
);

-- Audit log of public intake submissions (accepted/rejected/errors)
create table if not exists intake_submissions (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  link_id uuid references intake_links(id) on delete set null,
  created_by uuid references app_users(user_id) on delete set null, -- owner inferred from link
  submitted_at timestamptz not null default now(),
  patient_name text,
  mrn text,
  procedure text,
  phone1 text,
  phone2 text,
  notes text,
  category_key text,
  case_type_id text,
  status text not null check (status in ('accepted','rejected','error')),
  error_message text,
  backlog_id uuid references backlog(id) on delete set null
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

-- Trigger function: capture/refresh patient archive on backlog changes
create or replace function public._archive_capture_from_backlog() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Upsert archive row keyed by MRN
  insert into public.patients_archive (mrn, first_seen_at, last_seen_at, last_patient_name, total_backlog_entries, last_category_key, last_case_type_id, last_procedure)
  values (new.mrn, now(), now(), new.patient_name, 1, new.category_key, new.case_type_id, new.procedure)
  on conflict (mrn) do update set
    last_seen_at = excluded.last_seen_at,
    last_patient_name = excluded.last_patient_name,
    last_category_key = excluded.last_category_key,
    last_case_type_id = excluded.last_case_type_id,
    last_procedure = excluded.last_procedure,
    total_backlog_entries = public.patients_archive.total_backlog_entries + 1;
  return new;
end;
$$;

drop trigger if exists trg_archive_backlog_ins on public.backlog;
create trigger trg_archive_backlog_ins
after insert on public.backlog
for each row execute function public._archive_capture_from_backlog();

-- Keep a heartbeat on updates too (won't bump total entries, but refresh last_* fields)
create or replace function public._archive_touch_from_backlog_upd() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.patients_archive
     set last_seen_at = now(),
         last_patient_name = new.patient_name,
         last_category_key = new.category_key,
         last_case_type_id = new.case_type_id,
         last_procedure = new.procedure
   where mrn = new.mrn;
  return new;
end;
$$;

drop trigger if exists trg_archive_backlog_upd on public.backlog;
create trigger trg_archive_backlog_upd
after update on public.backlog
for each row execute function public._archive_touch_from_backlog_upd();

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

-- Backlog: insert allowed to owner or approved (so members can add cases)
create policy backlog_insert on backlog
  for insert with check (public.is_owner_or_approved());

-- Backlog: allow updates (e.g., soft remove) by owner or approved
create policy backlog_update on backlog
  for update using (public.is_owner_or_approved()) with check (public.is_owner_or_approved());

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

-- patients_archive: read allowed to owner or approved; no direct writes from client
alter table patients_archive enable row level security;
create policy patients_archive_read on patients_archive
  for select using (public.is_owner_or_approved());

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

-- intake_links RLS and policies
alter table intake_links enable row level security;
-- Owner can manage their intake links
create policy intake_links_owner_rw on intake_links
  for all using (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner'
  )) with check (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner'
  ));

-- intake_submissions RLS: owners can read their own submissions (by created_by)
alter table intake_submissions enable row level security;
drop policy if exists intake_submissions_owner_read on intake_submissions;
create policy intake_submissions_owner_read on intake_submissions
  for select using (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role in ('owner','member') and au.user_id = intake_submissions.created_by
  ));

-- Public function to submit backlog items using a token (security definer)
create or replace function public.submit_backlog_intake(
  p_token text,
  p_patient_name text,
  p_mrn text,
  p_procedure text,
  p_phone1 text default null,
  p_phone2 text default null,
  p_notes text default null,
  p_category_key text default null,
  p_case_type_id text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link record;
  v_id uuid;
  v_err text;
  v_mrn text;
  v_p1 text;
  v_p2 text;
begin
  select * into v_link from public.intake_links where token = p_token and active = true;
  if not found then
    -- Log rejection
    insert into public.intake_submissions (token, status, error_message)
    values (p_token, 'rejected', 'invalid or inactive token');
    raise exception 'invalid or inactive token';
  end if;
  -- Normalize inputs
  v_mrn := nullif(regexp_replace(coalesce(p_mrn,''), '\\D', '', 'g'), '');
  v_p1 := nullif(regexp_replace(coalesce(p_phone1,''), '\\D', '', 'g'), '');
  v_p2 := nullif(regexp_replace(coalesce(p_phone2,''), '\\D', '', 'g'), '');

  -- Basic validation
  if coalesce(trim(p_patient_name), '') = '' then
    v_err := 'patient_name is required';
  elsif v_mrn is null then
    v_err := 'mrn is required';
  elsif coalesce(trim(p_procedure), '') = '' then
    v_err := 'procedure is required';
  end if;

  if v_err is not null then
    insert into public.intake_submissions (
      token, link_id, created_by, status, error_message,
      patient_name, mrn, procedure, phone1, phone2, notes, category_key, case_type_id
    ) values (
      p_token, v_link.id, v_link.created_by, 'rejected', v_err,
      p_patient_name, v_mrn, p_procedure, v_p1, v_p2, p_notes, p_category_key, p_case_type_id
    );
    raise exception 'validation failed: %', v_err;
  end if;

  insert into public.backlog (
    patient_name, mrn, masked_mrn, procedure,
    category_key, est_duration_min, surgeon_id, case_type_id,
    phone1, phone2, notes
  ) values (
    trim(p_patient_name),
    v_mrn,
    regexp_replace(v_mrn, '.(?=..$)', '•', 'g'),
    trim(p_procedure),
    coalesce(p_category_key, v_link.default_category_key),
    60,
    v_link.default_surgeon_id,
    coalesce(p_case_type_id, v_link.default_case_type_id, 'case:elective'),
    v_p1,
    v_p2,
    nullif(p_notes, '')
  ) returning id into v_id;

  insert into public.intake_submissions (
    token, link_id, created_by, status, backlog_id,
    patient_name, mrn, procedure, phone1, phone2, notes, category_key, case_type_id
  ) values (
    p_token, v_link.id, v_link.created_by, 'accepted', v_id,
    p_patient_name, v_mrn, p_procedure, v_p1, v_p2, p_notes, coalesce(p_category_key, v_link.default_category_key), coalesce(p_case_type_id, v_link.default_case_type_id, 'case:elective')
  );

  return v_id;
end;
$$;

grant execute on function public.submit_backlog_intake(text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- Notes:
-- - If you want stricter mutations (e.g., only owner can insert schedule), change schedule_insert policy accordingly.
-- - If you want backlog to be public-read, replace the backlog_read policy with `using (true)`.
-- - The app bootstraps the first signed-in user as owner when app_users is empty.
