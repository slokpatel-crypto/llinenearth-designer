-- Normalize real-cut meterage evidence into a private append-only production registry.
-- Evidence is tied to a real production order and its durable locked-design context.
-- One latest row per order/garment may count toward meterage calibration; relabeling
-- the same cut under multiple case IDs cannot inflate the evidence count.

create schema if not exists private;

create table if not exists private.production_cut_evidence (
  evidence_id uuid primary key default gen_random_uuid(),
  case_id text not null,
  order_id uuid not null references private.production_orders(order_id) on delete cascade,
  revision_id text not null,
  recipe_hash text not null,
  garment text not null check (garment in ('shirt','trouser')),
  fabric_id text not null,
  fabric_width_cm numeric(7,2) not null,
  actual_metres numeric(8,3) not null,
  pattern_repeat_mm numeric(9,2),
  pattern_matching boolean not null default false,
  cut_context text not null default '',
  checked_by text not null,
  evidence_reference text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (case_id ~ '^[A-Za-z0-9._-]{3,80}$'),
  check (recipe_hash ~ '^[a-f0-9]{64}$'),
  check (fabric_width_cm between 60 and 220),
  check (actual_metres > 0 and actual_metres <= 12),
  check (pattern_repeat_mm is null or (pattern_repeat_mm > 0 and pattern_repeat_mm <= 1000)),
  check (length(trim(checked_by)) between 2 and 120),
  check (length(trim(evidence_reference)) between 3 and 240),
  check (length(cut_context) <= 160),
  check (length(note) <= 1200)
);

create index if not exists production_cut_evidence_order_idx
  on private.production_cut_evidence(order_id,garment,created_at desc);
create index if not exists production_cut_evidence_case_idx
  on private.production_cut_evidence(case_id,created_at desc);

alter table private.production_cut_evidence enable row level security;
revoke all on private.production_cut_evidence from public,anon,authenticated;

create or replace function public.production_cut_evidence_record(
  p_case_id text,
  p_order_id uuid,
  p_garment text,
  p_fabric_id text,
  p_fabric_width_cm numeric,
  p_actual_metres numeric,
  p_pattern_repeat_mm numeric default null,
  p_pattern_matching boolean default false,
  p_cut_context text default '',
  p_checked_by text default '',
  p_evidence_reference text default '',
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_evidence uuid;
  v_revision text;
  v_hash text;
  v_status text;
  v_context jsonb;
  v_expected_fabric text;
begin
  if trim(coalesce(p_case_id,'')) !~ '^[A-Za-z0-9._-]{3,80}$' then raise exception 'invalid anonymous cut case id'; end if;
  if p_garment not in ('shirt','trouser') then raise exception 'unsupported cut garment'; end if;
  if coalesce(length(trim(p_fabric_id)),0)<2 then raise exception 'fabric id is required'; end if;
  if p_fabric_width_cm is null or p_fabric_width_cm<60 or p_fabric_width_cm>220 then raise exception 'invalid fabric width'; end if;
  if p_actual_metres is null or p_actual_metres<=0 or p_actual_metres>12 then raise exception 'invalid actual cloth usage'; end if;
  if p_pattern_repeat_mm is not null and (p_pattern_repeat_mm<=0 or p_pattern_repeat_mm>1000) then raise exception 'invalid pattern repeat'; end if;
  if coalesce(length(trim(p_checked_by)),0)<2 then raise exception 'named tailor/checker is required'; end if;
  if coalesce(length(trim(p_evidence_reference)),0)<3 then raise exception 'physical cutting evidence reference is required'; end if;

  select o.revision_id,o.recipe_hash,o.status,c.context
  into v_revision,v_hash,v_status,v_context
  from private.production_orders o
  left join private.production_order_learning_context c on c.order_id=o.order_id
  where o.order_id=p_order_id;

  if v_status is null then raise exception 'unknown production order'; end if;
  if v_status not in ('cutting','stitching','fitting','ready','delivered') then
    raise exception 'real cut evidence requires an order that has reached cutting';
  end if;
  if v_context is null or v_context->>'version'<>'linen-earth-production-learning-context-v1' then
    raise exception 'durable locked-design production context is required for cut evidence';
  end if;
  if v_context->>'revisionId'<>v_revision or lower(coalesce(v_context->>'recipeHash',''))<>lower(v_hash) then
    raise exception 'production learning context does not match the order lock';
  end if;

  v_expected_fabric:=case when p_garment='shirt' then v_context#>>'{fabrics,shirtId}' else v_context#>>'{fabrics,trouserId}' end;
  if coalesce(v_expected_fabric,'')<>trim(p_fabric_id) then raise exception 'cut fabric does not match the locked production design'; end if;

  insert into private.production_cut_evidence(
    case_id,order_id,revision_id,recipe_hash,garment,fabric_id,fabric_width_cm,actual_metres,
    pattern_repeat_mm,pattern_matching,cut_context,checked_by,evidence_reference,note
  ) values(
    left(trim(p_case_id),80),p_order_id,v_revision,lower(v_hash),p_garment,left(trim(p_fabric_id),160),
    round(p_fabric_width_cm,2),round(p_actual_metres,3),
    case when p_pattern_repeat_mm is null then null else round(p_pattern_repeat_mm,2) end,
    coalesce(p_pattern_matching,false),left(trim(coalesce(p_cut_context,'')),160),
    left(trim(p_checked_by),120),left(trim(p_evidence_reference),240),left(trim(coalesce(p_note,'')),1200)
  ) returning evidence_id into v_evidence;
  return v_evidence;
end;
$$;

create or replace function public.production_cut_evidence_list(p_limit integer default 500)
returns table(
  evidence_id uuid,case_id text,order_id uuid,revision_id text,recipe_hash text,garment text,fabric_id text,
  fabric_width_cm numeric,actual_metres numeric,pattern_repeat_mm numeric,pattern_matching boolean,
  cut_context text,checked_by text,evidence_reference text,note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select latest.evidence_id,latest.case_id,latest.order_id,latest.revision_id,latest.recipe_hash,latest.garment,latest.fabric_id,
    latest.fabric_width_cm,latest.actual_metres,latest.pattern_repeat_mm,latest.pattern_matching,
    latest.cut_context,latest.checked_by,latest.evidence_reference,latest.note,latest.created_at
  from (
    select distinct on (e.order_id,e.garment) e.*
    from private.production_cut_evidence e
    order by e.order_id,e.garment,e.created_at desc,e.evidence_id desc
  ) latest
  order by latest.created_at desc
  limit greatest(1,least(coalesce(p_limit,500),2000));
$$;

create or replace function public.production_meterage_model_create_v4(
  p_garment text,
  p_version text,
  p_bands jsonb,
  p_evidence_case_ids jsonb,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_model uuid;
  v_requested_count integer:=0;
  v_verified_count integer:=0;
  v_verified_ids jsonb:='[]'::jsonb;
begin
  if p_garment not in ('shirt','trouser') then raise exception 'unsupported garment'; end if;
  if coalesce(length(trim(p_version)),0)<3 or length(trim(p_version))>80 then raise exception 'invalid model version'; end if;
  if jsonb_typeof(p_bands)<>'array' or jsonb_array_length(p_bands)<1 or jsonb_array_length(p_bands)>12 then raise exception 'meterage bands must contain 1..12 rows'; end if;
  if jsonb_typeof(p_evidence_case_ids)<>'array' then raise exception 'evidence case ids must be an array'; end if;

  select count(*) into v_requested_count from (
    select distinct trim(value) case_id from jsonb_array_elements_text(p_evidence_case_ids)
    where length(trim(value)) between 3 and 80
  ) requested;
  if v_requested_count<>jsonb_array_length(p_evidence_case_ids) then raise exception 'meterage evidence case IDs must be non-empty and unique'; end if;

  with latest as (
    select distinct on (e.order_id,e.garment) e.*
    from private.production_cut_evidence e
    order by e.order_id,e.garment,e.created_at desc,e.evidence_id desc
  ), verified as (
    select l.case_id
    from latest l
    where l.garment=p_garment
      and l.case_id in (select trim(value) from jsonb_array_elements_text(p_evidence_case_ids))
  )
  select count(*),coalesce(jsonb_agg(case_id order by case_id),'[]'::jsonb)
  into v_verified_count,v_verified_ids
  from verified;

  if v_verified_count<>v_requested_count then raise exception 'every meterage case must resolve to the latest provenance-backed cut for a distinct real production order'; end if;
  if v_verified_count<20 then raise exception 'at least 20 distinct provenance-backed real production cuts are required before model registration'; end if;

  insert into private.production_meterage_models(garment,version,bands,evidence_case_ids,evidence_count,note)
  values(p_garment,left(trim(p_version),80),p_bands,v_verified_ids,v_verified_count,left(coalesce(p_note,''),1200))
  returning model_id into v_model;
  insert into private.production_meterage_model_events(model_id,event_type,payload)
  values(v_model,'created',jsonb_build_object('evidence_count',v_verified_count,'version',left(trim(p_version),80),'evidence_source','production_cut_evidence_registry_v1'));
  return v_model;
end;
$$;

create or replace function public.production_meterage_model_approve_v4(
  p_model_id uuid,
  p_approved_by text,
  p_approval_note text default ''
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_garment text;
  v_status text;
  v_ids jsonb;
  v_stored_count integer;
  v_verified_count integer:=0;
begin
  select garment,status,evidence_case_ids,evidence_count into v_garment,v_status,v_ids,v_stored_count
  from private.production_meterage_models where model_id=p_model_id for update;
  if v_status is null then return false; end if;
  if v_status<>'draft' then raise exception 'only a draft meterage model can be approved'; end if;
  if length(trim(coalesce(p_approved_by,'')))<2 then raise exception 'owner/tailor approver is required'; end if;

  with latest as (
    select distinct on (e.order_id,e.garment) e.*
    from private.production_cut_evidence e
    order by e.order_id,e.garment,e.created_at desc,e.evidence_id desc
  )
  select count(*) into v_verified_count
  from latest l
  where l.garment=v_garment
    and l.case_id in (select trim(value) from jsonb_array_elements_text(v_ids));

  if v_verified_count<>v_stored_count or v_verified_count<20 then raise exception 'meterage model no longer has 20 distinct latest production-cut evidence cases'; end if;
  return public.production_meterage_model_approve(p_model_id,p_approved_by,p_approval_note);
end;
$$;

revoke all on function public.production_cut_evidence_record(text,uuid,text,text,numeric,numeric,numeric,boolean,text,text,text,text) from public,anon,authenticated;
revoke all on function public.production_cut_evidence_list(integer) from public,anon,authenticated;
revoke all on function public.production_meterage_model_create_v4(text,text,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.production_meterage_model_approve_v4(uuid,text,text) from public,anon,authenticated;
grant execute on function public.production_cut_evidence_record(text,uuid,text,text,numeric,numeric,numeric,boolean,text,text,text,text) to service_role;
grant execute on function public.production_cut_evidence_list(integer) to service_role;
grant execute on function public.production_meterage_model_create_v4(text,text,jsonb,jsonb,text) to service_role;
grant execute on function public.production_meterage_model_approve_v4(uuid,text,text) to service_role;
