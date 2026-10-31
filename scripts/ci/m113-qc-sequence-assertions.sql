-- M113: isolated PostgreSQL chronology and owner-lock contract, no live data.
do $$
declare
  v_legacy uuid;
  v_new uuid;
  v_order uuid;
  v_approval uuid;
  v_rework uuid;
  v_checks jsonb:='{"recipe_match":true,"fabric_match":true,"measurement_check":true,"pattern_alignment":true,"stitching_finish":true,"clean_damage_free":true}'::jsonb;
  v_start timestamptz:=now();
begin
  select order_id into strict v_legacy from private.production_orders
   where revision_id='LE-M113-HISTORIC-READY';
  if exists(select 1 from private.finished_garment_qc_inspections
            where order_id=v_legacy and inspection_sequence is not null) then
    raise exception 'migration falsely certified historical QC chronology';
  end if;
  begin
    perform public.production_order_set_status(v_legacy,'delivered','');
    raise exception 'unsequenced historical approval became delivery proof';
  exception when others then
    if sqlerrm<>'fresh sequenced QC inspection required for delivery' then raise; end if;
  end;
  v_new:=public.finished_garment_qc_record_v2(
    v_legacy,'approved',v_checks,'[]'::jsonb,'','CI inspector','CI-M113-RECHECK');
  if (select inspection_sequence from private.finished_garment_qc_inspections where inspection_id=v_new)<>1
     or (select qc_latest_sequence from private.production_orders where order_id=v_legacy)<>1 then
    raise exception 'reinspected historical order was not assigned QC ordinal one';
  end if;
  if public.production_order_set_status(v_legacy,'delivered','') is distinct from true then
    raise exception 'fresh sequenced QC was wrongly denied delivery';
  end if;
  if (select count(*) from private.production_order_events where order_id=v_legacy and status='delivered')<>1 then
    raise exception 'fresh delivery did not emit exactly one event';
  end if;

  v_order:=public.production_order_create('LE-M113-REWORK-SEQUENCE',repeat('b',64),null,'');
  perform public.production_order_set_status(v_order,'cloth_reserved','');
  perform public.production_order_set_status(v_order,'cutting','');
  perform public.production_order_set_status(v_order,'stitching','');
  perform public.production_order_set_status(v_order,'ready','');
  v_approval:=public.finished_garment_qc_record_v2(v_order,'approved',
    v_checks,'[]'::jsonb,'','CI inspector','CI-M113-FIRST');
  perform pg_sleep(0.02);
  v_rework:=public.finished_garment_qc_record_v2(v_order,'rework',
    '{}'::jsonb,'["measurement"]'::jsonb,'Recheck required',
    'CI inspector','CI-M113-LATEST');
  if (select inspection_sequence from private.finished_garment_qc_inspections where inspection_id=v_approval)<>1
    or (select inspection_sequence from private.finished_garment_qc_inspections where inspection_id=v_rework)<>2
    or (select qc_latest_sequence from private.production_orders where order_id=v_order)<>2 then
    raise exception 'QC insertion ordinal did not track real append order';
  end if;
  perform public.production_order_set_status(v_order,'ready','');
  begin
    perform public.production_order_set_status(v_order,'delivered','');
    raise exception 'old approved QC overrode newer physical rework';
  exception when others then
    if sqlerrm<>'current matching QC approval required before delivery' then raise; end if;
  end;
  if exists(select 1 from private.production_order_events
             where order_id=v_order and status='delivered') then
    raise exception 'rework-blocked delivery emitted a false event';
  end if;

  if not (select relrowsecurity from pg_class where oid='private.finished_garment_qc_inspections'::regclass) then
    raise exception 'QC ledger RLS unexpectedly disabled';
  end if;
  if has_function_privilege('anon','private.assign_finished_garment_qc_sequence()','EXECUTE')
    or has_function_privilege('authenticated','private.assign_finished_garment_qc_sequence()','EXECUTE') then
    raise exception 'QC sequence trigger function is public';
  end if;
end $$;
