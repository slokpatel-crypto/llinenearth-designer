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
