-- SECURITY DEFINER: Soft-remove a backlog item on behalf of an authenticated approved user.
-- Paste this into Supabase SQL editor and run once.

create or replace function public.backlog_soft_remove_user(
  p_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Require authenticated call
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Ensure the caller is allowed to write (owner or approved member/editor)
  if not exists (
    select 1 from public.app_users au
    where au.user_id = auth.uid()
      and (
        au.role = 'owner'
        or (au.status = 'approved' and au.role in ('member','editor'))
      )
  ) then
    raise exception 'not permitted';
  end if;

  -- Prefer boolean column if present; fallback to notes marker when column not found
  begin
    update public.backlog set is_removed = true where id = p_id;
  exception when undefined_column then
    update public.backlog
      set notes = coalesce(notes,'') || case when notes is null or notes='' then '' else E'\n' end || ('removed@' || now()::text)
      where id = p_id;
  end;
end;
$$;

grant execute on function public.backlog_soft_remove_user(uuid) to authenticated;
