-- M122: disposable PostgreSQL only; synthetic garment QC is not human proof.
do $$
declare
  v_order uuid;
  v_approval uuid;
  v_rework uuid;
  v_checks jsonb:='{"recipe_match":true,"fabric_match":true,"measurement_check":true,"pattern_alignment":true,"stitching_finish":true,"clean_damage_free":true}'::jsonb;
begin
  if (select count(*) from pg_trigger
      where tgrelid='private.finished_garment_qc_inspections'::regclass
        and tgname='finished_garment_qc_append_only' and tgenabled='O')<>1 then
    raise exception 'physical QC append-only trigger missing or disabled';
  end if;
  if has_function_privilege('anon','private.reject_finished_garment_qc_mutation()','EXECUTE')
     or has_function_privilege('authenticated','private.reject_finished_garment_qc_mutation()','EXECUTE') then
    raise exception 'physical QC mutation rejection trigger is publicly executable';
  end if;

  v_order:=public.production_order_create('LE-M122-IMMUTABLE-QC',repeat('d',64),null,'');
  perform public.production_order_set_status(v_order,'cloth_reserved','');
  perform public.production_order_set_status(v_order,'cutting','');
  perform public.production_order_set_status(v_order,'stitching','');
  perform public.production_order_set_status(v_order,'ready','');
  v_approval:=public.finished_garment_qc_record_v2(v_order,'approved',
    v_checks,'[]'::jsonb,'','CI checker','CI-M122-APPROVAL');

  -- Even privileged direct SQL cannot alter the historical approval's
  -- decision, physical checks, inspector, recipe, timestamp or sequence.
  begin
    update private.finished_garment_qc_inspections
      set decision='rework',checks='{}'::jsonb where inspection_id=v_approval;
    raise exception 'QC approval UPDATE incorrectly succeeded';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from private.finished_garment_qc_inspections where inspection_id=v_approval;
    raise exception 'QC approval DELETE incorrectly succeeded';
  exception when sqlstate '55000' then null;
  end;
  if (select decision from private.finished_garment_qc_inspections where inspection_id=v_approval)<>'approved'
     or (select inspection_sequence from private.finished_garment_qc_inspections where inspection_id=v_approval)<>1 then
    raise exception 'immutable QC approval was changed or removed';
  end if;

  -- A new physical rework remains appendable; it must veto delivery.
  v_rework:=public.finished_garment_qc_record_v2(v_order,'rework',
    '{}'::jsonb,'["measurement"]'::jsonb,'Fit requires correction',
    'CI checker','CI-M122-REWORK');
  if (select inspection_sequence from private.finished_garment_qc_inspections where inspection_id=v_rework)<>2 then
    raise exception 'QC rework did not preserve monotonic chronology';
  end if;
  begin
    update private.finished_garment_qc_inspections
      set decision='approved',checks=v_checks where inspection_id=v_rework;
    raise exception 'QC rework UPDATE incorrectly succeeded';
  exception when sqlstate '55000' then null;
  end;
  perform public.production_order_set_status(v_order,'ready','');
  begin
    perform public.production_order_deliver_idempotent(
      '123e4567-e89b-42d3-a456-426614174346'::uuid,v_order,'');
    raise exception 'historical approval overrode immutable newer rework';
  exception when others then
    if sqlerrm<>'current matching QC approval required before delivery' then raise; end if;
  end;
  if exists(select 1 from private.production_order_events where order_id=v_order and status='delivered')
    or exists(select 1 from private.production_delivery_request_receipts where order_id=v_order) then
    raise exception 'blocked delivery wrote a false event or idempotency receipt';
  end if;
end $$;
