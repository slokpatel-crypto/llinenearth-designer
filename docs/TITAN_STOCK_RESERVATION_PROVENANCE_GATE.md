# TITAN stock reservation provenance gate — 2026-11-03

- **Exact parent main:** `b7965866b8ddf4e037e71f1c6a69af65413663dd` (post #870 Designer stock integration).
- **Scope:** J1/T3 and T5/J5 fail-closed physical stock reservation integrity; T6/J6 automated SQL regressions.
- **Defect:** `fabric_stock_reserve_v2` checks available metres but can reserve a positive legacy/unprovenanced ledger balance. Public catalogue correctly fails closed; privileged reservation SQL must independently enforce that invariant.
- **Fix:** new SOURCE-ONLY forward migration replaces only the existing v2 reservation RPC body, preserving signature, request-key binding, locks, service-role privilege and exact same-evidence retries. A NEW reservation requires positive physical metres and `fabric_stock_snapshot_v2.provenance_ready=true`. No stock rows, schema tables, production service or physical facts are mutated by this commit.
- **Regression:** disposable native PostgreSQL fixture covers positive legacy-only and mixed-provenance rejection (zero reserve writes), verified positive reservation, exact retry returning one UUID, and rollback. CI bootstrap runs the forward migration after 20261102 key binding and executes both fixtures.
- **Code verification:** matching-head Full CI, disposable PostgreSQL, Non-3D/browser, quality, tests, engine, preview performance, release check and build **PENDING** until GitHub finishes. No test is claimed green in advance.
- **Human/physical gates:** real supplier inventory, staged migration approval/restore, authenticated operator/customer acceptance, tailor checks, Blender geometry, devices, five testers, ten deliveries and owner signoff **PENDING/BLOCKED**. No production deployment, live migration, stock writes or paid AI.
- **Next bounded slice:** inspect exact-head CI and native SQL result; fix failures on the same draft; after all-green compare current main ancestry, guard `vercel.json` deploymentEnabled=false and consider only dependency-complete isolated intake.

## 2026-11-03 — committed engineering slice

- **Exact parent:** main `b7965866b8ddf4e037e71f1c6a69af65413663dd`; **code/workflow commit:** `8ffd3454e017319b939cc22df89f5ce6ac15b173`; draft PR #872, five-file dependency-complete diff, no unrelated backlog.
- **Criteria:** J1/T3 reservation source-of-truth and T5/J5 privilege integrity; J6/T6 disposable native regression coverage. This does not certify any full launch gate.
- **Evidence status:** static source diff inspected; GitHub Full CI and Non-3D exact-head runs have not yet been reported. Native PostgreSQL result, browser QA, full tests, build and release checks remain **PENDING**. No claim of pass.
- **Next action:** inspect fresh PR #872 exact-head workflow jobs, repair failures, then compare newest main and no-deploy guard before any possible isolated integration. Keep staging migration and physical approvals blocked.

## 2026-11-03 — #872 verified main integration; identity-length follow-up

- **Exact parent:** main `b7965866b8ddf4e037e71f1c6a69af65413663dd`; **source PR #872 SHA:** `92d39e3e9a923af1c3a8d974f4b6506c6c37220a`; **merged main SHA:** `4309ce97660067ba949fc3f215d0b1dfbf2243e6`.
- **Matching-head evidence:** Full CI #41532082362 PASS (quality, tests, engine, preview, release, build, browser, disposable PostgreSQL); Non-3D #41532082623 PASS (Studio original model, responsive browser). Exactly five source files. Main `vercel.json` `git.deploymentEnabled=false` verified immediately before merge. Post-merge main CI remains PENDING.
- **T3/J1, T5/J5, T6/J6 next slice:** overlong request keys, fabric/revision IDs and checker/evidence strings were silently truncated by `left(trim(...))`, allowing distinct input to replay an existing reservation. New forward source-only SQL rejects all five overlong values before key lookup; native disposable fixture tests five aliases, valid maximum lengths and exact retries. New exact-head CI and Non-3D remain PENDING; no claim of acceptance.
- **BLOCKED/PENDING:** real supplier ledger, approved staging migration/restore, owner/operator acceptance, tailor, native Blender, devices, five beta tests, ten genuine deliveries and security/privacy/owner signoff. No live migration, production deployment, stock mutation or paid AI.
- **Next:** verify follow-up exact-head CI including disposable PostgreSQL, fix failures on same branch, compare latest main and no-deploy guard before considering isolated integration.

## 2026-11-03 — #873 verified integration and stock close evidence integrity slice

- **Exact parent:** main `4309ce97660067ba949fc3f215d0b1dfbf2243e6`; **source PR #873 SHA:** `bf316c07bb9d1280ba8cc5b1d9e559caccb603cf`; **merged main SHA:** `05c180c215929df6f487a1d3a758cce7df75fa58`.
- **Exact-head evidence for #873:** Full CI #41540396867 SUCCESS, including disposable PostgreSQL and browser; Non-3D #41540396795 SUCCESS. Five-file isolated main diff and `vercel.json` `git.deploymentEnabled=false` confirmed before merge. Post-merge main CI **PENDING** (commit-run lookup returned no push runs).
- **New bounded T3/J1, T5/J5, T6/J6 engineering slice:** existing `fabric_stock_release_v2` and `fabric_stock_consume_reservation_v2` silently truncated overlong named checker and physical source references; consume also rounded non-three-decimal actual usage. New source-only forward SQL rejects lossy evidence and unrepresentable usage, preserves both existing signatures/locks/privileges, and adds rollback-only disposable PostgreSQL fixture for four overlong aliases, invalid precision, valid maximum-length release/consume, idempotent close and exact evidence. CI loads migration and fixture. **All new matching-head CI/browser/native results PENDING** until completed; no assertion of production acceptance.
- **BLOCKED/PENDING:** verified real supplier inventory, approved staging migration/restore, authenticated customer/operator acceptance, tailor, Blender geometry, physical devices, five testers, ten genuine deliveries and owner approval. No live migrations, physical stock writes, deployment or paid AI.
- **Next:** verify new draft exact-head CI and disposable PostgreSQL fixture; repair failures on same branch; only consider isolated main integration after exact-head all-green, latest-main ancestry and deployment guard review. Then audit manual stock record locking and physical provenance, without inventing stock.

## 2026-11-03 — #874 exact-head CI repair (invalid usage SQLSTATE)

- **Exact parent:** draft #874 `25b50a1e8aab2458c7670977662dd03e8ebd3397`; **SQL repair commit:** `966c09df69373fbb09f35686e698c5114e8c3431`. Source branch: `titan-stock-close-evidence-integrity-20261103`; main remained `05c180c215929df6f487a1d3a758cce7df75fa58` at repair start.
- **Observed failure:** Full CI #41548932115 at original head FAILED only the disposable PostgreSQL job, while build PASS and Non-3D #41548932121 SUCCESS. Native SQL fixture expected SQLSTATE `22023` for rejected 1.0004-metre usage, but the new function raised default `P0001` instead; no evidence that the intended invalid precision was accepted.
- **Fix and regression:** the existing invalid-usage guard now explicitly raises SQLSTATE `22023`, matching the already committed rollback-only fixture. All four overlong-evidence tests and valid maximum-length/close cases remain intact. No live database touched. Matching-head full CI/native SQL/browser and Non-3D on the updated head remain **PENDING** until observed; do not merge yet.
- **Affected criteria:** T3/J1 stock truth and T5/J5 operator evidence integrity; T6/J6 native PostgreSQL regression. Human stock, staging/restore, authenticated acceptance, tailor, Blender, devices, five testers, ten deliveries and owner approval **PENDING/BLOCKED**.
- **Next 30–40-minute slice:** inspect exact-head CI at the updated checkpoint commit, repair any remaining native fixture failure without weakening assertions, then recheck live main, isolated diff and `vercel.json` no-deploy guard before considering verified integration.

## 2026-11-03 — #874 exact-head verified and isolated main integration

- **Parent main:** `05c180c215929df6f487a1d3a758cce7df75fa58`; **verified PR #874 head:** `a60b5b2ce77895936ac8d0537e4cfaaa8a51b2c8`; **merge result main:** `fd2f29771a24ae888719d64504a0b1fb3595ffb1`.
- **T3/J1, T5/J5, T6/J6 evidence:** Full CI #41556105022 SUCCESS (build and disposable PostgreSQL reservation invariants); Non-3D QA #41556104961 SUCCESS (studio). Both associated with exact source SHA. Five-file diff compared to main, branch head identical to tested SHA, main ancestry fast-forward-compatible, and main `vercel.json` `git.deploymentEnabled=false` confirmed before merge. PR #874 marked ready and merged with expected-head guard. Post-merge main CI not yet verified; no complete launch gate certified.
- **Still PENDING/BLOCKED:** real supplier stock, approved staging migration/restore, authenticated customer/operator acceptance, tailor signoff, native Blender geometry/UV, physical-device QA, five beta testers, ten deliveries and owner approval. No production deployment, live migration, stock writes or paid AI.
- **Next bounded slice:** verify post-merge main CI and investigate manual stock record concurrency/provenance with rollback-only disposable PostgreSQL regression; preserve no-deploy guard and isolate any change.
