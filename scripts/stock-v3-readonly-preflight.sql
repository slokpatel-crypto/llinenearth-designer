-- TITAN M65: READ-ONLY Supabase stock rollout preflight. No table reads,
-- inserts, updates, DDL, transaction locks or privileged function calls.
-- Safe for an authorized read-only check of a connected database, but DO NOT
-- confuse READY with physical evidence/approval to enable production writes.
WITH expected(name,signature) AS (
  VALUES
    ('record_v3','public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)'),
    ('reserve_v2','public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)'),
    ('release_v2','public.fabric_stock_release_v2(uuid,text,text,text)'),
    ('consume_v2','public.fabric_stock_consume_reservation_v2(uuid,numeric,text,text,text)'),
    ('snapshot_v2','public.fabric_stock_snapshot_v2(text[])')
), found AS (
  SELECT name,signature,to_regprocedure(signature) AS oid FROM expected
), code AS (
  SELECT f.*, lower(pg_get_functiondef(f.oid)) AS definition
  FROM found f
), checked AS (
  SELECT f.name,
    f.oid IS NOT NULL AS installed,
    -- Signature and EXECUTE privilege alone cannot identify which v2
    -- reservation body is installed. Legacy v2 accepts a repeated key
    -- without checking its original cutting-sheet evidence. A false READY
    -- would let the operator enable writes on an unsafe mixed migration.
    -- These are source-shape guards, not proof of actual transactional
    -- behavior; separate PostgREST replay tests remain mandatory.
    CASE f.name
      WHEN 'reserve_v2' THEN COALESCE(
        position('v_existing.event_type is distinct from ''reserve''' in f.definition)>0 AND
        position('v_existing.reservation_id is null' in f.definition)>0 AND
        position('v_existing.fabric_id is distinct from v_fabric' in f.definition)>0 AND
        position('v_existing.quantity_metres is distinct from p_quantity_metres' in f.definition)>0 AND
        position('v_existing.revision_id is distinct from v_revision' in f.definition)>0 AND
        position('v_existing.recorded_by is distinct from v_requester' in f.definition)>0 AND
        position('v_existing.source_reference is distinct from v_source' in f.definition)>0 AND
        position('pg_advisory_xact_lock(hashtext(''stock-request:''||v_key))' in f.definition)>0,
        false)
      WHEN 'record_v3' THEN COALESCE(
        position('v_existing.event_type is distinct from p_event_type' in f.definition)>0 AND
        position('v_existing.fabric_id is distinct from v_fabric' in f.definition)>0 AND
        position('v_existing.quantity_metres is distinct from p_quantity_metres' in f.definition)>0 AND
        position('v_existing.note is distinct from v_note' in f.definition)>0 AND
        position('v_existing.recorded_by is distinct from v_checker' in f.definition)>0 AND
        position('v_existing.source_reference is distinct from v_source' in f.definition)>0 AND
        position('v_existing.reservation_id is not null' in f.definition)>0 AND
        position('v_existing.revision_id is not null' in f.definition)>0 AND
        position('pg_advisory_xact_lock(hashtext(''stock-request:''||v_key))' in f.definition)>0,
        false)
      ELSE true
    END AS payload_binding_guard_present,
    COALESCE(p.prosecdef,false) AS security_definer,
    -- Must agree with fabric_stock_write_ready_v1(): accepting any
    -- search_path= setting would report READY for unsafe pg_temp drift.
    COALESCE(EXISTS(SELECT 1 FROM unnest(p.proconfig) c
      WHERE split_part(c,'=',1)='search_path'
        AND regexp_replace(
          replace(lower(split_part(c,'=',2)), '"', ''),
          '[[:space:]]+', '', 'g'
        ) IN ('public','public,private')),false) AS fixed_search_path,
    COALESCE(has_function_privilege('service_role',f.oid,'EXECUTE'),false) AS service_role_execute,
    COALESCE(has_function_privilege('anon',f.oid,'EXECUTE'),false) AS anon_execute,
    COALESCE(has_function_privilege('authenticated',f.oid,'EXECUTE'),false) AS authenticated_execute
  FROM code f LEFT JOIN pg_proc p ON p.oid=f.oid
)
SELECT jsonb_build_object(
  'status', CASE WHEN bool_and(
    installed AND security_definer AND fixed_search_path AND service_role_execute
      AND NOT anon_execute AND NOT authenticated_execute
      AND payload_binding_guard_present
  ) AND to_regclass('private.fabric_stock_ledger') IS NOT NULL
       THEN 'READY' ELSE 'BLOCKED' END,
  'pg_version',current_setting('server_version'),
  'ledger_schema_present',to_regclass('private.fabric_stock_ledger') IS NOT NULL,
  'checks',jsonb_agg(jsonb_build_object(
    'function',name,'installed',installed,'payload_binding_guard_present',payload_binding_guard_present,
    'security_definer',security_definer,
    'fixed_search_path',fixed_search_path,
    'service_role_execute',service_role_execute,
    'anon_execute',anon_execute,
    'authenticated_execute',authenticated_execute
  ) ORDER BY name)
)::text AS stock_preflight_json
FROM checked;
