-- Novice customer Designer completion study.
-- Anonymous cases only. The roadmap target time is entered by a named reviewer;
-- no timing threshold is invented in code.

create schema if not exists private;

create table if not exists private.designer_novice_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  case_id text not null,
  device_class text not null check (device_class in ('mobile','tablet','desktop')),
  duration_seconds integer not null check (duration_seconds between 1 and 7200),
  novice_confirmed boolean not null,
  liked_design_completed boolean not null,
  blocking_issue boolean not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (case_id ~ '^[A-Za-z0-9._-]{3,80}$')
);

create index if not exists designer_novice_attempts_case_idx
  on private.designer_novice_attempts(case_id,created_at desc);

create table if not exists private.designer_novice_study_decisions (
  event_id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('approved','review')),
  target_seconds integer not null check (target_seconds between 1 and 7200),
  signed_by text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (length(trim(signed_by)) between 2 and 120)
);

alter table private.designer_novice_attempts enable row level security;
alter table private.designer_novice_study_decisions enable row level security;
revoke all on private.designer_novice_attempts from public,anon,authenticated;
revoke all on private.designer_novice_study_decisions from public,anon,authenticated;

create or replace function public.designer_novice_attempt_record(
  p_case_id text,
  p_device_class text,
  p_duration_seconds integer,
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
declare v_id uuid;
begin
  if trim(coalesce(p_case_id,'')) !~ '^[A-Za-z0-9._-]{3,80}$' then
    raise exception 'invalid anonymous novice case id';
  end if;
  if p_device_class not in ('mobile','tablet','desktop') then
    raise exception 'invalid novice-test device class';
  end if;
  if p_duration_seconds is null or p_duration_seconds<1 or p_duration_seconds>7200 then
    raise exception 'invalid observed completion time';
  end if;
  if p_novice_confirmed is null or p_liked_design_completed is null or p_blocking_issue is null then
    raise exception 'novice test outcomes are required';
  end if;
  if p_blocking_issue and length(trim(coalesce(p_note,'')))<3 then
    raise exception 'blocking issue note is required';
  end if;

  insert into private.designer_novice_attempts(
    case_id,device_class,duration_seconds,novice_confirmed,liked_design_completed,blocking_issue,note
  ) values(
    left(trim(p_case_id),80),p_device_class,p_duration_seconds,
    p_novice_confirmed,p_liked_design_completed,p_blocking_issue,
    left(trim(coalesce(p_note,'')),1200)
  )
  returning attempt_id into v_id;
  return v_id;
end;
$$;

create or replace function public.designer_novice_attempt_list(p_limit integer default 500)
returns table(
  attempt_id uuid,case_id text,device_class text,duration_seconds integer,
  novice_confirmed boolean,liked_design_completed boolean,blocking_issue boolean,
  note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select a.attempt_id,a.case_id,a.device_class,a.duration_seconds,
    a.novice_confirmed,a.liked_design_completed,a.blocking_issue,a.note,a.created_at
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
        case_id,duration_seconds,novice_confirmed,liked_design_completed,blocking_issue
      from private.designer_novice_attempts
      order by case_id,created_at desc
    )
    select count(*) into v_within_target
    from latest
    where novice_confirmed
      and liked_design_completed
      and not blocking_issue
      and duration_seconds<=p_target_seconds;

    if v_within_target<5 then
      raise exception 'five novice liked-design completions within the documented target are required before approval';
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

create or replace function public.designer_novice_study_decision_list(p_limit integer default 100)
returns table(
  event_id uuid,status text,target_seconds integer,signed_by text,note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select d.event_id,d.status,d.target_seconds,d.signed_by,d.note,d.created_at
  from private.designer_novice_study_decisions d
  order by d.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),500));
$$;

revoke all on function public.designer_novice_attempt_record(text,text,integer,boolean,boolean,boolean,text) from public,anon,authenticated;
revoke all on function public.designer_novice_attempt_list(integer) from public,anon,authenticated;
revoke all on function public.designer_novice_study_decision_record(text,integer,text,text) from public,anon,authenticated;
revoke all on function public.designer_novice_study_decision_list(integer) from public,anon,authenticated;

grant execute on function public.designer_novice_attempt_record(text,text,integer,boolean,boolean,boolean,text) to service_role;
grant execute on function public.designer_novice_attempt_list(integer) to service_role;
grant execute on function public.designer_novice_study_decision_record(text,integer,text,text) to service_role;
grant execute on function public.designer_novice_study_decision_list(integer) to service_role;
