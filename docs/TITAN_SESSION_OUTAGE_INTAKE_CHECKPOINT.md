# TITAN isolated customer-session outage intake — 2026-11-17

- Scope: single customer-session HTTP outage contract from existing security PR #863, not the security branch's broader migrations or unrelated features.
- Source: PR #863 head `714e06876147536af1b4696609690774f989e288`; existing main route previously caught backend exceptions and returned HTTP 200 with `customer:null`.
- Parent: live main used to create `work/titan-session-503-isolated-intake-20261117`; branch implementation commit `2c02deb5a73d765dcd1dc9819fa37a40af08c947`; source-level regression commit `25bbd61c45c014e24b91a787b9f58f4b38c5772b`.
- Criterion: distinguish authenticated-session infrastructure failure (503, no-store, redacted logs) from normal signed-out state (200, customer:null), without leaking cookies or upstream errors.
- Test evidence: source-contract regression added but not executed locally. Full CI, built-Next HTTP, browser QA and matching-head security/release verification PENDING. This is not yet approved for main.
- No database migration, stock, deployment, model asset, paid AI or physical evidence changes.
- Next: run exact-head CI, built-Next HTTP negative tests for throwing identity provider vs ordinary unauthenticated session; confirm no-deploy guard on live main and review only two code/test files before any guarded merge.
- Owner/physical acceptance gates remain PENDING/BLOCKED. Historical release checklist/checkpoint/TODO were absent from inspected security branch; do not infer their approval.

## 2026-11-17 — upstream HTTP 5xx correction
- Parent head: `b4de625974e39ef072ed9ced66224f7792b9d622`; implementation `c33d460c2189d67b60c5e54d7d6d21af4282ada6`; regression `1e425e9db6680d4c97119cc574e7f0aa79712715`.
- Newly identified defect: `getCustomerIdentity` returned null for **every** non-2xx Supabase `/auth/v1/user` response. An HTTP 503 response (as distinct from a thrown network error) therefore still masqueraded as signed-out despite the earlier route correction.
- Criterion: 5xx upstream identity responses now throw a redacted generic error, allowing session route to respond 503; 4xx expired/invalid tokens continue to return null. Existing signed durable sessions and the fixed model remain unchanged.
- Evidence before this correction: prior exact head `b4de625974e39ef072ed9ced66224f7792b9d622` passed CI run 44034582129 and Non-3D run 44034582094; these DO NOT certify this new head. New source-contract regression committed but not executed locally; matching-head full CI, built HTTP 5xx/4xx integration, release/security checks and disposable DB verification PENDING.
- Next slice: verify matching-head CI, exercise real built Next endpoint with mocked 503 and 401 identity responses and inspect no-cache/error redaction; do not merge before these checks and exact-main no-deploy guard review.
- Physical stock, measured fabric, tailor signoff, customer/device evidence and production release remain PENDING/BLOCKED.

## 2026-11-17 — exact-head CI and isolated intake verification
- Verified parent/result head before this checkpoint: main `4dd8020abd83429449ff53ea5bb71b046394d86e` → PR #988 `4cdafcde07a49105d14757982b8d3aef8367f5d0`. Comparison: 6 commits ahead, 0 behind; four changed files limited to the session route, customer-auth provider bridge, source-contract test and this checkpoint. GitHub reports PR mergeable; that alone is not approval.
- Matching-head GitHub Actions: Full CI run [44042191318](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44042191318) SUCCESS (quality, npm test, engine, preview-performance, release:check, build, synthetic private HTTP, browser QA and disposable PostgreSQL invariants); Non-3D run [44042191401](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44042191401) SUCCESS. These workflows were associated with `4cdafcde07a49105d14757982b8d3aef8367f5d0`; this checkpoint-only commit will require its own matching-head status before any merge.
- Verified branch `vercel.json` contains `git.deploymentEnabled=false`; verify live main again immediately before any integration. No standalone built-Next HTTP test with mocked provider 503/401 has been demonstrated, and no independent security review approval is recorded. Therefore main intake remains BLOCKED, despite green general CI.
- Next exact acceptance slice: implement and run an executable HTTP-level regression against the built Next session route with controlled 503/401 provider responses, asserting status, cache headers, redaction and ordinary signed-out behavior. Then rerun matching-head CI and review isolated dependency ancestry before guarded main merge.
- No physical supplier/stock, tailor, customer/device, native 3D or production approval evidence supplied; those gates remain PENDING/BLOCKED. No live migration, stock mutation, paid AI, main merge or deployment performed.

## 2026-11-17 — executable route-handler regression
- Parent: `490a605ef68e1b6a5ac3fd09ecbbd54f4de8fd61`; behavior-test commit: `c06ea3d5497d352f94f566f2fccfe19ac512f6d1`.
- Criterion: exercise the actual transpiled session GET handler with injected identity results: thrown infrastructure outage must return 503 with redacted logs/no-store; signed-out null must return 200; valid identity must remain 200.
- Added `tests/customer-session-route-behavior.test.ts`. This is a handler-level regression, **not** a built-Next HTTP or browser test. Local execution NOT RUN; exact-head CI PENDING. Previous head `490a605ef68e1b6a5ac3fd09ecbbd54f4de8fd61` had successful CI #44050698109 and Non-3D #44050698389, which do not certify this new head.
- No migrations, deployment, live stock, paid AI, or physical evidence change. Main integration blocked pending new matching-head checks, independent review and required built-Next HTTP evidence.
- Next: inspect CI for this new head; repair test if needed, run built-Next HTTP negative test and security review, confirm main `vercel.json` no-deploy guard before any isolated intake.
