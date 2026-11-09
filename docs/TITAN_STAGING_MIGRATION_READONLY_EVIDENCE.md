# TITAN staging migration/stock RPC evidence — manual read-only capture

**Status: PREPARED ONLY — NOT EXECUTED.** This package creates no connection to Supabase or any other database. It is not confirmation of a staging environment, a migration-history repair plan, database approval, or launch readiness.

## Prerequisites for an authorized human reviewer

1. The owner must **explicitly identify and approve an isolated staging project** through an independent control-plane verification. A database name, IP address, or copied JSON claim is not proof that a connection targets staging.
2. The database/security reviewer must approve a **read-only database account**, permitted access to PostgreSQL system catalogs and `supabase_migrations.schema_migrations`, and a private place for raw results. Never use production credentials or share a connection string, SQL function source, IP address, or tokens in a public PR/issue.
3. The reviewer runs `docs/TITAN_STAGING_MIGRATION_READONLY_PROBE.sql` **manually against that verified staging connection only**, with a read-only transaction and error-on-first-failure configuration. Do not configure GitHub Actions, production apps or agent tasks to execute it.
4. Record run time (UTC), approved project identifier via independently verified dashboard/owner process, collector identity, exact source PR commit, and a private reference to the four query result sets. If the history table does not exist or a query lacks SELECT permission, report **BLOCKED**; do not initialize, repair or grant permissions merely to make the probe pass.

## What the SQL actually reads

- Connection/database metadata for manual staging identity checks, **not a self-proving identity token**.
- Applied migration **versions** and an optional history-table `name` value, if present. Supabase's history is version-keyed. The optional name and a version alone **cannot establish which different SQL file under a duplicate legacy prefix actually ran**.
- Actual currently deployed `public.fabric_stock_*` function definitions, **function owner**, security-definer flag, function settings and a digest of PostgreSQL's **rendered function definition**. That digest is **not** comparable byte-for-byte with a Git migration SQL file SHA-256.
- Effective `EXECUTE` permissions for any existing `anon`, `authenticated`, and `service_role` database roles. Missing **required v2 RPCs** or an expected role are **unknown/blockers**, not permission passes. A missing retired v1 function may be appropriate when deliberately removed and must **not** be recreated solely to satisfy an evidence query.

**Important absence check:** Query 4 starts from the eight explicitly named stock RPC candidates crossed with the three roles, not from the set of functions currently installed. It therefore returns **at least 24 evidence rows**, including `expected_function_name`, `function_exists=false`, `function_signature=NULL` and `effective_execute=NULL` for any missing function. A missing role likewise yields `role_exists=false` and an unknown permission. Function overloads may produce extra rows. Reviewers must mark missing required v2 functions and expected roles **BLOCKED/UNKNOWN** and independently determine whether a missing retired v1 function is intentional; no empty result set or NULL privilege is a passing permission check. The absence matrix does **not** itself establish expected function signatures or whether an apparent v2 overload is the production-approved one.

The SQL file contains `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`, four `SELECT` queries and `COMMIT`. The separate pure tests check that it contains no write statement and captures the required metadata. A successful capture means only that observations were obtained. It cannot prove the historical order of all 58 Git files.

## After collection — no deployment

Use the source-only `{version,filename,sha256}` evidence from [draft #912](https://github.com/slokpatel-crypto/llinenearth-designer/pull/912) for comparison with the independently reviewed staging output. Draft [#909](https://github.com/slokpatel-crypto/llinenearth-designer/pull/909) has an offline, fail-closed reconciler. A version-only record can never resolve two SQL files sharing the same version. Do not copy claimed provenance fields to make a reconciliation result green.

For the known `fabric_stock_reserve_v2` hazard, an independent reviewer must check the **actual deployed function body** for full-length identity rejection, not just the filename order. The two historical `20261103` source migrations differ: one rejects oversized identities; one truncates them before validation. Also inspect effective v1 stock RPC EXECUTE revocation and v2 role permissions. Only an owner-approved **forward-only, uniquely versioned migration plan** tested in a disposable PostgreSQL database can resolve this; the SQL probe itself does not patch or migrate anything.

Relevant references: [Supabase migration history and deployment guidance](https://supabase.com/docs/guides/deployment/database-migrations), [Supabase CLI migration list](https://supabase.com/docs/reference/cli/introduction), [PostgreSQL effective function privilege inspection](https://www.postgresql.org/docs/current/functions-info.html).

Release blockers remain [#882](https://github.com/slokpatel-crypto/llinenearth-designer/issues/882) (migration history and ordering), [#878](https://github.com/slokpatel-crypto/llinenearth-designer/issues/878) (protected main and independent approval), physical operator/tailor evidence and explicit owner approval.

**No staging query executed, SQL applied, migration repaired/renamed, PR merged or deployment triggered in this draft.**
