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
