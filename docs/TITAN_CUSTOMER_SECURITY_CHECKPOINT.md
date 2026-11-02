# TITAN customer security — isolated checkpoint (2026-11-02)

Scope: `titan-parallel-customer-security` only; customer-auth, customer-account identity fallback, design vault and share boundaries. Source base `5835a5533281b8306e9bfa1fd9786a30d59c8053`. No live customer records, migrations, stock, tailoring, measurements or visual rendering were touched.

## Implemented in this branch
- Customer OTP and OTP verification: same-origin/browser fetch-site validation and streamed JSON size bounds (4 KiB); malformed JSON handling and redacted upstream error logs.
- Customer sign-out: cross-origin POST rejection before clearing cookies.
- Customer identity: a present but invalid/expired signed session fails closed rather than falling back to a legacy access token; the legacy bridge remains only when the signed cookie is absent.
- Design vault: existing 1 MiB JSON cap now also performs origin, fetch metadata, MIME and declared-size preflight before rate-limit or service-role RPC.
- Shared designs: cross-origin checks, 1 MiB bounded JSON requests, all private no-store responses, redacted audit errors, strict signed token shape and a 65,536-character token ceiling.
- Design recovery: after a confirmed successful vault insert, owner-RPC failures or malformed acknowledgments do not destroy the only recovery credential; the response retains the recovery token and conservatively reports `accountOwned:false`. Account ownership is never falsely asserted. Actual owner assignment still requires a strict positive acknowledgment.
- Added pure request-boundary/tamper/expiry regressions and 5 additional synthetic actual-Next-HTTP vault rejection scenarios, asserting zero privileged RPCs on rejected requests.

## Verification evidence
- New Node unit test: `tests/customer-security-request-boundary.test.ts`.
- Extended `tests/customer-session.test.ts` and `tests/design-share.test.ts`.
- Extended `scripts/verify-designer-vault-boundary-http.cjs` with actual local Next HTTP tests: five vault preflight denials, customer OTP/verification/logout, signed-cookie downgrade rejection, legacy bridge, share preflight, and two-account owner-scoped vault load/delete negatives, and recovery-key preservation under a failed/malformed/false owner-assignment RPC. All use a local fake backend, with no live records. These tests still require matching-head CI proof.
- **Not yet verified as passed at checkpoint creation.** Require matching-PR-head GitHub CI: quality, npm test, engine, preview-performance, release-check, build, synthetic HTTP, browser verification. Confirm no Vercel deploy; inspect exact branch/main diff before merge.

## Unresolved production controls (do not call production ready)
1. **True bearer revocation/replay prevention:** signed customer cookies remain stateless for up to 30 days, and sign-out only removes client cookies. A stolen cookie can be reused until expiration or secret rotation. Requires a durable, per-session server revocation store and safe migration/rollout before this gate can pass.
2. **Share link revocation:** links expire after 30 days but are bearer URLs; revocation before expiry requires a durable server-side revocation ledger and validation at view time.
3. **OTP abuse:** in-process best-effort throttling remains insufficient for distributed deployments; trusted-edge IP enforcement and durable per-email/IP limits are required. Do not interpret forwarded headers as authenticated identity.
4. **Real environment proof:** verify same-origin policies behind actual reverse proxies, session rollback and expiry, direct cross-account owner-scoped RPCs with disposable identities, database migration state, browser login/recovery and real device widths. No live customer data may be used.
5. **Security coverage outside scope:** measurement vault, operator, stock, catalogue, rendering, tailoring and production paths have independent owners and acceptance gates; this work does not certify them.

## Merge/deploy
No branch merge without fresh main reconciliation and green exact-head checks. Never deploy Vercel from this workstream. No real-world/user acceptance gates are claimed.
