-- Purge all application data (owner-only), triggered from UI after email confirmation
-- This function truncates key tables and then clears app_users, effectively resetting the app.
-- SECURITY NOTE: It requires the caller to be an approved owner and runs as SECURITY DEFINER.
-- If your project has additional tables to reset, add them to the TRUNCATE list below.
CREATE OR REPLACE FUNCTION public.app_purge_everything()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Authorization: only approved owners may purge
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE user_id = auth.uid() AND role = 'owner' AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Truncate dependent/application tables first; then app_users last
  -- Add or remove tables as appropriate for your schema. RESTART IDENTITY resets sequences.
  -- CASCADE ensures dependent tables are cleared if they reference these.
  BEGIN
    TRUNCATE TABLE public.invitations RESTART IDENTITY CASCADE;
  EXCEPTION WHEN undefined_table THEN
    -- ignore if table does not exist
    NULL;
  END;

  BEGIN
    TRUNCATE TABLE public.schedule RESTART IDENTITY CASCADE;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    TRUNCATE TABLE public.backlog RESTART IDENTITY CASCADE;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    TRUNCATE TABLE public.intake_links RESTART IDENTITY CASCADE;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    TRUNCATE TABLE public.patients_archive RESTART IDENTITY CASCADE;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Finally clear app_users (after dependents are gone)
  BEGIN
    TRUNCATE TABLE public.app_users RESTART IDENTITY CASCADE;
  EXCEPTION WHEN undefined_table THEN NULL; END;
END;
$$;

grant execute on function public.app_purge_everything() to authenticated;

-- Enforce that only approved owners (or the first bootstrap when no owners) can assign role='owner'
CREATE OR REPLACE FUNCTION public.app_users_guard_owner_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Multi-tenant: allow multiple owners across separate workspaces.
  -- Keep as a no-op guard to remain compatible with existing trigger.
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_app_users_guard_owner_role ON public.app_users;
CREATE TRIGGER trg_app_users_guard_owner_role
BEFORE INSERT OR UPDATE ON public.app_users
FOR EACH ROW
EXECUTE FUNCTION public.app_users_guard_owner_role();

-- Delete a member completely (owner-only). By default, deletes dependents created by the member.
-- p_mode: 'delete' (default) to delete dependent rows, or 'null' to set FKs to NULL where possible.
CREATE OR REPLACE FUNCTION public.app_users_delete_completely(p_user_id uuid, p_mode text DEFAULT 'delete')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_owner boolean := false;
  v_target_role text;
  v_email text;
BEGIN
  -- Caller must be an approved owner
  SELECT EXISTS(
    SELECT 1 FROM public.app_users WHERE user_id = auth.uid() AND role = 'owner' AND status = 'approved'
  ) INTO v_is_owner;
  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Resolve target role and email; prevent deleting owners through this path
  SELECT role, email INTO v_target_role, v_email FROM public.app_users WHERE user_id = p_user_id;
  IF v_target_role IS NULL THEN
    -- nothing to do
    RETURN;
  END IF;
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'refusing to delete an owner via member-deletion RPC';
  END IF;

  -- Handle dependents (best-effort, ignore missing tables)
  IF p_mode = 'delete' THEN
    BEGIN
      DELETE FROM public.intake_links WHERE created_by = p_user_id;
    EXCEPTION WHEN undefined_table THEN NULL; END;
  ELSE
    -- p_mode = 'null' (will error if NOT NULL constraint exists)
    BEGIN
      UPDATE public.intake_links SET created_by = NULL WHERE created_by = p_user_id;
    EXCEPTION WHEN undefined_table THEN NULL; END;
  END IF;

  -- Remove invitations for this email (cleanup)
  IF v_email IS NOT NULL THEN
    BEGIN
      DELETE FROM public.invitations WHERE lower(email) = lower(v_email);
    EXCEPTION WHEN undefined_table THEN NULL; END;
  END IF;

  -- Finally remove the app user row
  DELETE FROM public.app_users WHERE user_id = p_user_id;
END;$$;

-- Allow authenticated clients to call the member deletion RPC
grant execute on function public.app_users_delete_completely(uuid, text) to authenticated;

-- Compatibility overload to satisfy clients that pass parameters as (p_mode, p_user_id)
CREATE OR REPLACE FUNCTION public.app_users_delete_completely(p_mode text, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.app_users_delete_completely(p_user_id := p_user_id, p_mode := p_mode);
END;$$;

grant execute on function public.app_users_delete_completely(text, uuid) to authenticated;

-- Accept invitation by token: requires caller to be signed in. Ensures token is valid and email matches auth user's email.
CREATE OR REPLACE FUNCTION public.invitations_get_email(p_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_email text; v_now timestamptz := now(); v exists boolean; BEGIN
  SELECT email INTO v_email FROM public.invitations
  WHERE token = p_token AND status = 'pending' AND (expires_at IS NULL OR expires_at > v_now)
  LIMIT 1;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'invalid or expired invitation token';
  END IF;
  RETURN v_email;
END;$$;

CREATE OR REPLACE FUNCTION public.invitations_accept(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv record;
  v_uid uuid := auth.uid();
  v_email text;
  v_full_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT * INTO v_inv FROM public.invitations
  WHERE token = p_token AND status = 'pending' AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  IF NOT FOUND THEN
    -- Maybe already accepted; treat as idempotent success if same email signs in again
    SELECT * INTO v_inv FROM public.invitations
    WHERE token = p_token AND status = 'accepted'
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid or expired invitation token';
    END IF;
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    IF v_email IS NULL THEN
      RAISE EXCEPTION 'could not resolve current user email';
    END IF;
    IF lower(v_email) <> lower(v_inv.email) THEN
      RAISE EXCEPTION 'email mismatch for invitation (expected %)', v_inv.email;
    END IF;
    v_full_name := (auth.jwt() ->> 'user_metadata')::jsonb ->> 'full_name';
    INSERT INTO public.app_users (user_id, email, full_name, role, status, invited_by, created_at)
    VALUES (v_uid, v_email, v_full_name, coalesce(v_inv.invited_role, 'member'), 'approved', v_inv.invited_by, now())
    ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = coalesce(v_inv.invited_role, 'member'), invited_by = EXCLUDED.invited_by;
    RETURN;
  END IF;
  -- Look up the email for the current auth user
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL THEN
    BEGIN
      v_email := auth.jwt() ->> 'email';
    EXCEPTION WHEN others THEN
      v_email := NULL;
    END;
    IF v_email IS NULL THEN
      RAISE EXCEPTION 'could not resolve current user email';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid) THEN
      RAISE EXCEPTION 'account not confirmed yet. Please confirm your email and try again.';
    END IF;
  END IF;
  IF lower(v_email) <> lower(v_inv.email) THEN
    RAISE EXCEPTION 'email mismatch for invitation (expected %)', v_inv.email;
  END IF;
  -- Upsert app_users as approved member
  v_full_name := (auth.jwt() ->> 'user_metadata')::jsonb ->> 'full_name';
  INSERT INTO public.app_users (user_id, email, full_name, role, status, invited_by, created_at)
  VALUES (v_uid, v_email, v_full_name, coalesce(v_inv.invited_role, 'member'), 'approved', v_inv.invited_by, now())
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = coalesce(v_inv.invited_role, 'member'), invited_by = EXCLUDED.invited_by;

  -- Mark invitation accepted
  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;
END;$$;

-- Allow authenticated clients to call invite acceptance RPC
grant execute on function public.invitations_accept(text) to authenticated;

-- Invitation lookup helper that works before the user signs in (read-only)
CREATE OR REPLACE FUNCTION public.invitations_lookup(p_token text)
RETURNS TABLE(id uuid, email text, status text, expires_at timestamptz, invited_role text, invited_by uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT invitations.id, invitations.email, invitations.status, invitations.expires_at, invitations.invited_role, invitations.invited_by
  FROM public.invitations
  WHERE token = p_token
  LIMIT 1;
END;$$;

grant execute on function public.invitations_lookup(text) to anon;
grant execute on function public.invitations_lookup(text) to authenticated;

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
  -- Ownership: who created/owns this row (defaults to current auth user)
  created_by uuid not null default auth.uid() references app_users(user_id) on delete cascade,
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

-- Backfill for ownership: add created_by if missing (nullable for migration safety), then add default
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'backlog' and column_name = 'created_by'
  ) then
    alter table public.backlog add column created_by uuid references public.app_users(user_id) on delete cascade;
    -- Set default for future inserts to current auth user; existing rows remain NULL
    alter table public.backlog alter column created_by set default auth.uid();
    -- Optional: add an index to speed up per-user queries
    create index if not exists backlog_created_by_idx on public.backlog(created_by);
  end if;
end $$;

-- Enable realtime for backlog table (required for Supabase postgres_changes subscription)
alter table public.backlog replica identity full;

-- Enable realtime for schedule table
alter table public.schedule replica identity full;

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
  full_name text,
  role text not null check (role in ('owner','member','viewer','editor')),
  status text not null check (status in ('approved','pending','revoked')),
  invited_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Backfill/migrate role check constraint to include viewer/editor if an older constraint exists
do $$ begin
  -- Detect if the role check does not yet include viewer/editor; constraint name is typically app_users_role_check
  if exists (
    select 1
    from information_schema.constraint_column_usage u
    join information_schema.table_constraints c
      on c.constraint_name = u.constraint_name and c.table_schema = u.table_schema and c.table_name = u.table_name
    where u.table_schema = 'public' and u.table_name = 'app_users' and u.column_name = 'role'
      and c.constraint_type = 'CHECK'
  ) then
    -- We don't parse the check text here; instead we attempt to drop the expected default name if present, then recreate
    begin
      alter table public.app_users drop constraint if exists app_users_role_check;
    exception when undefined_object then
      null;
    end;
    -- Re-add with the expanded set (idempotent if already correct)
    begin
      alter table public.app_users
        add constraint app_users_role_check check (role in ('owner','member','viewer','editor'));
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','expired')),
  invited_by uuid not null,
  invited_role text not null default 'member' check (invited_role in ('member','viewer','editor')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
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
-- Owner or approved user check (legacy, kept for compatibility)
create or replace function public.is_owner_or_approved() returns boolean
language sql stable as $$
  select exists (
    select 1 from app_users au
    where au.user_id = auth.uid() and (
      au.role = 'owner' or au.status = 'approved'
    )
  );
$$;

-- Workspace helpers: resolve the workspace owner for a user
-- For owners, returns their own user_id; for invited members/editors/viewers, returns the inviting owner's user_id.
create or replace function public.workspace_owner(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_role text;
  v_invited_by uuid;
begin
  if p_user_id is null then return null; end if;
  select role, invited_by into v_role, v_invited_by
    from public.app_users where user_id = p_user_id limit 1;
  if v_role = 'owner' then
    return p_user_id;
  end if;
  return v_invited_by;
end;
$$;

grant execute on function public.workspace_owner(uuid) to authenticated;

-- Read permission: owners always, or approved users with any non-revoked role
create or replace function public.can_read() returns boolean
language sql stable as $$
  select exists (
    select 1 from app_users au
    where au.user_id = auth.uid()
      and (
        au.role = 'owner'
        or (au.status = 'approved' and au.role in ('member','viewer','editor'))
      )
  );
$$;

-- Write permission: owners, and approved members/editors (viewers are read-only)
create or replace function public.can_write() returns boolean
language sql stable as $$
  select exists (
    select 1 from app_users au
    where au.user_id = auth.uid()
      and (
        au.role = 'owner'
        or (au.status = 'approved' and au.role in ('member','editor'))
      )
  );
$$;

-- Delete permission: owners and approved editors can delete backlog rows (members cannot)
create or replace function public.can_delete() returns boolean
language sql stable as $$
  select exists (
    select 1 from app_users au
    where au.user_id = auth.uid()
      and (
        au.role = 'owner'
        or (au.status = 'approved' and au.role = 'editor')
      )
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

-- When backlog rows are deleted, ensure the patient is recorded in the archive.
-- This upserts a patients_archive row keyed by MRN and updates last_seen_at/last_patient_name.
create or replace function public._archive_from_backlog_del() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If MRN on the deleted row is null, nothing to archive
  if old.mrn is null then
    return old;
  end if;

  -- Upsert archive row (do not decrement total_backlog_entries; keep it as historical count)
  insert into public.patients_archive (
    mrn, first_seen_at, last_seen_at, last_patient_name, total_backlog_entries, last_category_key, last_case_type_id, last_procedure
  ) values (
    old.mrn, now(), now(), old.patient_name, 0, old.category_key, old.case_type_id, old.procedure
  ) on conflict (mrn) do update set
    last_seen_at = excluded.last_seen_at,
    last_patient_name = excluded.last_patient_name,
    last_category_key = excluded.last_category_key,
    last_case_type_id = excluded.last_case_type_id,
    last_procedure = excluded.last_procedure;

  return old;
end;
$$;

drop trigger if exists trg_archive_backlog_del on public.backlog;
create trigger trg_archive_backlog_del
after delete on public.backlog
for each row execute function public._archive_from_backlog_del();

create or replace function public.backlog_set_removed(p_id uuid, p_removed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_owner uuid;
  v_caller_workspace uuid;
begin
  -- Get the workspace owner of the backlog item
  v_workspace_owner := (
    select public.workspace_owner(created_by)
    from public.backlog where id = p_id
  );
  
  -- Get the caller's workspace owner
  v_caller_workspace := public.workspace_owner(auth.uid());
  
  -- Only allow removal if the item is in the same workspace
  if v_workspace_owner != v_caller_workspace then
    raise exception 'Permission denied: item not in your workspace';
  end if;
  
  -- Perform the soft delete
  update public.backlog
     set is_removed = coalesce(p_removed, false),
         notes = case
           when coalesce(p_removed, false) then concat('removed@', now())
           else notes
         end
   where id = p_id;
end;
$$;

grant execute on function public.backlog_set_removed(uuid, boolean) to authenticated;

-- Ensure schedule activity also refreshes archive records (e.g. when cases are added without backlog insert)
create or replace function public._archive_touch_from_schedule_ins() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mrn text;
  v_patient_name text;
  v_category text;
  v_case_type text;
  v_procedure text;
begin
  select b.mrn, b.patient_name, b.category_key, b.case_type_id, b.procedure
    into v_mrn, v_patient_name, v_category, v_case_type, v_procedure
    from public.backlog b
   where b.id = new.waiting_list_item_id
   limit 1;

  if v_mrn is null then
    return new;
  end if;

  insert into public.patients_archive (
    mrn,
    first_seen_at,
    last_seen_at,
    last_patient_name,
    total_backlog_entries,
    last_category_key,
    last_case_type_id,
    last_procedure
  ) values (
    v_mrn,
    now(),
    now(),
    coalesce(v_patient_name, v_mrn),
    1,
    v_category,
    v_case_type,
    v_procedure
  )
  on conflict (mrn) do update set
    last_seen_at = excluded.last_seen_at,
    last_patient_name = coalesce(excluded.last_patient_name, public.patients_archive.last_patient_name),
    last_category_key = coalesce(excluded.last_category_key, public.patients_archive.last_category_key),
    last_case_type_id = coalesce(excluded.last_case_type_id, public.patients_archive.last_case_type_id),
    last_procedure = coalesce(excluded.last_procedure, public.patients_archive.last_procedure);

  return new;
end;
$$;

drop trigger if exists trg_archive_schedule_ins on public.schedule;
create trigger trg_archive_schedule_ins
after insert on public.schedule
for each row execute function public._archive_touch_from_schedule_ins();

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
  insert into public.app_users (user_id, email, role, status, invited_by)
  values (v_uid, coalesce(v_email, ''), 'owner', 'approved', v_uid)
  on conflict (user_id) do update set
    role = 'owner',
    status = 'approved',
    email = excluded.email,
    invited_by = excluded.user_id;
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
  insert into public.app_users (user_id, email, role, status, invited_by)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', ''), 'owner', 'approved', auth.uid())
  on conflict (user_id) do update set
    role = 'owner',
    status = 'approved',
    email = excluded.email,
    invited_by = excluded.user_id;
$$;

grant execute on function public.app_users_become_owner() to authenticated;

-- Policies
-- Backlog policies (per-user ownership)
-- Read: owners can read all; non-owners can read only their own rows
drop policy if exists backlog_read on backlog;
create policy backlog_read on backlog
  for select using (
    public.workspace_owner(created_by) = public.workspace_owner(auth.uid())
  );

-- Insert: allowed to owner or approved writers; inserted row must be owned by caller
drop policy if exists backlog_insert on backlog;
create policy backlog_insert on backlog
  for insert with check (
    (
      exists (select 1 from app_users au where au.user_id = auth.uid() and (au.role = 'owner' or (au.status = 'approved' and au.role in ('member','editor'))))
    )
    and created_by = auth.uid()
  );

-- Update: owners can update all; non-owners can update only their own rows
drop policy if exists backlog_update on backlog;
create policy backlog_update on backlog
  for update using (
    public.can_write()
    and public.workspace_owner(created_by) = public.workspace_owner(auth.uid())
  ) with check (
    public.can_write()
    and public.workspace_owner(created_by) = public.workspace_owner(auth.uid())
  );

-- Delete: owners can delete any; editors may delete their own
drop policy if exists backlog_delete on backlog;
create policy backlog_delete on backlog
  for delete using (
    public.can_delete()
    and public.workspace_owner(created_by) = public.workspace_owner(auth.uid())
  );

-- Schedule: read allowed to owner or approved users
drop policy if exists schedule_read on schedule;
create policy schedule_read on schedule
  for select using (
    public.workspace_owner((select b.created_by from public.backlog b where b.id = schedule.waiting_list_item_id)) = public.workspace_owner(auth.uid())
  );

-- Schedule: insert allowed to owner or approved writers (member/editor)
drop policy if exists schedule_insert on schedule;
create policy schedule_insert on schedule
  for insert with check (
    public.can_write()
    and public.workspace_owner((select b.created_by from public.backlog b where b.id = schedule.waiting_list_item_id)) = public.workspace_owner(auth.uid())
  );

-- Schedule: update/delete allowed to owner only
drop policy if exists schedule_update_owner on schedule;
create policy schedule_update_owner on schedule
  for update using (
    exists (select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner')
    and public.workspace_owner((select b.created_by from public.backlog b where b.id = schedule.waiting_list_item_id)) = public.workspace_owner(auth.uid())
  ) with check (
    exists (select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner')
    and public.workspace_owner((select b.created_by from public.backlog b where b.id = schedule.waiting_list_item_id)) = public.workspace_owner(auth.uid())
  );

drop policy if exists schedule_delete_owner on schedule;
create policy schedule_delete_owner on schedule
  for delete using (
    exists (select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner')
    and public.workspace_owner((select b.created_by from public.backlog b where b.id = schedule.waiting_list_item_id)) = public.workspace_owner(auth.uid())
  );

-- patients_archive: read allowed to owner or approved; no direct writes from client
alter table patients_archive enable row level security;
drop policy if exists patients_archive_read on patients_archive;
create policy patients_archive_read on patients_archive
  for select using (
    exists (
      select 1 from public.backlog b
      where b.mrn = patients_archive.mrn
        and public.workspace_owner(b.created_by) = public.workspace_owner(auth.uid())
    )
  );

-- app_users: self can read; owner can manage all
create policy app_users_read_self on app_users
  for select using (user_id = auth.uid());

drop policy if exists app_users_owner_all on app_users;
create policy app_users_owner_all on app_users
  for all using (
    exists (select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner')
    and public.workspace_owner(user_id) = public.workspace_owner(auth.uid())
  ) with check (
    exists (select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner')
    and public.workspace_owner(user_id) = public.workspace_owner(auth.uid())
  );

-- app_users bootstrap: allow inserting the first row when the table is empty
drop policy if exists app_users_bootstrap_first on app_users;
create policy app_users_bootstrap_first on app_users
  for insert with check (not exists (select 1 from app_users));

-- invitations: owner can manage all; invitee can read their own invite by email
drop policy if exists invitations_owner_all on invitations;
create policy invitations_owner_all on invitations
  for all using (
    exists (select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner')
    and invited_by = auth.uid()
  ) with check (
    exists (select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner')
    and invited_by = auth.uid()
  );

-- Allow an authenticated user to read invitations addressed to their email
create policy invitations_read_self on invitations
  for select using ((auth.jwt() ->> 'email') is not null and lower(email) = lower(auth.jwt() ->> 'email'));

-- owner_profiles: users can manage their own profile only
drop policy if exists owner_profiles_self_rw on owner_profiles;
create policy owner_profiles_self_rw on owner_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- intake_links RLS and policies
alter table intake_links enable row level security;
-- Owners and invited team can manage intake links in their workspace
drop policy if exists intake_links_owner_rw on intake_links;
create policy intake_links_owner_rw on intake_links
  for all using (
    public.workspace_owner(created_by) = public.workspace_owner(auth.uid())
  ) with check (
    public.workspace_owner(created_by) = public.workspace_owner(auth.uid())
  );

-- Members can read intake links for their workspace owner
drop policy if exists intake_links_read_workspace on intake_links;
create policy intake_links_read_workspace on intake_links
  for select using (
    public.workspace_owner(created_by) = public.workspace_owner(auth.uid())
  );

-- intake_submissions RLS: owners can read their own submissions (by created_by)
alter table intake_submissions enable row level security;
drop policy if exists intake_submissions_owner_read on intake_submissions;
create policy intake_submissions_owner_read on intake_submissions
  for select using (
    public.workspace_owner(created_by) = public.workspace_owner(auth.uid())
  );

-- Ensure at most one approved owner exists at the DB level
-- Multi-tenant: remove single-owner global index if present
DO $$ BEGIN
  BEGIN
    DROP INDEX IF EXISTS one_approved_owner_idx;
  EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

-- Allow writers to insert rows (normally inserted via function, but keep a policy consistent with can_write)
drop policy if exists intake_submissions_writer_insert on intake_submissions;
create policy intake_submissions_writer_insert on intake_submissions
  for insert with check (public.can_write());

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

-- SECURITY DEFINER helper: insert backlog on behalf of an authenticated, approved writer/owner (for members/editors).
create or replace function public.submit_backlog_user(
  p_patient_name text,
  p_mrn text,
  p_procedure text,
  p_phone1 text default null,
  p_phone2 text default null,
  p_notes text default null,
  p_category_key text default null,
  p_case_type_id text default null,
  p_est_duration_min integer default 60,
  p_surgeon_id text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_mrn text;
  v_p1 text;
  v_p2 text;
  v_surgeon text;
  v_uid uuid;
begin
  -- Require authenticated call
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Ensure the caller is allowed to write (owner or approved member/editor)
  if not exists (
    select 1 from public.app_users au
    where au.user_id = v_uid
      and (
        au.role = 'owner'
        or (au.status = 'approved' and au.role in ('member','editor'))
      )
  ) then
    raise exception 'not permitted';
  end if;

  -- Normalize inputs
  v_mrn := nullif(regexp_replace(coalesce(p_mrn, ''), '\\D', '', 'g'), '');
  v_p1 := nullif(regexp_replace(coalesce(p_phone1, ''), '\\D', '', 'g'), '');
  v_p2 := nullif(regexp_replace(coalesce(p_phone2, ''), '\\D', '', 'g'), '');
  v_surgeon := coalesce(p_surgeon_id, 's:1');

  if coalesce(trim(p_patient_name), '') = '' then
    raise exception 'patient_name is required';
  end if;
  if v_mrn is null then
    raise exception 'mrn is required';
  end if;
  if coalesce(trim(p_procedure), '') = '' then
    raise exception 'procedure is required';
  end if;

  insert into public.backlog (
    patient_name, mrn, masked_mrn, procedure,
    category_key, est_duration_min, surgeon_id, case_type_id,
    phone1, phone2, notes, created_by
  ) values (
    trim(p_patient_name),
    v_mrn,
    regexp_replace(v_mrn, '.(?=..$)', '•', 'g'),
    trim(p_procedure),
    nullif(trim(coalesce(p_category_key, '')),''),
    coalesce(p_est_duration_min, 60),
    v_surgeon,
    coalesce(p_case_type_id, 'case:elective'),
    v_p1,
    v_p2,
    nullif(p_notes, ''),
    public.workspace_owner(v_uid)  -- Set owner as the creator, not the member
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_backlog_user(text, text, text, text, text, text, text, text, integer, text) to authenticated;

-- Helper function to fix members without invited_by set (usually happens with old members created before this field existed)
create or replace function public.fix_member_invited_by()
returns table(user_id uuid, email text, role text, status text, old_invited_by uuid, new_invited_by uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_updated int;
begin
  -- Get the owner (should only be one per workspace)
  select au.user_id into v_owner_id from public.app_users au where au.role = 'owner' and au.status = 'approved' limit 1;
  
  if v_owner_id is null then
    raise exception 'No approved owner found in workspace';
  end if;

  -- Update members with NULL invited_by to point to the owner
  update public.app_users au
  set invited_by = v_owner_id
  where au.role in ('member', 'editor', 'viewer')
    and au.invited_by is null
    and au.user_id != v_owner_id;

  get diagnostics v_updated = row_count;
  
  -- Return the updated records
  return query
  select au.user_id, au.email, au.role, au.status, null::uuid, v_owner_id
  from public.app_users au
  where au.role in ('member', 'editor', 'viewer')
    and au.invited_by = v_owner_id
    and au.user_id != v_owner_id
  limit v_updated;
end;
$$;

grant execute on function public.fix_member_invited_by() to authenticated;

-- Notes:
-- - If you want stricter mutations (e.g., only owner can insert schedule), change schedule_insert policy accordingly.
-- - Backlog rows are now owned by the creator (`created_by`) and RLS restricts non-owners to their own rows.
-- - The app bootstraps the first signed-in user as owner when app_users is empty.
