-- M114: disposable PostgreSQL advisory eligibility proof (no real garments).
do $$
declare
  v_order uuid;
  v_qc uuid;
  v_eligible boolean;
  v_checks jsonb:='{"recipe_match":true,"fabric_match":true,"measurement_check":true,"pattern_alignment":true,"stitching_finish":true,"clean_damage_free":true}'::jsonb;
begin
  v_order:=public.production_order_create('LE-M114-ELIGIBILITY-REV',repeat('a',64),null,'');
  perform public.production_order_set_status(v_order,'cloth_reserved','');
  perform public.production_order_set_status(v_order,'cutting','');
  perform public.production_order_set_status(v_order,'stitching','');
  perform public.production_order_set_status(v_order,'ready','');

  select eligible into v_eligible from public.production_delivery_eligibility_list(100) where order_id=v_order;
  if v_eligible is distinct from false then
    raise exception 'ready order without physical QC was eligible';
  end if;

  v_qc:=public.finished_garment_qc_record_v2(v_order,'approved',v_checks,'[]'::jsonb,'',
    'CI checker','CI-M114-APPROVED');
  select eligible into v_eligible from public.production_delivery_eligibility_list(100) where order_id=v_order;
  if v_eligible is distinct from true then raise exception 'current proven QC approval was hidden'; end if;

  update private.finished_garment_qc_inspections
    set checks=checks||'{"unexpected":true}'::jsonb where inspection_id=v_qc;
  select eligible into v_eligible from public.production_delivery_eligibility_list(100) where order_id=v_order;
  if v_eligible is distinct from false then raise exception 'extra physical QC field became eligible'; end if;
  update private.finished_garment_qc_inspections set checks=v_checks where inspection_id=v_qc;

  update private.finished_garment_qc_inspections
    set recipe_hash=repeat('b',64) where inspection_id=v_qc;
  select eligible into v_eligible from public.production_delivery_eligibility_list(100) where order_id=v_order;
  if v_eligible is distinct from false then raise exception 'mismatched recipe became eligible'; end if;
  update private.finished_garment_qc_inspections
    set recipe_hash=repeat('a',64) where inspection_id=v_qc;

  update private.finished_garment_qc_inspections
    set inspection_reference=' ' where inspection_id=v_qc;
  select eligible into v_eligible from public.production_delivery_eligibility_list(100) where order_id=v_order;
  if v_eligible is distinct from false then raise exception 'invalid inspector reference became eligible'; end if;
  update private.finished_garment_qc_inspections
    set inspection_reference='CI-M114-APPROVED' where inspection_id=v_qc;

  perform public.finished_garment_qc_record_v2(v_order,'rework','{}'::jsonb,
    '["measurement"]'::jsonb,'Fabric needs rework','CI checker','CI-M114-REWORK');
  perform public.production_order_set_status(v_order,'ready','');
  select eligible into v_eligible from public.production_delivery_eligibility_list(100) where order_id=v_order;
  if v_eligible is distinct from false then raise exception 'stale approval overrode latest rework'; end if;

  if has_function_privilege('anon','public.production_delivery_eligibility_list(integer)','EXECUTE')
    or has_function_privilege('authenticated','public.production_delivery_eligibility_list(integer)','EXECUTE')
    or not has_function_privilege('service_role','public.production_delivery_eligibility_list(integer)','EXECUTE') then
    raise exception 'delivery eligibility function grants are incorrect';
  end if;
  if (select count(*) from information_schema.columns
      where table_schema='private' and table_name='production_delivery_request_receipts'
        and column_name in ('inspector','inspection_reference','checks'))<>0 then
    raise exception 'delivery receipt privacy regression';
  end if;
end $$;
