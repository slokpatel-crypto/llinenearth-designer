-- TITAN owner-approved STAGING evidence capture, manually run ONLY with read-only
-- authorization. Never auto-run against production or an unidentified project.
-- A successful query is NOT authentication of project identity or deployment approval.
-- Reads only migration metadata and Postgres function catalogs; no customer/order rows.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- 1. Connection fingerprint (owner must independently verify staging project ref).
SELECT 'connection_identity' AS evidence_kind,
       current_database() AS database_name,
       current_user AS query_role,
       inet_server_addr()::text AS server_address,
       inet_server_port() AS server_port,
       current_setting('server_version') AS postgres_version;

-- 2. Version history. Even a recorded name cannot resolve duplicate-version SQL
-- identity without independent underlying source or current function evidence.
-- to_jsonb(row) supports older migration-history tables with no "name" column.
SELECT 'migration_history' AS evidence_kind,
       version,
       to_jsonb(m)->>'name' AS recorded_name
FROM supabase_migrations.schema_migrations AS m
ORDER BY version;

-- 3. Actual currently installed stock RPC definitions and security context.
-- Hash is a compact *database-rendered definition* fingerprint, not a file SHA.
SELECT 'stock_function_definition' AS evidence_kind,
       p.oid::regprocedure::text AS function_signature,
       pg_get_userbyid(p.proowner) AS function_owner,
       p.prosecdef AS security_definer,
       p.provolatile AS volatility,
       p.proconfig AS function_settings,
       md5(pg_get_functiondef(p.oid)) AS rendered_definition_md5,
       pg_get_functiondef(p.oid) AS rendered_definition
FROM pg_proc AS p
JOIN pg_namespace AS ns ON ns.oid=p.pronamespace
WHERE ns.nspname='public'
  AND p.proname IN (
    'fabric_stock_record','fabric_stock_reserve','fabric_stock_release',
    'fabric_stock_consume_reservation','fabric_stock_record_v2',
    'fabric_stock_reserve_v2','fabric_stock_release_v2',
    'fabric_stock_consume_reservation_v2'
  )
ORDER BY p.proname,p.oid::regprocedure::text;

-- 4. Effective EXECUTE grants and explicit absence evidence for EACH named RPC.
-- Drive the matrix from expected names, never from pg_proc: a missing v2
-- function must appear as function_exists=false, not silently vanish.
-- Missing retired v1 may be intentional; reviewer must classify each result.
-- If a function or role is absent, effective_execute is NULL (UNKNOWN).
SELECT 'stock_function_effective_execute' AS evidence_kind,
       expected.function_name AS expected_function_name,
       p.oid::regprocedure::text AS function_signature,
       p.oid IS NOT NULL AS function_exists,
       requested.role_name,
       registered_role.oid IS NOT NULL AS role_exists,
       CASE WHEN registered_role.oid IS NULL OR p.oid IS NULL THEN NULL
            ELSE has_function_privilege(registered_role.oid,p.oid,'EXECUTE')
       END AS effective_execute
FROM (VALUES
       ('fabric_stock_record'),('fabric_stock_reserve'),
       ('fabric_stock_release'),('fabric_stock_consume_reservation'),
       ('fabric_stock_record_v2'),('fabric_stock_reserve_v2'),
       ('fabric_stock_release_v2'),('fabric_stock_consume_reservation_v2')
     ) AS expected(function_name)
CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) AS requested(role_name)
LEFT JOIN pg_namespace AS ns ON ns.nspname='public'
LEFT JOIN pg_proc AS p ON p.pronamespace=ns.oid AND p.proname=expected.function_name
LEFT JOIN pg_roles AS registered_role ON registered_role.rolname=requested.role_name
ORDER BY expected.function_name,p.oid::regprocedure::text NULLS FIRST,requested.role_name;

COMMIT;
