-- Server-timed novice Designer completion evidence.
-- Manual/operator-entered durations remain historical evidence, but only server-timed
-- sessions may satisfy the five-novice completion gate.

create schema if not exists private;

create table if not exists private.designer_novice_timing_sessions (
  session_id uuid primary key default gen_random_uuid(),
  case_id text not null,
  device_class text not null check (device_class in ('mobile','tablet','desktop')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  check (case_id ~ '^[A-Za-z0-9._-]{3,80}$')
);

create index if not exists designer_novice_timing_sessions_case_idx
  on private.designer_novice_timing_sessions(case_id,started_at desc);

alter table private.designer_novice_timing_sessions enable row level security;
revoke all on private.designer_novice_timing_sessions from public,anon,authenticated;

alter table private.designer_novice_attempts
  add column if not exists timing_session_id uuid references private.designer_novice_timing_sessions(session_id);

create unique index if not exists designer_novice_attempts_timing_session_unique
  on private.designer_novice_attempts(timing_session_id)
  where timing_session_id is not null;

create or replace function public.designer_novice_timer_start(
  p_case_id text,
  p_device_class text
)
returns table(session_id uuid,case_id text,device_class text,started_at timestamptz)
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_id uuid;
begin
  if trim(coalesce(p_case_id,'')) !~ '^[A-Za-z0-9._-]{3,80}$' then
    raise exception 'invalid anonymous novice case id';
  end if;
  if p_device_class not in ('mobile','tablet','desktop') then
    raise exception 'invalid novice-test device class';
  end if;

  insert into private.designer_novice_timing_sessions(case_id,device_class)
  values(left(trim(p_case_id),80),p_device_class)
  returning designer_novice_timing_sessions.session_id into v_id;

  return query
  select s.session_id,s.case_id,s.device_class,s.started_at
  from private.designer_novice_timing_sessions s
  where s.session_id=v_id;
end;
$$;

create or replace function public.designer_novice_timer_finish(
  p_session_id uuid
)
returns table(
  session_id uuid,
  case_id text,
  device_class text,
  duration_seconds integer,
  started_at timestamptz,
  finished_at timestamptz
)
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_started timestamptz;
  v_finished timestamptz;
  v_case text;
  v_device text;
  v_duration integer;
begin
  select s.started_at,s.finished_at,s.case_id,s.device_class
  into v_started,v_finished,v_case,v_device
  from private.designer_novice_timing_sessions s
  where s.session_id=p_session_id
  for update;

  if v_started is null then raise exception 'novice timing session not found'; end if;

  if v_finished is null then
    v_finished:=now();
    update private.designer_novice_timing_sessions
    set finished_at=v_finished
    where designer_novice_timing_sessions.session_id=p_session_id;
  end if;

  v_duration:=greatest(1,ceil(extract(epoch from (v_finished-v_started)))::integer);
  if v_duration>7200 then raise exception 'novice timing session exceeded two hours'; end if;

  return query select p_session_id,v_case,v_device,v_duration,v_started,v_finished;
end;
$$;

create or replace function public.designer_novice_attempt_record_v2(
  p_timing_session_id uuid,
  p_novice_confirmed boolean,
  p_liked_design_completed boolean,
  p_blocking_issue boolean,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_id uuid;
  v_case text;
  v_device text;
  v_started timestamptz;
  v_finished timestamptz;
  v_duration integer;
begin
  select s.case_id,s.device_class,s.started_at,s.finished_at
  into v_case,v_device,v_started,v_finished
  from private.designer_novice_timing_sessions s
  where s.session_id=p_timing_session_id;

  if v_case is null then raise exception 'novice timing session not found'; end if;
  if v_finished is null then raise exception 'finish the novice timing session before recording the attempt'; end if;

  v_duration:=greatest(1,ceil(extract(epoch from (v_finished-v_started)))::integer);
  if v_duration<1 or v_duration>7200 then raise exception 'invalid server-observed completion time'; end if;
  if p_novice_confirmed is null or p_liked_design_completed is null or p_blocking_issue is null then
    raise exception 'novice test outcomes are required';
  end if;
  if p_blocking_issue and length(trim(coalesce(p_note,'')))<3 then
    raise exception 'blocking issue note is required';
  end if;

  insert into private.designer_novice_attempts(
    case_id,device_class,duration_seconds,novice_confirmed,liked_design_completed,blocking_issue,note,timing_session_id
  ) values(
    v_case,v_device,v_duration,p_novice_confirmed,p_liked_design_completed,p_blocking_issue,
    left(trim(coalesce(p_note,'')),1200),p_timing_session_id
  )
  returning attempt_id into v_id;

  return v_id;
end;
$$;

drop function if exists public.designer_novice_attempt_list(integer);
create function public.designer_novice_attempt_list(p_limit integer default 500)
returns table(
  attempt_id uuid,case_id text,device_class text,duration_seconds integer,
  novice_confirmed boolean,liked_design_completed boolean,blocking_issue boolean,
  note text,timing_session_id uuid,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select a.attempt_id,a.case_id,a.device_class,a.duration_seconds,
    a.novice_confirmed,a.liked_design_completed,a.blocking_issue,a.note,a.timing_session_id,a.created_at
  from private.designer_novice_attempts a
  order by a.created_at desc
  limit greatest(1,least(coalesce(p_limit,500),2000));
$$;

create or replace function public.designer_novice_study_decision_record(
  p_status text,
  p_target_seconds integer,
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
  v_within_target integer:=0;
begin
  if p_status not in ('approved','review') then raise exception 'invalid novice-study decision'; end if;
  if p_target_seconds is null or p_target_seconds<1 or p_target_seconds>7200 then
    raise exception 'documented roadmap target time is required';
  end if;
  if length(trim(coalesce(p_signed_by,'')))<2 then raise exception 'named reviewer is required'; end if;
  if p_status='review' and length(trim(coalesce(p_note,'')))<3 then
    raise exception 'review decision note is required';
  end if;

  if p_status='approved' then
    with latest as (
      select distinct on (case_id)
        case_id,duration_seconds,novice_confirmed,liked_design_completed,blocking_issue,timing_session_id
      from private.designer_novice_attempts
      order by case_id,created_at desc
    )
    select count(*) into v_within_target
    from latest
    where timing_session_id is not null
      and novice_confirmed
      and liked_design_completed
      and not blocking_issue
      and duration_seconds<=p_target_seconds;

    if v_within_target<5 then
      raise exception 'five server-timed novice liked-design completions within the documented target are required before approval';
    end if;
  end if;

  insert into private.designer_novice_study_decisions(status,target_seconds,signed_by,note)
  values(
    p_status,p_target_seconds,left(trim(p_signed_by),120),left(trim(coalesce(p_note,'')),1200)
  )
  returning event_id into v_id;
  return v_id;
end;
$$;

revoke all on function public.designer_novice_timer_start(text,text) from public,anon,authenticated;
revoke all on function public.designer_novice_timer_finish(uuid) from public,anon,authenticated;
revoke all on function public.designer_novice_attempt_record_v2(uuid,boolean,boolean,boolean,text) from public,anon,authenticated;
revoke all on function public.designer_novice_attempt_list(integer) from public,anon,authenticated;

grant execute on function public.designer_novice_timer_start(text,text) to service_role;
grant execute on function public.designer_novice_timer_finish(uuid) to service_role;
grant execute on function public.designer_novice_attempt_record_v2(uuid,boolean,boolean,boolean,text) to service_role;
grant execute on function public.designer_novice_attempt_list(integer) to service_role;
