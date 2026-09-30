-- Preserve physical-evidence provenance through durable Fabric Analyzer queue jobs.
-- Replaces the enqueue RPC so background processing receives the same evidence
-- note already validated by synchronous Analyzer paths.

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
        'verifiedPhysicalSourceUrl',left(trim(coalesce(item->>'verifiedPhysicalSourceUrl','')),1800),
        'verifiedPhysicalEvidenceNote',left(trim(coalesce(item->>'verifiedPhysicalEvidenceNote','')),500)
      ),
      coalesce((item->>'force')::boolean,false)
    );
    v_count:=v_count+1;
  end loop;
  return query select v_batch,v_count;
end;
$$;

revoke all on function public.fabric_analyzer_batch_enqueue(jsonb) from public,anon,authenticated;
grant execute on function public.fabric_analyzer_batch_enqueue(jsonb) to service_role;

comment on function public.fabric_analyzer_batch_enqueue(jsonb)
is 'Queues private Fabric Analyzer jobs while preserving declared physical-evidence provenance.';
