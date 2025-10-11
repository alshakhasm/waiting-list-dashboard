-- SECURITY DEFINER helper: insert backlog on behalf of an authenticated, approved writer/owner.
-- Paste this into the Supabase SQL editor and run it.

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
    phone1, phone2, notes
  ) values (
    trim(p_patient_name),
    v_mrn,
    regexp_replace(v_mrn, '.(?=..$)', '•', 'g'),
    trim(p_procedure),
    p_category_key,
    coalesce(p_est_duration_min, 60),
    v_surgeon,
    coalesce(p_case_type_id, 'case:elective'),
    v_p1,
    v_p2,
    nullif(p_notes, '')
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_backlog_user(text, text, text, text, text, text, text, text, integer, text) to authenticated;
