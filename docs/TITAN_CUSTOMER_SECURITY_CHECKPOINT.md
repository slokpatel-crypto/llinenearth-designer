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


### 2026-11-19 — explicit sign-out acknowledgment (pending matching-head CI)
- Parent `ac56e2cc67a71856eef98adf42f07af4b0c58a51`; application commit `e80ea77293ed59880eb010d46758077c65cce9b3`; regression commit `569a18e065c2c287fabe5eda97221ffb2ead99de`.
- Criterion: HTTP 200 without literal `{ok:true}` must not clear the customer account UI, credentials, or private account state. Malformed JSON, `null`, string/number/object success values fail closed. Added source-level regression in `tests/customer-security-request-boundary.test.ts`; behavioral browser verification remains pending.
- Baseline `ac56e2cc67a71856eef98adf42f07af4b0c58a51`: GitHub Actions CI #44500930554 and Deep Engine Non-3D QA #44500930526 reported success for that exact SHA. These are NOT evidence for the new commits.
- New commit tests, full quality/build, browser QA and matching-head CI: NOT YET VERIFIED. No live migrations, stock writes, main merge or deployment.
- Principal release blocker unchanged: ordinary `src/lib/saved-designs.ts` browser-local saved recipes lack authenticated owner-scoped durable CRUD and cross-account/second-device disposable-DB verification. Physical fabric/stock, tailoring, device, native geometry and independent security signoff remain PENDING.
- Next bounded slice: implement authenticated owner-scoped saved-design read/write on a compatible isolated draft, prove account A/B denial and second-session recovery using disposable DB; do not silently migrate ambiguous legacy browser data.


## 2026-11-19 — Restore sign-out security regressions after strict acknowledgment change

- **Parent:** `65dfda851605c83c3c586d842cc29f8c5f2dbdc6`; **test commits:** `d2e9904f6e9ba5a1afe11e0cbffe804639935420`, `d0e97ad84a5f69c5cc87f78404f1aac6a63c0a2a`.
- **Criterion:** signed-out state and private-data clearing must occur only after both successful HTTP and explicit JSON `ok: true`. Updated the two source-level regressions that incorrectly demanded the older `if(!response.ok)` expression; the application already uses `if(!response.ok||data?.ok!==true)`. No application logic was weakened.
- **Evidence at parent SHA:** Full CI [44509266840](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44509266840) **FAILED** (910/912 tests passed; two outdated logout source assertions failed); Non-3D [44509266922](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44509266922) **FAILED** at unit gate. Disposable PostgreSQL customer-security and stock jobs passed. The two test edits and this checkpoint have **not yet passed matching-head CI**, and no local tests/browser QA/build were run in this session.
- **Blockers:** authenticated durable ordinary saved-design persistence, disposable two-account owner isolation and second-device recovery; staging rollout and owner/physical/security acceptance remain pending. **Next slice:** inspect matching-head full CI and Non-3D, fix any actual failures; then implement a small owner-scoped saved-design persistence boundary with synthetic two-identity tests. No main merge or deployment.


## 2026-11-19 — Exact-head verification of sign-out regression repair
- Parent/head inspected: `6189cb9be277fd1af6fe194d755e82d6f2a322df` (draft PR #863); checkpoint blob before append: `1e7ab722cc0dfbfffb8681b08679ee144f85e6a6`.
- Matching-head GitHub Actions: [Full CI #44518004703](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44518004703) **success** and [Deep Engine Non-3D QA #44518004656](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44518004656) **success**, both associated with this exact SHA. These verify the previously repaired sign-out source regressions at the inspected head, not this subsequent documentation commit. No local test/browser session was run here.
- Inspected `AGENTS.md`, `DECISIONS.md`, `src/lib/saved-designs.ts`, customer-account UI and this checkpoint. Historical `docs/TITAN_RELEASE_CHECKLIST.md`, `docs/TITAN_RELEASE_CHECKPOINT.md` and `TODO.md` were absent at this branch SHA; release-gate completion cannot be inferred from their absence.
- **Remaining release criterion:** ordinary saved-design CRUD still uses shared browser `localStorage`, without authenticated owner binding or durable second-browser recovery. The existing owner-scoped vault is separate. Cross-account negative and second-browser tests against a disposable database, independent security review, real stock/fabric, tailoring, customer/device and native-model evidence remain **PENDING**.
- **Next bounded engineering slice:** reconcile versioned `SavedDesign` with existing authenticated vault recipe contracts; implement one durable owner-scoped write/read path and negative two-account test without silently migrating anonymous browser records. No main intake, deployment, live database mutation or paid AI.
- **This checkpoint commit:** documentation-only; matching-head CI for its resulting SHA is pending and must be checked next run.

## 2026-11-19 — Bounded ordinary saved-design wire boundary (draft, not persistence)
- **Parent:** `f73aacf66ee0a030b41d1ca77e042f6a9eaff3e0`; **contract commit:** `500536f9e99cd43d045adc1caa193cfe7a417361`; **regression commit:** `2c67e24656c96a84fb7ee26f4b0f32f7a86f6503`.
- **Criterion:** an ordinary saved recipe needs an explicit v1 wire envelope, separate from the signed LockedDesignRevision vault; reject oversized/malformed writes and browser-supplied ownership/authorization fields before any future service-role database operation. Added pure parser and Node regressions for accepted v1, invalid version, spoofed owner/customer fields, malformed recipe and 1 MiB boundary.
- **Verification:** source and tests committed, **not executed locally**; matching-head Full CI, Non-3D, build and browser QA **PENDING** at this new SHA. Prior Full CI #44527851190 and Non-3D #44527851303 succeeded only at parent SHA. No disposable DB proof for this new contract.
- **Blockers:** this module is **not wired to an API or database** and must not be described as durable persistence. Authenticated session-derived owner, server-side owner-filtered CRUD, disposable PostgreSQL Alice/Bob negative tests, second-browser recovery, staging, independent security and all human/physical release gates remain **PENDING**. No silent anonymous localStorage migration.
- **Next slice:** implement one authenticated owner-derived durable write/read path with fail-closed behavior, using existing schema conventions, and execute two-identity disposable DB regressions; inspect exact-head CI first. No main merge, Vercel deployment, live DB changes or paid AI.


## 2026-11-19 — Nested saved-design ownership spoofing rejection (pending CI)
- **Parent:** `de810337ffdd234c290790844defc8759fc6856d`; implementation `9cbf4f07929e9872458459966bb05ecb8836494b`; regression `0e1edcea6ad9991789a07283c8576655de2ba0e2`; formatting repair `c64e688585d6e659a9cf2a45162465a9ba722003`.
- **Criterion:** ordinary recipe validation rejects owner/customer/authorization claims nested in brief, version, renderSet and arrays; malformed cyclic/prototype-shaped recipe payloads fail closed. New negative regressions cover these cases. Existing locked-design vault untouched.
- **Evidence:** prior exact-head Full CI #44570884275 and Non-3D #44570884320 succeeded at parent `de810337`. New commits were not tested locally; matching-head CI, disposable DB and browser QA are pending, so acceptance is NOT verified.
- **Blockers:** this is a pure wire validator, NOT durable saved-design storage. Owner-derived authenticated API, server owner-filtered database CRUD, two-account disposable DB isolation and second-browser recovery remain unimplemented. Physical stock/fabric, tailoring, native geometry, devices, independent security and release gates remain PENDING.
- **Next bounded slice:** implement owner-scoped durable read/write using an existing private database pattern, with Alice/Bob negative tests; do not import anonymous browser recipes silently. No main merge or deploy.


## 2026-11-20 — Ordinary saved-design database foundation (UNVERIFIED)
- Parent head: `f8ede13a730183f1336c80ecbbc68e6ea3a1ba5d` (matching-head CI #44581335147 and Non-3D #44581334877 green for **parent only**).
- Migration commit: `c23f17b108a51b9948ca6d9b2bd95f06bf769236`; disposable SQL regression commit: `389a2d0e9b8a7972e47cfeaec6e28cfc58b330b1`.
- Criterion: isolated ordinary-design durable database foundation with composite (owner_user_id,design_id) key; service-role-only RPCs for upsert/list/get/delete, 1 MiB JSON bound, schema version and ID matching. Existing browser localStorage and locked-design vault untouched. Migration is **not applied** anywhere by this run.
- Added `tests/sql/customer-saved-designs-isolation.sql` for two synthetic users, same design ID isolation, cross-owner read/delete denial, privilege checks and rollback. **NOT EXECUTED**; no matching-head CI, release, browser, or disposable PostgreSQL evidence for new commits. No production acceptance claim.
- Blockers: synthetic SQL must run in disposable Supabase/Postgres with auth.users; confirm CI integration and ACL behavior; authenticated Next API must derive owner ID from verified session (never browser), validate wire payload, and expose second-browser recovery. Do not enable production persistence before these checks. Physical stock/tailor/device/native/security gates still pending.
- Next 30–40-minute slice: wire disposable SQL test into existing CI job, fix any actual failures, then build authenticated owner-derived API and two-identity HTTP tests. Do not deploy or merge unverified stack.

## 2026-11-20 — Disposable saved-design owner-isolation workflow (PENDING matching-head execution)
- **Parent:** `c4c92a14ea3746a3b1dbc4e18bf6e9b77d6f6829`; **workflow commit:** `1952c4d401a966a48df72b3bcfe700a7ceb7b40f`. Parent's matching-head Full CI [44613398327](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44613398327) and Non-3D [44613398569](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44613398569) both succeeded, but neither exercised the new SQL regression.
- **Criterion:** dedicated pull-request/workflow-dispatch GitHub Actions job provisions disposable PostgreSQL 16, synthetic Supabase auth.users and roles, applies `20261120_customer_saved_designs.sql` ONLY to that disposable DB, executes `tests/sql/customer-saved-designs-isolation.sql`, and asserts synthetic users and records were rolled back.
- **Verification:** workflow committed, **NOT EXECUTED at this checkpoint**. Matching-head SQL job, full CI, Non-3D and browser evidence for resulting documentation commit remain PENDING. A green generic CI run does not prove the SQL test executed.
- **Blockers:** verified owner-derived authenticated API CRUD, second-browser recovery, live/staging migration authorization, independent security review and all physical/owner release gates remain PENDING. No live migration, main merge, deployment or paid AI.
- **Next bounded slice:** inspect new workflow's exact-head outcome; repair actual SQL failures; implement authenticated server-derived owner CRUD with synthetic two-customer HTTP tests, never silently import browser localStorage.

## 2026-11-20 — Authenticated ordinary saved-design API (UNVERIFIED)
- **Parent:** `ddce2aaacf72ea48616fa243389bf1461a0a7311`; **implementation:** `3498b85c1a2fbe50902a55ab2167a955ae8e9d39`.
- **Criterion:** new `/api/customer-saved-designs` GET and POST endpoints derive owner from verified customer session; validate versioned recipe, IDs, request size and strict RPC acknowledgements; deny anonymous reads/writes and return private no-store responses. Existing localStorage remains unchanged; no automatic anonymous-record import.
- **Evidence:** parent matching-head Full CI #44622718464, Non-3D #44622718564 and disposable PostgreSQL #44622718357 all succeeded. New route has NOT been tested or CI-verified; API acceptance remains PENDING. No browser/second-device evidence.
- **Next bounded slice:** add two-customer HTTP isolation regressions and run matching-head full CI/build; wire explicit authenticated save/recovery UI only after backend tests. Check RPC response shape and staging migration before enabling. Physical/human release gates PENDING. No main merge, deployment, live migration or paid AI.


## 2026-11-20 — saved-design RPC read-boundary hardening (pending exact-head CI)
Parent: `1aeafd3309558dd79f3583488b7028b26f249f8d`. Code/test commits: `5e85f0ed66753016e638eeaf2f9f0a59a504c07f`, `d9d2a48c8c7378e818d230df7c539090b725f652`, `edaa79439a589d9c94de4bb7afad1b7904a6f725`, `b7b5822993d1292c744bb91a14a652b4422c253a`. Criterion: authenticated saved-design RPC reads must not disclose unexpected database columns or return a different design ID than requested. Added pure row validation and negative regressions for owner/credential columns, mismatched IDs, invalid timestamps and nested owner claims. Previous parent CI, Non-3D and disposable PostgreSQL runs were successful; new head tests and workflows have not been verified yet. Next: verify matching-head CI, then synthetic two-account HTTP save/read/delete and second-browser recovery. Physical customer, tailor, stock, fabric, device and native checks remain pending. No deployment or live migration.

## 2026-11-20 — Repair failing full-CI HTTP fixture parse (pending matching-head verification)
- **Parent:** `2be05615555f5d5d870a85f4911c3750729048b3`; **fix commit:** `d368e2241b534387cc54f00f25c054f4f86c17a8`.
- **Criterion:** existing synthetic Designer vault HTTP regression script must parse and execute in full CI without duplicate lexical bindings. Renamed the second `bobDelete` fixture to `bobVaultDelete`, preserving its assertions and the first fixture.
- **Observed evidence at parent:** Full CI [44656646720](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44656646720) failed at `node scripts/verify-designer-vault-boundary-http.cjs` with `SyntaxError: Identifier 'bobDelete' has already been declared` (line 708). Disposable saved-design PostgreSQL [44656646658](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44656646658) succeeded; Non-3D [44656646660](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44656646660) was in progress when inspected.
- **Result:** syntax correction committed; matching-head full CI, Non-3D and SQL verification for resulting checkpoint SHA remain **PENDING**. No local test execution is claimed.
- **Next bounded slice:** verify exact-head workflows, repair any remaining real test failures, then complete two-customer authenticated saved-design HTTP isolation and second-browser recovery. Owner stock, fabric, tailor, device, native and independent security approvals remain PENDING. No main merge, deployment, live migration or paid AI.

## 2026-11-20 — Saved-design HTTP account isolation negative coverage

Parent SHA: `bea1e2146edebec3ce5369af4a65e1d91a127aa2`. Test implementation SHA: `a6af3d3147f9b2afd958d4cd9f6beb84c4432f31`. Criterion: authenticated saved-design owner isolation / rejection of client-supplied ownership. Extended the existing built-Next synthetic HTTP regression to reject forged top-level owner IDs and nested session tokens with HTTP 400 before privileged RPC, confirm no-store headers, and prove Alice/Bob list separation after Bob deletes his independently owned same-ID record. No live records or services used.

Prior parent matching-head evidence: Full CI #44657065416, Non-3D #44657065342 and disposable PostgreSQL #44657065359 succeeded at `bea1e2146edebec3ce5369af4a65e1d91a127aa2`; these do **not** verify the new tests. New-head CI/browser execution: **PENDING**. Next: inspect matching-head Full CI and synthetic HTTP results, repair any failure, then implement second-browser customer-facing recovery without silently importing anonymous browser drafts. Physical stock, customer pilot, tailor/device/Blender and independent security gates remain **PENDING/BLOCKED**. No merge/deploy/live migration.

## 2026-11-20 — Explicit cloud saved-design client adapter (pending matching-head verification)
- Parent: `ea2c3b757d6d9e53cc4f2db05586cfc790ef1916`; code commits `96651aa3b898863357a9837f6e4bf101ed117eea`, `139aef90b38b745db0b152e212bfaf69e897b41f`, `b6524174fc4ba94745435df6948abad99d7183ac`.
- Acceptance slice: explicit authenticated client operations save/list/delete ordinary versioned designs, reject malformed server acknowledgements, preserve localStorage without implicit migration. Added `src/lib/customer-saved-design-client.ts` and `tests/customer-saved-design-client.test.ts` with synthetic recovery/ownership/401/negative ACK cases.
- Previous parent matching-head evidence: Full CI #44663759860, Non-3D #44663757952, disposable PostgreSQL #44663757937 all successful at `ea2c3b757d6d9e53cc4f2db05586cfc790ef1916`. New commits require their own matching-head tests and workflows; do not claim verified until checked.
- Blockers: adapter not yet wired to Designer customer-facing controls; no real second-browser or customer pilot proof; migrations not applied live; physical stock, fabric measurements, tailor, native geometry, mobile/browser and independent security approval remain pending.
- Next 30–40-minute slice: connect explicit signed-in cloud save/list UI without silently uploading legacy browser records; verify cross-browser synthetic recovery and exact-head CI.


## 2026-11-20 — Synthetic second-browser cloud recovery/account separation regression
- **Parent:** `6f3d2e6a3ff905539ffb9eb6905ac704fe9b2566`; **test commit:** `9d42c76eaabd9462be339f63d65b088729f2d4ba`.
- **Criterion:** independent browser clients for one authenticated account can list a saved versioned design, while a different account cannot read or delete the first account's record, even with the same design ID. Added an account-scoped synthetic transport regression in `tests/customer-saved-design-client.test.ts`; this does **not** prove real browser session handling or production database ownership.
- **Parent matching-head evidence:** CI [44677517179](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44677517179), Non-3D [44677517171](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44677517171), disposable PostgreSQL [44677517174](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44677517174) succeeded at parent SHA. New test execution and matching-head workflows are **PENDING**; no local test execution claimed.
- **Next bounded slice:** verify the new test in matching-head CI; connect explicit cloud save/list controls in Designer without uploading legacy localStorage implicitly; run real two-browser/customer pilot before release approval. Physical stock, fabric provenance, tailor, native geometry, device and independent security gates remain PENDING/BLOCKED. No main merge, deployment, live migration or paid AI.


## 2026-11-20 — Explicit single-design cloud recovery client (matching-head verification pending)
- **Parent:** `ce88433dd30c94a6549c6b95ac1b2ecd29af223d`; implementation `7b9dcf5355091bbbe24c071cb0edc6570b16b0db`; regression `76290497fcaa281057f1d2679d64b595419f951a`.
- **Criterion:** recover one authenticated owner-scoped saved design by exact versioned ID without browser-local fallback; distinguish 404 missing from 401 unauthenticated; reject mismatched IDs, private columns, malformed responses and invalid IDs before network.
- **Prior matching-head evidence:** Full CI, Non-3D and disposable PostgreSQL succeeded at parent `ce88433dd30c94a6549c6b95ac1b2ecd29af223d`. New regression and matching-head workflows are **PENDING**, not claimed executed.
- **Remaining:** wire explicit signed-in Designer controls, prove real two-browser recovery and customer pilot, staging migration and independent security review; physical stock/fabric/tailor/device/native gates PENDING/BLOCKED.
- **Next bounded slice:** verify matching-head CI for this addition, then connect signed-in cloud listing/recovery controls without auto-uploading local drafts. No main merge, deployment, live migration or paid AI.


## 2026-11-20 — Explicit cloud vault UI slice (pending exact-head verification)
- Parent: `57126b1ca5dedd690eaef75f11bcd3cd6d6e7c24`; new cloud panel commit `d815657bd7f7e3f50408220d3d05df9175430a85`; SavedDesignsClient integration commit `dadfcf056ddc9873eccb65fcc2c8de84fb3c91d6`.
- Criterion: authenticated customer cloud listing and deliberate local-draft upload; selected cloud-record retrieval without implicit localStorage migration or browser draft overwrite. UI exposes these operations on the saved-designs screen, including when there are no local designs. No real browser or customer sign-in proof yet.
- Prior parent matching-head evidence: CI #44690169705 SUCCESS; Non-3D #44690169765 SUCCESS; disposable PostgreSQL #44690169676 SUCCESS. Those checks do **not** cover these new commits. Matching-head CI/browser QA for new head PENDING; no tests claimed executed here.
- Blockers: actual signed-in two-browser recovery, usable reconstruction into Designer, owner/device pilot, stock/fabric/tailor and independent security/release gates. No production migration or deploy.
- Next 30–40-minute slice: add browser UI regressions for signed-in cloud listing/upload and cloud recovery, verify exact-head CI, then implement explicit cloud-to-Designer reconstruction without modifying browser drafts.

## 2026-11-20 — Cloud vault stale-account display and upload refresh
- Parent `15512eb5a0eeb591e3fa1f230b65f07e141d9a8e`; UI fix `f41fc76cac4817d657dbecd046e741f67890a3ff`.
- Acceptance slice: failed cloud operations clear previously displayed account-scoped cloud records and selected details; successful explicit local-draft upload refreshes the account list and clears stale selection. Local drafts are not implicitly uploaded or overwritten.
- Parent matching-head evidence: CI #44697945170, Non-3D #44697945189, disposable PostgreSQL #44697945144 all SUCCESS at `15512eb5a0eeb591e3fa1f230b65f07e141d9a8e`; no matching-head test/CI evidence yet for this change. No local test execution claimed.
- Remaining: real browser sign-in/sign-out account switching, two-session reconstruction into Designer, UI browser regressions, customer pilot and independent security approval. Physical stock, measured fabric, tailoring, device and native-model gates PENDING/BLOCKED. Next: test the cloud panel at 390/768/1440px and connect explicit recovery to Designer with versioned validation. No main merge, deployment, live migration or paid AI.

## 2026-11-20 — Explicit confirmation before cloud draft upload
- Parent SHA: `3e68445a5d9f3b06ba57715762dac9e23c80eac4`; UI change SHA: `1e254f0b90c85484dbe17762a29749e86e7ba454`.
- Criterion: selecting a browser draft must not immediately transmit it to the cloud. Selection now only updates local component state; a separate enabled "Upload selected draft" button invokes the authenticated write. No automatic localStorage migration or live data mutation.
- Parent exact-head evidence: Full CI, Non-3D QA and disposable PostgreSQL workflow runs SUCCESS at `3e68445a5d9f3b06ba57715762dac9e23c80eac4` (checked through commit workflow runs). New-head tests, build and browser QA at 390/768/1440px PENDING; no local tests claimed.
- Next: add interactive browser regression proving selection alone sends zero requests, then verify matching-head CI and real two-session recovery into Designer. Customer/device pilot, staging, independent security and physical stock/fabric/tailor/native acceptance remain PENDING/BLOCKED. No main merge, deploy or live migration.

## 2026-11-20 — explicit upload consent regression tripwire
- Parent before slice: `09b71442a3d136c6c21d254c3a71ba098075007b`; test commits `e5ee21de5e3a00b1104cd37dc2e4a2ff11616a40`, `a68f36b4f46d34bde2265cffa51e0c132b83c98f`, `12f2f83549057e1cf2c8a42baf9573a124571aaa`.
- Criterion: browser-local draft selection must not initiate network upload; upload requires a distinct enabled button. Added `tests/cloud-upload-explicit-consent.test.ts` source-level regression to detect accidental JSX wiring changes. This is **not** interactive browser proof.
- Parent exact-head CI: CI 44714165043 SUCCESS, Non-3D 44714165019 SUCCESS, disposable PostgreSQL 44714165031 SUCCESS. No local tests executed for this slice. Matching-head CI on the checkpoint result is PENDING until run completion.
- Blockers: actual browser selection/no-request assertion, signed-in two-browser recovery into Designer, real customer/device/security acceptance, physical stock/fabric/tailor/native proof remain PENDING. Next: exercise cloud panel in actual browser and prove selection alone sends zero requests, then connect recovered versioned recipe to Designer without changing local drafts.

## 2026-11-20 — reject duplicate cloud account-list IDs
- Parent `1fd7bcfa8ee0450e30563ea4a632c032fbfee854`; implementation `7f1d2adf417aff9681497698a0fccfe2fe4c4819`; regression `f06cbfe8ca309a9736c5eb7ec0920dba7d5a6ab3`.
- Criterion: a malformed account listing containing duplicate design IDs must fail closed rather than present ambiguous recovery controls. `listCloudDesigns` now rejects duplicate decoded IDs; test checks duplicate rejection and valid singleton acceptance.
- Parent exact-head CI: Full CI 44722261811 SUCCESS; Non-3D 44722261681 SUCCESS; disposable PostgreSQL 44722261688 SUCCESS. New regression and quality/build/browser QA have **not** been executed locally. Matching-head CI for the new commits PENDING.
- Remaining: interactive browser upload-consent/no-request proof, signed-in two-browser Designer recovery, independent security, device, stock/fabric/tailor/native and human release gates PENDING. Next: verify matching-head CI and run real browser recovery without overwriting local drafts. No main merge, deploy, live migration, stock changes or paid AI.


## 2026-11-20 — Explicit cloud-only delete control (verification pending)
- Parent SHA: `472b16254620bbe25efb80750f39739f83c45615`; implementation `a214cfefb61b7d4e947f3eea1412020dcfc639a0`; regression `bc27233752a0a0568332960390833cb4ddbc26a6`.
- Criterion: a signed-in user can explicitly request deletion of an owned cloud record, with a separate browser confirmation and strict positive server acknowledgement. The action refreshes cloud records and clears recovered details, without calling local draft deletion or modifying localStorage. Cancellation sends no deletion request. Added source-level consent regression `tests/cloud-delete-explicit-consent.test.ts`.
- Parent exact-head evidence: Full CI #44730797101 SUCCESS, Non-3D #44730797029 SUCCESS, disposable PostgreSQL #44730797169 SUCCESS at `472b16254620bbe25efb80750f39739f83c45615`. These do not validate the new commits. Local tests, interactive browser confirmation/cancel/delete, matching-head CI and 390/768/1440px QA are **PENDING**.
- Next bounded slice: execute matching-head tests, interactive signed-in browser delete/cancel and two-session cloud recovery into Designer; avoid implicit browser draft writes. Customer pilot, staging, independent security, stock/fabric/tailor/device/native acceptance remain PENDING/BLOCKED. No main merge, deploy, live migration, stock mutation or paid AI.


## 2026-11-20 — Serialize cloud actions before React rerender
- **Parent:** `bf7b92687707a9d747fa855d4dd7d3cec11b8bdb`; **fix:** `0fe537bbd00311f527920fbfd1e7a2d7cb66e9dd`; **regression:** `d39c3d3692705a88e34801e9b46bcda4e2c87903`.
- **Criterion:** duplicate cloud save/delete/list/recovery actions must not overlap when two clicks occur before React applies the busy disabled state. A synchronous `useRef` in-flight mutex guards the shared async runner and releases in `finally`, including failures. Added `tests/cloud-actions-single-flight.test.ts` source contract regression. This is not browser click-timing proof.
- **Parent matching-head evidence:** Full CI #44747528554 SUCCESS, Non-3D #44747528004 SUCCESS, disposable PostgreSQL #44747528639 SUCCESS at parent SHA; these do not verify this new change. New-head local tests, matching-head CI, 390/768/1440px interactive browser QA **PENDING**.
- **Next bounded slice:** verify new-head workflows and actual rapid-click browser behavior, then implement explicit versioned cloud-to-Designer recovery with two authenticated sessions. Physical stock/fabric/tailor/native/device, staging customer pilot and independent security approval remain **PENDING/BLOCKED**. No main merge, deployment, live migration, paid AI or fabricated physical evidence.


## 2026-11-20 — Explicit versioned cloud recipe export (verification pending)
- **Parent:** `a13637bfaddc93d7170c2c6b48205ca975789950`; **UI:** `c36ddad9e21705342df001f84326e4eb1a1e93e2`; **source regression:** `699472f2f4ba0fdd47d81529200c703d730e8d4f`.
- **Criterion:** a signed-in customer who explicitly recovers a cloud record can export the versioned brief, recipe and render-set as JSON without changing any browser-local drafts or silently importing a design. The exported JSON is a portable recovery artifact, **not** an operational Designer import or a production lock.
- **Parent exact-head CI:** CI #44757568825 SUCCESS, Non-3D #44757568840 SUCCESS, disposable PostgreSQL #44757568919 SUCCESS at `a13637bfaddc93d7170c2c6b48205ca975789950`. These do not validate the new commits. Source regression was added but **not executed locally**; matching-head CI, download interaction and mobile/desktop browser QA PENDING.
- **Next:** build and verify a version-validated explicit Designer import path from recovered cloud recipes with real two-session browser tests. Customer/device pilot, staging, independent security, physical stock/fabric/tailor/native and T1–T6/J1–J6 release gates remain PENDING/BLOCKED. No main merge, Vercel deploy, live migration, live stock changes or paid AI.


## 2026-11-20 — isolated cloud-import preservation contract (pending CI)
- Parent SHA: `5d24018ad826af78e4190a43df7712efe7c70f62` (customer-security PR #863); isolated branch `work/titan-cloud-import-preservation-20261120`.
- Implementation SHA: `2fd2949c985165421606b789151286fabf0ce204`; regression SHA: `509332ce37af5b9dc8c11bd0b1e2842d7198bad3`.
- Acceptance slice: explicit versioned cloud export parsing rejects unsupported versions, extra/ownership fields and oversized recipes; import preserves every existing local record, resolves ID collisions, and refuses unreadable/full stores without mutation.
- Evidence: source regression added at `tests/cloud-design-import.test.ts`; **NOT RUN**. Matching-head CI, browser QA, two-account security review and end-to-end UI wiring **PENDING**. This helper is not exposed to customers yet.
- No live database, deployment, stock, or physical approval. Next: run exact-head tests and integrate explicit consent UI after verification; verify import identity collision behavior and two-session browser recovery.


## 2026-11-20 — Opt-in cloud-to-browser recovery UI, tested-source milestone (verification pending)
- **Original parent:** `c2a3684645fb5edb18ea0f244a6f0c287e92ea7f` (draft PR #1004), based on customer-security PR #863 `5d24018ad826af78e4190a43df7712efe7c70f62`.
- **Commits:** validator/runtime-import correction `fb31d60bfe2bd9f18dfd2551f483e1a0208ef4d6`; real Node-regression fixture `c56784a98a85d0d93ffe99dd7bf9ecb7d0e069d0`; customer import UI `8dddc76687c6075ef316303ee3b73235a64cac5c`; saved-card state synchronization `2411e862e0a3ecaacd80fb919a0e0d244c1b364d`; explicit-consent source regression `6046c51ba719b810e02392c2c12a0e823607f05a`; architecture decision `55493df065d97fb0e7a649436a378c17315dc635`.
- **Criterion:** owner-scoped fetched cloud design is explicitly confirmed before import; importer validates schema and presentation-critical recipe fields, keeps existing browser entries including unknown formats, resolves local ID collisions without changing version hashes or model ID, fails closed on unreadable/full stores, and refreshes the Saved Designs UI after success. No automatic import during list/recovery/export or cloud mutation.
- **Observed first-head failures:** at `c2a3684645fb5edb18ea0f244a6f0c287e92ea7f`, Full CI #44789109508 **FAILED** and Non-3D #44789109511 **FAILED** because the new test imported TypeScript without a `.ts` extension (Node `ERR_MODULE_NOT_FOUND`). The test and pure helper imports were corrected; this is not evidence of successful tests.
- **Later matching-head evidence at `6046c51ba719b810e02392c2c12a0e823607f05a`:** CI #44790121171 QUEUED and Non-3D #44790121372 QUEUED when inspected. The current later docs/result SHA needs independent matching-head results; targeted tests, browser QA at 390/768/1440, two real authenticated browsers/accounts, security review, disposable DB and build/engine/preview/release checks are NOT YET proven for the current head.
- **Blockers:** cloud feature staging/authenticated two-browser recovery, identity-switch privacy, customer device acceptance, stock provenance, tailoring signoff and native 3D measured evidence remain PENDING/BLOCKED. T1–T6/J1–J6 human/physical gates remain PENDING. No main merge, Vercel deployment, paid AI or live database migration.
- **Next 30–40-minute slice:** inspect new-head CI/test failures and fix defects; verify an owner-scoped record recovers with consent on a fresh browser without altering pre-existing local drafts, then test account switching/negative cases.


## 2026-11-20 — Cloud account-switch private-record scrub (isolated PR #1004)
- **Parent:** `1d126437b39fbd52d942cfb724779de6d556e374`, from the prior explicit cloud-to-local recovery milestone.
- **Code:** signed-session owner lookup `3547627d567aa1c465e0f8ec69b837b3a1b016bf`; UI focus/visibility scrub plus pre/post-action identity checks `8b45b1c6d7d224a6d064093820b7291664c3fe02`; existing cloud-delete owner-publish assertion `00cc358bdd4bf4c6f987abb1dcd174cd104f65d5`; new negative regressions `e31ecf5fa46d66b57af90520b22ffec91ded2593` and `d13487d6924698a51d7ba5513c94a9359eefe221`; architecture record `90f0d7816389942e7180efa664d05cb2dbc672d8`.
- **Acceptance slice:** cloud records are cleared when a tab returns from background; list, detail recovery, save, delete, export and local import require a signed-in identity and after-action same-owner recheck; stale requests cannot publish old account data following visibility invalidation. All local drafts are preserved, with no production writes outside existing authenticated cloud API actions.
- **Observed pre-milestone CI:** `1d126437b39fbd52d942cfb724779de6d556e374` CI #44790385554 and Non-3D #44790385496 were cancelled after newer branch commits; no complete acceptance inference. New tests source + synthetic transport checks are COMMITTED but not executed locally. CI #44792117468 and Non-3D #44792117474 were QUEUED at intermediate `d13487d6924698a51d7ba5513c94a9359eefe221` before documentation commits; they are NOT evidence for this checkpoint head.
- **Remaining:** matching-head full CI/non-3D/browser/release/database evidence, real two-account session-switch browser verification, independent security review, staging revocation tests, measured supplier stock/fabric, tailor, native Blender/device/customer pilot, T1–T6/J1–J6 physical owner gates all PENDING/BLOCKED.
- **Next:** inspect final matching-head CI for failures; add server-verified expected-owner protection if proven necessary for in-flight mutation safety; run actual two-account browser checks before main intake. No main merge, Vercel deployment, paid AI or live DB migration.


### 2026-11-20 — Account-switch confirmation-race follow-up (PR #1004; PENDING CI)
- **Prior checkpoint head:** `263649711f5a8171ab7a736ae6478d15de029f78`.
- **Fix:** `b6c34f6597d4c238594329224c87d2976979d393` binds the displayed selected recipe to the owner who fetched it. A focus or visibility scrub now invalidates that selection, even when a browser confirmation dialog retains an old event closure. Export and local import refuse invalidated selections until explicit owner-scoped recovery is repeated.
- **Regression:** `7e655114ab06119344567f3ce3d3ecf0b4a77463`, corrected Node regex test `16fabc00b512a3aa84bc89f60ddef777bf4074b9`; cloud delete revalidation assertion `8b896c71cbfd79ba7ef11f83a2bee5dcc593d838`; selected-owner scrub assertion `3d21307164bbd72f9923f7fa5fe5f80d425cef8e`.
- **Evidence:** intermediate head `d13487d6924698a51d7ba5513c94a9359eefe221` Full CI #44792117468 and Non-3D #44792117474 CANCELLED after subsequent commits; those do not count as pass. At `3d21307164bbd72f9923f7fa5fe5f80d425cef8e`, Full CI #44792786362 and Non-3D #44792786307 were PENDING. No tests were run locally; final checkpoint-head CI/browser/full release gates still PENDING.
- **Next:** inspect matching-head test/HTTP/browser results, run real two-account tab and confirmation interactions; verify failure paths and staging session revocation. Independent physical stock, tailor, device, native, security, pilot and T1–T6/J1–J6 human gates stay BLOCKED/PENDING. No main merge or deployment.


### 2026-11-20 — Confirmation focus-race correction (PR #1004)
- **Parent checkpoint:** `318f5863aedbc1c23a19c7d053d1082d2c801b05`.
- **UI fix:** `000b9bbe29c1b6b76088b6865633cb6e5c5d55ab` moves the cloud delete and local import confirmation dialogs *inside* the serialized owner-checked action. Tab focus from a browser-native confirmation no longer destroys the selected design while that action is active. Identity is rechecked **after** confirmation and before any delete or import effect; selectedOwner is also rechecked for export/import.
- **Regression:** `ecc08aef2160b947b2ab8ef39d435b5ec2a523b6` adds focus-dialog and post-consent owner assertions; source tests remain distinct from actual browser acceptance.
- **Verification:** matching-result-head CI and Non-3D were not yet observed at this checkpoint. Prior intermediate workflow runs are superseded by these commits. No local execution, signed-in real customer browser session, staging proof or independent security acceptance is claimed. Final 390/768/1440 QA and production release gates remain PENDING/BLOCKED.
- **Next:** inspect exact-head workflow results; exercise native confirm dialogs with two authenticated users and cross-tab account switches in real browsers; keep production/intake merge blocked until reviewed and verified. No Vercel deploy or production DB changes.


## 2026-11-21 — cloud action regression repaired after exact-head failure
- **Parent SHA:** `fa375c909c2b58f21c57589a064e194466b601ad`; **test-fix SHA:** `63b191c23632dc5815aadd2f837948f9c9c8f44b` on draft PR #1004.
- **Affected criterion:** cloud saved-design actions remain synchronously single-flight, with owner verification before/after authenticated operations. The earlier source test assumed `void run(async () => {`, but the actual identity-bound action contract is `void run(async (assertOwner) => {`. Updated the regression to assert the current owner-verified invocation and `await assertOwner()` rather than weakening the mutex checks.
- **Observed parent CI evidence:** at `fa375c909c2b58f21c57589a064e194466b601ad`, Full CI run [44793254895](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44793254895) FAILED (npm test: 928 passed, 1 failed, `tests/cloud-actions-single-flight.test.ts` stale invocation assertion); Non-3D run [44793254849](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44793254849) FAILED. Disposable PostgreSQL stock and customer security jobs in Full CI passed, but do not certify the branch.
- **Verification of new test-fix head:** exact-head CI/Non-3D workflow results not yet available at checkpoint writing; local npm tests, build and browser QA not run. This is a committed source/test alignment, **not** a production acceptance claim.
- **Blockers:** real two-session browser account switching, mobile/desktop QA, independent security review, staging and customer pilot; stock, physical tailoring and 3D acceptance remain PENDING/BLOCKED. No main merge, Vercel deploy, paid AI or live-data mutation.
- **Next slice:** check matching-head workflows and fix any remaining failure; run 390/768/1440 browser recovery/privacy checks and two-account owner-scoped tests before considering a dependency-isolated main intake.


## 2026-11-21 — exact-head CI verification after cloud-action regression repair
- **Verified code/checkpoint parent:** `cbe3ee3187d29203ca7d2be65d23d68520266038` (test fix `63b191c23632dc5815aadd2f837948f9c9c8f44b`).
- **Affected criterion:** customer cloud recovery action regression, synchronous single-flight and owner revalidation. GitHub Actions matching this exact SHA: Full CI [#44831824327](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44831824327) **SUCCESS**; Deep Engine Non-3D QA [#44831824365](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44831824365) **SUCCESS**. These results prove only the checks executed by those workflows, not independent real-account browser or release approval.
- **Integration blocker:** branch comparison with live main: **265 ahead, 33 behind, 68 changed files**; cannot merge the entire customer-security stack as an isolated section. Main `vercel.json` retains `git.deploymentEnabled=false`.
- **Remaining:** independent two-account signed-in browser verification at 390/768/1440, confirmation/focus race and cross-tab session-switch checks, security review, staging revocation, customer pilot, verified physical stock/fabric, tailoring and native 3D evidence, all owner release gates **PENDING/BLOCKED**. No live DB mutation, Vercel deploy or main merge.
- **Next independent engineering slice:** isolate the cloud import/recovery changes and required dependencies against live main, validate exact-head CI, browser QA and disposable database tests before considering a guarded main intake. This documentation-only checkpoint commit requires its own exact-head workflows; prior green results apply to its parent code SHA only.


## 2026-11-21 — matching-head CI verified for cloud recovery checkpoint
- **Parent SHA:** `d9b88e94ede431e2154d405abdccd7fc0678eeeb` (PR #1004). Branch comparison against that SHA was **identical** when checked; no newer compatible commits were overwritten.
- **Affected criterion:** automated cloud recovery/security regression and Non-3D verification at the exact checkpoint head. GitHub Actions CI [#44839168231](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44839168231) **SUCCESS** and Deep Engine Non-3D QA [#44839168302](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44839168302) **SUCCESS**, both queried by exact parent commit SHA. This is automated workflow evidence, not independently executed real-account browser QA.
- **Remaining blockers:** branch is 266 commits ahead / 33 behind main; no dependency-complete intake verified. Real two-account authenticated browser sessions, 390/768/1440 focus/confirmation races, staging security and revocation, physical fabric/stock, tailoring, device/Blender, customer pilot and T1–T6/J1–J6 human acceptance remain **PENDING/BLOCKED**. No production readiness or release approval.
- **Next isolated slice:** build a minimal cloud-import intake from current main, enumerate required dependencies and run exact-head checks plus authenticated cross-account browser tests before any guarded merge. No Vercel deployment, live database mutation, paid AI or stock changes.
- **Checkpoint-only result commit:** this append creates a new documentation SHA, whose own matching-head CI must be checked separately.


## 2026-11-21 — exact-head CI confirmation at `ff75f45b0a1d53bd21a7b8883bdd6023b8223f7c`
- **Parent/head:** `ff75f45b0a1d53bd21a7b8883bdd6023b8223f7c` (PR #1004; branch unchanged at read). **Criterion:** automated customer cloud recovery/security and Non-3D QA checks at the exact documentation head.
- **Evidence:** [Full CI #44846604814](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44846604814) **SUCCESS** and [Deep Engine Non-3D QA #44846604816](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44846604816) **SUCCESS**; both returned for this exact SHA. No independent local/browser tests were run in this milestone.
- **Review:** cloud UI still uses owner revalidation before/after selected recovery, delete and local import; this source inspection does not substitute for authenticated two-account browser and staging revocation evidence.
- **Blocked:** no dependency-isolated main intake, independent two-account session-switch browser QA at 390/768/1440, security review, physical stock/tailor/device/Blender/customer pilot acceptance. All corresponding T1–T6/J1–J6 human gates remain PENDING/BLOCKED. No main merge, live mutation, provider charges or Vercel deployment.
- **Next slice:** create a minimal main-based cloud recovery intake with required dependencies, then test exact-head CI, security/disposable database and real two-account browser confirmation/focus races before considering main. This checkpoint-only result commit itself needs matching-head CI.


## 2026-11-21 — Bounded cloud session verification response (pending exact-head CI)

Parent application SHA: `5d8a41a44849e2d1364deb5255e16507e394b6b4` (prior matching-head CI and Non-3D success). Source change: `f5ce71751ad5ec4180ab982e924ef82ad47047e0`; correction: `1315fe961743b48c64a6945fa407f5c8621b866e`; regression: `facab6ed4db693c5f626b2cf74c58184ff319e2a`.

Affected customer security criterion: session recheck must not consume unbounded upstream JSON. Added streamed 16 KiB cap, Content-Length preflight, strict UTF-8/JSON parsing and synthetic tests for normal, declared-oversized, streamed-oversized, malformed and missing-owner responses. **Not yet verified**: exact-head full CI, Non-3D/browser, security/release, disposable PostgreSQL as applicable. No production deployment or main integration.

Blockers: branch remains significantly divergent from main; customer cloud endpoint and wire dependencies are not on main, so an isolated dependency-complete intake is still required. Real two-account staging/browser acceptance, migration activation, owner and physical release evidence remain pending. Next action: inspect matching-head CI for this checkpoint commit; fix failures before any intake or merge. Do not call this production-ready.


## 2026-11-21 — Exact-head verification of bounded session response

Verified branch head `7dc14264255610589287d76207b1e63caea5eee6` (identical to live branch at verification). Full CI run #44862833523 and Deep Engine Non-3D QA run #44862833592 both completed SUCCESS for that exact SHA. This verifies the committed bounded-session-response regression within those workflow suites; it does not establish real staging owner isolation or production activation. Parent/result: parent `7dc14264255610589287d76207b1e63caea5eee6`; this documentation-only checkpoint commit's resulting SHA is recorded by GitHub and requires fresh matching-head checks before any integration.

Affected criterion: customer session revalidation HTTP response size/parse fail-closed behavior (automated verification only). Remaining blockers: isolated dependency-complete main intake, authenticated Alice/Bob browser privacy/confirmation races at 390/768/1440, staging session and SQL permission tests, independent security review, stock, tailoring, device, native geometry and human pilot gates. T1–T6/J1–J6 physical/human gates remain PENDING/BLOCKED. No main merge, deployment or live-data mutation. Next meaningful engineering slice: implement and test isolated main-based recovery intake; avoid further documentation-only commits unless new evidence or a code milestone exists.


## 2026-11-21 — Cloud import version-reference fail-closed regression

- Parent before source edit: `8cab2e002d18ae11d4a44ad3fd8cef1dbd0e1948` (last recorded checkpoint; branch had no intervening application edit observed during this slice). Source commit `4c9be8b056bab2c9bd437914f38c4af9e30aca79`; regression commit `e4403c50ddf7fdd2cb95f1354af84b0eb4e7c03c`.
- Criterion: customer recovery must reject present-but-malformed version linkage rather than bypass comparison. Optional legacy linkage remains optional. Added five negative assertions for numeric/null render-set version/hash and numeric recipe hash; rejected imports must leave existing browser bytes unchanged.
- Evidence: committed source and Node regression assertions. **NOT YET VERIFIED**: no matching-head CI, local Node test, browser or disposable-DB result for `e4403c50ddf7fdd2cb95f1354af84b0eb4e7c03c` at checkpoint time. Earlier CI successes apply only to their own exact SHA.
- Blockers: broad branch divergence from main; authenticated two-account browser/staging proof; feature-flagged database activation and independent physical/customer/operator gates. No main merge or deployment.
- Next: verify exact-head Full CI and Non-3D QA, then isolate a dependency-complete main-based intake and perform authenticated account-switch privacy checks at 390/768/1440.


## 2026-11-21 — bounded cloud saved-design response parsing

Parent checkpoint head: `1e68874af69c4e4183a95000b034093dd4bad032` (Full CI #44872939638 SUCCESS; Non-3D #44872939642 SUCCESS at that parent).
Code commit: `2ad2263ae1b8708f69a820a1e7426ff50acb782f`.
Regression commit: `3645658707910ec4a7a7bc474cb2c64cadeae90a`.
Criterion: customer owner-scoped cloud list/get/save/delete responses must not buffer unbounded server data. Added 25 MiB upper bound (24 designs at <=1 MiB each plus framing), preflight Content-Length validation, streamed byte counting and strict UTF-8/JSON decoding. Added declared-size, malformed-length, oversized streamed body and malformed JSON regressions.
Evidence: code and regression committed, **matching-head CI/Non-3D and browser tests PENDING**. The successful workflows above predate these changes and do not certify them. No local tests executed, no live services or database touched.
Next slice: verify exact-head workflows; review the 25 MiB ceiling against actual API response limits and two-account browser privacy, then isolate a dependency-complete main intake only after all gates pass. Customer pilot, stock, tailor, native and staging security acceptance remain BLOCKED/PENDING. No Vercel deployment or main merge.

## 2026-11-21 — Numeric Content-Length cloud response regression

Parent SHA: `fae070edf21606269270dcc633a7db47ca64ca17`. Code SHA: `a13598d39d9d66c3d1631568a33162abd1b21b96`. Regression SHA: `6f42cb917ab74a8f74ff041f9fa949ed5960f778`.

Customer cloud save/list/get/delete response parser mistakenly used a literal-backslash digit pattern (`/^\\\\d+$/` in source representation), rejecting all ordinary numeric Content-Length headers. Corrected it to the digit character class and added an end-to-end client regression asserting valid numeric Content-Length across all four operations. Affected criterion: authenticated durable saved-design recovery and account operations must accept valid bounded HTTP responses while rejecting malformed/oversized responses.

Evidence: source inspection and committed regression only. Full CI, Non-3D QA, build and browser/disposable database tests at regression SHA **NOT YET VERIFIED**; do not treat this milestone as technically accepted or main-merge eligible. No real customer records or live database were touched. Next: verify matching-head CI; inspect main-based dependency-complete intake and perform authenticated two-account browser and disposable DB checks. Physical stock, tailor, device and native 3D proof remain PENDING.


## 2026-11-21 — Reject unexpected metadata in private cloud listing

Parent SHA: `fdc9dda8a7255174fa279bd28b5c94a8c8441ccf` (matching Full CI #44891428826 SUCCESS and Non-3D QA #44891428848 SUCCESS). Source SHA: `21efcc1265dc4e0a873a94cc2069aa3aa70c454c`. Regression SHA: `f7a8d11f994d6a577b72f3582aeba4df0bb43ccb` (confirmed live branch head at checkpoint preparation).

Criterion: authenticated customer cloud-list response must contain exactly the documented `designs` field, without accidental private account metadata or session credentials. The client now fails closed on any unexpected top-level key; added two negative tests for leaked `owner_id` and `sessionToken` metadata. Existing valid `designs` responses remain supported. No schema migration, new dependency, live data or paid AI.

Evidence: source and regression committed; no local test execution. Matching-head Full CI and Non-3D QA for regression SHA had no runs returned at checkpoint preparation, therefore **PENDING**, as are authenticated two-account browser and disposable PostgreSQL tests. Prior green runs certify the parent only. The historical release checklist/checkpoint and TODO files were absent on this branch; AGENTS.md and DECISIONS.md were inspected. Main divergence before edits: 282 ahead / 33 behind; full-stack merge unsafe. Next: verify matching-head workflows and isolate a dependency-complete main-based intake; stage account-switch and owner-scoped DB verification. T1–T6/J1–J6 human/physical gates remain BLOCKED/PENDING; no main merge, Vercel deployment or live mutation.

## 2026-11-21 — Fail-closed malformed RPC payload serialization
- **Parent:** `38517af8b6a7e440838ec1b940ec0bd8d1e25540`; **code:** `50f1cd3ef1de49510d4fd674ab12d71fba845209`; **regression:** `6fe6066bd84b9460a23a8e6fafbd0d6a33b41a54`.
- **Criterion:** untrusted cloud saved-design RPC rows with cyclic objects, BigInt or throwing `toJSON` must return invalid, not crash listing/recovery. Existing valid row contract unchanged.
- **Evidence:** parent Full CI #44896164022 and Non-3D #44896164051 SUCCESS at `38517af8b6a7e440838ec1b940ec0bd8d1e25540` only. New tests committed in `tests/customer-saved-design-wire.test.ts`; no local execution or matching-head CI yet.
- **Blockers:** matching-head CI/Non-3D, authenticated two-account browser, disposable DB, independent security review, dependency-complete main intake; physical customer, stock, tailor and device gates remain pending. No production deployment or live DB mutation.
- **Next slice:** verify exact-head workflows, then independently validate customer cloud ownership using two authenticated browser accounts and disposable database before isolated main intake.


## 2026-11-21 — Hostile accessor fail-closed boundary
- **Parent:** `24b496d7e415a27f16b5b998e571d413e4926d7b`; **code:** `f8e200fc875416a0696c72b95f7d127044c627bf`; **regression:** `b64127bbc3ea7c6183dab103a5d38fa17703f194`.
- **Criterion:** malformed in-memory saved-design payloads with throwing getters or Proxy traps must return invalid rather than crash the owner-scoped write/read validation boundary.
- **Evidence:** previous parent Full CI #44905677566 and Non-3D #44905677558 SUCCESS. New source and negative regression committed; no local tests run; matching-head CI for new SHA pending at checkpoint. No physical or staging verification claimed.
- **Blockers:** authenticated two-account browser and disposable database verification, independent security review, isolated dependency-complete main intake; real stock, tailor, operator, device and native geometry acceptance remain PENDING/BLOCKED.
- **Next slice:** verify exact-head CI, perform authenticated owner-switch isolation with disposable DB, then assess safe main-based intake. No deployment or live-data mutations.


## 2026-11-21 — Exact-head CI verification of hostile accessor regression
- **Verified parent/head:** `704b6788096e4b0cf207e537e64721857f29b1da` (previous checkpoint; no new application code in this verification slice).
- **Criterion:** automated customer saved-design hostile-accessor regression and full non-3D engineering suite at the same commit.
- **Evidence:** GitHub Actions Full CI run #44910930048 **SUCCESS** and Deep Engine Non-3D QA run #44910930033 **SUCCESS**, both fetched by exact commit SHA. This is automated CI evidence, not independently executed local tests, authenticated browser pilot, staging, or physical approval.
- **Main safety:** live main `480fbea8c110bef9505fd8ccd072bf0fd69dea2b` retains `vercel.json` git.deploymentEnabled=false; candidate branch compared to main at 291 ahead / 33 behind. Entire stacked branch is **NOT** eligible for main merge.
- **Blockers:** customer two-account real authenticated browser isolation, disposable PostgreSQL ownership/RLS integration, independent review, dependency-complete main-based intake, stock/tailor/operator/device/native 3D human evidence all remain PENDING/BLOCKED.
- **Next acceptance slice:** build an isolated main-based cloud saved-design wire + client dependency intake, with actual account isolation and disposable DB checks; do not merge until exact-intake-head CI, browser, security and release gates pass. No deployment or live data mutation.
