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

-- 4. Effective EXECUTE privileges for each role that exists on approved staging.
-- Missing roles or missing RPC overloads must be handled as unknown/blocked, not
-- silently interpreted as an ACL pass.
SELECT 'stock_function_effective_execute' AS evidence_kind,
       p.oid::regprocedure::text AS function_signature,
       requested.role_name,
       role.oid IS NOT NULL AS role_exists,
       CASE WHEN role.oid IS NULL THEN NULL
            ELSE has_function_privilege(role.oid,p.oid,'EXECUTE')
       END AS effective_execute
FROM pg_proc AS p
JOIN pg_namespace AS ns ON ns.oid=p.pronamespace
CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) AS requested(role_name)
LEFT JOIN pg_roles AS role ON role.rolname=requested.role_name
WHERE ns.nspname='public'
  AND p.proname IN (
    'fabric_stock_record','fabric_stock_reserve','fabric_stock_release',
    'fabric_stock_consume_reservation','fabric_stock_record_v2',
    'fabric_stock_reserve_v2','fabric_stock_release_v2',
    'fabric_stock_consume_reservation_v2'
  )
ORDER BY p.proname,p.oid::regprocedure::text,requested.role_name;

COMMIT;
