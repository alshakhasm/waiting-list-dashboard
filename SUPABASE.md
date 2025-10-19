Supabase Setup and Operations (2025-10-08)

This app uses Supabase Auth + Postgres with Row Level Security (RLS) and a self-service owner model. This document captures the current, working configuration (Option A: strict RLS), installation steps, verification, and troubleshooting.

Key objects
- Tables: `backlog`, `schedule`, `app_users`, `invitations`, `owner_profiles`
- Functions (SECURITY DEFINER): `app_users_is_empty`, `app_users_bootstrap_owner`, `app_users_become_owner`, `is_owner`
- Policies: non-recursive, use `public.is_owner()` in owner-only rules; domain reads require owner or approved.

Environment
- Add to `apps/ui/.env.local`:
  - `VITE_SUPABASE_URL=...`
  - `VITE_SUPABASE_ANON_KEY=...`
- In Auth → URL Configuration, include `http://localhost:5173` for redirects.

Install schema (SQL editor → Role: postgres)
- Use the canonical `supabase/schema.sql` (already in the repo). It creates tables, enables RLS, defines functions and policies, and grants execution.
- If you created policies earlier, it is safe to re-run; it uses `create or replace` and `drop policy if exists`.

Critical helpers and non-recursive policies

```sql
-- Non-recursive owner check for use in policies
create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.app_users au
    where au.user_id = auth.uid() and au.role = 'owner'
  );
$$;

grant execute on function public.is_owner() to authenticated;

-- app_users owner-all policy via helper
drop policy if exists app_users_owner_all on public.app_users;
create policy app_users_owner_all on public.app_users
  for all using (public.is_owner()) with check (public.is_owner());

-- invitations and schedule owner-only policies should also use public.is_owner()
```

Owner bootstrap and self-promotion
- `app_users_is_empty()` → gate sign-up UI; callable by anon/authenticated.
- `app_users_bootstrap_owner()` → insert first owner if table empty; callable by authenticated.
- `app_users_become_owner()` → any authenticated user can create/update their `app_users` row as owner; idempotent.

Option A: strict RLS for domain tables
- Backlog: per-user ownership via `created_by`; owners read all, non-owners read only their rows. Inserts restricted (no anonymous seeding).
- Schedule: read by owner/approved; updates/deletes by owner.
- Invitations: owner manage all; invitee can read their own invite by email.

Verify installation
```sql
-- Objects present
select routine_name from information_schema.routines
 where routine_schema='public'
   and routine_name in ('is_owner','app_users_is_empty','app_users_bootstrap_owner','app_users_become_owner');
select tablename, policyname from pg_policies
 where schemaname='public'
   and tablename in ('app_users','backlog','schedule','invitations','owner_profiles');

-- Your access row exists
select user_id, email, role, status from public.app_users where user_id = '<YOUR-UID>';
```

In-app diagnostics
- EnvDebug badge: enable with `/?debug=1`, shows whether Supabase is enabled and the host.
- Console helpers:
  - `window.__SUPABASE_DEBUG__`, `window.__supabase`
  - `await window.__supabase.auth.getUser()` → session/user
  - `await window.__supabase.rpc('app_users_become_owner')` → self-promotion (idempotent)
  - `await window.__supabase.from('app_users').select('*').eq('user_id', user.id)` → verify row

Sign-out shortcuts (for session recovery)
- Visible Sign out in header and error screens
- `/?signout=1` → local clear + best-effort server revoke (3s cap)
- `/?signout=force` → local-only clear, instant

Seeding behavior under strict RLS
- The UI attempts a one-time demo seed. If RLS blocks inserts, it logs a warning and continues; the backlog remains empty until you add rows via SQL or a future owner-only form.

Troubleshooting
- Infinite recursion error on `app_users` policy → ensure policies use `public.is_owner()` instead of subselecting `app_users` directly.
- `getSession` hangs → try a different browser or disable blockers; the app will time out in ~5s and route you to sign-in.
- `Become owner` fails → confirm functions exist and GRANTs to `authenticated`; you can also upsert your row manually:
  ```sql
  insert into public.app_users (user_id, email, role, status)
  values ('<UID>','<email>','owner','approved')
  on conflict (user_id) do update set role='owner', status='approved', email=excluded.email;
  ```

Appendix: tables (abridged)
- `backlog(id, patient_name, mrn, masked_mrn, procedure, est_duration_min, surgeon_id, case_type_id, phone1, phone2, preferred_date, notes, created_at)`
- `schedule(id, waiting_list_item_id, room_id, surgeon_id, date, start_time, end_time, status, notes, created_at)`
- `app_users(user_id, email, role, status, invited_by, created_at, updated_at)`
- `invitations(id, email, token, status, invited_by, expires_at, created_at)`
- `owner_profiles(user_id, full_name, workspace_name, org_name, phone, timezone, locale, created_at, updated_at)`
