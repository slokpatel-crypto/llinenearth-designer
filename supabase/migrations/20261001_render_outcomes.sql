-- Private final-render outcome ledger for approval-rate and cost evidence.
-- Records provider-reported credits and later human review; no pricing assumptions are seeded.

create schema if not exists private;

create table if not exists private.designer_render_outcomes (
  outcome_id uuid primary key default gen_random_uuid(),
  job_id text not null,
  concept_id text not null,
  view text not null check (view in ('front','three-quarter','side','back')),
  shirt_id text not null,
  pant_id text not null,
  credits_used numeric(12,4) not null check (credits_used>=0),
  cached boolean not null default false,
  repair boolean not null default false,
  qa_status text check (qa_status in ('pass','review')),
  qa_payload jsonb,
  human_status text not null default 'pending' check (human_status in ('pending','approved','rejected')),
  human_note text not null default '',
  generated_at timestamptz not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique(job_id,view)
);

create index if not exists designer_render_outcomes_created_idx
  on private.designer_render_outcomes(created_at desc);
create index if not exists designer_render_outcomes_human_idx
  on private.designer_render_outcomes(human_status,created_at desc);

alter table private.designer_render_outcomes enable row level security;
revoke all on private.designer_render_outcomes from public,anon,authenticated;

create or replace function public.designer_render_outcome_record(
  p_job_id text,
  p_concept_id text,
  p_view text,
  p_shirt_id text,
  p_pant_id text,
  p_credits_used numeric,
  p_cached boolean,
  p_repair boolean,
  p_generated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_id uuid;
begin
  if coalesce(length(trim(p_job_id)),0)=0 then raise exception 'job id required'; end if;
  if p_view not in ('front','three-quarter','side','back') then raise exception 'invalid render view'; end if;
  if p_credits_used is null or p_credits_used<0 or p_credits_used>100000 then raise exception 'invalid credits used'; end if;

  insert into private.designer_render_outcomes(
    job_id,concept_id,view,shirt_id,pant_id,credits_used,cached,repair,generated_at
  ) values(
    left(trim(p_job_id),180),left(trim(p_concept_id),180),p_view,left(trim(p_shirt_id),160),left(trim(p_pant_id),160),
    round(p_credits_used,4),coalesce(p_cached,false),coalesce(p_repair,false),p_generated_at
  )
  on conflict(job_id,view) do update set
    credits_used=excluded.credits_used,
    cached=excluded.cached,
    repair=excluded.repair
  returning outcome_id into v_id;

  return v_id;
end;
$$;

create or replace function public.designer_render_outcome_attach_qa(
  p_job_id text,
  p_view text,
  p_qa_status text,
  p_qa_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
begin
  if p_qa_status not in ('pass','review') then raise exception 'invalid qa status'; end if;
  update private.designer_render_outcomes
  set qa_status=p_qa_status,qa_payload=p_qa_payload
  where job_id=left(trim(p_job_id),180) and view=p_view;
  return found;
end;
$$;

create or replace function public.designer_render_outcome_review(
  p_outcome_id uuid,
  p_human_status text,
  p_human_note text default ''
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
begin
  if p_human_status not in ('approved','rejected') then raise exception 'invalid human review status'; end if;
  update private.designer_render_outcomes
  set human_status=p_human_status,human_note=left(coalesce(p_human_note,''),1000),reviewed_at=now()
  where outcome_id=p_outcome_id;
  return found;
end;
$$;

create or replace function public.designer_render_outcome_list(p_limit integer default 200)
returns table(
  outcome_id uuid,job_id text,concept_id text,view text,shirt_id text,pant_id text,
  credits_used numeric,cached boolean,repair boolean,qa_status text,qa_payload jsonb,
  human_status text,human_note text,generated_at timestamptz,created_at timestamptz,reviewed_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select o.outcome_id,o.job_id,o.concept_id,o.view,o.shirt_id,o.pant_id,
    o.credits_used,o.cached,o.repair,o.qa_status,o.qa_payload,
    o.human_status,o.human_note,o.generated_at,o.created_at,o.reviewed_at
  from private.designer_render_outcomes o
  order by o.created_at desc
  limit greatest(1,least(coalesce(p_limit,200),1000));
$$;


create table if not exists private.designer_render_pattern_calibration (
  calibration_id uuid primary key default gen_random_uuid(),
  outcome_id uuid not null references private.designer_render_outcomes(outcome_id) on delete cascade,
  garment text not null check (garment in ('shirt','trouser')),
  expected_repeat_mm numeric(10,3) not null check (expected_repeat_mm>0 and expected_repeat_mm<=1000),
  observed_repeat_mm numeric(10,3) not null check (observed_repeat_mm>0 and observed_repeat_mm<=1000),
  scale_error_pct numeric(10,3) not null check (scale_error_pct>=0),
  axis_status text not null check (axis_status in ('match','mismatch','not_applicable')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists designer_render_pattern_calibration_outcome_idx
  on private.designer_render_pattern_calibration(outcome_id,created_at desc);

alter table private.designer_render_pattern_calibration enable row level security;
revoke all on private.designer_render_pattern_calibration from public,anon,authenticated;

create or replace function public.designer_render_pattern_calibration_record(
  p_outcome_id uuid,
  p_garment text,
  p_expected_repeat_mm numeric,
  p_observed_repeat_mm numeric,
  p_axis_status text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $
declare
  v_id uuid;
  v_error numeric;
begin
  if p_garment not in ('shirt','trouser') then raise exception 'invalid garment'; end if;
  if p_axis_status not in ('match','mismatch','not_applicable') then raise exception 'invalid axis status'; end if;
  if p_expected_repeat_mm is null or p_expected_repeat_mm<=0 or p_expected_repeat_mm>1000 then raise exception 'invalid expected repeat'; end if;
  if p_observed_repeat_mm is null or p_observed_repeat_mm<=0 or p_observed_repeat_mm>1000 then raise exception 'invalid observed repeat'; end if;
  if not exists(select 1 from private.designer_render_outcomes where outcome_id=p_outcome_id) then raise exception 'unknown render outcome'; end if;

  v_error=abs(p_observed_repeat_mm-p_expected_repeat_mm)/p_expected_repeat_mm*100;

  insert into private.designer_render_pattern_calibration(
    outcome_id,garment,expected_repeat_mm,observed_repeat_mm,scale_error_pct,axis_status,note
  ) values(
    p_outcome_id,p_garment,round(p_expected_repeat_mm,3),round(p_observed_repeat_mm,3),round(v_error,3),p_axis_status,left(coalesce(p_note,''),1000)
  )
  returning calibration_id into v_id;
  return v_id;
end;
$;

create or replace function public.designer_render_pattern_calibration_list(p_limit integer default 200)
returns table(
  calibration_id uuid,outcome_id uuid,garment text,expected_repeat_mm numeric,observed_repeat_mm numeric,
  scale_error_pct numeric,axis_status text,note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $
  select c.calibration_id,c.outcome_id,c.garment,c.expected_repeat_mm,c.observed_repeat_mm,
    c.scale_error_pct,c.axis_status,c.note,c.created_at
  from private.designer_render_pattern_calibration c
  order by c.created_at desc
  limit greatest(1,least(coalesce(p_limit,200),1000));
$;

revoke all on function public.designer_render_outcome_record(text,text,text,text,text,numeric,boolean,boolean,timestamptz) from public,anon,authenticated;
revoke all on function public.designer_render_outcome_attach_qa(text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.designer_render_outcome_review(uuid,text,text) from public,anon,authenticated;
revoke all on function public.designer_render_outcome_list(integer) from public,anon,authenticated;
revoke all on function public.designer_render_pattern_calibration_record(uuid,text,numeric,numeric,text,text) from public,anon,authenticated;
revoke all on function public.designer_render_pattern_calibration_list(integer) from public,anon,authenticated;

grant execute on function public.designer_render_outcome_record(text,text,text,text,text,numeric,boolean,boolean,timestamptz) to service_role;
grant execute on function public.designer_render_outcome_attach_qa(text,text,text,jsonb) to service_role;
grant execute on function public.designer_render_outcome_review(uuid,text,text) to service_role;
grant execute on function public.designer_render_outcome_list(integer) to service_role;
grant execute on function public.designer_render_pattern_calibration_record(uuid,text,numeric,numeric,text,text) to service_role;
grant execute on function public.designer_render_pattern_calibration_list(integer) to service_role;
