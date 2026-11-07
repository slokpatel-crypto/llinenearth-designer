-- TITAN read-only permissions evidence. Safe to run on STAGING with a read-only
-- connection; this SQL contains no mutation, DDL, GRANT, or SET ROLE.
-- Output: lifecycle | exact signature | role | effective EXECUTE.
-- Capture before AND after retirement, compare and obtain human sign-off.
-- MISSING_FUNCTION and MISSING_ROLE are evidence gaps, never automatic passes.
WITH rpc_signatures(lifecycle, signature) AS (
  VALUES
    ('v1', 'public.fabric_stock_record(text,text,numeric,text)'),
    ('v1', 'public.fabric_stock_reserve(text,numeric,text,text)'),
    ('v1', 'public.fabric_stock_release(uuid,text)'),
    ('v1', 'public.fabric_stock_consume_reservation(uuid,numeric,text)'),
    ('v2', 'public.fabric_stock_record_v2(text,text,numeric,text,text,text)'),
    ('v2', 'public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)'),
    ('v2', 'public.fabric_stock_release_v2(uuid,text,text,text)'),
    ('v2', 'public.fabric_stock_consume_reservation_v2(uuid,numeric,text,text,text)')
),
role_names(role_name) AS (
  VALUES ('PUBLIC'), ('anon'), ('authenticated'), ('service_role')
),
resolved AS (
  SELECT lifecycle, signature, to_regprocedure(signature) AS function_oid
  FROM rpc_signatures
)
SELECT f.lifecycle, f.signature, r.role_name,
  CASE
    WHEN f.function_oid IS NULL THEN 'MISSING_FUNCTION'
    WHEN r.role_name = 'PUBLIC' THEN
      CASE WHEN EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc p
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
        ) grant_entry
        WHERE p.oid = f.function_oid
          AND grant_entry.grantee = 0
          AND grant_entry.privilege_type = 'EXECUTE'
      ) THEN 'EXECUTE' ELSE 'NO_EXECUTE' END
    WHEN to_regrole(r.role_name) IS NULL THEN 'MISSING_ROLE'
    WHEN has_function_privilege(to_regrole(r.role_name)::oid, f.function_oid::oid, 'EXECUTE')
      THEN 'EXECUTE'
    ELSE 'NO_EXECUTE'
  END AS effective_execute
FROM resolved f
CROSS JOIN role_names r
ORDER BY f.lifecycle, f.signature, r.role_name;
