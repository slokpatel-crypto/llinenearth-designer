# TITAN browser CI runner compatibility checkpoint — 2026-11-11

Status: DRAFT / EXACT-HEAD CI PENDING / RELEASE BLOCKED.

- Parent: PR #978 `79a38f327ede333b89e301742ca3ce1605c7346c`; source workflows Full CI `43041755525` and Non-3D `43041755715` failed in Playwright `install --with-deps chromium`, due to `Temporary failure resolving` Ubuntu archive/security DNS. Their disposable PostgreSQL stock reservation job passed.
- Result commits: `173d66157a1b8e352a8ce2ec6a594fd728f98c22` (Full CI runner) -> `fd6811a8bd7a55e15affa0e3ef874c2f3bcb60c1` (Non-3D runner). Both workflows now pin `ubuntu-24.04` rather than moving `ubuntu-latest`; browser dependency installation and all verification steps remain required and unchanged. This avoids unexpected runner-image release drift, but does **not** guarantee DNS availability.
- Affected acceptance: T1/J4 technical browser evidence and release verification. No tests were weakened or skipped. Matching-head CI, browser pixel tests, security/release checks and native gates: **PENDING** for this new branch; source successes do not certify it.
- Primary Style Director PR #868 had advanced to `0dc69b42f591ff9aa980cdb5bdf546910d60a69d` when inspected; do not overwrite it. This branch is stacked on PR #978, not merged into primary.
- Historical `docs/TITAN_RELEASE_CHECKLIST.md`, `docs/TITAN_RELEASE_CHECKPOINT.md` and `TODO.md` are absent from this branch; the historical release stack is not current launch approval.
- Remaining physical/operational blockers: verified real stock, authenticated customer/operator acceptance, tailor fit and delivery evidence, real-device QA, native Blender/UV, staging migration proof and owner approval all PENDING/BLOCKED.
- Next: inspect exact-head Full CI and Non-3D results. If apt DNS fails on pinned Ubuntu 24.04 too, capture failure and investigate network-specific runner/apt strategy; do not bypass Playwright. Reconcile newer primary only after verified compatibility. No main merge, Vercel deployment, live migration, paid AI or live stock changes.
