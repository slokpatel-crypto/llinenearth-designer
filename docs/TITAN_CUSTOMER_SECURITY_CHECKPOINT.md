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


## 2026-11-18 — Browser saved-design corrupt-entry recovery

Parent verified branch head: `476c059754c4f9457321a923622eb9d748feebcb`; matching-head CI `44254771591` and Non-3D `44254771634` succeeded **before** this change. Source commit `115571e27f0ef44f01cd46e562857bd28e533b72`; regression commit `1f5bc31896b6a01c09cdd4216733271d16ca9f6a`. Criterion: a null/partial entry in a legacy browser saved-design array must not throw during a subsequent save or discard other valid versioned designs. The regression seeds malformed entries alongside one valid saved design, saves another, and asserts both valid IDs survive. New-head CI/test execution **not yet confirmed** at checkpoint write; do not claim pass. No live database/stock changes, deploy, paid AI, or main merge. Blocker: ordinary saved designs remain browser-local, without authenticated owner-scoped cross-device recovery. Next slice: authenticated server persistence with two-account denial and second-device recovery; keep physical, device, tailor and security approval gates PENDING.

## 2026-11-18 — Incomplete legacy saved-design payload isolation

Parent `14d247c7b48025d0b82117cbbae578589b5f6f7c` had matching-head CI `44262391703` and Non-3D `44262391725` successful. Source commit `075b430fd3a06470c301d0523ade3500e8f0b56d`; regression commit `33df34034f0fe786924330eae95fa0418721f2fd`. Acceptance criterion: null/missing brief or renderSet, array-shaped version, empty version ID and missing title in browser legacy records are ignored without discarding valid records or blocking a subsequent save. Existing legacy recipes with object-shaped brief/renderSet and version IDs remain supported. New-head test/CI NOT YET VERIFIED at checkpoint commit; do not infer success from previous-head runs. No live backend, stock, deployment or main mutation. Blocking release gate: ordinary saved designs remain browser-local without authenticated owner-scoped persistence, cross-account denial or second-device recovery. Next slice: implement authenticated server-backed saved-design CRUD with two-owner negative and second-device recovery tests on a compatible draft; physical/tailor/device/security approvals remain pending.

## 2026-11-18 — Exact-head verification of legacy saved-design payload isolation

Verified parent `4514b24b973a52cb7f875f2aa4bf993d93c7d495` on draft PR #863: matching-head CI run `44270466923` **success** and Deep Engine Non-3D QA run `44270467158` **success**, both completed. This confirms the prior `075b430f` source change and `33df3403` regression are included in passing workflow runs at this exact head; it does not establish live customer or physical acceptance. Acceptance criterion: malformed legacy browser saved-design payloads cannot block retention of valid versioned records during saves. Blocking next milestone: implement authenticated owner-scoped ordinary saved-design persistence and explicit two-account denial plus second-browser recovery; do not silently import shared localStorage as an authenticated owner's designs. No deployment, main merge, live database change, paid AI, or stock mutation. Human security review, supplier/stock, tailor, device, native-model and customer pilot evidence remain PENDING.

## 2026-11-18 — Matching-head CI for saved-design recovery checkpoint

Verified parent `dc203a64ff1a34062b64295ee225be6300a9dd4d` (draft PR #863) with GitHub Actions CI run `44280106910` **completed/success** and Deep Engine Non-3D QA run `44280106903` **completed/success**, both associated with that exact SHA. This confirms committed legacy saved-design malformed-record regression coverage in matching-head workflows; no new application behavior is claimed. The branch was confirmed identical to that parent before this checkpoint append. Release checklist/checkpoint and TODO.md are absent on this branch; do not silently treat their gates as passed. Next independent acceptance slice: authenticated owner-scoped server persistence for ordinary saved designs, explicit two-user read/write/delete denials and second-device recovery without auto-importing browser-wide localStorage. This requires a compatible server contract and disposable backend tests; existing authenticated vault of locked revisions does not fulfill this contract. Human security review, supplier stock and fabric measurements, tailor signoff, device/browser pilots, native model and customer acceptance remain PENDING. No live migration, main merge, deployment, paid AI or stock mutation.


## 2026-11-18 — Unreadable saved-design store preservation (pending exact-head CI)
- Parent before slice: `8ce8c47d02a341689feff19233006b58c6563ffd`; source fix `ad1a71724ac2324f8eaa8fd19ccc7c5852653a0d`; regression commit `7eedf07c64b78faf98cb262eacce63bd73069eb5`.
- Acceptance slice: an invalid JSON, non-array or null legacy saved-design payload must not be silently overwritten by a new save. `saveDesign` now throws without modifying the original localStorage bytes; a new regression covers three malformed payloads. This is a data-preservation safeguard, **not** authenticated persistence.
- Evidence: source and regression committed; GitHub commit-workflow lookup for `7eedf07c64b78faf98cb262eacce63bd73069eb5` returned no PR-triggered workflow runs at time of checkpoint. No local npm quality/test/engine/performance/release/build or browser QA was run in this session. All remain UNVERIFIED at this head.
- Blockers: ordinary designs still use browser-wide localStorage, with no owner-scoped server CRUD or second-device recovery; staging/customer identities and independent security acceptance pending. Physical stock, fabric, tailor, device and native model approvals remain pending.
- Next bounded slice: build and test authenticated ordinary saved-design CRUD on the existing owner-scoped backend, with two-account negative tests and second-browser recovery; use disposable backend only. Do not merge to main or deploy without matching-head full gates.

## 2026-11-18 — Legacy saved-design delete preservation (pending exact-head verification)
- Parent SHA: `4c7a06e991c583e324dba9405ad1b227103035fc` (matching-head CI #44351525753 and Non-3D #44351525726 both succeeded before this change).
- Code SHA: `51156c86c3ef8b7ab2a74bf7851cf87453e5fa68`; regression SHA: `33563e8b2d0add1d2b40cff6f98688db566d8279`.
- Criterion: removing one browser-saved design must not discard unrelated recoverable legacy records or overwrite unreadable/unsupported legacy stores. Added tests for malformed JSON, non-array payload, unknown entries, exact deletion, and absent-ID no-op.
- Verification: code and test committed; **no local test or matching-head CI result yet** for regression SHA. Keep criterion PENDING until CI and suitable runtime tests pass.
- Scope: browser-only backwards compatibility. Does NOT establish authenticated owner isolation, server persistence, or second-device recovery.
- Next slice: authenticated server-backed ordinary saved-design CRUD with two-account isolation and second-browser recovery using a disposable database. Physical stock/fabric, tailoring, devices, customers, native model and independent security gates remain PENDING/BLOCKED. No main merge, live migration, deployment or paid AI.


## 2026-11-19 — Exact-head verification of saved-design collision regression

- Verified parent/source head: `e67cb00896759dcdd460515eabe1695ce3a70fde` on draft PR #863, identical to live branch before this checkpoint append.
- Matching-head GitHub Actions: CI run `44405766486` **completed/success** and Deep Engine — Non-3D QA run `44405766579` **completed/success**, both returned by commit workflow lookup for the exact parent SHA. This verifies the previously committed `e435cf410bd34ca7e9c1d559ebe88603f30f6c67` regression-fixture correction and `cba7a1f7` deletion protection through the workflows; it is not live/staging browser evidence.
- Criterion: recognized saved-design deletion must not delete an unknown future-format entry with the same ID; regression now uses a complete valid legacy design fixture. No application source change in this checkpoint.
- Remaining engineering gate: ordinary saved designs are still browser-wide localStorage. Build authenticated owner-scoped durable CRUD with two-owner denial and second-device recovery on a disposable backend; never auto-claim anonymous browser drafts as owner data. Do not duplicate migration/stock, 3D or Style Director workers.
- Human/physical gates PENDING: actual stock/fabric evidence, tailor signoff, customer/operator and mobile-device pilots, native geometry and independent security review. No live database mutation, main merge, deployment or paid AI. Matching-head CI for this documentation-only checkpoint commit remains PENDING.

## 2026-11-19 — account OTP network-failure recovery
- Parent: `2934d6dda5dc9abb1e92f60bb70ab9b8d7e0b002`; application result: `b5817ba723eb87fb43fab43ba2cab607b295976e`.
- Criterion: customer authentication usability/failure recovery. `src/app/account/page.tsx` now catches rejected OTP send/verify requests and malformed/non-JSON responses, shows retry feedback and always releases the busy state; failed verification does not claim sign-in.
- Verification: source-level change only; local quality/tests/build/browser QA not run in this connector execution. Exact-head CI and Non-3D QA for the application SHA are pending; do not claim acceptance until green. Previous head `2934d6d` had matching-head CI #44415452445 and Non-3D #44415452541 successful.
- Remaining: add actual browser/HTTP regression for rejected fetch and invalid JSON; authenticated durable ordinary saved-design CRUD with cross-account denial and second-browser recovery; disposable DB and physical/human gates pending. No production deploy, live migration, main merge or paid AI.


## 2026-11-19 — Secure-copy claim network recovery (pending exact-head CI)
- Parent: `d865ff79e5f054d18541ee4ec451adb9a843c5fd` (matching-head CI #44440139741 and Non-3D #44440139680 completed/success before this change). Source fix: `e00557cff9d561eaeb670446a39e2698d17cc5c7`; regression: `4c71c9db99fa07be1cdcdb88472e1cc31c06f3a9`.
- Criterion: failed network or malformed JSON responses during authenticated design/measurement recovery claims must show retry feedback, release the busy state and retain the bearer for retry. Added a source-level regression checking both failure handling and success-only bearer clearing. This is not a browser or backend integration test.
- Verification: committed code and regression; local npm quality/full tests/engine/performance/release/build/browser QA NOT RUN. Matching-head workflow result for regression SHA and this checkpoint SHA PENDING. No claim of complete release acceptance.
- Blocker/next slice: authenticated owner-scoped ordinary saved-design durable CRUD, cross-account negative tests and second-device recovery against a disposable database. Stock/fabric, tailor, native-model, customer/device and independent security evidence remain PENDING. No main merge, live database mutation, deployment, paid AI or stock changes.


## 2026-11-19 — Strict recovery claim acknowledgement

Parent SHA `e299e3da925e5e789287ca9b3f2b2dfcd6d340e6` had matching-head CI `44447786159` and Non-3D `44447786182` successful. Application SHA `643090b2a03ef4d069ddad3c75cecb15e30c8205`; regression SHA `1d343e35c44657b8b8ecabf9f0a0f19b0027c767`. Criterion: the account's recovery-claim UI must only clear its bearer token and announce success when the backend acknowledges with literal JSON boolean `claimed:true`; truthy strings/objects are rejected, and failure preserves the token for retry. Added a source-contract regression to `tests/customer-security-request-boundary.test.ts`. New-head CI and local test execution were not confirmed at checkpoint time; do not claim green. No main merge, deployment, paid AI, or live database change. Blockers: authenticated ordinary saved-design persistence, disposable two-account/second-browser proof, physical stock/fabric/tailor/device and independent security approval. Next slice: durable authenticated saved-design CRUD with owner isolation and recovery, on a compatible branch with synthetic database tests.

## 2026-11-19 — Strict account action acknowledgments (pending matching-head CI)

- Parent: `0e12b3b8a35cfa60faa3d18cb7f473e735dc79e3` (matching-head CI #44456244743 and Non-3D #44456244696 completed/success).
- Application result: `adff1f466f82c9f9ca2819ce29e13f0d4cacf1f7`; regression result: `3435a55301063cdb15fdec7106768928d47c6a28`.
- Acceptance slice: account UI must only report secure-copy deletion or production quote acceptance after an exact JSON boolean `deleted:true` / `accepted:true` acknowledgment. Previously truthy strings or objects could trigger a false success message. The APIs already return strict booleans; this change hardens the UI boundary and adds source-contract regression assertions.
- Evidence: GitHub file commits above; no local npm quality, full tests, engine, performance, release check, build or browser QA executed. Matching-head CI/Non-3D for new code and checkpoint are PENDING, not green. No backend/staging acceptance claimed.
- Remaining release blockers: authenticated ordinary saved-design CRUD and disposable two-account/second-device isolation; stock/fabric measurements, tailoring, customer/operator device pilots, native geometry, independent security review. No main merge, live migration, production deploy, paid AI or stock change.
- Next bounded slice: test authenticated owner-scoped ordinary saved-design CRUD with two-account denial and second-device recovery using a disposable backend, without auto-importing anonymous localStorage.

## 2026-11-19 — Exact-head CI verification for strict account acknowledgments

- Verified parent/head `775519427cbfd6cfc361442b1eedf1e7be58ee81` on draft PR #863; GitHub Actions CI run #44461391995 and Deep Engine Non-3D QA run #44461392024 both completed successfully for this head.
- This verifies the previously committed strict `deleted:true` and `accepted:true` UI acknowledgment regressions through those workflows. It does not establish disposable-database, cross-account, second-browser, physical or independent security acceptance. Local npm and interactive browser tests were not run in this session.
- Next acceptance-driven engineering slice: implement and test authenticated owner-scoped ordinary saved-design persistence against a disposable database; keep anonymous browser records separate, with explicit migration/consent and two-account negative tests. No main intake without dependency-complete isolated diff and matching-head verification.


## 2026-11-19 — OTP UI acknowledgment hardening (pending matching-head verification)
- Parent SHA: `dffce2e702e58012557c1abd3d613467aa389a1b` (Full CI 44468267104 and Non-3D QA 44468267057 succeeded on this parent).
- Application commit: `d92b1c8e4b5bbabb9c96535a0ead1a464aeff2c9`; regression commit: `06b4e34282db9ee5cb3ba512966d3a34b15f76f3`.
- Criterion: OTP send and verify must not claim success on HTTP 200 with malformed, false or missing `ok:true`; verify also requires a customer ID. The server endpoints return `{ok:true}` and `{ok:true,customer}` respectively. Regression `tests/customer-auth-ui-ack.test.ts` pins the UI/server contract.
- Verification: code and test committed; local tests, build, browser QA and matching-head CI **not yet executed/confirmed** for these commits. No physical/customer acceptance is claimed.
- Blockers: authenticated server-backed ordinary saved-design CRUD, two-account isolation and second-browser recovery against a disposable database; physical fabric/stock/tailor/device/native/security evidence still pending.
- Next 30–40-minute slice: reconcile the existing owner-scoped vault and browser saved-design paths; implement one durable saved-design write/read contract and negative cross-account regression without live migrations.

## 2026-11-19 — malformed successful session payload (isolated customer account slice)

- Parent branch SHA: `3a214256e4fb108e1f648c3662f86e2ffcec615d`; application commit: `69f35cd2c03c7da0048d202c9eebc54d86860a39`; regression commit: `bbaea1fba6cac56adaf93f8e5de3969fa97bdd7e`.
- Criterion: a session endpoint that returns HTTP 200 with JSON `null`, an array, or a primitive must not throw while dereferencing `.customer`, leave stale account data, or claim a valid customer session. Invalid payloads are marked unavailable and the account fails closed.
- Evidence: source-level regression appended to `tests/customer-security-request-boundary.test.ts` consistent with existing account UI contract tests. **Not executed locally**; matching-head Full CI, Non-3D/browser QA, build, security and disposable DB checks **not yet confirmed** at regression SHA. Previous head `3a214256` had reported successful matching-head CI/Non-3D; that is not evidence for this change.
- Blockers: owner-scoped durable ordinary saved-design persistence, disposable two-account/second-browser recovery, staging security proof and physical stock/fabric/tailor/device/native evidence. No human approval claimed.
- Next 30–40-minute slice: add durable saved-design read/write integration using existing authenticated vault contracts, with two-identity negative tests and browser recovery. No live migrations or production deployment.
