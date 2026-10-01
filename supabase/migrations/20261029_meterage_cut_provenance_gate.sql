-- Require named physical provenance for every real cut used by the meterage registry.
-- Only production-usage-v2 events with a checker and a physical cutting reference are eligible.

create or replace function public.production_meterage_model_create_v3(
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
  if jsonb_typeof(p_bands)<>'array' or jsonb_array_length(p_bands)<1 or jsonb_array_length(p_bands)>12 then
    raise exception 'meterage bands must contain 1..12 rows';
  end if;
  if jsonb_typeof(p_evidence_case_ids)<>'array' then raise exception 'evidence case ids must be an array'; end if;

  select count(*) into v_requested_count
  from (
    select distinct trim(value) as case_id
    from jsonb_array_elements_text(p_evidence_case_ids)
    where length(trim(value)) between 1 and 80
  ) requested;

  select count(*),coalesce(jsonb_agg(case_id order by case_id),'[]'::jsonb)
  into v_verified_count,v_verified_ids
  from (
    select r.case_id
    from (
      select distinct trim(value) as case_id
      from jsonb_array_elements_text(p_evidence_case_ids)
      where length(trim(value)) between 1 and 80
    ) r
    where exists (
      select 1
      from public.style_events e
      where e.type='operator_note'
        and e.source='operator'
        and e.payload->>'subtype'='production_usage_case'
        and e.payload->>'version'='production-usage-v2'
        and e.payload->>'caseId'=r.case_id
        and e.payload->>'garment'=p_garment
        and length(trim(coalesce(e.payload->>'checkedBy','')))>=2
        and length(trim(coalesce(e.payload->>'evidenceReference','')))>=3
    )
    and not exists (
      select 1
      from public.style_events conflict
      where conflict.type='operator_note'
        and conflict.source='operator'
        and conflict.payload->>'subtype'='production_usage_case'
        and conflict.payload->>'caseId'=r.case_id
        and conflict.payload->>'garment'<>p_garment
    )
  ) verified;

  if v_requested_count<>jsonb_array_length(p_evidence_case_ids) then
    raise exception 'meterage evidence case IDs must be non-empty and unique';
  end if;
  if v_verified_count<>v_requested_count then
    raise exception 'every meterage case must resolve to a provenance-backed real cut for the selected garment';
  end if;
  if v_verified_count<20 then raise exception 'at least 20 provenance-backed real cuts are required before model registration'; end if;

  insert into private.production_meterage_models(
    garment,version,bands,evidence_case_ids,evidence_count,note
  ) values(
    p_garment,left(trim(p_version),80),p_bands,v_verified_ids,v_verified_count,left(coalesce(p_note,''),1200)
  ) returning model_id into v_model;

  insert into private.production_meterage_model_events(model_id,event_type,payload)
  values(v_model,'created',jsonb_build_object(
    'evidence_count',v_verified_count,'version',left(trim(p_version),80),'evidence_source','provenance_backed_production_usage_v2'
  ));
  return v_model;
end;
$$;

create or replace function public.production_meterage_model_approve_v3(
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
  select garment,status,evidence_case_ids,evidence_count
  into v_garment,v_status,v_ids,v_stored_count
  from private.production_meterage_models
  where model_id=p_model_id
  for update;

  if v_status is null then return false; end if;
  if v_status<>'draft' then raise exception 'only a draft meterage model can be approved'; end if;
  if length(trim(coalesce(p_approved_by,'')))<2 then raise exception 'owner/tailor approver is required'; end if;

  select count(*) into v_verified_count
  from (
    select distinct trim(value) as case_id
    from jsonb_array_elements_text(v_ids)
  ) r
  where exists (
    select 1
    from public.style_events e
    where e.type='operator_note'
      and e.source='operator'
      and e.payload->>'subtype'='production_usage_case'
      and e.payload->>'version'='production-usage-v2'
      and e.payload->>'caseId'=r.case_id
      and e.payload->>'garment'=v_garment
      and length(trim(coalesce(e.payload->>'checkedBy','')))>=2
      and length(trim(coalesce(e.payload->>'evidenceReference','')))>=3
  )
  and not exists (
    select 1
    from public.style_events conflict
    where conflict.type='operator_note'
      and conflict.source='operator'
      and conflict.payload->>'subtype'='production_usage_case'
      and conflict.payload->>'caseId'=r.case_id
      and conflict.payload->>'garment'<>v_garment
  );

  if v_verified_count<>v_stored_count or v_verified_count<20 then
    raise exception 'meterage model no longer has 20 provenance-backed unambiguous real cuts';
  end if;
  return public.production_meterage_model_approve(p_model_id,p_approved_by,p_approval_note);
end;
$$;

revoke all on function public.production_meterage_model_create_v3(text,text,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.production_meterage_model_approve_v3(uuid,text,text) from public,anon,authenticated;
grant execute on function public.production_meterage_model_create_v3(text,text,jsonb,jsonb,text) to service_role;
grant execute on function public.production_meterage_model_approve_v3(uuid,text,text) to service_role;
