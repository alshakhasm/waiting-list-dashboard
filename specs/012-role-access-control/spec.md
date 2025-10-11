# Feature spec: Role & Access Control (viewer/editor + single-owner)

Summary

- Introduce two new roles: `viewer` (read-only) and `editor` (write) in addition to existing `owner` and `member`.
- Enforce RLS so that:
  - `viewer` can only SELECT on guarded tables.
  - `editor` and `member` can INSERT/UPDATE on specified tables (delete restricted to owner where needed).
    - `editor` and `member` can INSERT/UPDATE on specified tables. Editors are additionally allowed to DELETE backlog rows; members are not.
  - `owner` retains full access.
- Make owner uneditable in the UI and enforce only one approved owner at the DB level.
- Add server-side RPCs for: accept invitation, delete user completely, purge app (already present); ensure execute grants.

Design decisions

- Roles are stored in `public.app_users.role` with the enum: (`owner`, `member`, `viewer`, `editor`).
- Two SQL helper functions: `public.can_read()` and `public.can_write()` centralize role logic for RLS policies.
- UI: Members page allows owners to assign `member`, `viewer`, or `editor` but cannot assign `owner` (client guard + server trigger prevents it). Owner rows are shown as a non-editable badge; demote action is disabled in the main UI.
- Database: enforce at-most-one approved `owner` via a trigger and a partial unique index. The trigger raises on attempts to add another owner.

Migration / SQL snippets

-- 1) Expand role check constraint
alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users
  add constraint app_users_role_check check (role in ('owner','member','viewer','editor'));

-- 2) Add helpers
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

-- 3b) Delete helper and policy (editors may delete backlog)
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

drop policy if exists backlog_delete on backlog;
create policy backlog_delete on backlog for delete using (public.can_delete());

-- 3) RLS policy updates (example for backlog)
drop policy if exists backlog_read on backlog;
create policy backlog_read on backlog for select using (public.can_read());

drop policy if exists backlog_insert on backlog;
create policy backlog_insert on backlog for insert with check (public.can_write());

drop policy if exists backlog_update on backlog;
create policy backlog_update on backlog for update using (public.can_write()) with check (public.can_write());

-- 4) Grant RPCs to authenticated
grant execute on function public.app_users_delete_completely(uuid, text) to authenticated;
grant execute on function public.app_users_delete_completely(text, uuid) to authenticated;
grant execute on function public.invitations_accept(text) to authenticated;

-- 5) Single-owner DB-level guard (ensure duplicates removed first)
-- list existing approved owners
select user_id, email, role, status, created_at from public.app_users where role = 'owner' and status = 'approved';

-- If more than one: demote extras to member (careful, run as owner)
-- update public.app_users set role = 'member' where user_id = '<uuid-to-demote>';

-- Then create unique partial index
create unique index if not exists one_approved_owner_idx on public.app_users ((status='approved' and role='owner')) where (status='approved' and role='owner');


Client changes

- UI: `MembersPage` updated to show non-editable owner badge; role dropdown for non-owner rows only. Provide realtime profile subscription so role changes reflect immediately.
- API: `updateMember` refuses assigning `owner` via client and `deleteMemberCompletely` has a fallback path if RPC missing.
- Debug helper: `debugCurrentAccess()` exposed as `appDebug.debugCurrentAccess()` to inspect current auth/app_user rows quickly.

QA checklist

- [ ] Run the role-check expansion SQL and verify updates succeed.
- [ ] Confirm `public.can_read()` and `public.can_write()` functions exist and return expected values for different test users.
- [ ] Verify backlog/schedule RLS policies are using these helpers.
- [ ] Confirm only one approved owner exists (SQL check). If duplicates existed, confirm extra owner rows were demoted.
- [ ] In app, confirm that:
  - Owner rows show a badge and cannot be edited in Members page.
  - Owners can assign viewer/editor/member to other users.
  - Viewers cannot insert/update guarded tables.
  - Editors and members can insert/update where permitted.
  - Delete member works for non-owner accounts.
- [ ] Use `await appDebug.debugCurrentAccess()` in console to confirm current profile.

Rollout notes

- Run SQL on staging first. If multiple owners exist, demote extras before creating the unique index.
- Monitor Supabase function grants and schema cache; clients may need to reload to pick up new functions.

Open questions (resolved)

- Editors may DELETE backlog rows (implemented via `can_delete()` and `backlog_delete` policy).
- Intake links remain owner-only (no change).

