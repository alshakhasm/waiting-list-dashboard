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

Row Level Security (RLS)

-- Enable RLS
alter table backlog enable row level security;
alter table schedule enable row level security;

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

Notes
- For assigning roles in JWT, you can use Supabase Auth with a custom JWT claim via hooks/edge functions, or store roles in user metadata and expose via `auth.jwt()`.
- You can keep the current in-memory adapter for local dev and enable Supabase in production by checking env availability.
