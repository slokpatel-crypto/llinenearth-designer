-- Private-schema deny-by-default hardening.
-- The private schema is intentionally reachable only through vetted public
-- SECURITY DEFINER RPCs. Client roles must never receive direct table/function
-- access merely to silence an RLS "no policy" informational advisory.

revoke all privileges on schema private from public, anon, authenticated, service_role;
revoke all privileges on all tables in schema private from public, anon, authenticated, service_role;
revoke all privileges on all sequences in schema private from public, anon, authenticated, service_role;
revoke all privileges on all functions in schema private from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private
  revoke all privileges on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private
  revoke all privileges on functions from public, anon, authenticated, service_role;

-- Extend the existing read-only deployment probe. This verifies effective
-- privileges, including privileges inherited through PUBLIC.
create or replace function public.roadmap_v2_evidence_health()
returns jsonb
language sql
security definer
set search_path='public','private','pg_catalog'
as $$
  select jsonb_build_object(
    'noviceServerTimer', to_regprocedure('public.designer_novice_timer_start(text,text)') is not null
      and to_regprocedure('public.designer_novice_timer_finish(uuid)') is not null
      and to_regprocedure('public.designer_novice_attempt_record_v2(uuid,boolean,boolean,boolean,text)') is not null,
    'verifiedBetaFlow', to_regprocedure('public.launch_beta_attempt_record_v4(text,text,text,text,boolean,text)') is not null,
    'signedStyleHandoff', to_regprocedure('public.style_director_handoff_audit_record_v2(text,text,text,text,text)') is not null
      and to_regprocedure('public.style_director_user_test_record_v2(text,text,boolean,boolean,boolean,uuid,boolean,text)') is not null,
    'distinctStyleValidation', to_regprocedure('public.style_director_validation_signoff_record_v3(text,integer,text,text)') is not null,
    'renderManualReview', to_regprocedure('public.designer_render_manual_review_signoff_latest()') is not null,
    'measurementEvidence', to_regprocedure('public.measurement_calibration_case_list(integer)') is not null,
    'productionDeliveryEvidence', to_regprocedure('public.production_delivery_evidence_list(integer)') is not null,
    'stockProvenance', to_regprocedure('public.fabric_stock_record_v2(text,text,numeric,text,text,text)') is not null
      and to_regprocedure('public.fabric_stock_snapshot_v2(text[])') is not null,
    'garmentQcProvenance', to_regprocedure('public.finished_garment_qc_record_v2(uuid,text,jsonb,jsonb,text,text,text)') is not null,
    'deliveryProvenance', to_regprocedure('public.production_delivery_evidence_record_v2(uuid,boolean,jsonb,text,text,text)') is not null,
    'outcomeLearningContext', to_regprocedure('public.production_order_create_with_context(text,text,uuid,text,jsonb)') is not null
      and to_regprocedure('public.production_order_learning_context_list(integer)') is not null,
    'productionCutEvidence', to_regprocedure('public.production_cut_evidence_record(text,uuid,text,text,numeric,numeric,numeric,boolean,text,text,text,text)') is not null
      and to_regprocedure('public.production_cut_evidence_list(integer)') is not null,
    'verifiedMeterageCuts', to_regprocedure('public.production_meterage_model_create_v4(text,text,jsonb,jsonb,text)') is not null
      and to_regprocedure('public.production_meterage_model_approve_v4(uuid,text,text)') is not null,
    'privateSchemaDenyByDefault',
      not has_schema_privilege('anon','private','USAGE')
      and not has_schema_privilege('authenticated','private','USAGE')
      and not exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='private'
          and c.relkind in ('r','p','v','m')
          and (
            has_table_privilege('anon',c.oid,'SELECT')
            or has_table_privilege('anon',c.oid,'INSERT')
            or has_table_privilege('anon',c.oid,'UPDATE')
            or has_table_privilege('anon',c.oid,'DELETE')
            or has_table_privilege('authenticated',c.oid,'SELECT')
            or has_table_privilege('authenticated',c.oid,'INSERT')
            or has_table_privilege('authenticated',c.oid,'UPDATE')
            or has_table_privilege('authenticated',c.oid,'DELETE')
          )
      )
      and not exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='private'
          and p.prokind='f'
          and (
            has_function_privilege('anon',p.oid,'EXECUTE')
            or has_function_privilege('authenticated',p.oid,'EXECUTE')
          )
      )
  );
$$;

revoke all on function public.roadmap_v2_evidence_health() from public,anon,authenticated;
grant execute on function public.roadmap_v2_evidence_health() to service_role;
