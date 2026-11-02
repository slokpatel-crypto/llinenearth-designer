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
