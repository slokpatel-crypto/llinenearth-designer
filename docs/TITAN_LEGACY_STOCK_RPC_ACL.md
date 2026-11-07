# TITAN — retire legacy stock mutation EXECUTE permissions

## Source, scope and safety

Branch: `titan-central-retire-legacy-stock-execute-20261103` from `main=4dd8020abd83429449ff53ea5bb71b046394d86e`. This is **independent** of draft manual-lock parity PR #876 and caller-guard PR #879. Do not merge independently of stock compatibility review.

The forward SQL migration `supabase/migrations/20261107093030_legacy_stock_rpc_execute_retirement.sql` withdraws `EXECUTE` on all four historical `public` v1 stock mutators from `PUBLIC`, `anon`, `authenticated`, and `service_role`:

- `fabric_stock_record(text,text,numeric,text)`
- `fabric_stock_reserve(text,numeric,text,text)`
- `fabric_stock_release(uuid,text)`
- `fabric_stock_consume_reservation(uuid,numeric,text)`

The former eight-digit date-prefixed retirement file name (`20261103_z_legacy_stock_rpc_execute_retirement.sql`) duplicated the historical `20261103` migration version. This **unmerged draft-only** addition now uses a unique, calendar-valid 14-digit version. No existing historical migration or remote applied history was renamed. Before integration, reconcile the current staging applied-version history, stacked integration draft #881 and pinned source-manifest draft #907 with the renamed file and latest code. This fix does **not** resolve the pre-existing historical version collisions or final-reservation function-order issue (#882, #883, #909).

The older routines use weaker evidence or locking semantics. The SQL retains their definitions for historical schema compatibility, changes no rows, changes no function bodies and grants no new permissions. Existing v2 functions and grants are intentionally unchanged. The new migration sorts after the other current 2026-11-03 stock migrations, including PR #876's proposed `20261103_manual_stock_fabric_lock_parity.sql` when reconciled.

## Exact acceptance and evidence boundary

The independent `.github/workflows/titan-legacy-stock-rpc-acl.yml` starts only a disposable PostgreSQL 16 service with synthetic roles. It loads the existing v1/v2 schema and provenance/concurrency migrations, then applies the new retirement SQL and executes `supabase/tests/20261103_z_legacy_stock_rpc_execute_retirement.sql`. The SQL checks that all four v1 signatures remain defined but have no *effective* `EXECUTE` for `service_role`, `authenticated` or `anon` (which includes inherited `PUBLIC` privileges); the four privileged v2 write signatures must remain executable by `service_role` and inaccessible to the two customer roles. It also asserts no stock ledger rows were created.

The disposable workflow includes a **red-before-green control**: it first runs the actual privilege-denial SQL against historical grants *without* the retirement migration and requires a failure identifying `service_role` access to v1. It then applies the retirement migration **twice** to assert safe repeatability and reruns the same SQL requiring success. This avoids accidentally accepting a test that always passes or an ACL change that breaks on replay.

A separate disposable-shell regression, `scripts/test-legacy-stock-rpc-acl-invocation.sh`, also **actually switches to service_role** and calls each of the four v1 methods, checking for the function-level `permission denied` error rather than an unrelated SQL failure. A positive `service_role` call to the provenance-bearing v2 manual receipt confirms authorized service functionality, with a transaction rollback and a final zero-row assertion. These calls use only synthetic data and cannot establish a live environment's role inheritance or production permissions.

This proves an isolated migration ACL contract, not the permissions of the live Supabase database, not the correctness of externally deployed callers, and not verified physical inventory. Never run these synthetic role bootstrap commands on a live database.

## Read-only staging permission snapshot (not yet executed on staging)

A separate inspection query `supabase/tests/20261103_z_stock_rpc_acl_readonly_snapshot.sql` reads the **exact four historical v1 and four authorized v2 function signatures** across `PUBLIC`, `anon`, `authenticated` and `service_role`. It reports 32 rows with effective `EXECUTE` status, `NO_EXECUTE`, `MISSING_ROLE` or `MISSING_FUNCTION`. For `PUBLIC`, it examines default/explicit function ACLs; for roles it uses PostgreSQL's effective privilege check, including inherited `PUBLIC`. The SQL **only SELECTs** and cannot retire grants or approve a deployment by itself.

On a controlled, separately authorized staging connection with a configured **read-only** PostgreSQL service entry, capture the snapshots before and after an independently approved migration, for example:

```bash
PGSERVICE=titan-staging-readonly psql -X -v ON_ERROR_STOP=1 -At -F '|' -f supabase/tests/20261103_z_stock_rpc_acl_readonly_snapshot.sql > stock-acl-before.tsv
# After the separately approved migration, repeat into stock-acl-after.tsv.
```

Never include database credentials in committed artifacts. A successful query alone is not a pass: verify all four v1 methods become `NO_EXECUTE` for `PUBLIC`, `anon`, `authenticated` and `service_role`, that service_role retains all four v2 `EXECUTE` rights, and that `anon` and `authenticated` cannot execute v2. Missing roles/functions and unexpected grants **block** approval. Archive both captures with the exact target database identity, migration fingerprint, timestamp, reviewers, and independent server/integration caller inventory; redact sensitive connection details. Do not use the synthetic test bootstrap against staging or production.

After capturing both read-only snapshots, run the offline, fail-closed verifier:

```bash
node tests/stock-acl-snapshot-evidence.mjs stock-acl-before.tsv stock-acl-after.tsv
```

It checks every expected signature and role in **both** 32-row files, rejects missing/extra/duplicated keys, missing roles/functions, unexpected v1 permissions, and any v2 permission drift. It accepts an already-revoked staging baseline but still requires all v1 grants denied afterward. Its 19 synthetic fixture cases run in the independent GitHub workflow. The verifier cannot authenticate the origin of saved snapshot files; retain database identity, timestamp and reviewer evidence separately. A passing offline comparison is **not approval** to apply the migration.

The disposable workflow also runs `scripts/test-legacy-stock-rpc-acl-rollback-controls.sh`: three deliberately unsafe, transaction-scoped changes (restoring a v1 PUBLIC grant, revoking a v2 service-role grant, and granting v2 to an unprivileged role) must each be rejected by the **actual** permission-test SQL. Each failed transaction is rolled back automatically; the original SQL gate must subsequently pass again. The controls enforce `PGDATABASE=titan_synthetic` and must **never** be invoked with staging or production credentials.

The independent CI workflow proves that the same read-only query detects synthetic `service_role` v1 privileges *before* revocation and their absence *after*, without connecting to any shared database. This does not replace an actual staging capture, security sign-off or integration/version reconciliation.

## Draft retirement migration filename safety

The security gate also pins the reviewed permission-only SQL Git blob SHA-1 (`7f2fa3de616dfe8a40fb5e4ca8de578aec49c958`). It compares **every byte** of the draft migration and fails if permissions, function bodies, transaction structure or even whitespace are changed without an explicit review and pin update. This is a deliberate content integrity gate, not a cryptographic attestation of staging SQL. The migration directory audit also rejects symlinks, nested directories and uppercase-case SQL suffixes rather than silently omitting them. Sixteen dedicated fixtures guard version and content checks; they do **not** certify historical Supabase migration history.

The ACL workflow now triggers for **any** modification under `supabase/migrations/**`, not only its previously named SQL file. A standalone static naming guard `scripts/verify-draft-legacy-stock-migration-version.mjs` and 11 fixtures `scripts/test-draft-legacy-stock-migration-version.mjs` require a single retirement migration with a calendar-valid, unique 14-digit Supabase timestamp; reject the obsolete duplicate 8-digit draft path, a second file with the same version, or an accidentally backdated replacement. It allows pre-existing migration collision groups only because this guard is **not** the independent full-history migration auditor (#883); those historical collisions are still blockers for CLI deployment and must not be waived.

## Compatibility, rollout and rollback gate

**Before migration on any staging/production database:** independently enumerate server, job, external integration and operator RPC callers; verify they use the v2 counterparts with genuine checker/source-reference evidence. Confirm signed-off staging ACL snapshots before and after migration, and run negative `service_role` v1 permission tests, positive authorized v2 tests, and concurrency/replay tests against an isolated staging dataset. Keep operator stock writes held while those checks are incomplete. Obtain human security/stock review, retention and operational rollback approval.

This is deliberately a **forward security restriction**. Do **not** blindly roll it back by regranting v1 `EXECUTE` — that reopens provenance and shared-lock bypasses. In case of incompatible callers, stop the rollout, keep writes held, migrate callers to v2, and only use any exceptional restoration with a documented incident and authorized security exception. Capture the specific migration/compatibility decision in the central `DECISIONS.md` at approved integration time, reconciling Security #863's changes rather than overwriting them.

No Vercel deployment, production customer/stock access, fake supplier evidence, fabric truth claims or main merge authorized by this draft.
