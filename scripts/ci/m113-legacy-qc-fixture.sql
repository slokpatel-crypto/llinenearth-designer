-- Synthetic isolated PostgreSQL fixture created BEFORE the M113 sequence migration.
-- A historical approval has no causal sequence and must NOT automatically
-- authorize a fresh delivery when timestamp chronology is untrustworthy.
do $$
declare
 v_order uuid;
begin
 v_order:=public.production_order_create('LE-M113-HISTORIC-READY',repeat('a',64),null,'');
 perform public.production_order_set_status(v_order,'cloth_reserved','');
 perform public.production_order_set_status(v_order,'cutting','');
 perform public.production_order_set_status(v_order,'stitching','');
 perform public.production_order_set_status(v_order,'ready','');
 perform public.finished_garment_qc_record_v2(
   v_order,'approved',
   '{"recipe_match":true,"fabric_match":true,"measurement_check":true,"pattern_alignment":true,"stitching_finish":true,"clean_damage_free":true}'::jsonb,
   '[]'::jsonb,'','CI inspector','CI-M113-LEGACY');
end $$;
