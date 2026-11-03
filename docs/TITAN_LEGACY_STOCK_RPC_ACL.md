# TITAN — retire legacy stock mutation EXECUTE permissions

## Source, scope and safety

Branch: `titan-central-retire-legacy-stock-execute-20261103` from `main=4dd8020abd83429449ff53ea5bb71b046394d86e`. This is **independent** of draft manual-lock parity PR #876 and caller-guard PR #879. Do not merge independently of stock compatibility review.

The forward SQL migration `supabase/migrations/20261103_z_legacy_stock_rpc_execute_retirement.sql` withdraws `EXECUTE` on all four historical `public` v1 stock mutators from `PUBLIC`, `anon`, `authenticated`, and `service_role`:

- `fabric_stock_record(text,text,numeric,text)`
- `fabric_stock_reserve(text,numeric,text,text)`
- `fabric_stock_release(uuid,text)`
- `fabric_stock_consume_reservation(uuid,numeric,text)`

The older routines use weaker evidence or locking semantics. The SQL retains their definitions for historical schema compatibility, changes no rows, changes no function bodies and grants no new permissions. Existing v2 functions and grants are intentionally unchanged. The new migration sorts after the other current 2026-11-03 stock migrations, including PR #876's proposed `20261103_manual_stock_fabric_lock_parity.sql` when reconciled.

## Exact acceptance and evidence boundary

The independent `.github/workflows/titan-legacy-stock-rpc-acl.yml` starts only a disposable PostgreSQL 16 service with synthetic roles. It loads the existing v1/v2 schema and provenance/concurrency migrations, then applies the new retirement SQL and executes `supabase/tests/20261103_z_legacy_stock_rpc_execute_retirement.sql`. The SQL checks that all four v1 signatures remain defined but have no *effective* `EXECUTE` for `service_role`, `authenticated` or `anon` (which includes inherited `PUBLIC` privileges); the four privileged v2 write signatures must remain executable by `service_role` and inaccessible to the two customer roles. It also asserts no stock ledger rows were created.

The disposable workflow includes a **red-before-green control**: it first runs the actual privilege-denial SQL against historical grants *without* the retirement migration and requires a failure identifying `service_role` access to v1. It then applies the retirement migration **twice** to assert safe repeatability and reruns the same SQL requiring success. This avoids accidentally accepting a test that always passes or an ACL change that breaks on replay.

A separate disposable-shell regression, `scripts/test-legacy-stock-rpc-acl-invocation.sh`, also **actually switches to service_role** and calls each of the four v1 methods, checking for the function-level `permission denied` error rather than an unrelated SQL failure. A positive `service_role` call to the provenance-bearing v2 manual receipt confirms authorized service functionality, with a transaction rollback and a final zero-row assertion. These calls use only synthetic data and cannot establish a live environment's role inheritance or production permissions.

This proves an isolated migration ACL contract, not the permissions of the live Supabase database, not the correctness of externally deployed callers, and not verified physical inventory. Never run these synthetic role bootstrap commands on a live database.

## Compatibility, rollout and rollback gate

**Before migration on any staging/production database:** independently enumerate server, job, external integration and operator RPC callers; verify they use the v2 counterparts with genuine checker/source-reference evidence. Confirm signed-off staging ACL snapshots before and after migration, and run negative `service_role` v1 permission tests, positive authorized v2 tests, and concurrency/replay tests against an isolated staging dataset. Keep operator stock writes held while those checks are incomplete. Obtain human security/stock review, retention and operational rollback approval.

This is deliberately a **forward security restriction**. Do **not** blindly roll it back by regranting v1 `EXECUTE` — that reopens provenance and shared-lock bypasses. In case of incompatible callers, stop the rollout, keep writes held, migrate callers to v2, and only use any exceptional restoration with a documented incident and authorized security exception. Capture the specific migration/compatibility decision in the central `DECISIONS.md` at approved integration time, reconciling Security #863's changes rather than overwriting them.

No Vercel deployment, production customer/stock access, fake supplier evidence, fabric truth claims or main merge authorized by this draft.
