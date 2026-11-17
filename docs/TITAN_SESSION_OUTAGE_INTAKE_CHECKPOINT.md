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
