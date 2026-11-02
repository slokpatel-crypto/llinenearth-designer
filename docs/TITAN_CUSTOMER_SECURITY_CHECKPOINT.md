# TITAN customer security — isolated checkpoint (2026-11-02)

Scope: `titan-parallel-customer-security` only; customer-auth, customer-account production security boundary, identity fallback, design vault and share boundaries. Source base `5835a5533281b8306e9bfa1fd9786a30d59c8053`. No live customer records, stock, tailoring, measurements or visual rendering were touched. A new **unapplied** session-revocation migration and dedicated synthetic SQL tests were added.

## Implemented in this branch
- Customer OTP and OTP verification: same-origin/browser fetch-site validation and streamed JSON size bounds (4 KiB); malformed JSON handling and redacted upstream error logs.
- Customer sign-out: cross-origin POST rejection before clearing cookies. When revocation enforcement is enabled, the exact signed bearer is hashed and durably revoked BEFORE success or cookie clearing; backend failure returns 503 and the account UI does not falsely show signed-out success.
- Customer production account: cross-origin and 16 KiB bounded JSON guards for quote acceptance and outcome recording; upstream errors redacted. Synthetic two-account quote acceptance asserts that a forged request owner ID cannot override authenticated identity. Only literal JSON boolean `true` from the owner-scoped quote RPC is accepted; string/object/null acknowledgments fail closed.
- Customer identity: a present but invalid/expired signed session fails closed. With the revocation flag enabled every session is checked against the service-role-only denylist; missing/malformed backend checks fail closed and legacy bearer fallback is disabled. With the flag off, legacy migration behavior remains unchanged.
- Design vault: existing 1 MiB JSON cap now also performs origin, fetch metadata, MIME and declared-size preflight before rate-limit or service-role RPC.
- Shared designs: cross-origin checks, 1 MiB bounded JSON requests, all private no-store responses, redacted audit errors, strict signed token shape and a 65,536-character token ceiling.
- Design recovery: after a confirmed successful vault insert, owner-RPC failures or malformed acknowledgments do not destroy the only recovery credential; the response retains the recovery token and conservatively reports `accountOwned:false`. Account ownership is never falsely asserted. Actual owner assignment still requires a strict positive acknowledgment.
- Added pure request-boundary/tamper/expiry regressions and 5 additional synthetic actual-Next-HTTP vault rejection scenarios, asserting zero privileged RPCs on rejected requests.

## Verification evidence
- New Node unit test: `tests/customer-security-request-boundary.test.ts`.
- Extended `tests/customer-session.test.ts` and `tests/design-share.test.ts`.
- Added `tests/customer-session-revocation.test.ts`, a disposable PostgreSQL migration job with rollback/ACL checks, and a second synthetic Next instance with enforcement on, validating logout failure, replay denial, legacy-cookie downgrade prevention and upstream-failure denial. These checks require matching-head CI. Extended `scripts/verify-designer-vault-boundary-http.cjs` with actual local Next HTTP tests: five vault preflight denials, customer OTP/verification/logout, signed-cookie downgrade rejection, legacy bridge, share preflight, and two-account owner-scoped vault load/delete negatives, and recovery-key preservation under a failed/malformed/false owner-assignment RPC. All use a local fake backend, with no live records. These tests still require matching-head CI proof.
- **Not yet verified as passed at checkpoint creation.** Require matching-PR-head GitHub CI: quality, npm test, engine, preview-performance, release-check, build, synthetic HTTP, browser verification. Confirm no Vercel deploy; inspect exact branch/main diff before merge.

## Unresolved production controls (do not call production ready)
1. **True bearer revocation/replay prevention:** code, SHA-256 denylist SQL, strict RPC checks, fail-closed sign-out and opt-in flag are committed. **NOT ACTIVE** without applying the new migration and enabling `LINEN_CUSTOMER_SESSION_REVOCATION_REQUIRED=1` after staging. Until then a stolen cookie may still be reused after logout. Real backend integration/rollback and active-enforcement proof remain blocking.
2. **Share link revocation:** links expire after 30 days but are bearer URLs; revocation before expiry requires a durable server-side revocation ledger and validation at view time.
3. **OTP abuse:** in-process best-effort throttling remains insufficient for distributed deployments; trusted-edge IP enforcement and durable per-email/IP limits are required. Do not interpret forwarded headers as authenticated identity.
4. **Real environment proof:** verify same-origin policies behind actual reverse proxies, session rollback and expiry, direct cross-account owner-scoped RPCs with disposable identities, database migration state, browser login/recovery and real device widths. No live customer data may be used.
5. **Security coverage outside scope:** measurement vault, operator, stock, catalogue, rendering, tailoring and production paths have independent owners and acceptance gates; this work does not certify them.

## Merge/deploy
No branch merge without fresh main reconciliation and green exact-head checks. Never deploy Vercel from this workstream. No real-world/user acceptance gates are claimed.

## Optional share-link revocation extension (2026-11-03)

Added a separate private capability secret to revoke an issued signed design link, keyed by token/revoke-key digests in a private SQL table. Under `LINEN_DESIGN_SHARE_REVOCATION_REQUIRED=1`, issuance must register before returning the token, and public share pages must check revocation before rendering (fail closed on backend error). The new POST `{action:"revoke",token,revokeKey}` requires both credentials and cannot be authorized by the public URL alone. The default remains disabled; the SQL migration, synthetic HTTP, database permission tests, and user-facing private-key retention/staging acceptance are still required. Unregistered legacy links are not revocable retroactively but continue to expire normally.

**Share revocation proof:** updated the existing local fake backend and revocation-enabled Next.js HTTP test to cover issuance refusal on registration failure, digest-only storage, public-view success before revocation, public-holder forged-key rejection, failure on backend unavailability, successful capability revocation, 404 replay after revocation and fail-closed share view when lookup fails. Updated disposable PostgreSQL CI job to also apply and verify share-link migration and rollback; no live data touched. Both dedicated feature flags remain off until staging.
