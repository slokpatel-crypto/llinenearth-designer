# TITAN isolated customer-session outage intake — 2026-11-17

- Scope: single customer-session HTTP outage contract from existing security PR #863, not the security branch's broader migrations or unrelated features.
- Source: PR #863 head `714e06876147536af1b4696609690774f989e288`; existing main route previously caught backend exceptions and returned HTTP 200 with `customer:null`.
- Parent: live main used to create `work/titan-session-503-isolated-intake-20261117`; branch implementation commit `2c02deb5a73d765dcd1dc9819fa37a40af08c947`; source-level regression commit `25bbd61c45c014e24b91a787b9f58f4b38c5772b`.
- Criterion: distinguish authenticated-session infrastructure failure (503, no-store, redacted logs) from normal signed-out state (200, customer:null), without leaking cookies or upstream errors.
- Test evidence: source-contract regression added but not executed locally. Full CI, built-Next HTTP, browser QA and matching-head security/release verification PENDING. This is not yet approved for main.
- No database migration, stock, deployment, model asset, paid AI or physical evidence changes.
- Next: run exact-head CI, built-Next HTTP negative tests for throwing identity provider vs ordinary unauthenticated session; confirm no-deploy guard on live main and review only two code/test files before any guarded merge.
- Owner/physical acceptance gates remain PENDING/BLOCKED. Historical release checklist/checkpoint/TODO were absent from inspected security branch; do not infer their approval.
