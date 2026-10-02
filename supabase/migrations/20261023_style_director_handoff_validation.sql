-- Bind Style Director real-user validation to a server-audited signed handoff.

alter table private.style_director_user_tests
  add column if not exists handoff_audit_id uuid references private.style_director_handoff_audit(audit_id);

create or replace function public.style_director_user_test_record_v2(
  p_case_id text,
  p_device_class text,
  p_directions_understandable boolean,
  p_directions_distinct boolean,
  p_stock_handoff_worked boolean,
  p_handoff_audit_id uuid,
  p_blocking_issue boolean,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_id uuid;
begin
  if trim(coalesce(p_case_id,'')) !~ '^[A-Za-z0-9._-]{3,80}$' then raise exception 'invalid anonymous case id'; end if;
  if p_device_class not in ('mobile','tablet','desktop') then raise exception 'invalid device class'; end if;
  if p_blocking_issue and coalesce(length(trim(p_note)),0)<3 then raise exception 'blocking issue note is required'; end if;
  if p_stock_handoff_worked then
    if p_handoff_audit_id is null then raise exception 'verified handoff audit id is required'; end if;
    if not exists(select 1 from private.style_director_handoff_audit h where h.audit_id=p_handoff_audit_id) then
      raise exception 'verified handoff audit was not found';
    end if;
  end if;

  insert into private.style_director_user_tests(
    case_id,device_class,directions_understandable,directions_distinct,
    stock_handoff_worked,handoff_audit_id,blocking_issue,note
  ) values(
    left(trim(p_case_id),80),p_device_class,p_directions_understandable,p_directions_distinct,
    p_stock_handoff_worked,p_handoff_audit_id,p_blocking_issue,left(trim(coalesce(p_note,'')),1200)
  )
  returning attempt_id into v_id;
  return v_id;
end;
$$;

drop function if exists public.style_director_user_test_list(integer);
create function public.style_director_user_test_list(p_limit integer default 500)
returns table(
  attempt_id uuid,case_id text,device_class text,directions_understandable boolean,
  directions_distinct boolean,stock_handoff_worked boolean,handoff_audit_id uuid,blocking_issue boolean,
  note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select t.attempt_id,t.case_id,t.device_class,t.directions_understandable,
         t.directions_distinct,t.stock_handoff_worked,t.handoff_audit_id,t.blocking_issue,t.note,t.created_at
  from private.style_director_user_tests t
  order by t.created_at desc
  limit greatest(1,least(coalesce(p_limit,500),2000));
$$;

revoke all on function public.style_director_user_test_record_v2(text,text,boolean,boolean,boolean,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.style_director_user_test_list(integer) from public,anon,authenticated;
grant execute on function public.style_director_user_test_record_v2(text,text,boolean,boolean,boolean,uuid,boolean,text) to service_role;
grant execute on function public.style_director_user_test_list(integer) to service_role;
