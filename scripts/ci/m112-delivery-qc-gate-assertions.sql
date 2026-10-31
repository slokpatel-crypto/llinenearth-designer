-- M112: disposable PostgreSQL assertions; synthetic fixture records are test-only.
do $$
declare
  o uuid; q uuid; k jsonb:='{"recipe_match":true,"fabric_match":true,"measurement_check":true,"pattern_alignment":true,"stitching_finish":true,"clean_damage_free":true}'::jsonb;
begin
  o:=public.production_order_create('LE-M112-LOCKED-REV',repeat('a',64),null,'');
  perform public.production_order_set_status(o,'cloth_reserved','');
  perform public.production_order_set_status(o,'cutting','');
  perform public.production_order_set_status(o,'stitching','');
  perform public.production_order_set_status(o,'ready','');
  begin
    perform public.production_order_set_status(o,'delivered','');
    raise exception 'missing QC was accepted';
  exception when others then
    if sqlerrm='missing QC was accepted' then raise; end if;
  end;
  q:=public.finished_garment_qc_record_v2(o,'approved',k,'[]'::jsonb,'','QA inspector','TEST-QC-112');
  update private.finished_garment_qc_inspections set checks=checks||'{"unexpected":true}'::jsonb where inspection_id=q;
  begin
    perform public.production_order_set_status(o,'delivered','');
    raise exception 'extra check was accepted';
  exception when others then
    if sqlerrm='extra check was accepted' then raise; end if;
  end;
  update private.finished_garment_qc_inspections set checks=k,recipe_hash=repeat('b',64) where inspection_id=q;
  begin
    perform public.production_order_set_status(o,'delivered','');
    raise exception 'wrong recipe was accepted';
  exception when others then
    if sqlerrm='wrong recipe was accepted' then raise; end if;
  end;
  update private.finished_garment_qc_inspections set recipe_hash=repeat('a',64) where inspection_id=q;
  if public.production_order_set_status(o,'delivered','') is distinct from true then
    raise exception 'valid approved QC delivery not accepted';
  end if;
  if (select count(*) from private.production_order_events where order_id=o and status='delivered')<>1 then
    raise exception 'delivery event duplicated';
  end if;
end $$;

-- Additional M112 canonical SQL boundary negatives. Direct table alterations
-- below exist ONLY inside isolated disposable PostgreSQL to test tamper defense.
do $$
declare
  v_order uuid;
  v_qc uuid;
  v_created timestamptz;
  v_checks jsonb:='{"recipe_match":true,"fabric_match":true,"measurement_check":true,"pattern_alignment":true,"stitching_finish":true,"clean_damage_free":true}'::jsonb;
begin
  v_order:=public.production_order_create('LE-M112-STRICT-PROVENANCE',repeat('a',64),null,'');
  perform public.production_order_set_status(v_order,'cloth_reserved','');
  perform public.production_order_set_status(v_order,'cutting','');
  perform public.production_order_set_status(v_order,'stitching','');
  perform public.production_order_set_status(v_order,'ready','');
  v_qc:=public.finished_garment_qc_record_v2(v_order,'approved',v_checks,'[]'::jsonb,'',
    'CI inspector','CI-M112-STRICT');
  select created_at into v_created from private.finished_garment_qc_inspections where inspection_id=v_qc;

  update private.finished_garment_qc_inspections
    set checks=jsonb_set(checks,'{recipe_match}','false'::jsonb) where inspection_id=v_qc;
  begin
    perform public.production_order_set_status(v_order,'delivered','');
    raise exception 'false physical check was accepted';
  exception when others then
    if sqlerrm<>'six exact passing physical QC checks required before delivery' then raise; end if;
  end;
  update private.finished_garment_qc_inspections set checks=v_checks,inspector='' where inspection_id=v_qc;
  begin
    perform public.production_order_set_status(v_order,'delivered','');
    raise exception 'missing inspector was accepted';
  exception when others then
    if sqlerrm<>'provenance-backed QC approval required before delivery' then raise; end if;
  end;
  update private.finished_garment_qc_inspections
    set inspector='CI inspector',
        created_at=(select created_at - interval '1 second'
                    from private.production_orders where order_id=v_order)
    where inspection_id=v_qc;
  begin
    perform public.production_order_set_status(v_order,'delivered','');
    raise exception 'QC predating order was accepted';
  exception when others then
    if sqlerrm<>'current matching QC approval required before delivery' then raise; end if;
  end;
  update private.finished_garment_qc_inspections set created_at=v_created where inspection_id=v_qc;
  insert into private.finished_garment_qc_inspections (
    order_id,revision_id,recipe_hash,decision,checks,defects,note,inspector,
    inspection_reference,created_at
  )
  select order_id,revision_id,recipe_hash,decision,checks,defects,note,inspector,
         inspection_reference,created_at
    from private.finished_garment_qc_inspections where inspection_id=v_qc;
  begin
    perform public.production_order_set_status(v_order,'delivered','');
    raise exception 'ambiguous latest QC timestamp was accepted';
  exception when others then
    if sqlerrm<>'ambiguous latest QC inspection' then raise; end if;
  end;
  if (select count(*) from private.production_order_events
      where order_id=v_order and status='delivered')<>0 then
    raise exception 'failed QC proof emitted delivery event';
  end if;
end $$;
