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
), checked AS (
  SELECT f.name,
    f.oid IS NOT NULL AS installed,
    COALESCE(p.prosecdef,false) AS security_definer,
    COALESCE(EXISTS(SELECT 1 FROM unnest(p.proconfig) c
      WHERE c LIKE 'search_path=%'),false) AS fixed_search_path,
    COALESCE(has_function_privilege('service_role',f.oid,'EXECUTE'),false) AS service_role_execute,
    COALESCE(has_function_privilege('anon',f.oid,'EXECUTE'),false) AS anon_execute,
    COALESCE(has_function_privilege('authenticated',f.oid,'EXECUTE'),false) AS authenticated_execute
  FROM found f LEFT JOIN pg_proc p ON p.oid=f.oid
)
SELECT jsonb_build_object(
  'status', CASE WHEN bool_and(
    installed AND security_definer AND fixed_search_path AND service_role_execute
      AND NOT anon_execute AND NOT authenticated_execute
  ) AND to_regclass('private.fabric_stock_ledger') IS NOT NULL
       THEN 'READY' ELSE 'BLOCKED' END,
  'pg_version',current_setting('server_version'),
  'ledger_schema_present',to_regclass('private.fabric_stock_ledger') IS NOT NULL,
  'checks',jsonb_agg(jsonb_build_object(
    'function',name,'installed',installed,'security_definer',security_definer,
    'fixed_search_path',fixed_search_path,
    'service_role_execute',service_role_execute,
    'anon_execute',anon_execute,
    'authenticated_execute',authenticated_execute
  ) ORDER BY name)
)::text AS stock_preflight_json
FROM checked;
