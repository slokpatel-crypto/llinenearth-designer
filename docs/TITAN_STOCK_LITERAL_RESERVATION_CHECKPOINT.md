# TITAN stock closure — literal reservation identity checkpoint

## 2026-11-02 UTC — T5/J5 stock-operation input integrity, T6/J6 regression

- **Exact parent main:** `a682e106e2d955d02485fc476a47d6d6fe87f873`. Intake branch `titan-stock-literal-reservation-id-20261102-1720` is based directly on that main commit, not the unverified stacked stock-v3 migration branch.
- **Existing independent work preserved:** PR #802 already merged a strict UUID version/variant/shape check into main; draft PR #799 overlaps it and must **not** be merged or ported wholesale because it would weaken main's stricter check. This intake retains main's strict regex and its regression tests.
- **New defect:** release/consume used `String(source.reservationId||"")`, accepting a JSON one-element array holding a valid UUID as though it were a literal reservation ID. That permits malformed payloads to pass input validation and reach privileged stock RPCs.
- **Implementation:** require a literal string for both closure paths, preserving existing whitespace trimming and canonical UUID version/variant check. Add pure normalization regressions and built-Next signed-cookie HTTP cases for malformed and JSON-coerced IDs; every rejected request must return private HTTP 409 with zero stock RPC calls.
- **Files:** `src/lib/designer/stock-ledger.ts`, `tests/stock-ledger.test.ts`, `scripts/verify-operator-stock-private-http.cjs`, this checkpoint. No migrations, supplier facts, production writes, paid AI or changes to original model.
- **Verification status at commit creation:** exact-result SHA and Full CI / Non-3D workflow runs **PENDING** until created and checked. Prior green #799 checks apply only to its different head, not this intake.
- **Launch gates:** real supplier rolls/stock, controlled v3 staging/restore, authenticated owner/customer/operator flow, tailor, Blender source geometry/UV, real devices, five beta testers, ten deliveries, privacy/security and owner approval remain BLOCKED/PENDING. No complete T1–T6 or J1–J6 acceptance gate is certified.
- **Next slice:** inspect exact-head Full CI and Non-3D QA, repair failures; then compare the new main SHA, isolated four-file diff and Vercel `git.deploymentEnabled=false` before considering an exact-SHA guarded merge. Do not deploy or migrate live data.
