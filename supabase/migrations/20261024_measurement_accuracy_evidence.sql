-- Private append-only measurement accuracy evidence for Phase 4.
-- Stores anonymous self-vs-tailor comparisons. Errors are recomputed server-side;
-- client supplied pass/error fields are never trusted.

create schema if not exists private;

create table if not exists private.measurement_calibration_cases (
  event_id uuid primary key default gen_random_uuid(),
  case_id text not null,
  self_chest_cm numeric(7,2) not null,
  tailor_chest_cm numeric(7,2) not null,
  self_sleeve_cm numeric(7,2) not null,
  tailor_sleeve_cm numeric(7,2) not null,
  evidence_source text not null,
  checked_by text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (case_id ~ '^[A-Za-z0-9._-]{3,80}$'),
  check (self_chest_cm between 50 and 200),
  check (tailor_chest_cm between 50 and 200),
  check (self_sleeve_cm between 30 and 100),
  check (tailor_sleeve_cm between 30 and 100),
  check (length(trim(evidence_source)) between 3 and 240),
  check (length(trim(checked_by)) between 2 and 120),
  check (length(note) <= 1200)
);

create index if not exists measurement_calibration_cases_case_idx
  on private.measurement_calibration_cases(case_id,created_at desc);

alter table private.measurement_calibration_cases enable row level security;
revoke all on private.measurement_calibration_cases from public,anon,authenticated;

create or replace function public.measurement_calibration_case_record(
  p_case_id text,
  p_self_chest_cm numeric,
  p_tailor_chest_cm numeric,
  p_self_sleeve_cm numeric,
  p_tailor_sleeve_cm numeric,
  p_evidence_source text,
  p_checked_by text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_id uuid;
begin
  if trim(coalesce(p_case_id,'')) !~ '^[A-Za-z0-9._-]{3,80}$' then raise exception 'invalid anonymous measurement case id'; end if;
  if p_self_chest_cm not between 50 and 200 or p_tailor_chest_cm not between 50 and 200 then raise exception 'invalid chest evidence'; end if;
  if p_self_sleeve_cm not between 30 and 100 or p_tailor_sleeve_cm not between 30 and 100 then raise exception 'invalid sleeve evidence'; end if;
  if length(trim(coalesce(p_evidence_source,'')))<3 then raise exception 'physical comparison evidence source is required'; end if;
  if length(trim(coalesce(p_checked_by,'')))<2 then raise exception 'named checker or tailor is required'; end if;

  insert into private.measurement_calibration_cases(
    case_id,self_chest_cm,tailor_chest_cm,self_sleeve_cm,tailor_sleeve_cm,evidence_source,checked_by,note
  ) values(
    left(trim(p_case_id),80),p_self_chest_cm,p_tailor_chest_cm,p_self_sleeve_cm,p_tailor_sleeve_cm,
    left(trim(p_evidence_source),240),left(trim(p_checked_by),120),left(trim(coalesce(p_note,'')),1200)
  ) returning event_id into v_id;
  return v_id;
end;
$$;

drop function if exists public.measurement_calibration_case_list(integer);
create function public.measurement_calibration_case_list(p_limit integer default 500)
returns table(
  event_id uuid,case_id text,self_chest_cm numeric,tailor_chest_cm numeric,
  self_sleeve_cm numeric,tailor_sleeve_cm numeric,evidence_source text,checked_by text,note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select c.event_id,c.case_id,c.self_chest_cm,c.tailor_chest_cm,
    c.self_sleeve_cm,c.tailor_sleeve_cm,c.evidence_source,c.checked_by,c.note,c.created_at
  from private.measurement_calibration_cases c
  order by c.created_at desc
  limit greatest(1,least(coalesce(p_limit,500),2000));
$$;

revoke all on function public.measurement_calibration_case_record(text,numeric,numeric,numeric,numeric,text,text,text) from public,anon,authenticated;
revoke all on function public.measurement_calibration_case_list(integer) from public,anon,authenticated;
grant execute on function public.measurement_calibration_case_record(text,numeric,numeric,numeric,numeric,text,text,text) to service_role;
grant execute on function public.measurement_calibration_case_list(integer) to service_role;
