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

**Private revocation access for the issuer:** the existing Designer Studio sharing controls now expose the separate cancellation code only to the share creator, allow explicit copying/saving it separately from the view-only public URL, and allow cancellation of the latest share in the current page. The private code is never included in the public link. In-page state is intentionally ephemeral; longer-term cancellation requires customers to keep the code safely. No model, fabric, physical-rendering, catalogue or tailoring implementations changed.

## Distributed OTP abuse control (opt-in, 2026-11-03)

Added dedicated-secret HMAC-normalized-email subjects and an atomic ten-minute/eight-request shared Postgres limiter under `LINEN_CUSTOMER_OTP_DISTRIBUTED_REQUIRED=1`. The new schema stores digests/counters only, denies client/table access, and has disposable SQL tests for 8 permitted/9th denied, window reset, subject separation and role ACL. Invalid/malformed/unavailable RPC acknowledgment must prevent OTP dispatch, returning 429 on exhaustion or 503 when unavailable. This control remains **disabled by default** until the dedicated migration/secret and staging rollout are approved. Trusted-edge IP/device budget verification is separately blocked; never trust forwarded headers as identity.

## Account-owned share management (2026-11-03)

The previously optional revocation ledger now also supports **server-verified, nullable owner IDs** for new shares. `listOwned` and `revokeOwned` on `/api/designer/share` derive identity from the signed-cookie/session verification and call service-role-only, owner-filtered SQL RPCs; user-supplied owner IDs are ignored. The account UI shows opaque share digests and expiration/revocation state only, with one-click cross-device cancellation. It never reveals the signed bearer URL or private anonymous revoke code. Anonymous shares remain key-controlled, previously minted links remain compatible and are not retroactively revocable. Synthetic SQL regressions check Bob cannot list/revoke Alice's shares and bearer/capability stays private; actual built Next HTTP adds Alice/Bob forgery/replay and backend failures.

**Still blocked:** this code is feature-gated until migrations are applied/verified in a disposable/staging backend, exact-head CI and responsive browser tests are green, and account/share flows pass actual staging proxy tests. Trusted-edge anti-OTP spraying, production operational signoff, and full application QA remain outside this owner-scoped subtask. No Vercel deployment.

## Distributed verification attempt protection (2026-11-03)

The same opt-in distributed OTP SQL limiter now has independent keyed HMAC subjects for request dispatch and **verification attempts**. Verified customer sign-in cannot brute-force codes across instances without exhausting the separate 8/10-minute budget. A ninth attempt fails 429 before reaching the OTP provider; missing/malformed/backend failures prevent verification with 503. Existing non-enforced sessions remain compatible. Both paths share the migration but not counters; new HTTP negative tests and exact-head CI verification are required. Real trusted-edge IP/device protection and a staged, configured rollout remain blockers.

## Account-switch async privacy isolation (2026-11-03)

The customer account page now uses a monotonically increasing refresh epoch to prevent late responses to previous account sessions from rendering after sign-out, a second sign-in, or a newer refresh. On customer ID change, old designs, shares, measurements, quotes, orders and outcomes are cleared before displaying new account data. In addition to a static contract regression, the built-browser security suite at 390px pauses Alice's share request, signs out, signs in Bob, then releases Alice's old response and asserts that neither her email nor share appears. This is synthetic-only browser verification; it does not certify staging cookie or proxy behavior.

Security branch feature flags for share/session revocation and OTP distributed send+verify budgets remain disabled pending real staging migration deployment, HTTPS reverse-proxy proof, trusted-edge throttling and owner acceptance. No Vercel deployment and no merge without exact-head green gates.

## Customer production RPC boundary (2026-11-03)

Production-account service-role RPCs now require JSON responses with a 4 MiB streamed limit per RPC. Account history must be a bounded array of object rows (100 quotes, 100 orders, 300 events, 100 outcomes); invalid upstream data returns private HTTP 503 without showing arbitrary contents. An outcome receipt is reported as successful only after the RPC returns a valid UUID, consistent with the existing PostgreSQL `returns uuid` contract. Pure tests and synthetic built-Next HTTP tests cover malicious/malformed responses, cross-account ownership and redaction. This does not modify operator workflows, production SQL, live records or release flags. Staging and exact-head CI are still required.

## OTP provider response limits and account binding (2026-11-03)

The customer authentication bridge no longer reads unbounded OTP provider response/error bodies. OTP confirmation accepts only JSON responses within 64 KiB and an authenticated UUID identity whose normalized returned email matches the email address submitted for that verification. No signed session cookie is issued if the upstream provider returns a different account identity. Legacy identity lookups also require JSON and a streamed limit of 16 KiB; malformed or oversized replies cannot authenticate a legacy bearer. Error bodies are not copied into exception messages or logs. Synthetic built-Next HTTP tests cover mismatch, oversized/wrong-MIME OTP replies, and denied oversized/wrong-MIME legacy replies. Existing production revocation and distributed OTP flags remain disabled until staging setup/validation, and exact-head CI is required before any merge.

## Browser account session recheck and signed-cookie downgrade (2026-11-03)

When an account session recheck fails, `/account` now hides the previously loaded owner's private designs, share inventory, production timeline and recovery-input credentials rather than continuing to show stale customer data. The page displays an explicit verification warning and a retry action. Signed sessions are recognized by cookie-name **presence**, not nonempty cookie value: empty, invalidly encoded and duplicate `le_customer_session` names are denied without attempting the temporary legacy bearer bridge. Pure/source regression and synthetic built-Next HTTP/390px Chromium checks cover failed rechecks, private UI cleanup, successful retry, and signed-cookie downgrade denial. This is code-level evidence only, not proof of external HTTPS proxy/staging behavior.

## Legacy auth header guard (2026-11-03)

The compatibility-only `le_customer_access` cookie is now rejected before provider forwarding unless it is nonempty ASCII URL-safe bearer text (max 4096 characters). This prevents oversized cookies and percent-decoded whitespace/control characters from entering the upstream Supabase `Authorization` request. Pure validation tests and synthetic built-Next HTTP tests cover overlong, whitespace and encoded newline cases and verify **zero** upstream calls. Signed-session priority, legacy bridge shutdown when revocation enforcement is enabled, and prior 16 KiB bounded provider responses remain unchanged. This is not a replacement for production signed-only sessions or distributed edge rate limiting.

## Cross-tab account identity revalidation (2026-11-03)

`/account` now performs a second authenticated session read **after** all owner-scoped vault/measurement/production/share requests and **before** publishing the returned private records. An owner ID change, failed second session fetch, malformed/failed HTTP history, or invalid required lists fails closed: all previously loaded private records, prior account identity and unfinished recovery bearers are hidden, and the user is offered a retry. This prevents an old account label from being combined with another customer's records when cookies change in another browser tab during an in-flight account refresh. Dedicated unit/source assertions and synthetic Chromium at 390px cover an Alice-to-Bob cookie-switch race and a private production 503 with no wrong-account disclosure. No live customer data involved. This remains code-level coverage, not target HTTPS/staging acceptance evidence.
