-- Verified private-beta lock -> share evidence.
-- A beta success may no longer be created from operator checkboxes alone.
-- The share API records an audit only after the locked revision passes recipe-hash verification.

create schema if not exists private;

create table if not exists private.design_share_audit (
  audit_id uuid primary key default gen_random_uuid(),
  revision_id text not null,
  recipe_hash text not null,
  created_at timestamptz not null default now(),
  check (length(trim(revision_id)) between 3 and 180),
  check (recipe_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists design_share_audit_revision_idx
  on private.design_share_audit(revision_id,created_at desc);

alter table private.design_share_audit enable row level security;
revoke all on private.design_share_audit from public,anon,authenticated;

create or replace function public.design_share_audit_record(
  p_revision_id text,
  p_recipe_hash text
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_id uuid;
begin
  if coalesce(length(trim(p_revision_id)),0)<3 or length(trim(p_revision_id))>180 then
    raise exception 'invalid locked revision id';
  end if;
  if lower(trim(coalesce(p_recipe_hash,''))) !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid locked recipe hash';
  end if;

  insert into private.design_share_audit(revision_id,recipe_hash)
  values(left(trim(p_revision_id),180),lower(trim(p_recipe_hash)))
  returning audit_id into v_id;
  return v_id;
end;
$$;

alter table private.launch_beta_attempts
  add column if not exists revision_id text,
  add column if not exists recipe_hash text,
  add column if not exists share_audit_confirmed boolean not null default false;

create or replace function public.launch_beta_attempt_record_v3(
  p_case_id text,
  p_device_class text,
  p_revision_id text,
  p_blocking_bug boolean,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_attempt uuid;
  v_hash text;
begin
  if p_device_class not in ('mobile','tablet','desktop') then raise exception 'unsupported beta device class'; end if;
  if coalesce(length(trim(p_case_id)),0)<3 or length(trim(p_case_id))>80 then raise exception 'invalid anonymous beta case id'; end if;
  if coalesce(length(trim(p_revision_id)),0)<3 or length(trim(p_revision_id))>180 then raise exception 'locked revision id is required'; end if;
  if p_blocking_bug is null then raise exception 'blocking beta result is required'; end if;
  if p_blocking_bug and length(trim(coalesce(p_note,'')))<3 then raise exception 'blocking beta bugs require a note'; end if;

  select a.recipe_hash into v_hash
  from private.design_share_audit a
  where a.revision_id=trim(p_revision_id)
  order by a.created_at desc
  limit 1;

  if v_hash is null then
    raise exception 'no verified share audit exists for this locked revision';
  end if;

  insert into private.launch_beta_attempts(
    case_id,device_class,core_flow_completed,design_locked,share_or_enquiry_completed,
    blocking_bug,note,revision_id,recipe_hash,share_audit_confirmed
  ) values(
    left(trim(p_case_id),80),p_device_class,true,true,true,
    p_blocking_bug,left(coalesce(p_note,''),1200),left(trim(p_revision_id),180),v_hash,true
  )
  returning attempt_id into v_attempt;
  return v_attempt;
end;
$$;

drop function if exists public.launch_beta_attempt_list(integer);
create function public.launch_beta_attempt_list(p_limit integer default 200)
returns table(
  attempt_id uuid,case_id text,device_class text,core_flow_completed boolean,
  design_locked boolean,share_or_enquiry_completed boolean,
  blocking_bug boolean,note text,revision_id text,recipe_hash text,
  share_audit_confirmed boolean,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select b.attempt_id,b.case_id,b.device_class,b.core_flow_completed,
    b.design_locked,b.share_or_enquiry_completed,b.blocking_bug,b.note,
    b.revision_id,b.recipe_hash,b.share_audit_confirmed,b.created_at
  from private.launch_beta_attempts b
  order by b.created_at desc
  limit greatest(1,least(coalesce(p_limit,200),500));
$$;

revoke all on function public.design_share_audit_record(text,text) from public,anon,authenticated;
revoke all on function public.launch_beta_attempt_record_v3(text,text,text,boolean,text) from public,anon,authenticated;
revoke all on function public.launch_beta_attempt_list(integer) from public,anon,authenticated;

grant execute on function public.design_share_audit_record(text,text) to service_role;
grant execute on function public.launch_beta_attempt_record_v3(text,text,text,boolean,text) to service_role;
grant execute on function public.launch_beta_attempt_list(integer) to service_role;
