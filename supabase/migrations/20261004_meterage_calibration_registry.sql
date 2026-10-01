-- Versioned meterage calibration tables.
-- Models are operator-authored from real cut evidence and require explicit owner/tailor approval.
-- No generic or guessed defaults are seeded.

create schema if not exists private;

create table if not exists private.production_meterage_models (
  model_id uuid primary key default gen_random_uuid(),
  garment text not null check (garment in ('shirt','trouser')),
  version text not null unique,
  bands jsonb not null check (jsonb_typeof(bands)='array' and jsonb_array_length(bands) between 1 and 12),
  evidence_case_ids jsonb not null check (jsonb_typeof(evidence_case_ids)='array'),
  evidence_count integer not null check (evidence_count>=0),
  note text not null default '',
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  approved_by text not null default '',
  approval_note text not null default '',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.production_meterage_model_events (
  event_id uuid primary key default gen_random_uuid(),
  model_id uuid not null references private.production_meterage_models(model_id) on delete cascade,
  event_type text not null check (event_type in ('created','approved','retired')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists production_meterage_models_garment_idx
  on private.production_meterage_models(garment,created_at desc);
create index if not exists production_meterage_model_events_model_idx
  on private.production_meterage_model_events(model_id,created_at);

alter table private.production_meterage_models enable row level security;
alter table private.production_meterage_model_events enable row level security;
revoke all on private.production_meterage_models from public,anon,authenticated;
revoke all on private.production_meterage_model_events from public,anon,authenticated;

create or replace function public.production_meterage_model_create(
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
  v_evidence_count integer;
begin
  if p_garment not in ('shirt','trouser') then raise exception 'unsupported garment'; end if;
  if coalesce(length(trim(p_version)),0)<3 or length(trim(p_version))>80 then raise exception 'invalid model version'; end if;
  if jsonb_typeof(p_bands)<>'array' or jsonb_array_length(p_bands)<1 or jsonb_array_length(p_bands)>12 then
    raise exception 'meterage bands must contain 1..12 rows';
  end if;
  if jsonb_typeof(p_evidence_case_ids)<>'array' then raise exception 'evidence case ids must be an array'; end if;

  select count(distinct value)::integer into v_evidence_count
  from jsonb_array_elements_text(p_evidence_case_ids);

  insert into private.production_meterage_models(
    garment,version,bands,evidence_case_ids,evidence_count,note
  ) values(
    p_garment,left(trim(p_version),80),p_bands,p_evidence_case_ids,v_evidence_count,left(coalesce(p_note,''),1200)
  ) returning model_id into v_model;

  insert into private.production_meterage_model_events(model_id,event_type,payload)
  values(v_model,'created',jsonb_build_object('evidence_count',v_evidence_count,'version',left(trim(p_version),80)));

  return v_model;
end;
$$;

create or replace function public.production_meterage_model_approve(
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
  v_status text;
  v_garment text;
  v_evidence_count integer;
begin
  select status,garment,evidence_count into v_status,v_garment,v_evidence_count
  from private.production_meterage_models where model_id=p_model_id for update;

  if v_status is null then return false; end if;
  if v_status<>'draft' then raise exception 'only a draft meterage model can be approved'; end if;
  if v_evidence_count<20 then raise exception 'at least 20 real cut cases are required before approval'; end if;
  if length(trim(coalesce(p_approved_by,'')))<2 then raise exception 'owner/tailor approver is required'; end if;

  insert into private.production_meterage_model_events(model_id,event_type,payload)
  select model_id,'retired',jsonb_build_object('reason','superseded','by_model_id',p_model_id)
  from private.production_meterage_models
  where garment=v_garment and status='approved';

  update private.production_meterage_models
    set status='retired',updated_at=now()
    where garment=v_garment and status='approved';

  update private.production_meterage_models
    set status='approved',
        approved_by=left(trim(p_approved_by),120),
        approval_note=left(coalesce(p_approval_note,''),1200),
        approved_at=now(),
        updated_at=now()
    where model_id=p_model_id;

  insert into private.production_meterage_model_events(model_id,event_type,payload)
  values(p_model_id,'approved',jsonb_build_object('approved_by',left(trim(p_approved_by),120),'evidence_count',v_evidence_count));

  return true;
end;
$$;

create or replace function public.production_meterage_model_retire(p_model_id uuid)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_status text;
begin
  select status into v_status from private.production_meterage_models where model_id=p_model_id for update;
  if v_status is null then return false; end if;
  if v_status='retired' then return true; end if;
  update private.production_meterage_models set status='retired',updated_at=now() where model_id=p_model_id;
  insert into private.production_meterage_model_events(model_id,event_type,payload)
  values(p_model_id,'retired',jsonb_build_object('reason','manual'));
  return true;
end;
$$;

create or replace function public.production_meterage_model_list(p_limit integer default 100)
returns table(
  model_id uuid,garment text,version text,bands jsonb,evidence_case_ids jsonb,evidence_count integer,
  note text,status text,approved_by text,approval_note text,approved_at timestamptz,
  created_at timestamptz,updated_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select m.model_id,m.garment,m.version,m.bands,m.evidence_case_ids,m.evidence_count,
    m.note,m.status,m.approved_by,m.approval_note,m.approved_at,m.created_at,m.updated_at
  from private.production_meterage_models m
  order by m.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),500));
$$;

revoke all on function public.production_meterage_model_create(text,text,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.production_meterage_model_approve(uuid,text,text) from public,anon,authenticated;
revoke all on function public.production_meterage_model_retire(uuid) from public,anon,authenticated;
revoke all on function public.production_meterage_model_list(integer) from public,anon,authenticated;

grant execute on function public.production_meterage_model_create(text,text,jsonb,jsonb,text) to service_role;
grant execute on function public.production_meterage_model_approve(uuid,text,text) to service_role;
grant execute on function public.production_meterage_model_retire(uuid) to service_role;
grant execute on function public.production_meterage_model_list(integer) to service_role;
