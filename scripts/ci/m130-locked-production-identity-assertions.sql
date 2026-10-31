-- M130 only disposable synthetic quote/order, never a real customer price or QC.
-- The BEFORE UPDATE gate protects locked design and quoted financial identity
-- while canonical status RPCs and physical QC sequence insert still work.
do $$
declare
  v_quote uuid;
  v_order uuid;
  v_qc uuid;
  v_revision text:='LE-M130-LOCKED-DESIGN-REVISION';
  v_hash text:=repeat('e',64);
  v_checks jsonb:='{"recipe_match":true,"fabric_match":true,"measurement_check":true,"pattern_alignment":true,"stitching_finish":true,"clean_damage_free":true}'::jsonb;
begin
  v_quote:=public.production_quote_create(
    v_revision,v_hash,'INR',
    '[{"label":"CI fabric and sewing","amount":250}]'::jsonb,
    10,'Synthetic quote');
  if v_quote is null then raise exception 'M130 quote setup failed'; end if;
  begin
    update private.production_quotes set recipe_hash=repeat('a',64)
      where quote_id=v_quote;
    raise exception 'M130 quote recipe hash rewrite succeeded';
  exception when sqlstate '55000' then null; end;
  begin
    update private.production_quotes set revision_id='FORGED-LOCKED-REVISION'
      where quote_id=v_quote;
    raise exception 'M130 quote revision rewrite succeeded';
  exception when sqlstate '55000' then null; end;
  begin
    update private.production_quotes set currency='USD' where quote_id=v_quote;
    raise exception 'M130 quote currency rewrite succeeded';
  exception when sqlstate '55000' then null; end;
  begin
    update private.production_quotes set line_items='[{"label":"Forged price","amount":1}]'::jsonb
      where quote_id=v_quote;
    raise exception 'M130 quote line items rewrite succeeded';
  exception when sqlstate '55000' then null; end;
  begin
    update private.production_quotes set total=1 where quote_id=v_quote;
    raise exception 'M130 quote financial total rewrite succeeded';
  exception when sqlstate '55000' then null; end;
  begin
    update private.production_quotes set created_at=now()+interval '1 day'
      where quote_id=v_quote;
    raise exception 'M130 quote creation timestamp rewrite succeeded';
  exception when sqlstate '55000' then null; end;
  if (select total from private.production_quotes where quote_id=v_quote)<>260
    or (select currency from private.production_quotes where quote_id=v_quote)<>'INR'
    or (select recipe_hash from private.production_quotes where quote_id=v_quote)<>v_hash then
    raise exception 'M130 original quoted design/price changed after rejected mutation'; end if;

  -- Valid canonical quote status changes are still permitted.
  if public.production_quote_set_status(v_quote,'sent','') is distinct from true
    or public.production_quote_set_status(v_quote,'accepted','') is distinct from true then
    raise exception 'M130 valid quote status transitions were blocked'; end if;
  v_order:=public.production_order_create(v_revision,v_hash,v_quote,'CI order');
  if v_order is null then raise exception 'M130 order creation failed'; end if;
  begin
    update private.production_orders set recipe_hash=repeat('a',64)
      where order_id=v_order;
    raise exception 'M130 order recipe hash rewrite succeeded';
  exception when sqlstate '55000' then null; end;
  begin
    update private.production_orders set revision_id='FORGED-ORDER-REVISION'
      where order_id=v_order;
    raise exception 'M130 order revision rewrite succeeded';
  exception when sqlstate '55000' then null; end;
  begin
    update private.production_orders set quote_id=null where order_id=v_order;
    raise exception 'M130 order quote relinking succeeded';
  exception when sqlstate '55000' then null; end;
  begin
    update private.production_orders set created_at=now()+interval '1 day'
      where order_id=v_order;
    raise exception 'M130 order creation timestamp rewrite succeeded';
  exception when sqlstate '55000' then null; end;

  -- Existing workflow is not blocked: status/note/updated_at and QC counter.
  if public.production_order_set_status(v_order,'cloth_reserved','') is distinct from true
    or public.production_order_set_status(v_order,'cutting','') is distinct from true
    or public.production_order_set_status(v_order,'stitching','') is distinct from true
    or public.production_order_set_status(v_order,'ready','') is distinct from true then
    raise exception 'M130 valid production transitions were blocked'; end if;
  v_qc:=public.finished_garment_qc_record_v2(
    v_order,'approved',v_checks,'[]'::jsonb,'',
    'CI checker','CI-M130-SYNTHETIC-QC');
  if v_qc is null then raise exception 'M130 valid QC append blocked'; end if;
  if (select qc_latest_sequence from private.production_orders
       where order_id=v_order)<>1
    or (select revision_id from private.production_orders where order_id=v_order)<>v_revision
    or (select recipe_hash from private.production_orders where order_id=v_order)<>v_hash
    or (select quote_id from private.production_orders where order_id=v_order)<>v_quote
    or (select status from private.production_orders where order_id=v_order)<>'ready' then
    raise exception 'M130 canonical order identity or normal QC sequencing incorrect'; end if;
  if (select count(*) from private.production_quote_events
       where quote_id=v_quote and event_type='accepted')<>1
    or (select count(*) from private.production_order_events
       where order_id=v_order and status='ready')<>1 then
    raise exception 'M130 allowed quote/order state events were not appended'; end if;
end $$;
