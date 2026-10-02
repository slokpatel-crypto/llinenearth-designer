-- Real-user Style Director validation evidence.
-- Anonymous case IDs only; no customer names, contact details or measurements.
-- Human owner/reviewer sign-off is append-only and requires at least one recorded real-user test.

create schema if not exists private;

create table if not exists private.style_director_user_tests (
  attempt_id uuid primary key default gen_random_uuid(),
  case_id text not null,
  device_class text not null check (device_class in ('mobile','tablet','desktop')),
  directions_understandable boolean not null,
  directions_distinct boolean not null,
  stock_handoff_worked boolean not null,
  blocking_issue boolean not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (case_id ~ '^[A-Za-z0-9._-]{3,80}$')
);

create table if not exists private.style_director_validation_signoffs (
  event_id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('approved','review')),
  signed_by text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (length(trim(signed_by)) between 2 and 120)
);

create index if not exists style_director_user_tests_case_idx
  on private.style_director_user_tests(case_id,created_at desc);

alter table private.style_director_user_tests enable row level security;
alter table private.style_director_validation_signoffs enable row level security;
revoke all on private.style_director_user_tests from public,anon,authenticated;
revoke all on private.style_director_validation_signoffs from public,anon,authenticated;

create or replace function public.style_director_user_test_record(
  p_case_id text,
  p_device_class text,
  p_directions_understandable boolean,
  p_directions_distinct boolean,
  p_stock_handoff_worked boolean,
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

  insert into private.style_director_user_tests(
    case_id,device_class,directions_understandable,directions_distinct,
    stock_handoff_worked,blocking_issue,note
  ) values(
    left(trim(p_case_id),80),p_device_class,p_directions_understandable,p_directions_distinct,
    p_stock_handoff_worked,p_blocking_issue,left(trim(coalesce(p_note,'')),1200)
  )
  returning attempt_id into v_id;
  return v_id;
end;
$$;

create or replace function public.style_director_user_test_list(p_limit integer default 500)
returns table(
  attempt_id uuid,case_id text,device_class text,directions_understandable boolean,
  directions_distinct boolean,stock_handoff_worked boolean,blocking_issue boolean,
  note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select t.attempt_id,t.case_id,t.device_class,t.directions_understandable,
         t.directions_distinct,t.stock_handoff_worked,t.blocking_issue,t.note,t.created_at
  from private.style_director_user_tests t
  order by t.created_at desc
  limit greatest(1,least(coalesce(p_limit,500),2000));
$$;

create or replace function public.style_director_validation_signoff_record(
  p_status text,
  p_signed_by text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_id uuid;
begin
  if p_status not in ('approved','review') then raise exception 'invalid validation status'; end if;
  if coalesce(length(trim(p_signed_by)),0)<2 then raise exception 'named reviewer is required'; end if;
  if p_status='review' and coalesce(length(trim(p_note)),0)<3 then raise exception 'review note is required'; end if;
  if not exists(select 1 from private.style_director_user_tests) then
    raise exception 'record real-user validation evidence before sign-off';
  end if;

  insert into private.style_director_validation_signoffs(status,signed_by,note)
  values(p_status,left(trim(p_signed_by),120),left(trim(coalesce(p_note,'')),1200))
  returning event_id into v_id;
  return v_id;
end;
$$;

create or replace function public.style_director_validation_signoff_list(p_limit integer default 100)
returns table(event_id uuid,status text,signed_by text,note text,created_at timestamptz)
language sql
security definer
set search_path='public','private'
as $$
  select s.event_id,s.status,s.signed_by,s.note,s.created_at
  from private.style_director_validation_signoffs s
  order by s.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),500));
$$;

revoke all on function public.style_director_user_test_record(text,text,boolean,boolean,boolean,boolean,text) from public,anon,authenticated;
revoke all on function public.style_director_user_test_list(integer) from public,anon,authenticated;
revoke all on function public.style_director_validation_signoff_record(text,text,text) from public,anon,authenticated;
revoke all on function public.style_director_validation_signoff_list(integer) from public,anon,authenticated;

grant execute on function public.style_director_user_test_record(text,text,boolean,boolean,boolean,boolean,text) to service_role;
grant execute on function public.style_director_user_test_list(integer) to service_role;
grant execute on function public.style_director_validation_signoff_record(text,text,text) to service_role;
grant execute on function public.style_director_validation_signoff_list(integer) to service_role;
