-- Require distinct server-audited Style Director handoffs for clean-case approval.
-- Reusing the same audited handoff under multiple anonymous case IDs cannot inflate evidence.

create or replace function public.style_director_validation_signoff_record_v3(
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
  v_positive integer:=0;
  v_id uuid;
begin
  if p_status not in ('approved','review') then raise exception 'invalid validation status'; end if;
  if p_required_positive_cases is null or p_required_positive_cases<1 or p_required_positive_cases>50 then raise exception 'documented positive-case target between 1 and 50 is required'; end if;
  if coalesce(length(trim(p_signed_by)),0)<2 then raise exception 'named reviewer is required'; end if;
  if p_status='review' and coalesce(length(trim(p_note)),0)<3 then raise exception 'review note is required'; end if;

  with latest as (
    select distinct on (case_id)
      case_id,directions_understandable,directions_distinct,stock_handoff_worked,blocking_issue,handoff_audit_id
    from private.style_director_user_tests
    order by case_id,created_at desc
  ), clean as (
    select distinct handoff_audit_id
    from latest
    where directions_understandable
      and directions_distinct
      and stock_handoff_worked
      and not blocking_issue
      and handoff_audit_id is not null
  )
  select count(*) into v_positive from clean;

  if p_status='approved' and v_positive<p_required_positive_cases then
    raise exception 'distinct verified Style Director handoffs do not meet the documented approval target';
  end if;

  insert into private.style_director_validation_signoffs(status,required_positive_cases,signed_by,note)
  values(p_status,p_required_positive_cases,left(trim(p_signed_by),120),left(trim(coalesce(p_note,'')),1200))
  returning event_id into v_id;
  return v_id;
end;
$$;

revoke all on function public.style_director_validation_signoff_record_v3(text,integer,text,text) from public,anon,authenticated;
grant execute on function public.style_director_validation_signoff_record_v3(text,integer,text,text) to service_role;
