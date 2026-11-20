# TITAN manual-stock lock parity — 2026-11-03

- **Parent main:** `fd2f29771a24ae888719d64504a0b1fb3595ffb1`. Independent intake branch `titan-manual-stock-lock-parity-20261103`, not stacked onto the documentation-only PR #875.
- **Affected criteria:** T3/J1 physical stock integrity; T5/J5 privileged operator write safety; T6/J6 disposable database verification.
- **Observed defect:** `fabric_stock_record_v2` used advisory key `hashtext(fabric_id)`, whereas reserve/consume use `hashtext('stock-fabric:'||fabric_id)`. Consequently manual adjustment-out and reservation/consumption were not serialized on the same fabric lock, permitting stale availability reads and overcommit.
- **Code fix:** forward source-only migration replaces the manual record RPC with the same signature and logic except its advisory key now matches reservation/consume. No real stock quantities or existing ledger rows are changed by this migration.
- **Regression:** `scripts/test-manual-stock-lock-parity.sh` uses two independent disposable PostgreSQL sessions: one holds the reservation fabric advisory lock, the other must time out attempting manual receipt, then successfully retry after release. Synthetic receipt is rolled back; zero rows must persist. CI loads migration and runs this test.
- **Commits:** migration `1802943acdf4db23955254c15f3ed0f362735d23`; concurrency test `5dc7ab29f26abe7432a96f740e47d7b9774cfd14`; CI integration `d176a853a264425753653af9f292d0ef57a19b66`. Matching-head CI and Non-3D **PENDING** until observed.
- **Remaining risks:** legacy v1 stock RPC uses the old lock namespace and must remain disabled/unreachable in operator flows; stock quantity rounding, manual evidence length and live migration staging/rollback need separate review. No claim of physical stock verification.
- **BLOCKED/PENDING:** supplier evidence, approved staging migration, authenticated operator/customer testing, tailor approval, native Blender geometry/UV, physical devices, five testers, ten deliveries, owner signoff. No deploy, live mutation, paid AI or main merge.
- **Next slice:** inspect matching-head native PostgreSQL job and Non-3D results, repair any failure without weakening assertions, audit v1 RPC reachability and physical evidence, then recheck live main ancestry and `vercel.json` deployment guard before any isolated integration.

## Follow-up — exact lock identity regression (2026-11-03)

- **Parent SHA:** `909767ce239c8838a94e6ba47e1c76ed133e5359`; **test fix SHA:** `50f190dc7058b577f9f99c465e08deae1bd778cb`.
- **Affected criterion:** T3/J1 and T6/J6 concurrency proof. Earlier lock acquisition polling accepted *any* granted advisory lock from any other PostgreSQL session. This could falsely signal readiness and cause a flaky timeout assertion when unrelated sessions held advisory locks. Polling now matches the exact single-integer advisory key `hashtext('stock-fabric:'||fabric)` using PostgreSQL `pg_locks.classid=0`, `objid=hashtext(...)::oid`, `objsubid=1` and a different backend PID.
- **Evidence:** Prior head `909767ce239c8838a94e6ba47e1c76ed133e5359` passed Full CI run `41580556051` and Non-3D run `41580556095`. These results do **not** certify the new head. New-head disposable PostgreSQL and matching-head CI remain **PENDING** until observed.
- **Blockers:** legacy v1 RPC reachability, real staging migration/rollback, real stock/tailor/customer/operator/native/device evidence all remain unverified. No main merge or deployment.
- **Next slice:** check exact-head CI for this fix; if green, audit v1 stock RPC grants and compare branch against latest main before considering a guarded isolated merge.

## Exact-head verification — 2026-11-03

- **Verified head:** `46b4d5126111d878a34508e89522f40343abdbe9` (parent of this checkpoint-only commit). Full CI run `41586696592` **SUCCESS** and Non-3D QA run `41586696575` **SUCCESS**, both explicitly reporting that exact head SHA. The test includes the disposable two-session PostgreSQL lock regression; no live database used.
- **Affected acceptance:** T3/J1 lock serialization regression and T6/J6 automated verification have matching-head green evidence at the verified head. This does not prove complete physical stock or customer/operator release readiness.
- **Safety review:** inspected migration `20261103_manual_stock_fabric_lock_parity.sql`; v2 has `revoke all ... from public,anon,authenticated` and grants only `service_role`. It still rounds quantities and truncates text; these are separate integrity gaps. A GitHub code-search attempt for the legacy v1 RPC returned no indexed matches, which is **not proof** of absence or revoked EXECUTE privileges. Its definition/grants and deployment compatibility remain unverified. Do not merge until legacy entry points and dependency safety are audited.
- **Current main observed:** `fd2f29771a24ae888719d64504a0b1fb3595ffb1`; `vercel.json` on this head has `git.deploymentEnabled=false`. No main update, deploy or migration in this run.
- **Next 30–40-minute slice:** inspect all historical stock migration RPC definitions and grants, add a disposable PostgreSQL regression asserting legacy public/anon/authenticated stock writes cannot bypass the fabric lock, then re-run exact-head CI before considering isolated integration.

## Legacy v1 write bypass retirement — 2026-11-03

- **Parent:** `ceed6051155d3f23d4b7a5c0a8971c77fae4e477`; **migration SHA:** `2a81fd8b2c7fae5496e3728b0d06262bd766077d`; **regression SHA:** `74c07ce79bf7070a2bf15982628d01fb2b40fef5`.
- **Criteria:** T3/J1 physical provenance and serialization, T5/J5 privileged write boundary, T6/J6 disposable SQL regression.
- **Historical evidence:** `20261001_fabric_stock_ledger.sql` grants `service_role` execution on legacy `fabric_stock_record(text,text,numeric,text)`; `20261028_fabric_stock_provenance.sql` introduces a separate v2 writer but does not revoke v1. Legacy v1 can write without checker/source evidence and takes the old advisory key.
- **Fix:** revoke `service_role` EXECUTE on the legacy v1 writer after v2 lock parity is installed; retain the v1 function definition for schema compatibility and leave all existing stock ledger rows untouched. Only the provenance-bearing v2 manual writer remains available to service-role callers. **Compatibility caution:** legacy server callers, if any, must migrate to v2 with real checker and physical source reference; no fabricated defaults. The full caller audit remains pending and prevents main integration.
- **Regression:** disposable PostgreSQL script now asserts effective `has_function_privilege` is false for `service_role`, `anon` and `authenticated` on v1, in addition to existing two-session v2 lock parity. **New-head CI/Non-3D PENDING**; no claim of passed tests at this commit.
- **Next:** inspect all server-side RPC call sites and current exact-head workflow outcomes; resolve any genuine compatibility dependency, then consider isolated main integration only after all matching-SHA checks and no-deploy guard verification. Real supplier stock, staging migration approval, customer/operator/tailor/device/Blender testing, five testers, ten deliveries and owner signoff remain PENDING/BLOCKED.

## Physical-evidence loss prevention — 2026-11-03

- **Parent SHA:** `8199a3cf4134c484c0b5fd31677f1d221737e2ff`; **validation SHA:** `e107e8139005256b6dd74b69a7685a80d9824c7e`; **regression SHA:** `75749008112a3528288b24089e7ff5c6ec8cf4a0`.
- **Affected criteria:** T3/J1 stock physical truth and T6/J6 disposable database regression. Manual v2 writer now rejects quantities with more than three decimal places and oversized fabric ID, note, checker and source reference before locking/writing; it no longer silently rounds or truncates accepted physical inputs. Existing valid three-decimal quantities and bounded text retain their behavior.
- **Regression:** five negative SQL cases assert specific rejection reasons and no synthetic ledger write. **Matching-head CI/Non-3D pending** at the new SHA; no local PostgreSQL test claimed.
- **Compatibility:** upstream callers submitting unsupported precision or oversized evidence will now receive explicit errors rather than silently altered records. Verify operator callers and error handling before integration. Historical legacy v1 caller audit remains open.
- **Blockers:** supplier stock, staging approval, authenticated operator/customer proof, tailor, native Blender, device/browser acceptance, five testers, ten deliveries and owner signoff remain PENDING. No main merge, live migration or deployment.
- **Next:** inspect exact-head PostgreSQL and Non-3D runs, fix any failures, then complete operator RPC compatibility audit before guarded integration.

## Matching-head CI verification — 2026-11-03

- **Verified parent/head:** `0692fa4d29510a10ee3eea114fb85bdc3783c57e`; Full CI run `41630683911` **SUCCESS**, Non-3D QA run `41630683822` **SUCCESS**, both returned for this exact commit by GitHub Actions. The disposable PostgreSQL lock parity, legacy privilege and invalid physical-evidence regressions are included in the CI source at this SHA. This confirms the automated checks, not staging or production behavior.
- **Affected criteria:** T3/J1 stock-write safety and T6/J6 disposable SQL regression have matching-head automated evidence. T5/J5 legacy operator compatibility remains **BLOCKED**: GitHub code search for `fabric_stock_record` and `fabric_stock_record_v2` returned `incomplete_results=true` and zero indexed hits, so it cannot establish absence of live or repository callers.
- **Remaining blockers:** operator RPC caller/error-handling inspection, staged migration/rollback and real stock proof, authenticated customer/operator acceptance, tailoring, physical-device/browser QA, Blender native evidence, five testers, ten deliveries and owner signoff. No merge, deployment or live mutation authorized from this evidence alone.
- **Next independent slice:** inspect actual operator API routes and RPC invocations using complete repository tree or checked-out source, add a caller-compatibility regression for v2 precision/evidence errors, then rerun matching-head checks before any isolated main intake.

## Operator route compatibility audit — 2026-11-03

- **Parent/head inspected:** `0e5a0c7494aa2aec0416ebb3b119cf9b65163520`. Exact-head GitHub Actions CI `41639319305` and Non-3D QA `41639319268` both returned `success` for this SHA; these checks predate this documentation commit.
- **Inspected source:** `src/app/api/operator/stock/route.ts` calls only `fabric_stock_record_v2`, `fabric_stock_reserve_v2`, `fabric_stock_release_v2`, `fabric_stock_consume_reservation_v2` and read-only `fabric_stock_snapshot_v2`; no legacy `fabric_stock_record` invocation in this operator endpoint. The operator mutation path returns HTTP 423 when `legacyStockWritesEnabled()` is false. Its only explicitly documented exception is the synthetic localhost HTTP fixture. `scripts/verify-operator-stock-private-http.cjs` asserts fake PostgREST RPC calls and never connects to real Supabase. The public inventory route is read-only and does not establish physical availability without verified ledger evidence.
- **Limit:** This is an inspected operator-route compatibility result, **not** a complete repository-wide or external-client caller audit. GitHub code search returned zero hits with `incomplete_results=true`; it cannot prove no other caller exists. Do not claim the legacy RPC retirement safe for all clients or merge to main based solely on this review.
- **Next acceptance slice:** inspect `legacyStockWritesEnabled` implementation and all relevant server call sites, then add an explicit regression asserting operator HTTP stock requests never call v1 and remain 423 outside the synthetic fixture. Verify CI at the new SHA, assess isolated main ancestry and no-deploy guard before any merge.
- **Pending:** real supplier stock, staged migration/rollback, authenticated owner/customer/operator acceptance, tailoring, native Blender, devices, five testers, ten deliveries and owner approval. No production deployment or live mutation.

## Operator v2 RPC contract regression — 2026-11-03

- **Parent:** `97147eb25d396b1b4f66b0f1450e4be314d5d99e`; **test commit:** `90af5ea4b5bfd10c23ec2108dca432ad13063d90`.
- **Affected gates:** T3/J1 stock integrity, T5/J5 operator boundary, T6/J6 regression. The synthetic authenticated HTTP fixture now reads the actual operator stock route and requires exactly the five approved v2 RPC call sites, rejecting any additional, duplicated, removed, or legacy RPC invocation. This complements its existing HTTP 423 write-hold and fake PostgREST assertions.
- **Source inspection:** all five route RPC invocations matched the new allowlist at the test commit. **Full CI and Non-3D QA for this new head remain unverified at checkpoint creation**; do not treat this inspection as an executed Node/HTTP test.
- **Remaining:** external legacy callers, staging migration approval, real supplier stock, customer/operator acceptance, tailor, native Blender, physical devices, five testers, ten deliveries and owner approval remain PENDING/BLOCKED. No main integration, deployment or live database mutation.
- **Next slice:** check exact-head CI and Non-3D; investigate any failure, then assess isolated main intake only after dependency/guard verification.


## Exact-head operator RPC regression verification — 2026-11-03

- **Verified parent SHA:** `228d8d8c86dd8983e5dbc25d4a569f4b0e585676`; Full CI `41657962514` **SUCCESS**, Non-3D QA `41657962553` **SUCCESS**, both returned by GitHub for the exact parent SHA. The newly added operator RPC allowlist regression is therefore included in these workflows. This documentation update requires its own matching-head check; do not attribute parent checks to the new commit.
- **Source inspection:** `src/app/api/operator/stock/route.ts` calls only v2 stock RPCs (`fabric_stock_snapshot_v2`, `fabric_stock_record_v2`, `fabric_stock_reserve_v2`, `fabric_stock_release_v2`, `fabric_stock_consume_reservation_v2`). POST returns HTTP 423 before privileged write selection unless the existing synthetic-test gate is enabled. No live authenticated HTTP test was performed in this review.
- **Repository-wide code search limitation:** GitHub code search for `fabric_stock_record` returned zero results with `incomplete_results=true`, which is not evidence of zero external callers. External RPC callers and staging compatibility remain unverified.
- **Main ancestry and deployment:** observed main `4dd8020abd83429449ff53ea5bb71b046394d86e`; GitHub compare `main...228d8d8c86dd8983e5dbc25d4a569f4b0e585676` reports **diverged**, 17 ahead and 1 behind. Live main `vercel.json` still contains `git.deploymentEnabled=false`. No direct merge of this branch is authorized without dependency-complete isolated intake and matching-head checks.
- **Acceptance:** T3/J1 concurrency and legacy permission regression; T5/J5 operator v2 allowlist; T6/J6 exact-head CI/Non-3D automated checks verified at parent SHA only. Physical supplier stock, real customer/operator acceptance, tailor, devices, native Blender, five testers, ten deliveries and owner signoff remain **PENDING/BLOCKED**.
- **Next 30–40-minute slice:** audit stock HTTP test fixture for a negative assertion that a retired v1 RPC can never be invoked by any operator action; if missing, add and run regression. Reconcile newest main and PR ancestry before an isolated guarded intake. No deploy, live migration or physical stock mutation.

## Operator RPC parser bypass regression — 2026-11-03

- **Parent:** `0a2019a232cc85ce79e7e304c6b0a1b66ea6d1d6`; **test commit:** `31e3bb860e33945094d9f80296d95b7fccfaeb37`.
- **Affected gates:** T5/J5 privileged operator RPC boundary and T6/J6 regression. The previous static allowlist recognized only typed `rpc<T>("literal")` calls. An untyped `rpc("fabric_stock_record")`, single-quoted literal, or dynamically named RPC could escape enumeration and leave the allowlist apparently unchanged.
- **Fix:** enumerate typed/untyped, single/double-quoted literal RPC calls, count all RPC call expressions independently, and fail when a dynamic/nonliteral call cannot be accounted for. Existing five-v2-only allowlist and no-duplicate checks remain enforced. Synthetic fixture only; no production stock access.
- **Verification:** parent `0a2019a232cc85ce79e7e304c6b0a1b66ea6d1d6` Full CI `41668152404` and Non-3D `41668152463` both SUCCESS. These do **not** certify the new test SHA or this checkpoint SHA. New matching-head CI/Non-3D and actual HTTP execution remain PENDING until observed.
- **Remaining blockers:** external legacy RPC clients, staged migration/rollback approval, real supplier inventory, authenticated operator/customer acceptance, tailor, Blender, physical devices, five testers, ten deliveries and owner approval. Do not merge stacked draft into main or deploy.
- **Next slice:** verify exact-head CI and built-Next synthetic HTTP suite; if green, inspect live main ancestry and isolate dependency-complete intake only with the no-deploy guard.

## CI regex syntax correction — 2026-11-03

- **Parent:** `14d8043acc2e5f3a663900d4cef4d816d08a1aaa`; **fix commit:** `67cf712398da36ccf87442fee1a8f4098baca2bd`.
- **Observed exact-head evidence at parent:** Full CI run `41678750579` **FAILURE** in build job `126067030536` at `node scripts/verify-operator-stock-private-http.cjs`: JavaScript `SyntaxError: Invalid regular expression: Unterminated group`. The newly added allowlist regex used doubled backslashes in JavaScript regex literals. Disposable PostgreSQL job passed. Non-3D QA `41678750486` **SUCCESS** at the same parent SHA.
- **Correction:** normalize escapes in the two `stockRoute.matchAll` regex literals to recognize literal `.rpc`, optional generic type, whitespace and opening parenthesis. The allowlist assertions are preserved. This is a source fix, not proof of passing built-Next HTTP verification.
- **Affected criteria:** T5/J5 operator RPC allowlist and T6/J6 CI regression. **Matching-head Full CI, Non-3D and built-Next synthetic HTTP at fix SHA remain PENDING** until GitHub results are observed. No main merge, deployment, live migration or stock mutation.
- **Next slice:** check exact-head workflow results for the checkpoint commit; if failing, inspect logs and fix. If green, reconcile current main and isolated dependency-complete intake. External clients, real inventory, staging, customer/operator acceptance, tailor, native Blender, devices, five testers, ten deliveries and owner signoff remain BLOCKED/PENDING.

## 2026-11-04 — operator RPC allowlist CI failure repair

- **Observed previous head:** `e84f75ad8d61af1c8f13ed52c5a8887b2e75ac54`; Full CI `41688230621` **FAILURE** at synthetic private stock HTTP verification; Non-3D `41688230619` **SUCCESS**. Full CI's disposable PostgreSQL stock reservation job **SUCCESS**; npm quality, tests, engine, preview-performance, release check and build all succeeded before the HTTP step.
- **Cause:** static audit scanned for `.rpc(...)` calls, but the actual operator route uses a local `await rpc<T>(...)` helper. It falsely returned zero callsites against five expected v2 names; not evidence of a real stock API failure.
- **Parent/result commits:** `e84f75ad8d61af1c8f13ed52c5a8887b2e75ac54` → `4163945a15616260be5c822874b2b12a08f8b1fa` → `4f859ccdf51f985b88d37168a9efda292c8b7418`. Corrected the audit to count and validate literal names in awaited local helper calls, including typed/untyped forms; corrected regex escaping in second commit. A small isolated Node regex fixture confirmed matching both typed example calls, **not** full repo verification.
- **Criteria:** T5/J5 privileged stock RPC source-call allowlist and T6/J6 HTTP/CI regression. **New-head Full CI/Non-3D pending**, no acceptance claimed until matching SHA green.
- **Next slice:** inspect exact-head workflows, repair any failure, then reconcile #876 with current main and the independent #879/#880/#881 security migrations and the known Supabase migration-version collisions before any intake. Real stock, staged migration approval, external caller inventory, authenticated operator/customer tests, tailor, native Blender, physical devices, five testers, ten deliveries and owner signoff remain **PENDING/BLOCKED**. No main merge, deploy or live database write.
