-- Harden Style Director real-user validation with a human-entered evidence threshold.
-- Software does not invent the required number of clean cases. A named reviewer records
-- the minimum positive-case count, and approval is rejected until current latest-case
-- evidence meets that documented threshold.

alter table private.style_director_validation_signoffs
  add column if not exists required_positive_cases integer;

alter table private.style_director_validation_signoffs
  drop constraint if exists style_director_validation_signoffs_required_positive_cases_check;

alter table private.style_director_validation_signoffs
  add constraint style_director_validation_signoffs_required_positive_cases_check
  check (required_positive_cases is null or required_positive_cases between 1 and 50);

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
      case_id,directions_understandable,directions_distinct,stock_handoff_worked,blocking_issue
    from private.style_director_user_tests
    order by case_id,created_at desc
  )
  select count(*) into v_positive
  from latest
  where directions_understandable
    and directions_distinct
    and stock_handoff_worked
    and not blocking_issue;

  if p_status='approved' and v_positive<p_required_positive_cases then
    raise exception 'positive Style Director cases do not meet the documented approval target';
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

drop function if exists public.style_director_validation_signoff_list(integer);
create function public.style_director_validation_signoff_list(p_limit integer default 100)
returns table(
  event_id uuid,status text,required_positive_cases integer,signed_by text,note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select s.event_id,s.status,s.required_positive_cases,s.signed_by,s.note,s.created_at
  from private.style_director_validation_signoffs s
  order by s.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),500));
$$;

revoke all on function public.style_director_validation_signoff_record_v2(text,integer,text,text) from public,anon,authenticated;
revoke all on function public.style_director_validation_signoff_list(integer) from public,anon,authenticated;

grant execute on function public.style_director_validation_signoff_record_v2(text,integer,text,text) to service_role;
grant execute on function public.style_director_validation_signoff_list(integer) to service_role;
