-- Linen Earth private Fabric Analyzer backend
-- Backend-only corpus, profile cache, review loop, calibration and service-role RPCs.
-- No customer-facing access is granted.

create schema if not exists private;

create table if not exists private.fabric_knowledge_sources (
  id text primary key,
  title text not null,
  publisher text not null,
  url text not null,
  source_kind text not null check (source_kind in ('fiber_authority','textile_education','cloth_mill','manufacturer','internal_taxonomy')),
  notes text not null default '',
  checked_at timestamptz not null default now()
);

create table if not exists private.fabric_material_knowledge (
  slug text primary key,
  name text not null,
  layer text not null check (layer in ('fiber','blend','construction','finish','performance')),
  family text not null,
  aliases text[] not null default '{}',
  visual_cues jsonb not null default '{}'::jsonb,
  menswear_uses text[] not null default '{}',
  climate_tags text[] not null default '{}',
  formality_min smallint not null check (formality_min between 1 and 5),
  formality_max smallint not null check (formality_max between 1 and 5),
  style_notes text not null default '',
  verified_properties jsonb not null default '{}'::jsonb,
  visual_only_cautions text[] not null default '{}',
  source_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  check (formality_min <= formality_max)
);

create table if not exists private.fabric_pattern_knowledge (
  slug text primary key,
  name text not null,
  family text not null,
  aliases text[] not null default '{}',
  geometry text not null default '',
  typical_scales text[] not null default '{}',
  typical_contrast text[] not null default '{}',
  menswear_uses text[] not null default '{}',
  formality_min smallint not null check (formality_min between 1 and 5),
  formality_max smallint not null check (formality_max between 1 and 5),
  visual_cues jsonb not null default '{}'::jsonb,
  styling_notes text not null default '',
  source_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  check (formality_min <= formality_max)
);

create table if not exists private.fabric_color_knowledge (
  slug text primary key,
  name text not null,
  hue_family text not null,
  aliases text[] not null default '{}',
  depth text not null check (depth in ('very-light','light','mid','deep','very-deep')),
  temperature text not null check (temperature in ('warm','cool','neutral','variable')),
  saturation text not null check (saturation in ('muted','soft','medium','rich','vivid')),
  menswear_roles text[] not null default '{}',
  pairing_families text[] not null default '{}',
  styling_notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists private.fabric_analyzer_versions (
  version text primary key,
  knowledge_scope text not null,
  material_count integer not null default 0,
  pattern_count integer not null default 0,
  color_count integer not null default 0,
  source_count integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists private.fabric_reference_examples (
  id text primary key,
  source_id text not null references private.fabric_knowledge_sources(id),
  manufacturer text not null,
  product_name text not null,
  source_url text not null,
  composition text not null default '',
  color_name text not null default '',
  pattern_name text not null default '',
  construction_name text not null default '',
  weight_gsm numeric,
  usage_tags text[] not null default '{}',
  verified_facts jsonb not null default '{}'::jsonb,
  observed_notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists private.fabric_color_reference_terms (
  id text primary key,
  source_id text not null references private.fabric_knowledge_sources(id),
  system_name text not null,
  color_name text not null,
  hex_value text,
  notation text,
  source_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists private.fabric_pattern_reference_terms (
  id text primary key,
  source_id text not null references private.fabric_knowledge_sources(id),
  term text not null,
  family text not null,
  source_url text not null,
  evidence_note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists private.fabric_material_reference_terms (
  id text primary key,
  source_id text not null references private.fabric_knowledge_sources(id),
  term text not null,
  term_type text not null check (term_type in ('fiber','blend','weave','construction','finish','yarn','fabric_type','quality','performance','garment_use')),
  source_url text not null,
  evidence_note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists private.fabric_style_relationships (
  id text primary key,
  subject_type text not null,
  subject_id text not null,
  predicate text not null,
  object_type text not null,
  object_id text not null,
  confidence numeric not null check (confidence between 0 and 1),
  provenance text not null check (provenance in ('source_backed','reference_derived','engine_inference')),
  source_ids text[] not null default '{}',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists private.fabric_analysis_profiles (
  id uuid primary key default gen_random_uuid(),
  image_fingerprint text not null,
  image_source text not null default '',
  declared_context jsonb not null default '{}'::jsonb,
  analyzer_version text not null,
  model_id text not null,
  profile jsonb not null,
  confidence jsonb not null default '{}'::jsonb,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','approved','corrected','rejected')),
  review_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(image_fingerprint,analyzer_version)
);

create table if not exists private.fabric_analysis_feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references private.fabric_analysis_profiles(id) on delete cascade,
  field_path text not null,
  previous_value jsonb,
  corrected_value jsonb,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists private.fabric_analysis_bindings (
  fabric_id text not null,
  profile_id uuid not null references private.fabric_analysis_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(fabric_id,profile_id)
);

create table if not exists private.fabric_analyzer_calibration_cases (
  id text primary key,
  source_id text not null references private.fabric_knowledge_sources(id),
  source_url text not null,
  expected jsonb not null default '{}'::jsonb,
  notes text not null default '',
  enabled boolean not null default true,
  last_profile_id uuid references private.fabric_analysis_profiles(id) on delete set null,
  last_score numeric,
  last_result jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists private.fabric_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  fabric_id text,
  image_url text,
  source_page_url text,
  source_id text,
  declared_context jsonb not null default '{}'::jsonb,
  force boolean not null default false,
  status text not null default 'queued' check (status in ('queued','running','complete','error')),
  attempts integer not null default 0,
  profile_id uuid references private.fabric_analysis_profiles(id) on delete set null,
  error_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fabric_style_relationships_subject_idx on private.fabric_style_relationships(subject_type,subject_id,predicate);
create index if not exists fabric_style_relationships_object_idx on private.fabric_style_relationships(object_type,object_id);
create index if not exists fabric_analysis_bindings_fabric_idx on private.fabric_analysis_bindings(fabric_id,updated_at desc);
create index if not exists fabric_analysis_feedback_profile_idx on private.fabric_analysis_feedback(profile_id,created_at desc);
create index if not exists fabric_analysis_profiles_review_idx on private.fabric_analysis_profiles(review_status,updated_at desc);
create index if not exists fabric_analysis_jobs_batch_idx on private.fabric_analysis_jobs(batch_id,status,created_at);
create index if not exists fabric_analysis_jobs_status_idx on private.fabric_analysis_jobs(status,created_at);

alter table private.fabric_knowledge_sources enable row level security;
alter table private.fabric_material_knowledge enable row level security;
alter table private.fabric_pattern_knowledge enable row level security;
alter table private.fabric_color_knowledge enable row level security;
alter table private.fabric_analyzer_versions enable row level security;
alter table private.fabric_reference_examples enable row level security;
alter table private.fabric_color_reference_terms enable row level security;
alter table private.fabric_pattern_reference_terms enable row level security;
alter table private.fabric_material_reference_terms enable row level security;
alter table private.fabric_style_relationships enable row level security;
alter table private.fabric_analysis_profiles enable row level security;
alter table private.fabric_analysis_feedback enable row level security;
alter table private.fabric_analysis_bindings enable row level security;
alter table private.fabric_analyzer_calibration_cases enable row level security;
alter table private.fabric_analysis_jobs enable row level security;

revoke all on schema private from public,anon,authenticated;
revoke all on all tables in schema private from public,anon,authenticated;

create or replace function public.fabric_analyzer_profile_get(
  p_image_fingerprint text,
  p_analyzer_version text default 'fabric-analyzer-v4'
)
returns table(
  id uuid,image_fingerprint text,image_source text,declared_context jsonb,analyzer_version text,model_id text,
  profile jsonb,confidence jsonb,review_status text,review_notes text,created_at timestamptz,updated_at timestamptz
)
language sql security definer set search_path='public','private' as $$
  select p.id,p.image_fingerprint,p.image_source,p.declared_context,p.analyzer_version,p.model_id,
         p.profile,p.confidence,p.review_status,p.review_notes,p.created_at,p.updated_at
  from private.fabric_analysis_profiles p
  where p.image_fingerprint=p_image_fingerprint and p.analyzer_version=p_analyzer_version
  limit 1;
$$;

create or replace function public.fabric_analyzer_profile_upsert(
  p_image_fingerprint text,p_image_source text,p_declared_context jsonb,p_analyzer_version text,
  p_model_id text,p_profile jsonb,p_confidence jsonb
)
returns uuid language plpgsql security definer set search_path='public','private' as $$
declare v_id uuid;
begin
  insert into private.fabric_analysis_profiles(
    image_fingerprint,image_source,declared_context,analyzer_version,model_id,profile,confidence,review_status,updated_at
  ) values(
    left(p_image_fingerprint,128),left(coalesce(p_image_source,''),1800),coalesce(p_declared_context,'{}'::jsonb),
    left(p_analyzer_version,80),left(p_model_id,120),coalesce(p_profile,'{}'::jsonb),coalesce(p_confidence,'{}'::jsonb),
    'unreviewed',now()
  )
  on conflict(image_fingerprint,analyzer_version) do update set
    image_source=excluded.image_source,declared_context=excluded.declared_context,model_id=excluded.model_id,
    profile=excluded.profile,confidence=excluded.confidence,updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.fabric_analyzer_profile_bind(p_fabric_id text,p_profile_id uuid)
returns boolean language plpgsql security definer set search_path='public','private' as $$
begin
  if not exists(select 1 from private.fabric_analysis_profiles where id=p_profile_id) then
    raise exception 'Unknown fabric analysis profile';
  end if;
  if coalesce(length(trim(p_fabric_id)),0)=0 then return false; end if;
  insert into private.fabric_analysis_bindings(fabric_id,profile_id,updated_at)
  values(left(trim(p_fabric_id),160),p_profile_id,now())
  on conflict(fabric_id,profile_id) do update set updated_at=now();
  return true;
end;
$$;

create or replace function public.fabric_analyzer_profile_review(p_profile_id uuid,p_status text,p_notes text default '')
returns boolean language plpgsql security definer set search_path='public','private' as $$
begin
  if p_status not in ('unreviewed','approved','corrected','rejected') then raise exception 'Unsupported review status'; end if;
  update private.fabric_analysis_profiles
  set review_status=p_status,review_notes=left(coalesce(p_notes,''),1200),updated_at=now()
  where id=p_profile_id;
  return found;
end;
$$;

create or replace function public.fabric_analyzer_profiles_for_fabrics(p_fabric_ids text[],p_include_unreviewed boolean default true)
returns table(
  fabric_id text,id uuid,image_fingerprint text,image_source text,declared_context jsonb,analyzer_version text,model_id text,
  profile jsonb,confidence jsonb,review_status text,review_notes text,created_at timestamptz,updated_at timestamptz
)
language sql security definer set search_path='public','private' as $$
  with ranked as (
    select b.fabric_id,p.id,p.image_fingerprint,p.image_source,p.declared_context,p.analyzer_version,p.model_id,
           p.profile,p.confidence,p.review_status,p.review_notes,p.created_at,p.updated_at,
           row_number() over(partition by b.fabric_id order by
             case p.review_status when 'approved' then 4 when 'corrected' then 3 when 'unreviewed' then 2 else 1 end desc,
             p.updated_at desc) as rn
    from private.fabric_analysis_bindings b
    join private.fabric_analysis_profiles p on p.id=b.profile_id
    where b.fabric_id=any(p_fabric_ids) and p.review_status<>'rejected'
      and (p_include_unreviewed or p.review_status in ('approved','corrected'))
  )
  select fabric_id,id,image_fingerprint,image_source,declared_context,analyzer_version,model_id,
         profile,confidence,review_status,review_notes,created_at,updated_at
  from ranked where rn=1;
$$;

create or replace function public.fabric_analyzer_profiles_for_review(p_limit integer default 50)
returns table(
  fabric_id text,id uuid,image_source text,declared_context jsonb,analyzer_version text,model_id text,
  profile jsonb,confidence jsonb,review_status text,review_notes text,created_at timestamptz,updated_at timestamptz
)
language sql security definer set search_path='public','private' as $$
  select b.fabric_id,p.id,p.image_source,p.declared_context,p.analyzer_version,p.model_id,
         p.profile,p.confidence,p.review_status,p.review_notes,p.created_at,p.updated_at
  from private.fabric_analysis_profiles p
  left join lateral(
    select fabric_id from private.fabric_analysis_bindings b where b.profile_id=p.id order by b.updated_at desc limit 1
  ) b on true
  where p.review_status='unreviewed'
  order by p.updated_at desc
  limit greatest(1,least(coalesce(p_limit,50),200));
$$;

create or replace function public.fabric_analyzer_feedback_insert(
  p_profile_id uuid,p_field_path text,p_previous_value jsonb,p_corrected_value jsonb,p_reason text default ''
)
returns uuid language plpgsql security definer set search_path='public','private' as $$
declare v_id uuid;
begin
  if not exists(select 1 from private.fabric_analysis_profiles where id=p_profile_id) then raise exception 'Unknown fabric analysis profile'; end if;
  insert into private.fabric_analysis_feedback(profile_id,field_path,previous_value,corrected_value,reason)
  values(p_profile_id,left(p_field_path,180),p_previous_value,p_corrected_value,left(coalesce(p_reason,''),600))
  returning id into v_id;
  update private.fabric_analysis_profiles set review_status='corrected',updated_at=now() where id=p_profile_id;
  return v_id;
end;
$$;

create or replace function public.fabric_analyzer_feedback_apply(
  p_profile_id uuid,p_field_path text,p_previous_value jsonb,p_corrected_value jsonb,p_reason text default ''
)
returns uuid language plpgsql security definer set search_path='public','private' as $$
declare v_id uuid; v_path text[]; v_previous jsonb;
begin
  if not exists(select 1 from private.fabric_analysis_profiles where id=p_profile_id) then raise exception 'Unknown fabric analysis profile'; end if;
  if p_field_path !~ '^(observed|inferredStyle|confidence|references)(\.[A-Za-z][A-Za-z0-9_]*){1,3}$' then
    raise exception 'Unsupported correction path';
  end if;
  v_path=string_to_array(p_field_path,'.');
  select profile #> v_path into v_previous from private.fabric_analysis_profiles where id=p_profile_id;
  update private.fabric_analysis_profiles
  set profile=jsonb_set(profile,v_path,coalesce(p_corrected_value,'null'::jsonb),true),review_status='corrected',updated_at=now()
  where id=p_profile_id;
  insert into private.fabric_analysis_feedback(profile_id,field_path,previous_value,corrected_value,reason)
  values(p_profile_id,left(p_field_path,180),coalesce(v_previous,p_previous_value),p_corrected_value,left(coalesce(p_reason,''),600))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.fabric_analyzer_learning_summary(p_min_samples integer default 3)
returns table(field_path text,corrected_value jsonb,samples bigint)
language sql security definer set search_path='public','private' as $$
  select f.field_path,f.corrected_value,count(*) as samples
  from private.fabric_analysis_feedback f
  group by f.field_path,f.corrected_value
  having count(*)>=greatest(2,least(coalesce(p_min_samples,3),20))
  order by count(*) desc,f.field_path
  limit 120;
$$;

create or replace function public.fabric_analyzer_stats()
returns table(
  profiles bigint,pending_review bigint,approved bigint,corrected bigint,rejected bigint,bindings bigint,feedback bigint,
  source_groups bigint,material_terms bigint,pattern_terms bigint,color_terms bigint,real_examples bigint,relationships bigint,
  source_backed_relationships bigint,calibration_cases bigint
)
language sql security definer set search_path='public','private' as $$
  select
    (select count(*) from private.fabric_analysis_profiles),
    (select count(*) from private.fabric_analysis_profiles where review_status='unreviewed'),
    (select count(*) from private.fabric_analysis_profiles where review_status='approved'),
    (select count(*) from private.fabric_analysis_profiles where review_status='corrected'),
    (select count(*) from private.fabric_analysis_profiles where review_status='rejected'),
    (select count(*) from private.fabric_analysis_bindings),
    (select count(*) from private.fabric_analysis_feedback),
    (select count(*) from private.fabric_knowledge_sources),
    (select count(distinct lower(term)) from private.fabric_material_reference_terms),
    (select count(distinct lower(term)) from private.fabric_pattern_reference_terms),
    (select count(distinct lower(system_name || ':' || color_name)) from private.fabric_color_reference_terms),
    (select count(*) from private.fabric_reference_examples),
    (select count(*) from private.fabric_style_relationships),
    (select count(*) from private.fabric_style_relationships where provenance='source_backed'),
    (select count(*) from private.fabric_analyzer_calibration_cases where enabled);
$$;

create or replace function public.fabric_analyzer_calibration_cases_get(p_limit integer default 12)
returns table(
  id text,source_id text,source_url text,expected jsonb,notes text,last_profile_id uuid,last_score numeric,
  last_result jsonb,last_run_at timestamptz
)
language sql security definer set search_path='public','private' as $$
  select c.id,c.source_id,c.source_url,c.expected,c.notes,c.last_profile_id,c.last_score,c.last_result,c.last_run_at
  from private.fabric_analyzer_calibration_cases c
  where c.enabled
  order by coalesce(c.last_run_at,'epoch'::timestamptz) asc,c.id
  limit greatest(1,least(coalesce(p_limit,12),30));
$$;

create or replace function public.fabric_analyzer_calibration_record(
  p_case_id text,p_profile_id uuid,p_score numeric,p_result jsonb
)
returns boolean language plpgsql security definer set search_path='public','private' as $$
begin
  update private.fabric_analyzer_calibration_cases
  set last_profile_id=p_profile_id,last_score=greatest(0,least(100,coalesce(p_score,0))),
      last_result=coalesce(p_result,'{}'::jsonb),last_run_at=now()
  where id=p_case_id and enabled;
  return found;
end;
$$;

create or replace function public.fabric_analyzer_reference_snapshot()
returns jsonb language sql security definer set search_path='public','private' as $$
  select jsonb_build_object(
    'materials',(select coalesce(jsonb_agg(term order by lower(term)),'[]'::jsonb)
      from (select distinct on(lower(term)) term from private.fabric_material_reference_terms order by lower(term),term) x),
    'patterns',(select coalesce(jsonb_agg(term order by lower(term)),'[]'::jsonb)
      from (select distinct on(lower(term)) term from private.fabric_pattern_reference_terms order by lower(term),term) x),
    'colors',(select coalesce(jsonb_agg(color_name order by system_name,lower(color_name)),'[]'::jsonb)
      from (select distinct on(lower(system_name),lower(color_name)) system_name,color_name
            from private.fabric_color_reference_terms order by lower(system_name),lower(color_name),color_name) x),
    'sources',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'publisher',publisher,'url',url) order by title),'[]'::jsonb)
      from private.fabric_knowledge_sources where source_kind<>'internal_taxonomy'),
    'examples',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'source_id',source_id,'manufacturer',manufacturer,'product_name',product_name,'source_url',source_url,
      'composition',composition,'color_name',color_name,'pattern_name',pattern_name,'construction_name',construction_name,
      'weight_gsm',weight_gsm,'usage_tags',usage_tags,'verified_facts',verified_facts
    ) order by manufacturer,product_name),'[]'::jsonb) from private.fabric_reference_examples),
    'provenance',jsonb_build_object(
      'materials',(select coalesce(jsonb_agg(jsonb_build_object('term',term,'source_id',source_id,'type',term_type) order by lower(term),source_id),'[]'::jsonb) from private.fabric_material_reference_terms),
      'patterns',(select coalesce(jsonb_agg(jsonb_build_object('term',term,'source_id',source_id,'family',family) order by lower(term),source_id),'[]'::jsonb) from private.fabric_pattern_reference_terms),
      'colors',(select coalesce(jsonb_agg(jsonb_build_object('term',color_name,'source_id',source_id,'system',system_name) order by lower(color_name),source_id),'[]'::jsonb) from private.fabric_color_reference_terms)
    )
  );
$$;

create or replace function public.fabric_analyzer_batch_enqueue(p_items jsonb)
returns table(batch_id uuid,queued integer)
language plpgsql security definer set search_path='public','private' as $$
declare v_batch uuid:=gen_random_uuid(); v_count integer:=0; item jsonb;
begin
  if jsonb_typeof(p_items)<>'array' then raise exception 'items must be an array'; end if;
  if jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>500 then raise exception 'batch size must be 1..500'; end if;
  for item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(length(trim(item->>'imageUrl')),0)=0 and coalesce(length(trim(item->>'sourcePageUrl')),0)=0 then continue; end if;
    insert into private.fabric_analysis_jobs(batch_id,fabric_id,image_url,source_page_url,source_id,declared_context,force)
    values(
      v_batch,
      nullif(left(trim(coalesce(item->>'fabricId','')),160),''),
      nullif(left(trim(coalesce(item->>'imageUrl','')),1800),''),
      nullif(left(trim(coalesce(item->>'sourcePageUrl','')),1800),''),
      nullif(left(trim(coalesce(item->>'sourceId','')),80),''),
      jsonb_build_object(
        'declaredMaterial',left(trim(coalesce(item->>'declaredMaterial','')),120),
        'declaredFabricType',left(trim(coalesce(item->>'declaredFabricType','')),120),
        'supplierColorName',left(trim(coalesce(item->>'supplierColorName','')),120),
        'supplierPatternName',left(trim(coalesce(item->>'supplierPatternName','')),120),
        'notes',left(trim(coalesce(item->>'notes','')),500),
        'macroImageUrl',left(trim(coalesce(item->>'macroImageUrl','')),1800),
        'foldImageUrl',left(trim(coalesce(item->>'foldImageUrl','')),1800),
        'swatchRealWidthMm',case when jsonb_typeof(item->'swatchRealWidthMm')='number' then item->'swatchRealWidthMm' else 'null'::jsonb end,
        'repeatRealMm',case when jsonb_typeof(item->'repeatRealMm')='number' then item->'repeatRealMm' else 'null'::jsonb end,
        'verifiedGsm',case when jsonb_typeof(item->'verifiedGsm')='number' then item->'verifiedGsm' else 'null'::jsonb end,
        'verifiedDrape',case when item->>'verifiedDrape' in ('Fluid','Balanced','Structured') then item->>'verifiedDrape' else '' end,
        'verifiedFiberContent',left(trim(coalesce(item->>'verifiedFiberContent','')),220),
        'verifiedPhysicalSourceUrl',left(trim(coalesce(item->>'verifiedPhysicalSourceUrl','')),1800)
      ),
      coalesce((item->>'force')::boolean,false)
    );
    v_count:=v_count+1;
  end loop;
  return query select v_batch,v_count;
end;
$$;

create or replace function public.fabric_analyzer_jobs_claim(p_limit integer default 4)
returns table(id uuid,batch_id uuid,fabric_id text,image_url text,source_page_url text,source_id text,declared_context jsonb,force boolean,attempts integer)
language plpgsql security definer set search_path='public','private' as $$
begin
  return query
  with picked as (
    select j.id from private.fabric_analysis_jobs j
    where j.status='queued' or (j.status='running' and j.updated_at<now()-interval '10 minutes' and j.attempts<3)
    order by j.created_at for update skip locked
    limit greatest(1,least(coalesce(p_limit,4),8))
  ), updated as (
    update private.fabric_analysis_jobs j
    set status='running',attempts=j.attempts+1,updated_at=now(),error_message=''
    from picked where j.id=picked.id returning j.*
  )
  select u.id,u.batch_id,u.fabric_id,u.image_url,u.source_page_url,u.source_id,u.declared_context,u.force,u.attempts from updated u;
end;
$$;

create or replace function public.fabric_analyzer_job_finish(p_job_id uuid,p_status text,p_profile_id uuid default null,p_error text default '')
returns boolean language plpgsql security definer set search_path='public','private' as $$
begin
  if p_status not in ('complete','error') then raise exception 'unsupported status'; end if;
  update private.fabric_analysis_jobs
  set status=p_status,profile_id=p_profile_id,error_message=left(coalesce(p_error,''),1000),updated_at=now()
  where id=p_job_id;
  return found;
end;
$$;

create or replace function public.fabric_analyzer_batch_status(p_batch_id uuid)
returns table(status text,count bigint)
language sql security definer set search_path='public','private' as $$
  select j.status,count(*) from private.fabric_analysis_jobs j where j.batch_id=p_batch_id group by j.status order by j.status;
$$;

do $$
declare fn regprocedure;
begin
  foreach fn in array array[
    'public.fabric_analyzer_profile_get(text,text)'::regprocedure,
    'public.fabric_analyzer_profile_upsert(text,text,jsonb,text,text,jsonb,jsonb)'::regprocedure,
    'public.fabric_analyzer_profile_bind(text,uuid)'::regprocedure,
    'public.fabric_analyzer_profile_review(uuid,text,text)'::regprocedure,
    'public.fabric_analyzer_profiles_for_fabrics(text[],boolean)'::regprocedure,
    'public.fabric_analyzer_profiles_for_review(integer)'::regprocedure,
    'public.fabric_analyzer_feedback_insert(uuid,text,jsonb,jsonb,text)'::regprocedure,
    'public.fabric_analyzer_feedback_apply(uuid,text,jsonb,jsonb,text)'::regprocedure,
    'public.fabric_analyzer_learning_summary(integer)'::regprocedure,
    'public.fabric_analyzer_stats()'::regprocedure,
    'public.fabric_analyzer_calibration_cases_get(integer)'::regprocedure,
    'public.fabric_analyzer_calibration_record(text,uuid,numeric,jsonb)'::regprocedure,
    'public.fabric_analyzer_reference_snapshot()'::regprocedure,
    'public.fabric_analyzer_batch_enqueue(jsonb)'::regprocedure,
    'public.fabric_analyzer_jobs_claim(integer)'::regprocedure,
    'public.fabric_analyzer_job_finish(uuid,text,uuid,text)'::regprocedure,
    'public.fabric_analyzer_batch_status(uuid)'::regprocedure
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated',fn);
    execute format('grant execute on function %s to service_role',fn);
  end loop;
end $$;
