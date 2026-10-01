-- Versioned Linen Earth house-ease calibration registry.
-- Real finished-garment observations are append-only.
-- A model may be registered only after every current shirt/trouser ease cell has real evidence.
-- Approval is human and versioned. This migration does NOT switch the live provisional fit engine automatically.

create schema if not exists private;

create table if not exists private.house_ease_evidence (
  evidence_id uuid primary key default gen_random_uuid(),
  case_id text not null,
  garment text not null check (garment in ('shirt','trouser')),
  fit_class text not null,
  field text not null,
  body_cm numeric(8,2) not null check (body_cm>0 and body_cm<=300),
  finished_cm numeric(8,2) not null check (finished_cm>0 and finished_cm<=350),
  ease_cm numeric(8,2) not null,
  tailor text not null,
  garment_ref text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (case_id ~ '^[A-Za-z0-9._-]{3,80}$'),
  check (length(trim(tailor)) between 2 and 120),
  check (length(trim(garment_ref)) between 2 and 120),
  check (
    (garment='shirt' and fit_class in ('slim','regular','relaxed') and field in ('chest','waist','bicep','neck','wrist'))
    or
    (garment='trouser' and fit_class in ('flat','pleated','wide','cropped','other') and field in ('waist','seat','thigh','knee'))
  )
);

create index if not exists house_ease_evidence_cell_idx
  on private.house_ease_evidence(garment,fit_class,field,created_at desc);
create index if not exists house_ease_evidence_case_idx
  on private.house_ease_evidence(case_id,created_at desc);

create table if not exists private.house_ease_models (
  model_id uuid primary key default gen_random_uuid(),
  version text not null unique,
  shirt_table jsonb not null check (jsonb_typeof(shirt_table)='object'),
  trouser_table jsonb not null check (jsonb_typeof(trouser_table)='object'),
  evidence_snapshot jsonb not null check (jsonb_typeof(evidence_snapshot)='object'),
  evidence_case_count integer not null default 0 check (evidence_case_count>=0),
  note text not null default '',
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  approved_by text not null default '',
  approval_note text not null default '',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.house_ease_model_events (
  event_id uuid primary key default gen_random_uuid(),
  model_id uuid not null references private.house_ease_models(model_id) on delete cascade,
  event_type text not null check (event_type in ('created','approved','retired')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table private.house_ease_evidence enable row level security;
alter table private.house_ease_models enable row level security;
alter table private.house_ease_model_events enable row level security;
revoke all on private.house_ease_evidence from public,anon,authenticated;
revoke all on private.house_ease_models from public,anon,authenticated;
revoke all on private.house_ease_model_events from public,anon,authenticated;

create or replace function private.house_ease_required_cells()
returns table(cell_key text)
language sql
immutable
set search_path='public','private'
as $$
  select 'shirt:'||fit_class||':'||field
  from unnest(array['slim','regular','relaxed']) fit_class
  cross join unnest(array['chest','waist','bicep','neck','wrist']) field
  union all
  select 'trouser:'||fit_class||':'||field
  from unnest(array['flat','pleated','wide','cropped','other']) fit_class
  cross join unnest(array['waist','seat','thigh','knee']) field;
$$;

create or replace function public.house_ease_evidence_record(
  p_case_id text,
  p_garment text,
  p_fit_class text,
  p_field text,
  p_body_cm numeric,
  p_finished_cm numeric,
  p_tailor text,
  p_garment_ref text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_id uuid;
  v_ease numeric;
begin
  if trim(coalesce(p_case_id,'')) !~ '^[A-Za-z0-9._-]{3,80}$' then raise exception 'invalid anonymous case id'; end if;
  if p_body_cm is null or p_body_cm<=0 or p_body_cm>300 then raise exception 'invalid body measurement'; end if;
  if p_finished_cm is null or p_finished_cm<=0 or p_finished_cm>350 then raise exception 'invalid finished measurement'; end if;
  if length(trim(coalesce(p_tailor,'')))<2 then raise exception 'tailor/inspector is required'; end if;
  if length(trim(coalesce(p_garment_ref,'')))<2 then raise exception 'finished garment reference is required'; end if;

  if not (
    (p_garment='shirt' and p_fit_class in ('slim','regular','relaxed') and p_field in ('chest','waist','bicep','neck','wrist'))
    or
    (p_garment='trouser' and p_fit_class in ('flat','pleated','wide','cropped','other') and p_field in ('waist','seat','thigh','knee'))
  ) then raise exception 'unsupported garment / fit class / field'; end if;

  v_ease=round(p_finished_cm-p_body_cm,2);

  insert into private.house_ease_evidence(
    case_id,garment,fit_class,field,body_cm,finished_cm,ease_cm,tailor,garment_ref,note
  ) values(
    left(trim(p_case_id),80),p_garment,p_fit_class,p_field,round(p_body_cm,2),round(p_finished_cm,2),v_ease,
    left(trim(p_tailor),120),left(trim(p_garment_ref),120),left(trim(coalesce(p_note,'')),1000)
  )
  returning evidence_id into v_id;

  return v_id;
end;
$$;

create or replace function public.house_ease_evidence_list(p_limit integer default 1000)
returns table(
  evidence_id uuid,case_id text,garment text,fit_class text,field text,
  body_cm numeric,finished_cm numeric,ease_cm numeric,tailor text,garment_ref text,note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select e.evidence_id,e.case_id,e.garment,e.fit_class,e.field,
    e.body_cm,e.finished_cm,e.ease_cm,e.tailor,e.garment_ref,e.note,e.created_at
  from private.house_ease_evidence e
  order by e.created_at desc
  limit greatest(1,least(coalesce(p_limit,1000),5000));
$$;

create or replace function public.house_ease_model_create(
  p_version text,
  p_shirt_table jsonb,
  p_trouser_table jsonb,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_model uuid;
  v_required integer;
  v_covered integer;
  v_case_count integer;
  v_snapshot jsonb;
begin
  if trim(coalesce(p_version,'')) !~ '^[A-Za-z0-9._-]{3,80}$' then raise exception 'invalid model version'; end if;
  if jsonb_typeof(p_shirt_table)<>'object' or jsonb_typeof(p_trouser_table)<>'object' then
    raise exception 'ease tables must be objects';
  end if;

  select count(*) into v_required from private.house_ease_required_cells();

  select count(*) into v_covered
  from private.house_ease_required_cells() r
  where exists(
    select 1
    from private.house_ease_evidence e
    where e.garment||':'||e.fit_class||':'||e.field=r.cell_key
  );

  if v_covered<>v_required then
    raise exception 'real finished-garment evidence is required for every house-ease cell (%/% covered)',v_covered,v_required;
  end if;

  select count(distinct case_id) into v_case_count from private.house_ease_evidence;

  select jsonb_object_agg(r.cell_key,coalesce(x.case_ids,'[]'::jsonb))
  into v_snapshot
  from private.house_ease_required_cells() r
  left join lateral (
    select jsonb_agg(distinct e.case_id) case_ids
    from private.house_ease_evidence e
    where e.garment||':'||e.fit_class||':'||e.field=r.cell_key
  ) x on true;

  insert into private.house_ease_models(
    version,shirt_table,trouser_table,evidence_snapshot,evidence_case_count,note
  ) values(
    left(trim(p_version),80),p_shirt_table,p_trouser_table,v_snapshot,v_case_count,left(trim(coalesce(p_note,'')),1200)
  )
  returning model_id into v_model;

  insert into private.house_ease_model_events(model_id,event_type,payload)
  values(v_model,'created',jsonb_build_object(
    'evidence_case_count',v_case_count,
    'covered_cells',v_covered,
    'required_cells',v_required
  ));

  return v_model;
end;
$$;

create or replace function public.house_ease_model_approve(
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
begin
  select status into v_status from private.house_ease_models where model_id=p_model_id for update;
  if v_status is null then return false; end if;
  if v_status<>'draft' then raise exception 'only a draft ease model can be approved'; end if;
  if length(trim(coalesce(p_approved_by,'')))<2 then raise exception 'owner/tailor approver is required'; end if;

  insert into private.house_ease_model_events(model_id,event_type,payload)
  select model_id,'retired',jsonb_build_object('reason','superseded','by_model_id',p_model_id)
  from private.house_ease_models
  where status='approved';

  update private.house_ease_models set status='retired',updated_at=now() where status='approved';

  update private.house_ease_models
  set status='approved',
      approved_by=left(trim(p_approved_by),120),
      approval_note=left(trim(coalesce(p_approval_note,'')),1200),
      approved_at=now(),
      updated_at=now()
  where model_id=p_model_id;

  insert into private.house_ease_model_events(model_id,event_type,payload)
  values(p_model_id,'approved',jsonb_build_object('approved_by',left(trim(p_approved_by),120)));

  return true;
end;
$$;

create or replace function public.house_ease_model_retire(p_model_id uuid)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_status text;
begin
  select status into v_status from private.house_ease_models where model_id=p_model_id for update;
  if v_status is null then return false; end if;
  if v_status='retired' then return true; end if;
  update private.house_ease_models set status='retired',updated_at=now() where model_id=p_model_id;
  insert into private.house_ease_model_events(model_id,event_type,payload)
  values(p_model_id,'retired',jsonb_build_object('reason','manual'));
  return true;
end;
$$;

create or replace function public.house_ease_model_list(p_limit integer default 100)
returns table(
  model_id uuid,version text,shirt_table jsonb,trouser_table jsonb,evidence_snapshot jsonb,
  evidence_case_count integer,note text,status text,approved_by text,approval_note text,
  approved_at timestamptz,created_at timestamptz,updated_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select m.model_id,m.version,m.shirt_table,m.trouser_table,m.evidence_snapshot,
    m.evidence_case_count,m.note,m.status,m.approved_by,m.approval_note,
    m.approved_at,m.created_at,m.updated_at
  from private.house_ease_models m
  order by m.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),500));
$$;

revoke all on function public.house_ease_evidence_record(text,text,text,text,numeric,numeric,text,text,text) from public,anon,authenticated;
revoke all on function public.house_ease_evidence_list(integer) from public,anon,authenticated;
revoke all on function public.house_ease_model_create(text,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.house_ease_model_approve(uuid,text,text) from public,anon,authenticated;
revoke all on function public.house_ease_model_retire(uuid) from public,anon,authenticated;
revoke all on function public.house_ease_model_list(integer) from public,anon,authenticated;

grant execute on function public.house_ease_evidence_record(text,text,text,text,numeric,numeric,text,text,text) to service_role;
grant execute on function public.house_ease_evidence_list(integer) to service_role;
grant execute on function public.house_ease_model_create(text,jsonb,jsonb,text) to service_role;
grant execute on function public.house_ease_model_approve(uuid,text,text) to service_role;
grant execute on function public.house_ease_model_retire(uuid) to service_role;
grant execute on function public.house_ease_model_list(integer) to service_role;
