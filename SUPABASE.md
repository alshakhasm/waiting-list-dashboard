Supabase: Updated model overview (2025-10-04)

This app now supports a self-service owner model and invitation-based members on top of Supabase Auth + Postgres RLS. Highlights:

- Tables: backlog, schedule, app_users, invitations, owner_profiles (optional details for owners)
- RPC helpers (SECURITY DEFINER):
  - app_users_is_empty() → returns true if app_users has no rows
  - app_users_bootstrap_owner() → inserts first owner when table is empty
  - app_users_become_owner() → makes the current user an owner (their own workspace)
- RLS: backlog/schedule readable by owner or approved; mutations gated; app_users self-read, owner-manage-all; owner_profiles self-only
- UI flows:
  - Create Account (/?create=1): collect info → send confirmation → after sign-in, finalize by calling app_users_become_owner() and upserting owner_profiles
  - Accept Invite (/?accept=1&token=...): mark invite accepted → upsert app_users as member (pending) → owner later approves
  - Sign in (/?signin=1): magic link or password; can also trigger bootstrap via query
- Debugging: /?debug=1 shows a badge indicating if Supabase is enabled and which host is used. On load errors, the screen offers Retry and Become owner actions.

Troubleshooting quick tips
- If the badge says disabled → add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to apps/ui/.env.local and refresh
- If Become owner fails → run `supabase/schema.sql` in the Supabase SQL editor to create RPCs and policies; ensure GRANT EXECUTE to authenticated
- For timeouts → try the error screen’s buttons; check console for `__LAST_BECOME_OWNER_ERROR__` and network logs

Supabase setup (quick start)

1) Create a new Supabase project (free tier is fine).
2) In Project Settings → API, copy:
   - Project URL → VITE_SUPABASE_URL
   - anon public key → VITE_SUPABASE_ANON_KEY
3) In `apps/ui/.env.local` (create it) add:
   - VITE_SUPABASE_URL=...
   - VITE_SUPABASE_ANON_KEY=...

Schema (SQL)

-- Backlog items
create table if not exists backlog (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null,
  mrn text not null,
  masked_mrn text not null,
  procedure text not null,
  est_duration_min int not null,
  surgeon_id text,
  case_type_id text,
  -- Optional fields used by the UI editor
  phone1 text,
  phone2 text,
  preferred_date date,
  notes text,
  created_at timestamp with time zone default now()
);

-- Schedule entries
create table if not exists schedule (
  id uuid primary key default gen_random_uuid(),
  waiting_list_item_id uuid not null references backlog(id) on delete cascade,
  room_id text not null,
  surgeon_id text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'tentative', -- tentative|confirmed
  notes text,
  created_at timestamp with time zone default now()
);

-- App users (access control)
create table if not exists app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','member')),
  status text not null check (status in ('approved','pending','revoked')),
  invited_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Invitations (MVP manual link share)
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','expired')),
  invited_by uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

Row Level Security (RLS)

-- Enable RLS
alter table backlog enable row level security;
alter table schedule enable row level security;
alter table app_users enable row level security;
alter table invitations enable row level security;

-- Roles are provided via JWT claim `role` (set up in Supabase Auth or edge function).
-- Staff: can insert to schedule (add-only). Seniors: can update/delete.

create policy schedule_read for schedule
  as permissive for select
  using (true);

create policy schedule_insert_staff for schedule
  as permissive for insert
  with check (auth.jwt() ?->> 'role' in ('staff','senior'));

create policy schedule_update_senior for schedule
  as permissive for update
  using (auth.jwt() ?->> 'role' = 'senior')
  with check (auth.jwt() ?->> 'role' = 'senior');

create policy schedule_delete_senior for schedule
  as permissive for delete
  using (auth.jwt() ?->> 'role' = 'senior');

-- Backlog is typically read-only in this flow; adjust as needed
create policy backlog_read for backlog
  as permissive for select
  using (true);

-- App users
-- Allow a signed-in user to read their own profile
create policy app_users_read_self on app_users
  as permissive for select
  using (user_id = auth.uid());

-- Allow owner to read all app_users
create policy app_users_read_owner on app_users
  as permissive for select
  using (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner'
  ));

-- Allow owner to insert/update/delete any app_users row
create policy app_users_write_owner on app_users
  as permissive for all
  using (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner'
  ))
  with check (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner'
  ));

-- Invitations (owner-only)
create policy invitations_owner_all on invitations
  as permissive for all
  using (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner'
  ))
  with check (exists (
    select 1 from app_users au where au.user_id = auth.uid() and au.role = 'owner'
  ));

-- Optionally, allow reading a specific invite by token for the accept flow.
-- If you prefer server-only token checking, remove this and handle via edge function.
create policy invitations_read_by_token on invitations
  as permissive for select
  using (token = current_setting('request.headers', true)::jsonb ? 'x-invite-token');

-- Domain tables (backlog, schedule) guard by approved or owner
-- Example: only show data to owner or approved members
drop policy if exists schedule_read;
create policy schedule_read on schedule
  as permissive for select
  using (exists (
    select 1 from app_users au where au.user_id = auth.uid() and (au.role = 'owner' or au.status = 'approved')
  ));

-- Adjust other schedule policies similarly if you want to restrict mutations to approved only
-- For brevity, keeping prior staff/senior example; replace with your desired model.

Notes
- For assigning roles in JWT, you can use Supabase Auth with a custom JWT claim via hooks/edge functions, or store roles in user metadata and expose via `auth.jwt()`.
- You can keep the current in-memory adapter for local dev and enable Supabase in production by checking env availability.

Bootstrap & Flow (MVP manual link)

1) First user becomes owner:
  - UI calls a bootstrap that, if app_users is empty, inserts (user_id, role='owner', status='approved').
2) Invite members:
  - Owner creates an invitation row with a random token and 7-day expiration.
  - Owner copies link and shares: https://<your-site>/?accept=1&token=<token>
3) Accept invite:
  - Invitee opens link, signs in with the same email.
  - UI validates token and email, marks invitation accepted, inserts app_users row as role='member', status='pending'.
4) Approve access:
  - Owner switches the member to status='approved' in the Members screen.
5) Gating:
  - RLS for domain tables requires (role='owner' OR status='approved'). Pending and revoked cannot access data.

Auth configuration

1) In Supabase → Authentication → URL Configuration:
  - Add your local URL: http://localhost:5173
  - Add your production URL: https://alshakhasm.github.io/waiting-list-dashboard
  These are used for email confirmation / magic link redirects.

2) In Authentication → Providers → Email:
  - Enable Email auth.
  - Optionally enable Confirm email. If on, new sign-ups must confirm via email before session is created.
  - Enable Magic Link if you want passwordless sign-in.
  - Enable Email + Password if you want traditional sign-in.

3) Roles in JWT:
  - If you store `role` in `app_metadata` or `user_metadata`, you can surface it in RLS via `auth.jwt() ?->> 'role'`.
  - Example: on sign-up, set `app_metadata.role = 'staff'` manually via the Admin API or a Postgres function. Alternatively, manage roles in a `profiles` table joined to `auth.uid()`.

4) Environment variables:
  - VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be present at build/runtime for auth to be enabled in the UI.
  - When these are set, unauthenticated visitors will see a Sign In / Sign Up screen by default.
