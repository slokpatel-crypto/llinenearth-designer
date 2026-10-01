-- Make the database approval gate use the same verified-handoff semantics as the UI summary.
-- Approval counts only the latest row per anonymous case, requires a real signed handoff audit,
-- and counts distinct handoff audits so legacy checkbox-only rows can never satisfy the target.

create or replace function public.style_director_validation_signoff_record_v2(
  p_status text,
  p_required_positive_cases integer,
  p_signed_by text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_id uuid;
  v_positive integer:=0;
begin
  if p_status not in ('approved','review') then raise exception 'invalid validation status'; end if;
  if p_required_positive_cases is null or p_required_positive_cases<1 or p_required_positive_cases>50 then
    raise exception 'documented positive-case target between 1 and 50 is required';
  end if;
  if coalesce(length(trim(p_signed_by)),0)<2 then raise exception 'named reviewer is required'; end if;
  if p_status='review' and coalesce(length(trim(p_note)),0)<3 then raise exception 'review note is required'; end if;

  with latest as (
    select distinct on (case_id)
      case_id,directions_understandable,directions_distinct,stock_handoff_worked,
      handoff_audit_id,blocking_issue
    from private.style_director_user_tests
    order by case_id,created_at desc
  )
  select count(distinct l.handoff_audit_id) into v_positive
  from latest l
  join private.style_director_handoff_audit h on h.audit_id=l.handoff_audit_id
  where l.directions_understandable
    and l.directions_distinct
    and l.stock_handoff_worked
    and l.handoff_audit_id is not null
    and not l.blocking_issue;

  if p_status='approved' and v_positive<p_required_positive_cases then
    raise exception 'verified positive Style Director cases do not meet the documented approval target';
  end if;

  insert into private.style_director_validation_signoffs(
    status,required_positive_cases,signed_by,note
  ) values(
    p_status,p_required_positive_cases,left(trim(p_signed_by),120),left(trim(coalesce(p_note,'')),1200)
  )
  returning event_id into v_id;
  return v_id;
end;
$$;

revoke all on function public.style_director_validation_signoff_record_v2(text,integer,text,text) from public,anon,authenticated;
grant execute on function public.style_director_validation_signoff_record_v2(text,integer,text,text) to service_role;
