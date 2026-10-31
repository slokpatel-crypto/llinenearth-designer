## 2026-10-31 — J1/T3 M72 integrate physical receipt dedupe with private operator stock audit
- [x] Created new stack directly from the *newest compatible* independent draft PR #565 exact head `899840d08887c441442d6e0c0fed4fe7387b7cdb` on #564. Preserved sibling #565 physical receipt natural-key migration and matching audit fixture, and integrated sibling #566's aggregate-only operator audit, not by changing the PR base or merging into main.
- [x] Both features coexist on one child: synthetic-only CI PostgreSQL stock audit RPC (10 aggregate counts, service-role-only), authenticated bounded private/no-store operator GET audit, optional Stock Desk button with stale-result invalidation, physical receipt double-count veto across different request keys, and individual SQL/Node/static source gates.
- [x] Reconciled overlapping operator component, SQL historical runner, release gates and tests while preserving original photographic Studio and no mandatory paid AI.
- [ ] Confirm exact-integrated PostgreSQL, Node quality, eval:engine, preview, static release, Next build and responsive browser CI/Non-3D PASS, fix any failure. No production SQL, live stock, merge/deploy.
- [ ] Genuine supplier records, aggregate owner audit approval, meterage source authenticity, real operator, tailor/QC, native Blender, real beta and deliveries and owner schema/production release approval remain BLOCKED/PENDING.

## 2026-10-31 — J1/T3 prevent duplicate physical receipt metres across independent request keys (M71)
- [x] Found remaining gap: stock_record_v3 only deduplicated the SAME request key. Two tabs/devices using different keys could record the same documented physical roll/receipt line twice and inflate available metres. Do not equate typed evidence with physical verification.
- [x] Added **unapplied** later migration `20261031_stock_receipt_source_line_dedupe.sql`: legacy duplicate preflight veto (no cleanup), partial unique ledger index on (fabric SKU, normalized exact source LINE) for receipts only, and source-line veto after the existing fabric advisory lock. Same-key exact retry still returns the original UUID. Different real source lines/fabrics remain permitted; adjustments retain separate evidence and request-key controls.
- [x] Added owner-authorized read-only **count-only** receipt source audit; disposable CI synthetic legacy duplicate/blank/placeholder fixture; actual migration-refusal rehearsal and cleanup **only** in ephemeral PostgreSQL. Added SQL positive/negative and direct-index tests plus two real concurrent sessions with different keys and one physical source. Stock Desk now explicitly requires the genuine roll + supplier document line, never an invented suffix.
- [x] Added Node/source regression and static release gates. All physical stock data remain unverified, and this migration is not installed in Supabase.
- [ ] Require matching-head PostgreSQL, quality, full Node, engine, preview, release, production build, 390/768/1440 browser and Non-3D PASS before crediting **code** gate. GitHub source commits alone are not runtime verification.
- [ ] Owner must review actual supplier line standards, real duplicate/blank source audit and reconciliation, staging/rollback migration plan, signed physical metres and authenticated operator cross-device test. Tailor/QC, native Blender, devices, five novice betas, ten actual deliveries, privacy/security, separate merge and production-deploy approvals remain BLOCKED/PENDING.
- [ ] Next slice: inspect matching-head CI; repair any failure, then require owner-authorized actual receipt-line audit and a safe staging rehearsal before proposing live schema application. No production SQL, stock writes, main merge, deploy or paid AI.

## 2026-10-31 — J1/T3 owner-facing read-only audit before source-line dedupe migration
- [x] Added `scripts/ci/stock-reservation-source-audit.sql`: a **read-only transaction** with only ten aggregate counts and zero raw roll/document/checker IDs in output: total holds, duplicate normalized source-line groups and rows, missing locked revision, missing source, missing named checker, missing request key, missing reservation UUID, padded source, and placeholder source. No stock data read from production or owner files in this run. Source text alone is not evidence of genuine physical stock.
- [x] In **disposable** historical PostgreSQL only, insert five fake legacy reservation rows covering duplicate case/trim source aliases, missing source, missing revision, missing checker/key/hold UUID and placeholder source. Assert the expected audit counts. Run the actual proposed dedupe migration against those rows and require it to fail with the owner-reconciliation message **before any index installs**. Delete only those CI fixture rows from the isolated database, require clean audit counts, then execute the entire historical migration and existing same-line concurrency tests. Refuse direct shell fixture execution outside GitHub Actions.
- [x] Add Node source and static release gates for the audit and fail-closed migration rehearsal.
- [ ] Verify exact-new-head disposable PostgreSQL, Node/quality, engine/preview, release, production build, responsive browser 390/768/1440, Non-3D QA. Do not mark pass until matching-head CI actually succeeds. No live database connection or migrations applied.
- [ ] Actual supplier source references, roll measurements, live ledger summary, verified legacy anomaly review, human owner reconciliation and physical order-line uniqueness are **not proved** by synthetic CI. Real operator login/journey, native Blender, tailor fit/QC, device beta, first ten real deliveries, privacy/security and separate owner schema/merge/deploy approval remain BLOCKED/PENDING.
- [ ] Next: obtain owner-authorized audited source-document line standards and a read-only report from their selected environment, then review genuine anomalies; never silently repair or delete real source rows in a migration.

## 2026-10-31 — J1/T3 make each real meterage/order line unique across reservation request keys
- [x] Verified that prior request-key idempotency stopped repeats only for one key. Two tabs/devices using **different keys** could hold the **same physical source line** twice for the same fabric and immutable locked revision, silently reducing available stock.
- [x] Add **unapplied** later migration `20261031_stock_reservation_line_dedupe.sql`: guard existing duplicate historic rows with an owner-reconciliation error; unique partial index on `(fabric_id, revision_id, lower(trim(source_reference)))` for reservation rows with actual source references; and explicit same-line validation **after shared fabric lock** in the unchanged `fabric_stock_reserve_v2` signature. The earlier exact-key retry still returns the original ID before the natural duplicate check.
- [x] Legitimately shared **sheet** across *different locked revisions* or *different real documented lines* remains allowed; the same line for the same fabric/revision (including case variants or previously consumed/released holds) is rejected. Operator desk now asks for actual sheet + line/item reference and warns never to invent references.
- [x] Expand historical PostgreSQL CI with true same-line SQL and direct-index duplicate tests, legitimate different order/line tests, plus independent simultaneous distinct-request-key/one-source-line race; add Node/source release gates.
- [ ] New-child disposable PostgreSQL + full Node/quality/engine/preview/release/build/390/768/1440 + Non-3D verification **PENDING**. Real migration is NOT applied; existing duplicate data will cause preflight failure requiring genuine owner reconciliation before rollout. A source string is not independent proof that the sheet or measured metres exists.
- [ ] Real supplier sheet source IDs, operator physical measurements and signoffs, cross-device/actual UI acceptance, full historic non-stock migrations, real tailor/QC, native Blender, devices, beta/five novice/ten real deliveries, privacy/security, and owner schema/merge/deploy approvals remain BLOCKED/PENDING. No live SQL, production data, merge or deploy.
- [ ] Next: inspect exact child SQL/Node/browser CI and fix failures. Obtain a real source-document/line identity policy and audit real legacy entries before proposing a production migration.

## 2026-10-31 — J1/T3 reject reservation key collisions with different order evidence
- [x] Found that `fabric_stock_reserve_v2` in `20261031_stock_reservation_concurrency_provenance.sql` returned an existing reservation UUID based solely on `request_key`. A retry using the same key with different fabric, quantity, locked design revision, human checker or meterage evidence was wrongly reported as a valid hold. An existing manual physical receipt's key also had an ambiguous collision response.
- [x] Add a **draft-only, later** `20261031_stock_reservation_exact_key_evidence.sql` migration replacing `reserve_v2` with full stored-intent comparison, exact untruncated keys/fabric/revision and millimetre precision, original shared request/fabric advisory locking, physical available-metre veto and service-role-only privileges. Preserve the RPC signature and earlier migration lineage.
- [x] Expand the real historical PostgreSQL test with positive identical-key retry, negative changed five evidence fields, cross-RPC key collisions, invalid truncation/padding/precision, unchanged row count and grants. Add simultaneous conflicting same-key requests from two database sessions (one accepted, one rejected). Add Node/release-source regression gates.
- [ ] Require the new exact-child **disposable PostgreSQL**, Node/quality, engine, preview, static release, production build, 390/768/1440 browser and Non-3D PASS. The migration is NOT applied to live Supabase; fail closed when historical SQL install is missing instead of claiming physical stock safety.
- [ ] Next: physical source-document uniqueness across *different* keys/tabs/devices, actual supplier roll/metres records, authenticated operator acceptance, real tailor/QC and original-model Blender four-view, beta/ten deliveries, privacy/security and owner schema/merge/deploy signoffs remain outstanding. No production writes, migrations, main merge or deployment.

## 2026-10-31 — J1/T3 stock RPC idempotency must survive actual historical migration chain
- [x] The earlier disposable PostgreSQL M66 job passed for `fabric_stock_record_v3` but constructed a minimal ledger fixture. That cannot independently verify the real legacy table, provenance columns, request-key index, reserve/consume/release RPC replacement order or complete stock lifecycle.
- [x] Extend the **existing disposable PostgreSQL 16 service only**, creating `titan_stock_historical` as a second isolated database. Apply the six actual chronological stock migrations from `20261001_fabric_stock_ledger.sql` through `20261031_stock_record_exact_retry.sql` without reimplementing their schema. Run the same original assertions and two-session concurrency race in both the minimal fixture and real stock-only chain.
- [x] Add actual RPC integration assertions: real `fabric_stock_reserve_v2` idempotency; v3 receipt retries; reservation-key versus record-key collision; oversell veto; `fabric_stock_consume_reservation_v2` releases unused metres exactly and cannot consume a closed reservation; `fabric_stock_release_v2` cannot double-release; physical/reserved/available snapshot arithmetic; older RPC existence and RLS.
- [x] Add Node regression and release-source gates requiring the historical migration sequence and cross-RPC assertions.
- [ ] Full-integrated migration, exact-child Postgres service, CI, Non-3D, Next build, Node tests and browser QA **PENDING until the draft's current SHA completes all workflows**. This is a stock-only migration-chain test, not a replay of every unrelated production/customer schema migration, nor a human physical roll check. SQL remains unapplied to live infrastructure.
- [ ] Real supplier roll ID and physical metres validation, signed-in operator/customer end-to-end flow, cross-device different-key idempotency, actual installation/recovery/rollback migration, tailor QC/Blender/native performance, five novice beta journeys, ten no-reentry real deliveries, privacy/security and owner release signoff remain BLOCKED/PENDING. Do not merge, deploy or run live SQL.
- [ ] Next engineering slice: resolve any exact-head historical PostgreSQL CI failure without weakening tests, then prototype real source-document identity policy to reject the same physical roll receipt across different idempotency keys.

## 2026-10-31 — J1/T3 prove stock v3 retry safety in disposable real PostgreSQL
- [x] Added an isolated PostgreSQL 16 job on GitHub Actions that loads the **actual unchanged** `20261031_stock_record_exact_retry.sql` file against a disposable schema with the existing partial unique `request_key` index. No Supabase instance, database secret, existing ledger or production data is contacted.
- [x] Added SQL assertions for identical-key same-event UUID and one row, conflicting quantity/fabric/checker/source/note veto, reservation-vs-record key collision, unreserved-metre adjustment veto, exact 0.001 m precision and no anonymous/authenticated execute privilege.
- [x] Added two-session real PostgreSQL concurrency tests: same-key simultaneous receipts return one event ID; competing 2m adjustments against 3m available allow exactly one commit. Retain failure diagnostics and enforce scripts/workflow existence in Node and release source gates.
- [ ] Exact child SHA GitHub Actions `TITAN Stock Record — Disposable PostgreSQL` must finish PASS. Repair any actual SQL, environment or shell failures and rerun **before** claiming DB concurrency acceptance. Parent #559 CI/Non-3D are independent. Current local runtime has no PostgreSQL engine; static source tests are not SQL execution.
- [ ] Physical supplier roll/source IDs, true supplier-ledger import, installed v3 production migration, cross-device idempotency with **different** request keys, genuine account/operator use, tailor/QC/3D/device/beta deliveries, privacy/security and release signoffs still require independent evidence. No live SQL, production writes, merge or deployment.

## 2026-10-31 — J1 physical manual stock events must be idempotent under cross-tab retries
- [x] Identified a real double-counting defect: `fabric_stock_record_v2` directly appends receipts and adjustments with no `request_key`. A timeout, page retry or second tab could record the same measured fabric twice. The already-shipped ledger partial unique `request_key` index and reserve_v2 locking provide a compatible basis for a new RPC.
- [x] Draft new **unapplied** `supabase/migrations/20261031_stock_record_exact_retry.sql`: `fabric_stock_record_v3` requires exact, bounded request keys, serializes by request key, validates every physical evidence field before returning a prior event ID, rejects conflicting-key reuse, holds shared `stock-fabric:` lock for adjustment-out availability, and restricts execution to `service_role`. Existing v2 SQL retained for backwards-compatible migrations but the new API fails closed rather than silently calling v2.
- [x] Browser normalizes measured physical event first, gives the same identical event one key across in-tab retries and edit/revert, warns on ambiguous results and blocks repeated confirmed event. Server validates literal request key and only calls v3. Added pure signature/key tests, SQL/source safety tests and static release gates. No phantom physical stock, no schema applied.
- [ ] **PENDING:** exact-new-child CI/Non-3D dependency audit, Node/quality/engine/preview/release/build and real browser QA. Independent local DB transaction test and migration install compatibility must be verified in an isolated test DB before any owner-approved deployment. Browser keys are per-tab and not persisted across reloads; **different keys do not guarantee global deduplication**. Production physical roll counts, supplier validation, authenticated operator, tailor/QC, native Blender, devices, five beta journeys, ten genuine deliveries, privacy/security and owner approvals PENDING/BLOCKED.
- [ ] Next: verify real SQL concurrency/idempotency under two sessions and conflicting payloads in a disposable nonproduction database; then evaluate a durable operator-visible event lookup/recovery with unique signed source document IDs, and obtain explicit schema migration approval. No main merge, live SQL write, deployment or paid AI.

## 2026-10-31 — J1 stock reservation browser retries must preserve the same SQL request key
- [x] Reproduced that the operator Stock Desk created a fresh `crypto.randomUUID()` for every reserve button press, even when a previous request had timed out after the SQL transaction committed. React `busy` updates were asynchronous and older GET snapshots could replace newer post-write stock. Non-idempotent physical `record` retries could also silently duplicate counts.
- [x] Add a pure exact-intent signature and stable browser-session request key per reservation (fabric, revision, metres, named checker, meterage source); re-use the same key on ambiguous retries, including when details are edited and restored. Keep the already-shipped SQL `fabric_stock_reserve_v2` request-key lock unchanged; do not invent stock.
- [x] Use synchronous `useRef` single-flight for all four stock mutation actions; invalidate older reads before writes; always reconcile stock after success, 4xx/5xx, parse failure or timeout. Keep actions disabled until a verified current GET; block another identical reservation after an authoritative receipt and display an explicit status message. Warn operators that record/consume/release errors can be ambiguous and need ledger verification before retry.
- [x] Add pure regression for key reuse across five changed fields and restoring original input, source regression for synchronous lock/read generation, and static release-source gate.
- [ ] Require exact-new-head dependency audit, quality, Node, engine, preview, release, Next build, browser 390/768/1440 and Non-3D PASS before considering the code gate complete. Last parent #556 CI/browser was pending at selection. Live SQL migration installation, cross-tab/page-refresh/device idempotency, durable stock event dedupe, actual measured supplier rolls, authenticated operator acceptance, physical tailor/QC, native Blender, beta deliveries, security/privacy and owner release approvals remain PENDING/BLOCKED. No production writes/migrations, paid AI, main merge or deployment.
- [ ] Next independent work: owner-reviewed SQL transactional idempotency for physically recorded stock receipts, protecting cross-tab/device retries as a distinct release criterion; do not deploy schema without approval.

## 2026-10-31 — J1/T3 operator stock API must not leak private evidence or accept altered write receipts (stacked draft)
- [x] Identified that `/api/operator/stock` returned many success, 401 and error branches without explicit private/no-store protections; unexpected privileged RPC exceptions were reflected through `error.message`. `normalizeVaultId` trimmed altered stock event/reservation UUID receipts before reporting success.
- [x] Use one private/no-store/no-cache Next response helper for **every** GET/POST branch; preserve authentication, Origin/JSON bounds, strict physical stock validation, source evidence and existing RPC interfaces. Return a generic unexpected-operation error rather than exposing SQL/RPC diagnostics.
- [x] Reuse existing exact vault UUID contract with literal-equality enforcement before confirming recorded stock event or reservation. Keep legitimate uppercase UUIDs, reject padding, arrays, objects, booleans and malformed IDs. Add pure and source regressions, built-Next unauthenticated GET/POST stock header smoke in both CI lanes, and static release gates.
- [ ] Require both exact-new-commit CI and Non-3D PASS (audit, quality, Node tests, engine, preview-performance, release, build, browser 390/768/1440). HTTP smoke only proves anonymous response headers, not live authenticated stock acceptance. Independent physical roll/metres, signed-in operator/customer, physical tailor/QC, native Blender, real devices, five beta journeys, ten deliveries, security/privacy and owner approval remain BLOCKED/PENDING.
- [ ] Next engineering slice: verify real operator stock mutation validation and backend retry/idempotency semantics without touching production database. No main merge, deploy, live writes/migrations or paid-provider calls.

## 2026-10-31 — J5 stale operator GET must not reauthorize post-mutation controls (stacked draft)
- [x] Reproduced source race: an initial or overlapping GET could complete after a quote/order/status POST and replace fresh ledger data with older quotes, QC, outcomes and order statuses; the UI initially treated the ledger as configured before a verified GET. A failed/ambiguous POST did not force a reconciliation refresh. Linked packet export and status controls were not explicitly tied to current ledger verification.
- [x] Default ledger readiness to false; use monotonically increasing read versions to discard superseded success and error responses; clear old evidence and disable status/linked packet actions during refresh. Invalidate pending GET before POST; reconcile the ledger after both success and failure. Add Node source regression and release gate; preserve verified locked revision, independent tech-pack export, original model/photo and no-paid-AI Designer.
- [ ] Exact-head dependency audit, quality, full Node, engine, preview-performance, release check, build, Chromium 390/768/1440 and Non-3D pending CI. No server-side idempotency/atomic order+QC snapshot proven. Genuine stock, authenticated owner/operator, physical tailor/QC, native Blender, devices, beta/ten deliveries, privacy/security and owner approvals remain BLOCKED/PENDING. No live writes, migrations, paid provider, main merge or deployment.

## 2026-10-31 — J5 operator mutations must be single-flight before React rerender (stacked draft)
- [x] Reproduced source-level duplicate-submit window: `post` and vault recovery relied on asynchronous `busy` state; two same-render clicks could both enter before React disabled the controls, creating duplicate quote/order writes or overlapping recovery.
- [x] Add one synchronous `useRef` guard shared by mutations and recovery, claim before the first await and release in each finally. Add Node source regression and static release guard. Preserve existing receipt verification, immutable lock, original model/photo and no paid AI.
- [ ] Verify this exact child SHA dependency audit, quality, full Node, engine, preview-performance, release check, build, Chromium 390/768/1440 and Non-3D. Browser rapid-click behavior and server-side idempotent retry remain PENDING; this client guard is not an exactly-once backend guarantee. Genuine stock, authenticated owner/operator, physical QC/tailor, Blender, devices, beta deliveries, privacy/security and approvals remain BLOCKED/PENDING. No merge/deploy or live write.

## 2026-10-31 — J5 production packet quote/order must be the same actual receipt (stacked draft)
- [x] Reproduced that exportProductionPacket independently picked the first matching accepted quote and first matching order by recipe. Two real orders or quotes for one locked revision could produce a packet falsely associating unrelated quote and order identities.
- [x] Select a unique order only; attach only its exact accepted quote_id receipt (case-insensitive PostgreSQL UUID), never a merely same-recipe quote. Omit independently capped missing quote evidence; refuse ambiguous multiple orders or quotes. Add pure positive/negative and browser-source regressions plus release guard; preserve canonical photo/model, no-paid-AI preview, backward-compatible recipe and no new schema.
- [ ] Verify exact child head dependency audit, quality, full Node, engine, preview-performance, release, build, 390/768/1440 browser and Non-3D. A real operator must confirm packet-to-order lineage and human tailor handoff. Supplier stock, owner/customer Supabase, physical QC, native Blender, devices, beta/deliveries, security/privacy and owner approvals remain BLOCKED/PENDING. No main merge, production deploy, paid provider or production database write.

## 2026-10-31 — J5 mixed-case QC order UUID cannot conceal newer rework (stacked draft)
- [x] Reproduced that latest-delivery QC scanned `row.order_id!==orderId` while the lineage check used case-insensitive UUID equality. A newer uppercase-hex PostgreSQL UUID rework could be skipped, leaving an older lowercase approval to authorize delivery.
- [x] Normalize only the comparison to case-insensitive UUID hex, preserving literal provenance, newest timestamp/rework veto, six physical checks, immutable lineage and capped-ledger fail-closed rules. Add mixed-case approval/rework regressions and release-source guard.
- [ ] Verify this exact child head's dependency audit, quality, full Node tests, engine, preview-performance, release check, build, responsive 390/768/1440 Chromium and Non-3D. Real supplier stock, authenticated customer/operator, physical QC/tailor, native Blender, devices, beta deliveries, privacy/security and owner approvals remain BLOCKED/PENDING. No main merge or deploy.

## 2026-10-31 — J5 physical QC must match the current ready order's immutable recipe (stacked draft)
- [x] Reproduced that the privileged delivered transition checked the newest six-pass QC receipt for an order UUID but did not compare its inspection UUID, locked revision, recipe hash or creation time to the current production order. A success-shaped but mismatched QC ledger could therefore unlock delivery for another recipe.
- [x] Require an exact inspection UUID and matching revision/hash for every same-order QC row, valid inspection timestamp no earlier than the order, and an actual current ready order from a verified non-saturated 150-row page. Fail closed when the target is absent, malformed or the page is capped. Apply the same rule to the operator delivery button; add positive/negative regression and release-source checks. No schema, model/photo, paid AI, stock fabrication or production write.
- [ ] Verify this exact draft head's dependency audit, quality, Node tests, engine, preview-performance, release, build, 390/768/1440 Chromium and Non-3D. This remains a non-atomic capped read: production-safe delivery at scale needs an owner-reviewed transactional SQL RPC. Genuine supplier stock, authenticated owner/operator, physical QC/tailor, native Blender, devices, five beta cases, ten real deliveries, privacy/security and separate owner approvals remain BLOCKED/PENDING. No main merge or deployment.

## 2026-10-31 — J5 optional production evidence rows must be typed (stacked draft)
- [x] Reproduced that installed optional QC/outcome/context RPCs could return HTTP 200 arrays containing arbitrary objects; the server and browser previously checked array caps/source flags only. A forged outcome could crash the operator UI at `overall_rating.replaceAll`, while empty or malformed learning context could be displayed as attached production lineage.
- [x] Fail closed on invalid QC, outcome and context row identity, calendar timestamps, required UI fields and duplicate inspection/outcome IDs in both server and client response guards. Preserve nullable historical QC inspector/reference (never counts as approved delivery). Add positive/negative regressions.
- [ ] Verify exact-head audit, quality, full Node, engine, preview, release, build, responsive Chromium 390/768/1440 and Non-3D. Human/physical stock, customer/operator, tailor, native Blender, devices, beta/deliveries, privacy/security and owner approvals remain BLOCKED/PENDING. No merge or deploy.

## 2026-10-30 — J4 public bearer-link referrer and indexing privacy (stacked draft)
- [x] Reproduced that the signed public share page inherited the site-wide `strict-origin-when-cross-origin` header, which exposes the full bearer URL to same-origin navigation and lacks a route-specific noindex/no-store policy. A consented public link is not a private account page.
- [x] Add later-matching `/share/:token` response headers `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: private, no-store`, plus page robots/referrer metadata and regression coverage of header precedence. Preserve existing signed links, expiry, deterministic original model/photo and no paid AI.
- [ ] Verify exact-head audit, quality, Node, engine, preview-performance, release check, production build, responsive Chromium 390/768/1440 and Non-3D. A real browser network-header/privacy review and authenticated customer share acceptance remain PENDING; physical stock, tailor, native Blender, devices, beta/delivery and owner approvals remain BLOCKED/PENDING. No main merge, deploy, paid provider or production database write.

## 2026-10-30 — J4 public share must be owner-verified and separately consented (stacked draft)
- [x] Reproduced that a bare, self-hashed locked revision could mint a 30-day public bearer link without signed-in ownership or explicit disclosure consent; a failed share audit still returned the token with `audited:false`. The Studio called it a "private" link despite anyone with the URL being able to view it.
- [x] Require a literal recovery token and separate `consentToShare:true`, authenticated customer identity, BOTH owner-scoped and recovery-key vault reads with exact lock lineage, valid bounded audit UUID and a configured signing secret **before** issuing any public share token. Studio gates the button on a verified account-owned secure copy and independently resettable share consent, validates the receipt and explains bearer-link visibility. Add pure/source regressions; keep original model, photo, measurement exclusion, no-paid-AI preview, signed public-link reader and existing owner-verified enquiry.
- [ ] Verify this exact draft SHA dependency audit, quality, full Node, engine, preview-performance, release check, production build, responsive 390/768/1440 Chromium and Non-3D. Real authenticated customer/operator acceptance, audit RPC/schema compatibility, consent/security/privacy owner review, verified supplier stock, tailor/QC, native Blender, real devices, five beta and ten actual deliveries remain PENDING/BLOCKED. No live writes, migrations, paid providers, main merge or deploy.

## 2026-10-30 — J5 operator quote labels and currency must be literal, complete receipts (stacked draft)

- [x] Reproduced that quote normalization coerced JSON arrays/objects into valid-looking three-letter currencies and line-item labels, and silently truncated labels longer than 160 characters. A misleading quote could be persisted and handed to a customer/tailor.
- [x] Keep the existing omitted-currency INR default and supported literal three-letter currencies, but reject other JSON types. Require exact scalar nonempty line-item labels, reject overlength or control-bearing labels instead of silently changing operator instructions; add positive/negative quote regressions. No schema, production writes or currency whitelist change.
- [ ] Require exact-head audit, quality, full Node tests, engine, preview-performance, release check, build, Chromium 390/768/1440 and Non-3D. Real operator/customer quote acceptance, supplier stock, tailor/QC, native Blender, devices, beta/delivery, privacy/security and owner signoff remain BLOCKED/PENDING. No main merge, paid AI or deploy.

## 2026-10-30 — J3 persisted legacy labels must match the supported photo/tailor vocabulary (stacked draft)

- [x] Reproduced that a saved StyleSpec v2 could contain arbitrary nonempty legacy labels, including withheld Wing Collar/Contrast Placket, and still pass lock/recovery validation even though no supported photographic selector could reconstruct them.
- [x] Validate all eleven persisted legacy fields against existing selectable option-library labels and the two fixed collar-finish/shirt-wear vocabularies; preserve supported provisional labels and canonical advanced-only IDs. Add forged-label and compatibility regressions.
- [ ] Require exact-head dependency audit, quality, full Node tests, engine, preview-performance, release:check, build, Chromium 390/768/1440 and Non-3D. Genuine owner-scoped Supabase recovery, physical stock/tailor, native Blender, real devices, five beta, ten deliveries, security/privacy and owner approval remain BLOCKED/PENDING. No live writes, schema, paid providers, main merge or deploy.

## 2026-10-30 — J2 advanced controls must not diverge from visible photographic selections (stacked draft)

- [x] Reproduced that `changeExpandedCut` synchronized only cuffs, so a selectable expanded collar/placket/fit/rise/waistband/break could change the canonical construction without updating the legacy control rendered on the original Studio photograph. Also found that `toLegacyStyle` could surface legacy-unselectable Wing Collar/Contrast Placket and retained stale collar-cloth finish.
- [x] Bridge all seven compatible expanded groups to existing actual `DESIGNER_STYLE_CHOICES`, reject advanced-only/unselectable labels, preserve versioned v2-only selections, and make canonical collar finish reconstruct correctly. Added positive/negative pure and source regressions. Original model/photo, stock and paid-AI behavior unchanged.
- [ ] Verify this exact draft head's dependency audit, quality, full Node tests, engine, preview-performance, release check, build, 390/768/1440 browser option matrix and Non-3D. Real photo shape accuracy, supplier rolls/metres, authenticated owner/operator, tailor/QC, native Blender, devices, five beta, ten genuine deliveries, security/privacy and owner approvals remain PENDING/BLOCKED. No live writes, migrations, paid providers, main merge or deployment.

## 2026-10-30 — StyleSpec v2 JSON envelope cannot coerce option identities (stacked draft)

- [x] Reproduced that `validateStyleSpecV2` converted single-element array/object-like garment IDs and shirt-wear/collar-finish fields to strings and accepted incomplete/incorrect legacy envelopes.
- [x] Require literal IDs, non-array shirt/pant/legacy records and all eleven nonempty legacy labels; keep supported advanced options and hash inputs unchanged. Add positive and negative regressions.
- [ ] Verify this child SHA's dependency audit, quality, full Node tests, engine, preview-performance, release:check, build, responsive 390/768/1440 browser, and Non-3D QA. Authenticated owner/operator, genuine supplier inventory, tailoring, native Blender, real devices, beta/delivery, security/privacy and owner approval remain PENDING/BLOCKED. No production writes, migration, provider charges, main merge or deployment.

## 2026-10-30 — J5 operator delivery browse receipts must be typed before display or evidence recording (stacked draft)
- [x] Reproduced that a successful delivery-order/evidence RPC returning an array with null, coerced IDs, malformed timestamps or invalid re-entry fields passed the API array-only check. The operator UI then dereferenced row IDs or called .join on unverified fields; it could crash or display a misleading partial history.
- [x] Add shared pure 500-row-cap, exact UUID, duplicate-ID, calendar and safe-field-array browse validation. Fail the privileged GET closed with 503 and make the client reject malformed success-shaped responses before rendering or offering audit controls. Preserve nullable legacy notes, optional delivery timestamp and original first-ten SQL release authority; tests cover positive and negative cases.
- [ ] Verify matching-head dependency audit, quality, full Node, engine, preview-performance, release:check, build, responsive Chromium 390/768/1440 and Non-3D. Genuine stock, authenticated customer/operator, physical tailor/QC, devices, native Blender, five beta cases, ten deliveries, privacy/security and owner approvals remain BLOCKED/PENDING. No live writes, migrations, paid providers, main merge or deployment.

## 2026-10-30 — J5 authoritative physical audit IDs must be exact database UUIDs (stacked draft)
- [x] Reproduced first-ten proof accepting arbitrary nonempty order and evidence receipt strings (e.g. `synthetic-order-1` and `fake-audit-id`) as immutable SQL identities; trimming-only guards could not distinguish forged successful JSON from UUID-returning database columns.
- [x] Reuse the existing exact literal operator UUID receipt validator for authoritative first-ten order, evidence-order and evidence IDs; preserve legitimate uppercase UUIDs and reject synthetic, padded and coerced identities. Update pure/calendar proof fixtures to valid version-4 UUIDs and add negative forged-ID regressions.
- [ ] Require this exact SHA's dependency audit, quality, full Node, engine, preview-performance, release check, build, responsive Chromium 390/768/1440 and Non-3D QA. Genuine supplier stock, authenticated owner/operator, tailor/QC, devices, native Blender, five beta cases, ten actual deliveries, privacy/security and owner release approvals remain BLOCKED/PENDING. No production writes, migrations, paid providers, main merge or deploy.

## 2026-10-30 — J3 owner-scoped vault list completeness and duplicate identity safety (stacked draft)
- [x] Reproduced both authenticated owned-list routes silently omitting malformed, expired or invalid rows and allowing repeated UUID identities. A corrupt RPC could return an apparently complete but truncated saved-design/measurement list.
- [x] Require every returned row to have a valid, current, exact UUID envelope and reject duplicate IDs case-insensitively; fail the whole list on invalid design payload/hash/signature or measurement/observation profile. Reject saturated SQL-capped owner lists (100 designs, 50 measurements) rather than reporting a truncated history as complete. Preserve empty valid lists, existing account identity and recovery-token semantics.
- [ ] Verify exact-head quality, full Node tests, engine, preview, release, build, Chromium 390/768/1440 and Non-3D. Genuine authenticated owner save/list/recover/claim, supplier inventory, physical tailor, devices, native Blender, beta/delivery, privacy/security and owner signoff remain BLOCKED/PENDING. No production writes, migrations, provider charges, main merge or deploy.

## 2026-10-30 — J3 both durable vault stores require exact UUID receipts (stacked draft)
- [x] Reproduced design/measurement store routes accepting a padded or coerced upstream store ID via the recovery-token UUID normalizer. A malformed successful RPC could produce an apparently durable recovery credential and trigger owner-link attempts.
- [x] Validate the literal PostgreSQL UUID scalar before issuing a design or measurement recovery token or linking owner. Shared strict helper, positive uppercase UUID and negative padded/array/object receipt regressions, both route source guards. Preserve existing owner-scoped actions, recovery token formats and no-paid-AI Studio.
- [ ] Exact-head quality, full Node tests, engine, preview-performance, release check, build, responsive 390/768/1440 browser and Non-3D must PASS. No real owner authenticated vault store/load/recovery, physical supplier/tailor, native Blender, device, beta/delivery, privacy/security or owner release approval claimed. No live write/migration, paid AI, main merge or deploy.

## 2026-10-30 — J4 share/enquiry audit receipts must be exact literal UUIDs (stacked draft)
- [x] Reproduced `verifiedLockedHandoffAuditId` trimming padded upstream UUID strings and `/api/designer/enquiry` using the same permissive `normalizeVaultId` directly. Both could claim `audited:true` from an altered RPC receipt rather than a literal database ID.
- [x] Require an exact scalar UUID receipt (case-insensitive hex only, no whitespace/coercion) in the shared share/enquiry audit helper, and use it in the owner-scoped enquiry API. Add positive uppercase and negative padded/array tests, source regression and release contract.
- [ ] Verify new exact-head quality, full Node tests, engine, preview, release, build, 390/768/1440 Chromium and Non-3D. Real authenticated owner-scoped enquiry/operator receipt and actual WhatsApp send remain unverified; physical stock, tailor, devices, native Blender, beta, delivery, security/privacy and owner approval BLOCKED/PENDING. No DB writes, migrations, provider charges, main merge or deployment.

## 2026-10-30 — J5 saturated global QC pages cannot authorize delivery (stacked draft)
- [x] Reproduced that a full `finished_garment_qc_list` page (500 server / 250 operator UI) could be accepted as proof of latest-by-order QC even though the list is capped and may omit relevant history.
- [x] Fail closed at the exact configured row cap and on invalid caps in the shared latest-QC guard; wire 500 to the privileged delivery transition and 250 to the operator UI. Add saturated/unsaturated and invalid-limit regressions; preserve existing strict timestamp/provenance checks.
- [ ] Verify this exact stacked head in quality, full Node tests, engine, preview-performance, release check, production build, 390/768/1440 Chromium and Non-3D. A sub-cap list is still not an atomic latest-by-order database receipt; owner-approved DB change would be required for a complete guarantee. Real supplier stock, signed-in customer/operator, tailor, devices, native Blender, five beta cases, ten deliveries, security/privacy and release approval remain BLOCKED/PENDING. No live writes, migration, paid AI, main merge or deployment.

## 2026-10-30 — J5 impossible QC timestamps must never outrank physical rework (stacked draft)
- [x] Reproduced `Date.parse("2026-02-31T12:00:00Z")` normalizing to March 3; a nonexistent approved inspection could outrank a genuine March 2 rework and falsely allow delivered status.
- [x] Validate literal full calendar day and 00–23/00–59/00–59 wall-clock before parsing the timezone instant. Preserve valid leap-day, fractional-second and offset timestamps. Add phantom-approval/rework and positive/negative regressions. This shared guard covers both server and operator UI.
- [ ] Require exact-head quality, Node, engine, preview-performance, release, build, Chromium 390/768/1440 and Non-3D. A 500-row list is not atomic latest-by-order proof. Genuine physical tailor/QC, supplier stock, owner/operator, devices, native Blender, five beta, ten deliveries, privacy/security and release approval remain BLOCKED/PENDING. No live write, migration, paid provider, main merge or deployment.

## 2026-10-30 — J5 operator production errors must not reveal private backend diagnostics (stacked draft)
- [x] Reproduced the privileged operator production POST exception handler reflecting raw SQL/RPC error.message into HTTP 409, potentially exposing internal owner/order/schema details.
- [x] Keep server-side diagnostic logging; use a constant generic private no-store error for unexpected failures, while preserving explicit 400 validation and 409 verified-receipt errors. Add regression against reintroducing exception-message reflection.
- [ ] Verify this exact child SHA in quality, full Node, engine, preview-performance, release check, production build, Chromium 390/768/1440 and Non-3D QA. This is code-level security hardening, not human security/privacy signoff. Live supplier stock, signed-in owner/operator acceptance, physical tailor, devices, native Blender, beta/deliveries and owner approval remain BLOCKED/PENDING. No migration, live write, paid provider, merge or deployment.

## 2026-10-30 — J5 first-ten delivery audit RPC failure must not be mistaken for absent migration (stacked draft)
- [x] Reproduced operator delivery evidence GET catching every first-ten RPC failure (malformed 200, upstream 5xx, timeout and missing migration) and returning a success-shaped `firstTenBasis:null` ledger.
- [x] Preserve compatibility only for an actual HTTP 404 missing optional RPC, with explicit `firstTenAuditInstalled:false`; reject installed malformed, unreachable or oversized responses and validate typed first-ten receipt. Valid `historyValid:false` remains visible but never release-capable.
- [x] Added positive/negative receipt and route-wiring regressions, and updated previous source contract for the strengthened first-ten check. No schema change, live write, provider charge, main merge or deployment.
- [ ] Verify matching-head quality, full Node, engine, preview-performance, release check, build, real 390/768/1440 Chromium and Non-3D. Genuine first-ten RPC migration, real ten deliveries, stock, signed-in owner/operator, tailor, devices, native Blender, security/privacy and owner approvals remain BLOCKED/PENDING.

## 2026-10-30 — J5 optional operator evidence receipts must be distinguishable from missing migrations (stacked draft)
- [x] Reproduced operator production GET treating malformed 200 QC, customer-outcome or learning-context RPC bodies as success-shaped empty/invalid optional lists; all upstream failures were also silently converted to empty history.
- [x] Require literal arrays for installed optional RPCs; a malformed 200, 5xx, timeout or invalid JSON now fails the operator production GET closed. Preserve legacy compatibility only for HTTP 404 missing optional RPCs and expose explicit installed-status flags rather than representing absent migration as verified zero history.
- [x] Display missing optional evidence status on operator Production Desk. Add positive/negative pure response-shape tests and source wiring; no schema or new dependency.
- [ ] Verify exact-head quality, Node, engine, preview-performance, release, build, 390/768/1440 browser and Non-3D. Human physical supplier/stock, signed-in owner/operator/tailor, devices/native Blender, beta/delivery, security/privacy/owner approvals remain BLOCKED. No live writes, migration, merge or deployment.

## 2026-10-30 — J5 operator delivery UI and stale-ledger controls (stacked draft)
- [x] Reproduced production desk offering "delivered" based on first matching QC row even when latest physical QC was rework or lacked literal provenance; server already rejected such transitions. Reuse the same fail-closed latest-QC helper for the operator affordance and show an unverified state instead of stale approval.
- [x] Reproduced a failed/malformed production ledger refresh leaving stale quotes/orders and mutation controls enabled. Clear stale records, disable create controls and show an explicit retry message on backend failure; preserve unauthenticated redirect and legacy optional-list compatibility.
- [x] Added regression source wiring and latest-QC positive/negative checks. No schema, supplier inventory, live writes, model/photo changes, paid AI, merge or deployment.
- [ ] Verify exact-head quality, full Node, engine, preview-performance, release, build, 390/768/1440 Chromium and Non-3D. Genuine owner/operator/tailor QC, physical stock, device/native Blender, five beta, ten deliveries and security/privacy/owner approvals remain BLOCKED.

## 2026-10-30 — J5 delivery must use latest provenance-backed QC (stacked draft)
- [x] Reproduced the delivered-status gate using `inspections.find` and `String(inspector/reference)`, which could promote an older approved inspection ahead of a newer rework or accept coerced upstream provenance.
- [x] Add pure latest-by-timestamp, fail-closed physical QC reader: require a typed list, literal order identity, parseable timestamp, supported decision and literal bounded inspector/reference; reject same-millisecond ambiguity and latest rework. Use before `production_order_set_status`, preserve DB transition authorization and existing 500-row bound. Add positive/negative out-of-order, stale, tie and coercion regressions.
- [ ] Require exact-head quality, Node, engine, preview, release, build, Chromium 390/768/1440 and Non-3D. Real tailor QC, owner/operator production, supplier stock, physical devices/native Blender, beta/delivery/security/privacy and owner release approvals remain BLOCKED. A capped list is not an atomic database latest-by-order receipt; consider a dedicated DB RPC after owner-reviewed migration planning. No live write, schema change, merge or deploy.

## 2026-10-30 — J5 owner-scoped customer production history must fail closed (stacked draft)
- [x] Reproduced customer production GET returning a success-shaped `{quotes,orders,orderEvents,outcomes}` even when one of the four authenticated Supabase RPCs returned a malformed non-array body.
- [x] Require all four independent owner-scoped RPCs to return actual arrays before returning a customer history snapshot; preserve valid empty lists, owner authentication, bounded decoded reads, no-store and 503 failure semantics. Add pure positive/negative receipt tests and API source regression.
- [ ] Verify exact-head quality, full Node tests, engine, preview-performance, release check, build and 390/768/1440 browser/Non-3D. Live authenticated owner recovery, supplier stock, tailor/device/native Blender, five beta cases, first ten deliveries, security/privacy and owner approval remain blocked. No live writes, migration, merge, deployment or paid AI.

## 2026-10-30 — J5 delivery evidence read and write must fail closed (stacked draft)
- [x] Reproduced unbounded upstream Supabase success/error reads in first-ten delivery audit and evidence browsing, allowing a malformed non-array ledger to appear configured or a padded RPC UUID to become a recorded audit.
- [x] Bounded all delivery evidence RPC reads: 4 MiB list and chronological first-ten basis, 4 KiB write receipt; 8-second abort, private no-store and missing-migration null basis preserved. Require literal exact UUID audit receipt and array-shaped history before a success-shaped configured response.
- [x] Added positive/negative real-stream JSON size, malformed reply, exact UUID and endpoint source regressions; no production data or schema mutations, no fake delivered customers, no paid AI or model/feature change.
- [ ] Exact-head CI, tests, engine, preview, release, build and browser/Non-3D must pass. Live first-ten RPC remains missing; real supplier stock, owner/customer/operator, tailor, device, native model and human release signoffs still BLOCKED. No main merge or deployment.

## 2026-10-30 — J5 QC and operator ledger fail-closed transport (stacked draft)
- [x] Reproduced the finished-garment QC endpoint reading unbounded upstream success/error JSON, accepting trimmed QC receipt UUIDs, and allowing malformed list bodies to appear successful; bounded JSON reader reused with 4 MiB list and 4 KiB mutation caps, 8-second timeout, non-reflected errors, exact scalar UUID receipt and array-shape checks.
- [x] Reproduced the operator production desk converting malformed quote/order RPC list values into apparently empty quote/order ledgers; reject non-array receipts before returning a configured shop snapshot.
- [x] Added positive/negative source and UUID regression coverage; preserved original model, deterministic no-paid-AI core, existing migrations, operator authentication and prior stacked draft changes.
- [ ] Run exact-head quality, Node suite, engine, preview, static release, build, Chromium 390/768/1440, Non-3D QA. Real owner/operator Supabase and genuine supplier/tailor/device/native geometry evidence remain mandatory; do not merge/deploy.

## 2026-10-29 — J5 privileged quote/order creation receipts must be exact (draft)
- [x] Reproduced operator quote and order create routes returning `lockedRevisionVerified:true` and `learningContextAttached:true` without validating the create RPC's returned UUID; null, objects, arrays or padded strings could appear as successful creations.
- [x] Require literal exact UUID scalar from both creation RPCs before reporting success; reject invalid receipts with 409, preserving real locked revision integrity and no-cost deterministic preview. Added positive/negative receipt and route-source regressions.
- [ ] Verify matching-head quality, full Node, engine, preview-performance, release, build, 390/768/1440 browser and Non-3D QA. Real owner/operator Supabase quote/order, genuine supplier stock, tailor/device/native Blender and security/owner approvals remain blocked or pending. No live writes, merge or deploy.

## 2026-10-29 — legacy gallery URL origin spoofing (draft)
- [x] Reproduced the unverified legacy HTML parser accepting arbitrary image URLs and checking links with a string-prefix host test; `https://llinenearth.com.evil.example/` passed the prefix test.
- [x] Enforce HTTPS, exact page origin and no embedded credentials on both discovered images and links. Preserve legitimate relative, protocol-relative and absolute same-origin swatches; add positive/negative pure regressions and parser-wiring assertions.
- [ ] Verify this exact stacked head with quality, full Node, engine, preview-performance, release, build, 390/768/1440 Chromium and Non-3D QA. Real stock, owner-scoped Supabase lock/recovery/enquiry/operator, tailor/device/native geometry, security and human release signoffs remain unverified. No live writes, migrations, main merge or deploy.

## 2026-10-29 — ambiguous operator stock identity must not erase a sold-out veto (draft)
- [x] Reproduced a mistyped operator metadata subtype with a padded or single-element-array active fabric ID being ignored as unrelated, even when it carried an `availability` instruction. That could hide an explicit sold-out veto behind otherwise positive stock.
- [x] Fail closed for ambiguous current-catalogue identities without treating them as valid IDs; preserve genuinely unrelated notes and retired fabrics. Added positive/negative pure regressions.
- [ ] Verify this exact stacked head in full quality, Node, engine, preview-performance, release, build and real 390/768/1440 browser/Non-3D CI. No live supplier stock, owner-authenticated customer/operator acceptance, tailor/device/native Blender or human release approval. No DB writes, migrations, main merge or deployment.

## 2026-10-29 — integrated stock dust and bounded RPC source-test verification (draft)
- [x] Reproduced a tiny positive `available_metres` (e.g. `1e-12`) passing the floating 0.001m tolerance and incorrectly advertising `inStock:true` despite zero ledger units. Reject positive quantities rounding to zero and use integer physical units for customer availability; add Node regressions.
- [x] Reconciled #495's bounded JSON RPC adapter with its renamed validated `record` alias in the existing source-contract test; require literal IDs, a 1 MiB response cap and row-shape validation without weakening checks.
- [ ] Verify exact-head quality, full Node, engine, preview, release, production build and real 390/768/1440 browser/Non-3D QA. Live supplier stock, owner-scoped lock/recovery/enquiry/operator, tailor/device/native Blender, security and human release approvals remain unverified. No live mutation, merge or deployment.

## 2026-10-29 — bound JSON reads on both customer stock evidence services (draft)
- [x] Operator override pages and verified stock RPC use streaming bounded JSON reading instead of unbounded response.json(), with decoded body caps of 4 MiB/page and 1 MiB/stock snapshot under existing 8-second aborts. Oversize, invalid UTF-8/JSON and malformed stock row shapes all fail closed.
- [x] Add real stream/Unicode, exact-byte-boundary, overflow, body absence and malformed response regressions plus both service wiring checks; preserve legitimate stock and no-store semantics.
- [ ] Run exact new-head full CI, Node tests, preview, engine, release, build and pinned browser/Non-3D QA; real supplier stock, authenticated end-to-end customer/operator, physical tailor/device/native geometry, security and owner launch acceptance remain missing. No DB write, schema migration, main merge or deployment.

## 2026-10-29 — integrate padded metadata subtype strictness into latest stacked draft
- [x] Preserve independent PR #494 finding: whitespace-padded or one-element-array designer_fabric_metadata subtype must fail closed instead of hiding operator sold-out history.
- [x] Add positive/negative subtype regression cases alongside active-fabric ambiguity and literal material tags fixes; update legacy source assertions for the typed text parser.
- [ ] Recheck exact-head CI and physical/human launch gates. No main merge, production write, migration or deployment.

## 2026-10-29 — strict operator textile tags and ambiguous sold-out metadata (draft)
- [x] Guard active-catalogue operator notes with an availability key against malformed/typo subtype: fail closed instead of discarding a possible sold-out override.
- [x] Do not convert nested JSON arrays into seemingly reviewed season/role tags; accept literal vocabulary strings only and deduplicate. Preserve full literal weave, texture and operator note or omit invalid/overlong text rather than silently clipping.
- [x] Add pure regression cases and loader source-contract tests; preserve verified stock contract and deterministic no-paid-AI core.
- [ ] Exact-head quality, tests, engine, preview, release, build, browser/Non-3D CI and separate actual supplier stock, authenticated customer/operator, tailor, device, native Blender, security and release approvals still required. No production write, schema migration, merge or deploy.

## 2026-10-29 — operator physical metadata must be literal (draft)
- [x] Reproduced `Number(payload.weightGsm)` accepting `"145"` and `[145]`, and `String(payload.drape)` accepting `["soft"]`; when a provenance receipt existed, these values could become apparently verified physical GSM/drape.
- [x] Require literal finite numeric GSM/formality and literal enum weight class/drape; ignore coerced physical fields while preserving the operator's valid availability veto and existing valid numeric metadata. Reject nonstring weave/texture; add positive/negative pure and loader regressions.
- [ ] Verify this exact stacked draft with quality, Node, engine, preview, release, production build and pinned browser/Non-3D QA. Real supplier GSM/stock, signed-in Supabase operator/customer flow, tailor, device, native Blender and security/release acceptance remain unverified. No live write, migration, merge or deployment.

## 2026-10-29 — malformed operator availability cannot erase a sold-out veto (draft)
- [x] Reproduced the fail-open path: a newer `designer_fabric_metadata` event with JSON-coerced `availability:["available"]` or padded fabric identity was parsed as a valid available record and masked an older explicit sold-out override, even with verified physical stock.
- [x] Validate literal subtype, exact catalogue ID and explicit `unknown|available|unavailable` before selecting the newest operator metadata. A malformed current-catalogue override makes the entire metadata read unavailable, so both customer stock paths fail closed; unrelated notes and retired catalogue IDs remain ignored. Add positive/negative pure and loader wiring regressions.
- [ ] Require exact-head quality, full Node, engine, preview, release, build and pinned Chromium/Non-3D QA; verify actual authenticated owner-scoped Supabase lock/recovery/enquiry/operator workflow and physical stock separately. No fabricated approvals, live write, migration, main merge or deploy.

## 2026-10-29 — reject shifted operator metadata pagination (draft)
- [x] Reproduced a count-valid, contiguous `Content-Range` page sequence that can still repeat a row across offset pages and omit an older sold-out veto during concurrent changes.
- [x] Require strictly descending `at.desc,id.desc` row identity across every page, including the boundary, and fail closed on missing IDs, malformed timestamps, repeated/shifted rows or incorrect tie order. Added positive and negative pure regressions plus source-wiring guard.
- [ ] Require exact-head quality, full Node tests, engine, preview-performance, release, build and pinned browser/Non-3D QA. This is not an atomic database snapshot; real owner-verified stock and signed-in customer/operator, tailor, device, native Blender and security/release acceptance remain outstanding. No merge or deploy.

## 29 October 2026 — integrated exact-count paginated operator ledger (draft)
- [x] Reconcile PR #486 exact `Content-Range` completeness with PR #488's stable paginated reads, based on PR #487's verified stock/legacy integration; never drop either security property.
- [x] Add pure positive/negative receipt regressions for valid multi-page scans, missing/shifted ranges, changing totals, unexpectedly short pages and oversized evidence. Preserve existing single-page helper tests.
- [ ] Verify final exact-head Node, quality, engine, preview, release, build, pinned browser and Non-3D QA; then real human supplier stock, signed-in customer/operator acceptance, tailor/device/native Blender and major release approvals. No merge or production DB writes.

## 29 October 2026 — bounded optional legacy inventory discovery (draft)
- [x] Reproduced unbounded external gallery response body and no request timeout in `scanLegacySite()`, which could stall the inventory route despite fail-closed live structured stock.
- [x] Add 5-second remote fetch timeout and 2 MiB streamed response guard; preserve bundled unverified website fallback and UTF-8 decoding. Add real streaming and negative source regressions.
- [ ] Require latest exact-head quality, Node, engine, preview, release, build, real 390/768/1440 browser and Non-3D QA. Real supplier/owner stock, customer/operator, tailor/device/native Blender and major release approvals remain outstanding. No live writes, migration, merge or deploy.

## 29 October 2026 — exact-count operator override ledger read (draft)
- [x] Reproduced a bounded `limit=1000` metadata fetch that could treat a truncated operator history as complete, concealing older sold-out vetoes.
- [x] Require PostgREST `Prefer: count=exact` and a complete `Content-Range` matching the entire returned page; missing/partial/mismatched counts fail closed. Add pure boundary regressions and CI-only mock count headers.
- [ ] Verify exact stacked draft head with quality, full Node tests, engine, preview, release, build and pinned Chromium. Paginate large operator histories before supporting >1000 events. Genuine stock, owner-authenticated flow, native/tailor/device human evidence and launch approval remain outstanding; no live mutation, migration, merge or deployment.

## 29 October 2026 — operator metadata outage cannot erase sold-out veto (draft)
- [x] Reproduced fail-open condition: failed `style_events` fetch returns `{}` indistinguishable from a valid empty ledger; a positive roll could then be promoted despite a hidden operator `unavailable` override.
- [x] Add explicit `sourceVerified` read status and bounded 8-second fetch; make Designer customer stock empty and legacy API stock unavailable on metadata outage. Keep operator best-effort compatibility read.
- [x] Update CI-only loopback stock fixture to supply a valid *empty* operator ledger, not manufactured approvals; add negative/positive fixture and route contract tests.
- [ ] Verify exact-head Node, quality, engine, preview, release, production build and pinned Chromium, and real authenticated owner-scoped Supabase customer/operator workflow. Live supplier stock, tailor/device/native Blender and owner release remain outstanding. No migration, live data write, merge or deploy.

## 29 October 2026 — no clipped physical fabric provenance (draft)
- [x] Reproduced shared physical-evidence normalizer silently slicing long roll/source references, checker names or supplier URLs and returning a seemingly verified physical receipt.
- [x] Reject overlong normalized fields rather than truncating, preserving valid literal boundary-length text and adding source/worksheet regression tests.
- [ ] Require combined exact-head quality, Node, engine, preview, release, production build and pinned real browser QA; supplier measurements and owner/tailor review remain unverified. No migrations, live stock mutations, merge or deploy.

## 29 October 2026 — exact physical stock identity boundary (draft)
- [x] Reproduced operator stock writes silently trimming padded catalogue fabric IDs and reservation UUIDs into different existing physical stock subjects.
- [x] Reject padded fabric IDs in manual receipts/adjustments and reservation creation; reject padded UUIDs on consumption/release. Preserve normalization of human names, notes and source references, and existing valid keys.
- [ ] Verify exact-head Node, quality, engine, preview, release, build and 390/768/1440 browser QA. Real supplier/owner stock and signed-in Supabase operator handoff remain unverified; no migration, live write, merge or deployment.

## 2026-10-29 — legacy inventory public availability consistency (draft)

- [x] Reproduced `/api/inventory` reporting all bundled structured swatches `inStock:true` and advertising the optimistic total even when the verified live stock ledger has no entries; Designer already fails closed.
- [x] Reused exact Designer operator-metadata + reviewed-live-stock loader for the legacy inventory API; preserve old response shape and unverified legacy website swatches; add explicit no-store, source and positive/negative stock regressions on a stacked draft branch.
- [ ] Verify exact-head quality, full Node tests, engine, preview, release, production build and pinned browser QA. Real supplier/owner stock, end-to-end authenticated customer/operator, tailor/device/native geometry and release acceptance remain external blockers. Do not merge/deploy based on synthetic test stock.

## 29 October 2026 — stock audit note provenance integrity (draft)
- [x] Reproduced silently truncated or JSON-coerced physical stock notes on manual ledger record, reservation consumption and release.
- [x] Reject non-text or overlong (>600 normalized chars) notes while preserving optional blank notes and adding negative/positive regression tests.
- [ ] Verify this exact stacked draft head in GitHub CI, Node, engine, preview, release, build and real 390/768/1440 browser checks; confirm actual authenticated operator/Supabase acceptance separately. Live stock ledger, locked revisions, beta attempts and orders were still empty at read-only audit. Supplier, tailor, native geometry, target devices and explicit major-milestone approvals remain required; no merge or deploy.

## 29 October 2026 — cross-check physical stock RPC provenance receipts (draft)
- [x] Read v2 stock SQL: the RPC returns manual, provenance and legacy-unverified event counts in addition to provenance_ready. Customer adapter previously trusted the boolean alone.
- [x] Require positive safe-integer manual events, equal provenance event count and exactly zero legacy-unverified events before accepting a v2 RPC's provenance_ready. Missing/coerced/inconsistent counts fail closed. Update isolated CI-only mock and negative tests; no physical stock or live write.
- [ ] Verify this exact draft commit with quality, Node, engine, preview, release, build and real 390/768/1440 browser CI. Live owner-confirmed rolls, signed-in customer/operator Supabase, device/tailor/native geometry and human release approval remain required.

## 29 October 2026 — catalogue identity / live-stock binding (draft)
- [x] Prevent a valid stock RPC row from advertising multiple distinct swatches with the same catalogue fabric ID; both duplicates now fail closed.
- [x] Restrict the verified-stock count to uniquely represented catalogue IDs; an unexpected RPC fabric can no longer inflate customer-visible evidence metrics.
- [x] Add positive and negative pure regressions for duplicate catalogue IDs, unknown RPC rows and preservation of valid stock.
- [ ] Verify PR #477's exact commit in quality, Node, engine, preview, release, production build and pinned Chromium. PR #476's matching-head CI/Non-3D QA were cancelled and cannot be counted as passed.
- [ ] Live Supabase has zero private fabric stock ledger rows and zero locked revisions, so genuine stock and signed-in owner/recovery/enquiry/operator acceptance remain unverified. Supplier, tailor, native Blender, physical devices and launch approvals are separate human gates. No live writes, merge or deploy.

## 29 October 2026 — stacked stock + device QA source integration (draft)
- [x] Combine PR #474 fail-closed verified stock and isolated CI browser fixture with PR #475 exact v2 device QA receipt validation on a new branch, preserving both parents and the canonical fixed Studio photo.
- [x] Reject non-string/padded live RPC fabric identifiers and contradictory padded duplicates before advertising exact physical stock. Add regression cases; no inventory was created.
- [x] Align browser/server device QA p95 rounding and preserve null for unmeasured review receipts; regression-test near-threshold and empty sessions. No human device evidence was recorded.
- [x] Fail closed on historical contradictory v2 device rows and preserve an operator's explicit `review` verdict in the device dashboard, even when raw latency/checkboxes pass. Add reader regression; still no real device signoff.
- [x] Reproduced PR #474 Non-3D QA browser failure: 3D handoff fabric selector was empty after build-time stock had been frozen into a static lab page. Force request-time inventory on the internal viewer and assert this contract; require fresh exact-head browser CI.
- [ ] Require both CI workflows at the **integration commit SHA**; do not transfer green status from either sibling PR.
- [ ] Live Supabase read-only audit: stock ledger, locked revisions, novice/beta attempts and production orders are empty. Obtain real owner-scoped authenticated customer/operator acceptance, verified shirt/trouser stock, native Blender, tailor and target-device human approvals. Synthetic fixture does not meet release gates. No merge, migration or deploy.

## 29 October 2026 — isolated browser stock fixture for honest test coverage (draft)
- [x] Verified source tests pass but unconfigured CI browser calls return 409 after correctly rejecting absent physical inventory.
- [x] Add a loopback-only synthetic stock RPC fixture launched solely by GitHub Actions browser jobs, with explicit CI-only process guard, fake key, bounded exact IDs and no real Supabase mutations. Keep real production stock fail-closed; add fixture regressions.
- [ ] Check revised exact-head CI / Non-3D QA, then still require real signed-in owner/tailor/stock/device acceptance. Synthetic QA evidence must never be reported as physical stock or production readiness.

## 29 October 2026 — customer catalogue must fail closed without live physical stock (draft)

- [x] Verified that live Supabase SQL now responds but fabric stock ledger has zero records; the customer stock adapter previously preserved bundled `inStock:true` when the trusted snapshot was absent.
- [x] Patch the shared verified-stock projection so unverified, duplicate, malformed or unavailable ledger evidence never promotes catalogue-only stock as customer-available; preserve verified zero and explicit catalogue unavailability, add positive/negative tests and update release contract checks.
- [ ] Require exact new-head CI, Node, engine, preview, release, production build and real browser checks. Obtain genuine owner-verified stock for a shirt and trouser plus an isolated real Supabase customer/operator test before claiming beta launch. No fake stock record, migration, production data mutation, merge or deployment.

## 29 October 2026 — physical fabric colour measurement provenance and receipt integrity (draft)

- [x] Reproduced coerced LAB channels, fabric/profile IDs, colour hex/method/checker/reference, silently truncated notes, unbounded JSON, and success-shaped colour check IDs without a validated database receipt.
- [x] Added literal finite physical LAB and typed nontruncated provenance, strict reviewed Analyzer colour matching, 16 KiB same-origin streamed JSON, 400/413 body errors, exact UUID check receipt, and fail-closed ten-fabric colour evidence summary. Node and four negative-only real HTTP regressions; no actual instrument/booth sample or database mutation.
- [ ] Verify exact-head quality, tests, engine, preview, release, build and Chromium. Real approved Analyzer profile, calibrated physical colour samples, live Supabase, supplier/tailor and native Blender remain unverified; no migration, merge or deploy.

## 29 October 2026 — house-ease physical evidence and tailor model receipt integrity (draft)

- [x] Reproduced coerced body/finished centimetres, ease-table ranges, case/garment/fit/tailor fields, silently truncated notes, unbounded privileged JSON and success-shaped model/evidence/approval IDs.
- [x] Added literal physical measurements, bounded human provenance, nontruncated notes, fail-closed 35-cell evidence summary, 16 KiB same-origin streamed JSON, exact UUID creation/evidence receipts and exact true approval/retirement receipts. Added Node and four negative-only real HTTP regressions; no physical tape session or database write.
- [ ] Verify exact-head quality, tests, engine, preview, release, build and pinned browser QA. Real tailor measurements, model approval, live Supabase, supplier stock and native Blender remain unverified; no migration, merge or deploy.

## 29 October 2026 — physical fabric truth policy must have a confirmed ledger receipt (draft)

- [x] Reproduced silently truncated signer/rationale, unbounded operator JSON, and success-shaped physical-evidence policy save after only HTTP 2xx with no returned record.
- [x] Added literal nontruncated human evidence, 16 KiB same-origin streamed JSON, explicit 400/413 failures, private no-store responses, and PostgREST returned event ID/time verification. Added Node and four negative-only real HTTP regressions; no actual supplier evidence recorded.
- [ ] Require exact-head CI, Node, engine, preview, release, build and Chromium. Confirm actual live service-role ledger representation and real owner/supplier approval once Supabase connectivity is restored; no migration, merge, deploy, native Blender or tailor signoff.

## 29 October 2026 — novice Designer timing and human acceptance evidence integrity (draft)

- [x] Reproduced coercible novice case/device/time/decision/signer values, truncated blocking notes, unbounded privileged JSON and unverified timer/attempt/approval receipts.
- [x] Added literal evidence normalizers, strict server-session UUID and matching start/finish receipt checks, UUID attempt/decision receipts, 16 KiB same-origin streamed JSON, 400/413 body errors and private no-store responses. Added Node regressions and four negative-only real HTTP checks; no live user/session/database write.
- [ ] Verify exact-head quality, full tests, engine, preview, release, production build and pinned Chromium. Real five-novice acceptance, owner/tailor/device signoff, live Supabase, supplier facts and native Blender remain unverified; no migration, merge or deploy.

## 29 October 2026 — launch/beta human proof cannot be coerced or falsely recorded (draft)

- [x] Reproduced coerced beta case/device/revision/evidence-kind/checklist signers, silently truncated notes, unbounded launch JSON and success-shaped beta/checklist audit IDs without a confirmed RPC receipt.
- [x] Added literal launch evidence fields, 16 KiB same-origin streamed JSON, exact UUID receipts for verified beta, legacy beta and checklist, 400/413 errors and private no-store responses; Node and negative-only HTTP regressions.
- [ ] Verify exact-head CI/Node/engine/preview/release/build/Chromium. No actual five-customer beta, human legal/privacy approval, live Supabase, supplier/tailor/native Blender acceptance, migration, merge or deployment.

## 29 October 2026 — meterage model human approval integrity (draft)

- [x] Reproduced coerced model/approver identities, silently truncated approval notes, truthy RPC approval/retirement, unbounded model JSON and coerced physical band measurements.
- [x] Added literal physical band values and bounded provenance, strict UUID model/receipt, exact true approval/retirement, 16 KiB same-origin streamed JSON, 400/413 errors, private no-store responses and regression/negative-only HTTP checks.
- [ ] Verify exact-head CI/Node/engine/preview/release/build/Chromium; no actual cut cases, owner/tailor approval, live Supabase, native Blender, migration, merge or deployment.

## 29 October 2026 — physical cutting/meterage proof boundary (draft)

- [x] Reproduced coerced case/garment/cloth width/usage/repeat/matching, silently truncated cut notes/contexts, unbounded privileged JSON and unverified cut evidence IDs.
- [x] Added literal physical inputs, 16 KiB same-origin streamed JSON, exact UUID receipt, 400/413 body errors, private no-store responses, Node and negative-only HTTP tests.
- [ ] Verify exact-head CI/Node/engine/preview/release/build/Chromium; real supplier rolls, cut tickets, tailor review, live Supabase and native Blender remain unverified. No migration, merge or deploy.

## 29 October 2026 — physical measurement calibration evidence integrity (draft)

- [x] Reproduced unbounded operator calibration JSON, silently truncated physical notes, and unverified RPC event IDs that could falsely report `stored:true`.
- [x] Added 16 KiB same-origin streamed JSON, literal nontruncated note <=1200 chars, exact UUID receipt before stored success, 400/413 body errors and private no-store responses. Added Node and negative-only real HTTP regressions.
- [ ] Require exact-head CI/Node/engine/preview/release/build/Chromium. No live Supabase, physical tape measurements, supplier/tailor/native Blender acceptance, migration, merge or deploy.

## 29 October 2026 — immutable production delivery evidence receipt (draft)

- [x] Reproduced permissive delivery order UUID regex, unauthenticated transport not checked before session, malformed JSON mapped to generic 409, and unverified RPC evidence IDs reported as success.
- [x] Added exact UUID order and receipt validation, strict action, bounded 16 KiB same-origin streamed JSON, 400/413 body failures and private no-store responses. Focused Node source tests and four negative-only actual HTTP cases; no real delivery audit is recorded.
- [ ] Verify exact new head in CI, tests, engine, preview, release, build and browser. Real first-ten physical delivery history, Supabase, supplier/tailor and native Blender remain unverified; no migration, merge or deployment.

## 29 October 2026 — finished-garment physical QC integrity (draft)

- [x] Reproduced unbounded QC JSON, coerced decision/order IDs/defect tags, silently truncated notes, and a success-shaped inspection ID without a validated RPC receipt.
- [x] Added 16 KiB same-origin streamed JSON, strict UUID order and receipt, literal physical checks/defects/notes and private no-store responses. Added focused Node regressions and negative-only real HTTP transport cases; no real inspection is recorded.
- [ ] Verify this exact new head in CI, full Node/engine/preview/release/build and Chromium; live Supabase/operator, supplier/tailor, physical QC and native Blender approval remain blocked. No migration, merge or deployment.

# TITAN — prioritized execution queue

## 2026-10-29 — Device QA acceptance integrity (draft)
- [x] Reject JSON-coerced viewport/version/class and malformed or >120 duration samples rather than filtering them into a passing 12-sample receipt.
- [x] Fail closed when a new v2 device event claims `accepted` without all actual numeric latency and literal visual checks; reject overlong human notes instead of silently cutting findings.
- [x] Keep historical v1 evidence visible as review only; prevent numeric-string legacy fallback from masquerading as measured p95 or sample counts.
- [ ] Verify the new exact branch head with quality, all Node tests, engine, preview, release, build and actual 390/768/1440 browser checks; then review CI failures and fix without weakening tests.
- [ ] Obtain actual independent target-device sessions and operator signoff; software tests are not physical QA acceptance.


## 29 October 2026 — operator learning evidence cannot be JSON-coerced

- [x] Reproduced unbounded operator outcome review/policy JSON, coerced outcome IDs, decisions, reviewers, notes and numeric policy thresholds, silent truncation and unverified RPC success IDs.
- [x] Require 16 KiB same-origin streamed JSON, literal reviewer/policy evidence, exact UUID receipt before review or policy is reported saved, and private no-store POST responses. Preserve existing operator UI's numeric threshold and optional review note. Added pure/source tests and negative-only actual HTTP transport checks.
- [ ] Verify final exact-head CI/Node/engine/preview/release/build/Chromium. Live operator sign-in, human approval, owner-scoped Supabase and physical/tailor/native Blender acceptance remain unverified. No migration, production data change, merge or deployment.


## 29 October 2026 — customer quote/feedback transport and receipt integrity

- [x] Confirmed PR #460 exact-head CI #40842666927 and Non-3D QA #40842666847 completed successfully, including browser/mobile steps; no live Supabase acceptance is implied.
- [x] Reproduced unbounded customer quote/feedback JSON, coerced quote/order IDs and rating/fit/note values, silently truncated feedback, and truthy/non-UUID RPC responses that could falsely report success.
- [x] Added 16 KiB streamed JSON and same-origin request checks, literal UUIDs, typed feedback with no silent truncation, exact boolean quote acceptance and validated outcome UUID receipt. Added pure tests and 15 actual HTTP *negative-only* checks (including undeclared chunked bytes) wired into the existing pinned browser QA; no real account/quote/order is used.
- [ ] Verify new exact-head CI, full Node/engine/preview/release/build and Chromium checks; live owner-scoped Supabase, supplier/tailor/device, and native Blender gates remain outstanding. No migration, production data mutation, merge or deploy.


## 29 October 2026 — strict operator production status boundary

- [x] Reproduced quote/order status mutations that coerced array/object IDs, statuses and notes with `String(...)`, silently truncated notes at 1000 characters, and reported HTTP success even when the privileged RPC returned false.
- [x] Added pure typed status parser with exact UUIDs, existing transition-destination vocabularies and literal notes; reject invalid requests before QC lookups or privileged database RPC. Require exact boolean `true` before reporting an update, and preserve proper 400/413 for malformed/oversized streamed JSON.
- [x] Added negative/positive Node regression cases and source-route guards. No DB migration, schema changes, customer record writes or production deployment.
- [ ] Check the final branch head in quality, Node, engine, preview, release, production build and real-browser CI. Live Supabase, physical stock/tailor and native 3D approval remain unverified.


## 29 October 2026 — operator login transport/security hardening

- [x] Reproduced the operator login's unbounded `request.json()`, array/object password coercion and silent 300-character truncation, Origin-only cross-site check, and unbounded forwarded-IP attempt map.
- [x] Stacked draft implementation: shared 4 KiB streamed JSON/same-origin gate, strict literal opaque password, bounded 15-minute per-IP/global fail-closed attempts, negative pure/real HTTP regressions. Preserve existing verifier and operator cookie.
- [ ] Require exact-head CI/Node/engine/preview/release/build/real-browser checks. Do not send actual operator credentials in CI, claim live authentication or merge/deploy.
- [ ] Distributed edge/provider throttling, live Supabase customer-owner recovery and real operator/tailor acceptance remain release blockers.


## 29 October 2026 — 1 PM auth counter exhaustion hardening

- [x] PR #457 exact-head CI #40830722822 and Non-3D QA #40830722830 completed successfully (source, Node, engine, preview, release, build, pinned Chromium/mobile). Live Supabase and human acceptance remain unverified.
- [x] Identified active-rate-key eviction at the 2,048-key limit: rotating distinct IP/mailbox identities could delete a live victim counter, allowing its next OTP or verification request to restart at one.
- [x] In a new stacked draft, preserve all live identity counters and reject new identities when full; reclaim expired keys after the ten-minute window. Add regression coverage for both mailbox and IP paths. No provider calls, production data changes, model/photo changes, merge or deploy.
- [ ] Require exact-head CI, real browser, release and build checks on the final draft commit. Process-local counters are not a distributed abuse control; edge/provider protection and live authenticated acceptance remain release gates.


## 29 October 2026 — 12 PM customer authentication security sprint

- [x] Rechecked PR #456 exact head `e2c78c04`: CI #40805041551 and Non-3D QA #40805041648 **both completed successfully**, including pinned browser/mobile checks. This is source QA, not live launch acceptance.
- [x] Reproduced a public auth request gap in source: OTP and verification endpoints used unbounded `request.json()`, accepted JSON array/number coercion and had no same-origin transport guard; verification had no local attempt throttle and OTP's process map could grow unbounded.
- [x] Draft implementation: both endpoints now enforce 4 KiB streamed JSON, same-origin/fetch-metadata checks, literal email/code types, private no-store responses and bounded process-local OTP/verify attempt budgets, including hashed per-mailbox limits against forwarded-IP rotation. The bodyless logout POST now also rejects cross-site requests before clearing cookies. Added pure regressions and real HTTP *negative-only* checks; no actual sign-in emails are sent by tests.
- [ ] Require **new exact-head** quality, Node tests, engine, preview, release, build and Chromium checks on the auth draft before calling it verified; retain unmerged draft status.
- [ ] Live Supabase acceptance still blocked: read-only migrations, table list and SQL timed out, while security advisor reported hibernation despite management `ACTIVE_HEALTHY`. Do not apply migrations or assume owner/recovery/intent/operator verification passed.
- [ ] Process-local rate limiting is not distributed abuse protection. A trusted edge/store-backed limiter, actual provider/OTP flow and human operator signoff are still needed for production release.


Prepared: 2026-10-24 (Asia/Kolkata). This is a **planned 8-hour work allocation**, not a background-job runner or a claim that work has executed. Check boxes only after implementation and exact-head verification.

Repository: `slokpatel-crypto/llinenearth-designer`
Starting point: draft PR #372 head `28a50ac`; its original CI and Non-3D QA runs were green when this plan was drafted. Parent PRs are stacked; do **not** merge straight into `main`.

## Minimum launch-ready MVP — verified source scope (28 October 2026)

**Launch target:** invitation-only *customer enquiry beta*, not checkout, automated tailoring, or production certification. Preserve the existing `linen-earth-studio-model-v1` photograph; never substitute the prototype 3D garment. See `docs/TITAN_LAUNCH_MVP.md` for the acceptance matrix and external gates.

### Execute in priority order
- [x] Inspect latest draft PR #450 and its exact-head CI / Non-3D QA; both passed at `74db98f` on 28 Oct. Do not extrapolate that status to a later commit.
- [x] Find and patch coercible/truncated fabric IDs and occasion/scope data on assessment/search/brief; add static and real HTTP negative tests on this *new draft branch*. This is implementation, not an assertion that this new head passed CI.
- [x] Confirm strict Designer request patch #451 on exact head `151f1bd`: build + Studio browser checks passed. This does **not** approve later changes.
- [ ] Confirm **new exact-head** quality, complete Node tests, engine, preview performance, release check, production build and real Chromium HTTP/viewport checks before promoting PR #452.
- [x] Compare overlapping #444–#447 and #448–#452 source-level security and first-ten RPC contracts; selectively port vault bounds + order lineage without replacing newer modules. See `docs/TITAN_20261028_DRAFT_STACK_RECONCILIATION.md`.
- [ ] Complete full stacked-draft ancestry review/integration; keep older SQL incompatible with current v2 RPC unapplied, and do not merge draft stacks straight to `main`.
- [x] Implement a privacy-preserving, bounded public locked-share/enquiry transport, validate durable audit UUID receipts, and make WhatsApp handoff an explicit revision-bound outbound click; see draft head under `work/titan-verified-enquiry-handoff-20261029`. This checkbox means **source implemented**, not exact-head verified.
- [ ] Verify new handoff draft's full Node/engine/release/build/Chromium source and HTTP gates on its final exact commit.
- [x] Harden operator quote/order creation to require literal locked revision/hash/recovery token and exactly one unexpired vault row before constructing a handoff or creating production records (source implementation in stacked draft; exact-head CI still required).
- [ ] Verify real authenticated Supabase lock/recovery/enquiry path and selected stock; do not treat local browser storage as production durability.
- [ ] Obtain owner-controlled fabric scale/stock truth, real tailor signoff, novice beta/device/edge QA, primary production runtime identity and customer consent before opening beta.
- [ ] Keep 3D Blender/photo four-angle parity, automatic production delivery, FASHN final render and ecommerce **outside this smallest beta** until separately approved and evidenced.

## Eight-hour work allocation — 24 October 2026, IST

| Time | Budget | Focus | Exit evidence |
| --- | --- | --- | --- |
| 01:45–02:30 | 45 min | Repo/PR/CI audit, blockers, highest-risk regression | Reproducible failure list and selected one-file-at-a-time tasks |
| 02:30–04:00 | 90 min | Fabric intake, Analyzer truth, stock/provenance contract | Tests for declared-vs-estimated facts, repeat-mm identity and unknown data |
| 04:00–05:30 | 90 min | Designer Engine, Style Director compatibility | Tested exact-ID outfit rules and reproducibility |
| 05:30–06:30 | 60 min | Measurements, design lock, versioned tailor handoff | Canonical lock/restore/revision tests |
| 06:30–07:30 | 60 min | Existing Real Model Designer technical integrity | Model-identity, projection/UV or measurable geometry preflight; no fake photo approval |
| 07:30–08:45 | 75 min | Operator/release evidence, responsive UI and failure paths | Fail-closed proof checks and 390/768/1440px browser QA |
| 08:45–09:45 | 60 min | Full validation and handoff | Quality/tests/evals/build, clean draft PR and remaining blockers |

**Work sequencing:** Finish one scoped task, add tests, run affected checks, commit on a branch, then pick the next task. If a task is blocked by real supplier/physical evidence, record the blocker and continue to the next code task. The time slots are budgets, not promises of completion.

## 1. Stabilize and audit (highest priority)
- [ ] Compare `main` with stacked draft PRs, including #372; document conflicts and safe integration order.
- [ ] Read current roadmap, `AGENTS.md`, `DECISIONS.md` and all release gates before changing behavior.
- [ ] Verify CI and Non-3D QA on the **new** exact commit, not a green parent only.
- [ ] Investigate existing lint/quality/build warnings, runtime errors and unresolved audit findings.
- [ ] Preserve fixed studio-model identity `linen-earth-studio-model-v1` and canonical `/designer/studio-tucked.webp`.

## 2. Core fabric intake and Analyzer / Fabric Intelligence
- [ ] Trace flat/macro/fold intake, catalogue identity and operator-review flow end-to-end.
- [ ] Check physical repeat mm, fibre, GSM, drape, colour and stock provenance; leave unverifiable values unknown.
- [ ] Harden malformed input, cross-fabric identity, stale replies and partial-batch recovery.
- [ ] Confirm reviewed evidence flows to all relevant Designer routes without losing provenance.
- [ ] Add focused deterministic tests for each issue actually found; do not invent supplier measurements.

## 3. Designer Engine and Style Director
- [ ] Audit shirt/pant option IDs and canonical cross-garment rules; reject incompatible construction.
- [ ] Verify Safe / Elevated / Statement ranking with deterministic scenario snapshots.
- [ ] Fix discovered fabric-selection or design-state regressions, one scoped patch at a time.
- [ ] Preserve quick, no-credit interactive previews; optional AI is only for locked/final workflows.
- [ ] Test saved designs and older StyleSpec adapters for backward compatibility.

## 4. Measurements, lock and tailoring bridge
- [ ] Audit measurement validation, ease and fit warnings with explicit uncertainty labels.
- [ ] Verify exact fabric IDs, garment options, measurements and versions survive lock/save/restore.
- [ ] Verify locked-spec hash prevents silent drift between preview, render and tailor handoff.
- [ ] Add recovery tests for changed selections, lost browser state and stale network responses.

## 5. Real Model Designer: technical-only work
- [ ] Keep original model/photo identity, proportions, garments and customer-visible rollout unchanged.
- [ ] Review production vs prototype 3D separation and model asset integrity/preflight.
- [ ] Test existing body/garment alignment, UV orientation, actual repeat scale and four-view QA contracts.
- [ ] Prepare concrete issues for real Blender geometry/drape corrections when evidence is insufficient.
- [ ] Do **not** claim photoreal, fit, physical fabric or tailor acceptance from software-only tests.

## 6. Operator workflow, UX and production QA
- [ ] Confirm first-ten production evidence is based on actual chronological delivery history and closed field IDs.
- [ ] Confirm refresh failure, stale replies, contradiction and missing live data all revoke readiness.
- [ ] Check responsive screens at 390px / 768px / 1440px, plus console/runtime errors.
- [ ] Run `npm run quality`, `npm test`, `npm run eval:engine`, `npm run eval:preview-performance`, `npm run release:check`, `npm run build`.
- [ ] Record exact tested SHA, passed/failed checks, screenshots where applicable and remaining risks.
- [ ] Open/update a draft PR; **no main merge or production deploy** before full milestone verification.

## External evidence / release blockers (must remain unclaimed until proven)
- [ ] Owner/supplier-confirmed repeat, GSM, fibre, physical drape and stock facts.
- [ ] Real tailor construction/fit approval and verified model four-angle physical comparison.
- [ ] Authenticated live Supabase migration verification and genuine oldest-ten delivery audit.
- [ ] Real operator/browser/device acceptance, security/release gate sign-off.
- [ ] Production deployment only after a major clean milestone and explicit approval.

## Later phase — do not implement in this queue
- [ ] Ecommerce and checkout.
- [ ] B2B customer accounts.
- [ ] Additional brand/marketing pages.
- [ ] Notifications and broad marketing automations.

## Progress record
- [ ] 2026-10-28 18:45 IST (draft; exact-head CI/browser pending): Assessment now parses explicit measurement and tailor observations before loading live catalogue and house-ease evidence. Corrupt tape values take HTTP 422 precedence over unavailable-fabric 409. Static and actual HTTP regression added; valid requests unchanged, no physical/tailor signoff or production release.
- [ ] 2026-10-28 18:33 IST (draft; exact-head CI/browser pending): Assessment, search and legacy/advisor brief POSTs now reject cross-origin or non-JSON requests, invalid UTF-8/JSON and oversized streamed/chunked bodies, with 400/403/413/415 responses. Added standalone transport regressions, all four real HTTP route contract checks and release-readiness source guard. Preserve 64 previous fit contracts. No live production/supplier/tailor evidence, original model change, main merge or deployment; reconcile the duplicate shared helper with the separate #444-#447 draft stack before integration.
- [x] 2026-10-28 (draft continuation from #437): Search and both brief/advisor paths now use the same strict measurement parser as assessment and reject invalid explicit tailor observations with HTTP 422 before catalogue/evidence work. Preserved omitted/null fields, decimal tape inputs and centimetre storage with inch display. All 64 real local HTTP contracts passed across four paths; 997 Node tests, quality, engine, preview, release and production build passed. Exact-head remote/browser results are tracked in the follow-on draft PR. This closes an engineering inconsistency, not physical or production acceptance.
- [ ] 2026-10-28 10:50 IST (draft, exact-head CI pending): The assessment API previously silently dropped malformed explicitly supplied body-profile and tailor-observation receipts to null, potentially hiding fit warnings. Invalid supplied objects now return HTTP 422; omitted/null optional values retain legacy behaviour. Body profile enums require literal strings rather than arrays coercible through `String()`. Added unit regressions and four actual HTTP fit-input contract cases; real tailor measurements and signoff remain external.
- [ ] 2026-10-28 10:45 IST (draft, exact-head CI pending): The server measurement adapter previously accepted `unit:["cm"]` via `String()` and carried malformed supplied `updatedAt` strings into tailor/fit evidence. Require literal `cm`/`in` units and real offset-aware Gregorian timestamps whenever supplied, preserving legacy omitted-timestamp compatibility. Added positive/negative unit tests and four actual HTTP assessment contract cases. No real tape measurement or tailor signoff was performed.
- [ ] 2026-10-28 10:40 IST (draft; exact-head CI pending): Hardened asynchronous Designer assessment response against server-side same-ID fabric revision races. The response must carry exactly the selected shirt and trouser catalogue provenance, stock, photo and physics snapshot before any recommendation, fit assessment or memory event is applied. A changed roll or missing/corrupt receipt fails closed with a refresh/reassess message. Added pure positive/negative regressions and a real Chromium mocked revised-photo response scenario; full browser outcome pending. No supplier, native Blender, tailor or production proof claimed.
- [ ] 2026-10-28 10:35 IST (independent follow-on draft; exact-head checks pending): The `/api/designer/assess` visual-review adapter previously coerced untrusted status arrays, numeric strings, booleans, nulls and string booleans into apparent passing proof. Added a pure strict parser requiring literal status, finite bounded numeric scores, real boolean evidence and valid semantic status; invalid supplied receipts now fail HTTP 422 before tailor garment-spec assembly. Added positive/negative type-abuse regressions. This does not authenticate reviewers or certify photographic, physical, supplier, tailor or production evidence.
- [ ] 2026-10-28 10:30 IST (draft, exact-head CI pending): Investigated actual #432 CI and Non-3D Chromium failures; both failed at `scripts/verify-designer-advisor.cjs:169` because an applied assessment produced no `designer_recommendation` memory event. Root cause: the same-ID fabric-revision guard was added to `assessmentIdentity` but omitted from three async `expectedIdentity` constructors (manual assessment, search result and Style Director handoff), so valid completions were silently discarded. Bound each path to its current fabric revision, added source regression guards and explicit browser failure assertions. Keep #432 failing head as evidence; require new exact-head CI and full Chromium QA before marking fixed. No native Blender/photo, supplier, tailor, authenticated production, merge or deployment claim.
- [ ] 2026-10-28 10:00 IST (follow-on draft; exact-head CI/browser QA pending): Designer Creative Lab now binds active and restored concepts to selected fabric revision evidence, not merely shirt/trouser IDs. Same-ID changes to image, repeat scale, physical physics/provenance or stock revoke prior creative visual review and stale fit/assessment state; selection-derived revision identity also invalidates async assessments, alternative searches, director handoff badge and locked design UI. Lock creation rechecks the full selection and creative visual review after its async hash; production handoff, tech pack, share, enquiry and vault actions fail closed on subsequent selection drift, including delayed responses. Creative generation aborts on same-ID fabric revision, applying stale concepts is blocked, and catalogue/creative/assessment server routes now share the exact physical provenance/physics loader. The assessment and redesign APIs independently reject stale same-ID creative provenance before assembling a garment spec or reusing a concept; real HTTP negative coverage added. Legacy callers without snapshots remain compatible but do not certify physical parity. Added source, negative revision and mocked 1440px Chromium reload tests (real browser outcome pending); supplier measurements, tailor signoff and production acceptance remain external blockers.
- [ ] 2026-10-28 10:00 IST (draft; exact-head CI pending): Phase 1 proof now rejects JSON-coerced repeat, photo marker and preview-period values; only finite actual numeric measurements can enter physical-scale validation. Reviewer identity must be a string and realism ratings must be exact integer 1–5, including at the direct acceptance gate; fractional 3.5/4.5 ratings and object IDs cannot inflate independent reviewer counts. Added negative and valid-case tests. This does not authenticate reviewers, prove supplier measurements or remove the native Blender/photo/tailor/production blockers.
- [ ] 2026-10-28 09:00 IST (draft; exact-head CI pending): Native Blender preflight now fails on missing/nonfinite silhouette and identity-guide samples rather than allowing warning-only readiness. The independent candidate validator checks all 11 garment-fit measurements, nine canonical identity guides, evaluated mesh/UV facts and reconciled triangle/vertex budgets. Added positive/negative abuse regressions. Four-angle rendering also snapshots the actual .blend, canonical photo and preflight-script SHA-256 before native inspection, and rechecks all three before publication to reject concurrent source drift; this does **not** repair native sleeve spacing/UV seams or certify photographic, supplier, tailor or production gates.
- [ ] 2026-10-28 08:00 IST (draft; exact-head CI/native Blender pending): Four-angle candidate/diagnostic PNG integrity now requires decodable bounded RGB/RGBA 8/16-bit noninterlaced raster data, correct scanline counts and filters, consecutive IDAT chunks and valid compressed stream termination. CRC-valid but undecodable/truncated/extra-data frames are rejected even with recomputed hashes. Direct validator calls without all three actual source paths also fail closed. Manifest and native-preflight JSON receipts also reject duplicate keys and NaN/Infinity before any candidate integrity verdict. The native report must independently include valid canonical body height/reference mesh and measured hand/leg identity guide spacing; omitted/coerced/drifted values fail closed. Added positive/negative Python regressions; no real native render, photographic parity, supplier evidence or production acceptance is implied.
- [ ] 2026-10-28 08:00 IST (second scoped draft, exact-head CI pending): GarmentViewer readiness evidence from operator JSON now rejects numeric-string, boolean, null, nonfinite and rounded realism/latency/physical-scale values instead of coercing them. The authenticated /api/memory/event write path now also rejects coerced, malformed or silently truncated GarmentViewer evidence before storing it; read-time validation alone could not undo earlier Number(null) and rounded-rating conversions. The operator form also rejects blank error fields that Number(\"\") would falsely turn into zero, preserves >8% precision without rounding, prevents same-fabric verified stripe/check submissions, and refuses corrupt browser-restored latency/reviewer samples. The stripe/check gate requires distinct fabric IDs and rejects duplicate verified receipts. Added negative tests; no supplier measurements, independent reviewer identities or physical acceptance are fabricated. The operator promotion desk now explicitly stays BLOCKED until a trusted server-side native Blender/four-angle registry is integrated; operator JSON cannot set that gate. Remains stacked draft/unmerged.
- [ ] 2026-10-28 08:00 IST (draft; exact-head CI and real native render pending): Four-angle candidate QA now requires the unchanged canonical Blender scene to pass native geometry/UV preflight before rendering. Render outputs are staged, checked for exact front/three-quarter/side/back yaw, complete CRC-checked PNGs, dimensions, a separately hashed native geometry/UV preflight report (including sleeve spacing, UV seams and body collisions), and SHA-256 bindings to saved scene, original studio photo and preflight script, and published only as a complete fresh candidate directory. Offline negative regressions are wired into CI. An explicit rejected-diagnostic mode retains four-angle debugging with a failed native report, never promotion evidence; #311 workflow needs fresh-directory/flag integration. This is **file integrity only**, not a successful native run, photographic parity, measured fabric/drape or tailor acceptance.
- [ ] 2026-10-28 07:00 IST (draft; exact-head CI/browser acceptance pending): Added keyboard skip-to-main, safe-area-aware five-destination mobile dock and contact clearance, readable 11–13px compact photo/garment/QA proof labels, 44px lock/filter/review targets, screen-reader live preview state with explicit physical-fit uncertainty, accessible inactive-filter/planned-garment/QA-review contrast, and 390/768/1440 Chromium assertions with measured warm-session preview-ready diagnostics (not a device or paint SLA). No original-model/photo, physical scale, supplier evidence or deployment changes; device/real-operator acceptance still required.
- [ ] 2026-10-28 05:00 IST (draft; exact-head CI and 11am audit pending): Browser-saved body measurements and manual tailor observations now share strict offset-aware Gregorian timestamp validation. Impossible dates, 24:00 and invalid timezone offsets are rejected before vault/browser restore; valid leap days and real offsets remain supported. Tests added; live physical evidence remains unverified.
- [ ] 2026-10-28 05:00 IST (draft; exact-head CI and 11am audit pending): Design locking and verification now reject NaN/Infinity, zero or inverted finished-garment targets and malformed ease ranges before JSON serialization can turn invalid tape values into null. Negative and valid-case regressions added; no actual tailor measurement certified.
- [ ] 2026-10-28 05:00 IST (draft; exact-head CI and 11am audit pending): Operator measurement-calibration UI now clears old PASS evidence on failed, malformed or out-of-order Supabase reads, exposes a retry alert and cancels stale unmounted requests. Source regression added; live authenticated browser evidence and exact-head CI pending.
- [ ] 2026-10-28 05:00 IST (draft; exact-head CI and 11am audit pending): Measurement calibration now rejects coerced numeric input and fabricated checker/source values; malformed latest database rows, conflicting same-instant revisions, invalid calendar timestamps and missing physical evidence cannot inflate ten-case median readiness. Revision verification now cross-checks UTC timestamp and recipe-hash prefix embedded in both legacy and nonce-suffixed IDs, rejecting malformed/mismatched timestamp-hash IDs and invalid parent identity; nonce/ownership remain unauthenticated. Added abuse/legacy regressions; exact-head CI and live tailor comparisons still required. No physical acceptance inferred.
- [x] 2026-10-28 04:00 IST (draft): Physics-catalogue enrichment now requires approved/corrected human review and an auditable HTTPS/no-credentials source or typed operator note before accepting normalized indices. Rejected/unreviewed records, unsafe URL schemes, credential-bearing URLs and object-coerced notes fail closed. The adapter preserves legitimately accepted GSM as an explicit patch and never upgrades an existing catalogue declaration. Added negative and positive tests; exact-head CI pending.
- [x] 2026-10-28 04:00 IST (draft): Physical motif-repeat confirmation is no longer suppressed by a catalogue Fine/None/Bold label; both fabric IDs need independently verified scale flags and valid closed-vocabulary labels. Added negative and valid-case recommendation regressions. This requests human physical evidence; it does not supply it. Exact-head CI pending.
- [x] 2026-10-28 04:00 IST (draft): Closed physical-physics provenance upgrade gap: supplying a reviewed label without an explicit GSM measurement patch cannot convert a catalogue fallback into reviewed evidence. Explicit weaker/unknown labels remain conservative; valid reviewed patches and malformed-value rejection have focused tests. No supplier reading was manufactured. Exact-head CI pending.
- [x] 2026-10-28 04:00 IST (draft): Pairing and accent rules now fail closed on malformed/unknown weight-class and pattern-scale vocabularies instead of treating invalid index -1 or unknown motifs as a valid pass. The catalogue motif warning explicitly avoids claiming measured physical repeat. Added negative and valid-case engine regressions; exact-head CI pending.
- [x] 2026-10-28 04:00 IST (draft): Corrected hot/humid weight, weight-class and season-tag recommendation language to identify catalogue observations rather than claiming confirmed supplier physical data. Added roll-up and hot-weather negative regressions.
- [x] 2026-10-28 04:00 IST (draft): Prevent Style Director from counting a categorical drape label or raw GSM value as reviewed physical proof. Drape/GSM evidence now requires a finite, bounded, reviewed physics fact tied to the exact fabric ID; estimated, declared, malformed and cross-fabric facts stay unverified. Wide-leg drape warnings remain until genuine review. Added negative and integration regressions. This is an evidence-label correction, not a supplier measurement or drape calibration. Exact-head CI pending.
- [x] 2026-10-28 04:00 IST (draft): Extended pure cross-garment construction guards for short-sleeve shirt families, flat-front versus pleated trouser families, cropped trouser types versus shoe breaks, and roll-up sleeves with short-sleeve hems; the cropped hem guard also rejects slight breaks. All checks use canonical option IDs, preserve customer selections, remain provisional pending tailor approval, and have negative/legacy-default plus engine-wiring regressions. Exact-head CI and operator/tailor acceptance remain separate gates. No production merge or deploy.
- [x] 2026-10-28 03:00 IST (draft): Designer alternative-search requests now use a one-owner abort scope keyed to full selected assessment identity plus search scope. Rapid repeat clicks cannot dispatch duplicate requests; old responses/errors/finally handlers cannot overwrite a new selection or release its in-flight lock. Added delayed-response and source-wiring regressions; exact-head CI/browser QA pending.
- [x] 2026-10-28 03:00 IST (draft): The customer Designer's look-assessment request now snapshots and sends the matching v2 style, measurements and body profile; stale async replies are identity-checked and aborted on subsequent selection changes. Legacy/v2 state commits together to avoid a self-cancel race, and prior fit/production assessment is cleared when the selected identity drifts. Source-wiring regressions added; browser/CI still required.
- [x] 2026-10-28 03:00 IST (draft): Preview-option release coverage now rejects duplicate option IDs, missing identity fields, malformed support/review/construction statuses and non-array runtime input; malformed rows cannot inflate `fullyCleared` or complete the gate. Operator UI shows invalid-row count and an explicit blocking alert. Negative tests added; exact-head CI and real operator review still required.
- [x] 2026-10-28 03:00 IST (draft): Bind selected Creative Lab directions and restored browser drafts to exact fabric IDs, occasion, climate, intention, legacy style and advanced v2 construction. Stale context/advanced-cut concepts now clear instead of carrying prior visual evidence into a new design; abort in-flight concept generation on v2 changes. Pure negative regression cases added. Exact-head CI/browser QA must pass; no physical fit, photographic parity or production approval inferred.
- [x] 2026-10-28 02:00 IST: Added bounded GLB BIN UV payload inspection: nonfinite float coordinates, collapsed UV ranges, invalid strides, truncated buffer views and impossible byte bounds revoke UV readiness even if JSON accessor metadata looks plausible. No fabric physical calibration, native Blender UV stitching or model parity is inferred.\n- [x] 2026-10-28 02:00 IST: Hardened GLB structural inspection to require typed VEC2 UV accessors, valid buffer-view references and per-primitive vertex-count parity; malformed TEXCOORD_0 and normal metadata cannot masquerade as UV-ready. This is metadata integrity only, not native seam/texture value inspection or physical acceptance.\n- [x] 2026-10-28 02:00 IST: Guarded 3D measured-tile labels against UV sampler repeat clamping on either axis of any shirt/trouser panel. Out-of-range recorded tile measurements remain stored but are explicitly shown as approximate in the isolated viewer, with regression tests; no claim of physically verified UV projection or supplier acceptance.\n- [x] 2026-10-28 02:00 IST: Added Blender-independent UV loop validation and native scene preflight gating for collapsed/nonfinite faces, discontinuities on shared mesh edges, nonmanifold topology and absent continuity evidence. Pure negative regressions do not certify sewn seams, grain direction, physical textile scale, four-angle photo parity or drape. Native Blender run and actual repaired geometry remain blocked pending scene/evidence; no production promotion.\n- [x] 2026-10-28: Reviewed Analyzer-to-Designer physical evidence and Phase 2 policy counts now require strictly typed dimensions, provenance and bounded coverage; malformed GSM, drape, fibre, URLs and rejected reviews cannot certify customer facts. Isolated 3D repeat calibration matches deterministic photo preview: swatch width/unobserved repeat cannot certify true scale, and overflow/coercion fails closed. Build-time fabric-scales.json entries now require operator/supplier provenance and typed finite measurements before tile calibration; rounded-zero tiles stay approximate. Added negative regressions. Exact-head CI, supplier evidence and native Blender acceptance remain separate pending gates; no release claim.
- [x] 2026-10-28: Hardened Phase 1 proof against coerced latency samples (`null`, booleans, numeric strings, empty strings) and invalid direct-gate sample counts, p95 values or nonfinite physical repeats; photo calibration overflow/underflow now fails closed instead of throwing or certifying scale. Added raw and recorded-evidence regressions. Exact-head CI/Non-3D QA, genuine render timings and real physical/operator acceptance remain separate pending gates; no release claim.
- [x] 2026-10-24: Confirmed connected GitHub repository and latest open draft PR #372.
- [x] 2026-10-24: Confirmed PR #372 head `28a50ac` has passing **CI** and **Deep Engine — Non-3D QA** workflow runs.
- [x] 2026-10-24: Hardened physical-evidence parsing across direct, batch, queue and worker Analyzer paths; malformed/coerced facts now fail closed and persisted jobs are independently revalidated.

- [x] 2026-10-24: Closed the reference-page-only Analyzer evidence-loss gap across direct, batch, queue and worker routes; source-only requests containing submitted verified physical facts or provenance now fail closed instead of silently dropping it. No asset, schema, model or live data changed.

- [x] 2026-10-24: Refactored Analyzer batch CSV parsing into a testable pure module; invalid nonempty GSM, repeat, physics indices and drape labels survive to strict server validation instead of being silently dropped by the worksheet importer. Existing valid decimal values still parse as numbers.

- [x] 2026-10-24: Prevented physical CSV template from promoting provenance-free catalogue GSM and drape into verified claims; only valid operator physical provenance allows prefill, with independent pure tests and HTTPS-only exported evidence URLs.

- [x] 2026-10-24: Rejected malformed and over-limit synchronous Analyzer batch envelopes atomically instead of silently processing only the first 12 rows. Added envelope and route-contract regressions; exact-head CI and browser QA still required.

- [x] 2026-10-24: Strictly parsed Analyzer CSV worksheets: duplicate/empty headings, row-width drift, unclosed quotes and unexpected text after quote now block all rows, surface an operator error and prevent analysis. Ordinary valid quoted provenance and numeric columns remain supported; exact-head CI pending.

- [x] 2026-10-24: Durable 500-job Analyzer queue now rejects malformed/oversized envelopes before enqueuing, rather than silently discarding submitted jobs 501+. Shared size-aware batch validator and regression tests. Production queue/database not touched.

- [x] 2026-10-24: Checked actual Gregorian validity of operator/supplier physical-evidence dates before exporting GSM/drape as verified CSV. Reject impossible days/months, preserve valid leap day; targeted tests added. No real evidence asserted.

- [x] 2026-10-24: Fixed atelier handoff identity collision: two saved design IDs using the same locked spec hash now retain separate customer requests; a duplicate request for the same design/version still replaces its earlier copy. Added pure regression tests, protected 50-item cap; browser-only storage remains non-production.

- [x] 2026-10-24: Atelier browser handoff reader rejects corrupt null/nonobject/incomplete stored rows before new submissions, deduplication or dashboard updates. Valid stored handoffs retain original persistence format; pure recovery tests added.

- [x] 2026-10-24: Hardened Atelier queue browser-read contract beyond top-level fields: invalid garment details, fabric assessments, notes, alternative fabrics and statuses no longer reach React rendering, and legacy oversized arrays are bounded to 50. Initial and switched customer notes/status now synchronize. New regression fixtures added. Exact-head CI/browser QA pending; handoffs remain local-only.

- [x] 2026-10-24: Atelier handoff IDs no longer depend on timestamps alone; new local packets use a fresh 128-bit browser cryptographic nonce, with backward-compatible legacy IDs. Handoff CTA and confirmation now explicitly identify browser-only storage and report write failures without claiming staff delivery. Added deterministic pure/static tests; exact-head CI and browser QA pending.

- [x] 2026-10-24: Analyzer CSV import rejects unsupported/misspelled headings and nonempty rows without fabricId, imageUrl or sourcePageUrl rather than silently excluding source/physical evidence. Blank spacer lines and valid identified rows retain previous behavior; focused fail-closed regressions added. Exact-head CI and operator browser QA pending.

- [x] 2026-10-24: Replaced unsupported `align-items:end` on the Analyzer operator panel with `align-items:flex-end`; added CSS regression, addressing the recurring Autoprefixer mixed-support build warning without changing model or physical evidence. Exact-head build must confirm no warning.

- [x] 2026-10-24: Analyzer operator batch client now verifies that every 200 response accounts for each submitted row exactly once via ordered per-item status, matching total and success/failure counts. Inconsistent/partial acknowledgements show an error rather than incrementing success totals. Focused pure and UI/API contract tests added. Exact-head CI and browser QA pending.

- [x] 2026-10-24: Saved Designs remounts the browser-local Atelier handoff panel when design ID or locked version changes; a saved/sent packet and unsent customer note from design A can no longer appear under design B. Static React key wiring regression added. Exact-head browser QA pending.

- [x] 2026-10-24: Saved Designs now filters corrupted/legacy localStorage entries at the browser-read boundary before list rendering or save/dedup, validating required design, brief, visual render and handoff shape. Valid older drafts retain order/format and prior 24-design cap. Pure corrupt-entry and compatibility regressions added; exact-head CI/browser validation pending. Not durable production storage.

- [x] 2026-10-24: Local design feedback now differentiates customers by `(designId,specHash)` rather than spec alone, with collision-resistant random packet IDs and guarded browser-read status/reasons. Existing reviewed feedback remains compatible, 100-row cap preserved, and pure regressions added. Exact-head checks and staff browser acceptance pending; no production feedback inbox claimed.

- [x] 2026-10-24: Fabric Studio scan now snapshots the selected upload/consent, invalidates async work on file, stock, fabric-range, garment, source changes and unmount; stale classifier/provider replies can no longer replace a newer fabric profile, and canceled preflight avoids starting an obsolete optional AI request. UI wiring tests added. Exact-head CI/browser QA pending.

- [x] 2026-10-24: Operator Analyzer batch prevents duplicate in-flight ingestion via an immediate ref lock independent of React state; CSV textarea, file picker and template actions are locked during a run, including a second guard after asynchronous file reading. Tested source lifecycle and `finally` unlock. Exact-head CI/browser QA pending.

- [x] 2026-10-24: Operator Analyzer CSV file imports now obey most-recent intent. Late file reads cannot replace a newer selected file, manual CSV edit, or in-flight batch source; read failures are reported without clearing the worksheet, and same-file reselection is supported. Exact-head CI and operator device QA remain required; no merge/deploy.

- [x] 2026-10-24: Analyzer batch error copy now distinguishes verified prior-chunk acknowledgements from unknown current-chunk outcomes; failure to refresh the operator view after all chunks succeed no longer falsely says batch ingestion failed. Pure numeric/message regressions and UI integration tests added; retry remains human-reviewed (not exactly-once), with CI/browser verification pending.

- [x] 2026-10-24: Local named customer-measurement records now skip corrupted null/nonnumeric/invalid nested entries, deduplicate IDs, preserve valid legacy customers and enforce the existing 20-profile limit. New profiles get random 128-bit nonce IDs, while browser save/use/delete failures show errors rather than false confirmation; pure and UI regressions added, exact-head CI/browser acceptance pending.
- [x] Guard linked-active customer profile deletion by exact profile ID and snapshot digest; leave older unlinked Designer snapshots intact (no ownership inference).

- [x] 2026-10-24: Secure measurement vault now exposes the issued recovery/delete token before any browser-local writes. Browser quota/security failure leaves token available and reports server success separately; clipboard denial preserves manual-copy fallback. Pure truth-message and UI sequencing tests added. Exact-head CI and browser permission simulation pending.

- [x] 2026-10-24: A newly activated named customer measurement profile now links its exact Designer legacy snapshot by profile ID + local integrity digest. Deleting the profile clears only its unchanged linked snapshot, not another customer or independently edited measurements; older unlinked snapshots remain intact. Added pure identity/edited-state regressions and UI wiring checks. CI/manual browser acceptance pending.

- [x] 2026-10-25: Consolidated strict stored measurement and manual-tailor-observation validation across secure-vault store/load, Measurements browser restore, Designer browser restore and Designer API observations. Corrupt numbers, unknown keys/categories and invalid timestamps now fail closed without manufactured evidence. Added shared pure/wiring regressions; physical tailor/vault/browser acceptance remains external.

- [x] 2026-10-26: Hardened measurement and locked-design vault store recovery: remote store success issues the token before optional owner linking, linking RPC false/rejection no longer becomes a misleading 503, and unconfirmed ownership is explicitly reported. Measurement UI now preserves the displayed recovery token and warns about unconfirmed account linking. Malformed/unsupported request envelopes return 400 instead of 503. Pure injected-RPC regression and route/UI contract tests added. Exact-head CI, authenticated browser recovery/claim tests, real Supabase outage simulation and deployment approval remain pending.

- [x] 2026-10-26: Secured the two-key browser measurement/observation save and remote-restore path. Both values are now written as one verified UI operation; on partial failure a pure helper attempts to roll back only unchanged values from this operation (without overwriting another tab), and UI does not activate a partially stored fit. Honest separate remote-retrieved/local-storage failure messaging added. Quota, read denial, undo denial, and concurrent edit regressions included. Browser/CI acceptance still required; localStorage has no true atomic transaction.

- [x] 2026-10-26: The locked-design Studio client now displays server-provided unconfirmed account-link status beside the recovery token, preserving copied/manual-copy messages. Source ordering regression added; authenticated browser acceptance still required.

- [x] 2026-10-26: Main Measurements save and Use in Designer now commit measurements plus manual observations through the guarded pair writer. Partial browser writes keep React state inactive, attempt non-clobbering rollback, disclose incomplete recovery, and block Designer navigation. Added source regression and release-contract coverage; real blocked-storage/concurrent-tab device acceptance remains required.

- [x] 2026-10-27: Named customer activation resets unrelated posture evidence; save/activate/delete recover partial writes without knowingly overwriting concurrent edits. Invalid history blocks mutation; confirmed writes are read back. Runtime regressions cover customer switching, failed activation/deletion and corrupted history.
- [x] 2026-10-27: Measurement vault uses synchronous request locking and locks edit/token controls during recovery. LocalStorage getter denial preserves remote recovery credentials; successful recovery clears stale local-save errors.
- [x] 2026-10-27: New measurement-recovery scenarios passed locally in Chromium at 390/768/1440, with synthetic vault responses, storage denial, rollback and duplicate dispatch. No console errors or horizontal overflow. Latest runtime download failed; isolated Playwright 1.56.1 / Chromium 141 succeeded without changing project dependencies. Remote exact-head CI, authenticated vault and physical acceptance remain pending.

- [x] 2026-10-27: Physical provenance rejects coerced array/object/boolean/number fields; corrupt evidence cannot authorize verified CSV values. Template GSM stays blank outside the existing supported range. Added normalization and CSV integration regressions; no supplier evidence invented or changed.

- [x] 2026-10-27: Deleting an unchanged, linked named customer now removes their associated manual tailor observations as well as measurements; stale/independently edited manual fits and other customers' records are preserved. Regression tests cover successful removal, rollback on denied deletion, and identity isolation. Draft #402; exact-head CI/browser acceptance and real tailoring evidence remain release gates.
- [x] 2026-10-27: Analyzer CSV header validation now applies to single-row/header-only worksheets; malformed evidence column names cannot bypass checks when zero data rows are parsed. A single leading supplier UTF-8 BOM is accepted without weakening field validation. Deterministic tests added. Stacked draft #403; exact-head CI and operator device acceptance remain pending.
- [x] 2026-10-27: Owned measurement/design vault actions reject malformed UUIDs before authentication or database RPC, using the same strict normalizer as recovery-token issue/parse. Coerced arrays, invalid UUID versions/variants and trailing data fail closed; token/schema formats are unchanged. Exact-head CI and authenticated live Supabase acceptance remain pending.

- [x] 2026-10-27: Recovery-token load/delete in measurement and locked-design vaults no longer depend on optional legacy session introspection. Owned/claim operations still require account identity; malformed credentials still fail before auth/RPC. Draft #406, exact-head CI and authenticated provider acceptance pending.
- [x] 2026-10-27: Locked revision verification handles corrupt runtime envelopes and unserializable nested payloads by returning failed integrity instead of throwing through vault APIs. Existing valid lock generation is unchanged. Draft #407, real vault and release acceptance pending.
- [x] 2026-10-27: Optional customer identity resolution on vault store is best effort. Legacy Auth outages do not prevent independently working secure copy creation; ownership uncertainty is surfaced while preserving the issued recovery credential. Account-owned actions remain mandatory-auth. Draft #408, exact-head CI and real Supabase outage acceptance pending.

- [x] 2026-10-27: Identical garment recipes locked in the same second now receive distinct 64-bit nonce-suffixed design revision IDs. Recipe hashing, parent links and compatibility with older stored IDs remain unchanged. Draft #409; exact-head CI and production handoff acceptance pending.
- [x] 2026-10-27: Measurement and locked-design vault per-process rate caches are bounded to 4,096 entries, opportunistically evicting expired oldest keys with constant per-request work; the existing 30 requests/minute per cache identity threshold remains. Memory safety is not distributed rate-limit security: edge/backend enforcement and authenticated threat-model review remain release blockers. Draft #410; exact-head CI pending.

- [x] 2026-10-27: Increased premium 390px phone navigation from 8px to 11px labels while retaining the five real destinations, fixed bottom clearance and compact two/three-line wrapping; static regression added. Draft #411. Requires fresh exact-head Chromium 390/768/1440 screenshots and touch-device acceptance; does not imply general accessibility sign-off.

- [x] 2026-10-27: Both account-owned vault listing routes now screen malformed rows and ID/date envelopes before exposing results; design listing additionally requires the SQL index recipe hash and revision ID to match the independently verified locked payload. Corrupt rows are skipped without assigning a different design identity. Draft #412; exact-head CI, authenticated Supabase list/load acceptance, and supplier/tailor verification remain release gates.

- [x] 2026-10-27: Hardened measurement and locked-design vault read responses for both recovery tokens and authenticated account load: only one well-formed, unexpired timestamped RPC row is accepted; duplicate/malformed/expired envelopes fail closed instead of returning arbitrary or stale records or causing a service-level exception. The design account-claim follow-up uses the same guarded read before optional production ownership propagation. New pure and route-wiring regressions added. Exact-head CI, authenticated live Supabase recovery/claim and mobile browser acceptance still required; no schema, merge or deploy.

- [x] 2026-10-27: Hardened instant fabric preview scale promotion: only an actual declared repeat with a detected positive finite pixel period can turn a tile into a verified physical-width render. A declared swatch-width record, stale nondetected repeat, overflow, nonfinite width or invalid texture dimension cannot silently become measured patterned scale or pass the photo repeat audit. Deterministic regressions added. Supplier repeat proof and customer-device visual acceptance still external; exact-head CI pending. No schema/model/photo replacement or deploy.

- [x] 2026-10-27: Design and measurement secure vaults now require literal boolean RPC acknowledgements for claim, owned delete and token delete. Malformed truthy JSON cannot masquerade as a confirmed claim/deletion or trigger production-ownership propagation. Added pure boundary and both-route wiring regressions. SQL/schema unchanged; exact-head CI and live authenticated/browser checks remain mandatory. No merge or deploy.

- [x] 2026-10-27: Secured account-owned measurement/design vault list expiry semantics. Shared Postgres offset-bearing timestamp parser now rejects stale/expired, ambiguous date-only and impossible created-after-expiry list rows; both endpoints reuse the guard without changing the Supabase schema. Added timestamp-boundary, timezone and route-compatibility regressions. Exact-head CI and authenticated real database/browser validation pending; no main merge or deploy.

- [ ] 2026-10-28 06:00 IST: Operator desktop cloud sync now rejects malformed/unsafe cursor syntax, impossible timestamps, invalid financial/tape evidence, truncated >250 event uploads, duplicate IDs, malformed backend pages and out-of-order cursor rows. Stock operator read now fails closed on duplicate/unknown SKUs, impossible metre balances and contradictory provenance counts; record/reserve require UUID RPC acknowledgements. Draft #425; exact-head CI, real desktop + Supabase, and authenticated browser acceptance pending. This is not a production stock certification.

- [ ] Desktop cloud sync follow-up: replace timestamp-only upload high-watermark with a durable acknowledged event-ID or append-position journal. The 06:00 draft replays equal timestamps, but system-clock rollback or backdated local inserts can still be skipped; do not claim exactly-once sync until tested with real offline/online desktop and Supabase recovery.

- [x] 2026-10-29: Reconciled #454 owner/token enquiry and consent onto #455 operator handoff while preserving #453 explicit second-click WhatsApp anchor and shared bounded/throttled transport; changes committed in a stacked draft, not yet validated on exact integrated head.
- [ ] Validate combined head: quality, Node tests, engine, preview, release check, build and both pinned Chromium workflows; real Supabase account/token/operator and stock/tailor acceptance still required. No merge, migration or production deployment.

- [x] 2026-10-29: Invalidated pending customer enquiry replies when explicit consent changes, a lock is replaced, or the selection identity changes. Prevents a late audit/draft response from reappearing after the user unchecks consent. Source/test/release guard staged; exact-head browser QA still required.

- [x] 2026-10-30: Operator first-ten delivery evidence now rejects padded, array/object or otherwise nonliteral order IDs before recording physical no-reentry claims. The existing exact UUID receipt parser is reused for both request identity and returned evidence receipt; regression covers positive UUID case normalization and negative coercion. Draft CI/browser and real physical/operator signoff remain separate gates; no live writes or deployment.

- [x] 2026-10-30: First-ten physical delivery and operator summary timestamps now reject impossible Gregorian dates, clock values and missing/invalid timezone offsets instead of accepting JavaScript calendar rollover. Added leap-day/offset and invalid order/audit regressions. This is source integrity only; exact-head CI, genuine first-ten deliveries and human signoff remain release gates.

- [x] 2026-10-30: Authoritative first-ten delivery audit validation now rejects whitespace-padded order IDs, audit order IDs and audit receipt IDs instead of trimming them into trusted identities. Case-only ID variants remain compatible; malformed/coerced and padded receipt regressions added. Draft exact-head CI/browser and genuine first-ten physical/operator evidence remain separate gates. No production writes, migration, model change, paid provider or deploy.

- [x] 2026-10-30: J5 operator delivery browse receipts now fail closed if a delivered timestamp precedes order creation or a matching completion audit predates order creation/delivery. Historical nullable delivery dates and evidence for orders omitted by the capped browse page remain browsable, not release proof. Pure chronology regressions added; matching-head CI/browser and real physical evidence remain independent gates.

- [x] 2026-10-30 08:00 UTC: T5/J5 fail-closed operator browse lineage: validated order statuses and locked hash/revision receipts; immutable completion audit must preserve matching order revision, recipe hash and creation instant when the order is on the bounded page, and cannot predate its own recorded order creation otherwise. Zero-reentry audits cannot report re-entered fields. Added pure regression cases. Draft exact-head CI and real operator/physical proof remain separate; no main merge/deploy.

- [x] 2026-10-30: T5/J5 independent first-ten SQL vs newest-500 operator browse consistency guard; overlapping immutable receipts cannot contradict, and case-equivalent UUIDs deduplicate in UI. No data/schema migration, original model change or paid AI. Exact-head CI, physical beta/delivery and owner approval remain independent.

- [x] 2026-10-30: J5 first-ten snapshot consistency now rejects a newer operator browse audit for an oldest-ten delivered order if that immutable audit receipt is absent from the authoritative SQL snapshot. A later manual-reentry incident can no longer coexist with an apparently clean first-ten certification. Unrelated historical/out-of-page audits remain browsable. Pure positive/negative regressions added. Exact-head CI/browser and ten real deliveries remain separate gates; no live writes, migrations, paid provider, merge or deployment.

- [x] 2026-10-30 08:55 UTC: J3 authenticated design-vault claim now reads one unexpired, integrity-verified locked revision before any owner-link mutation; corrupt/missing/expired records cannot return a successful account claim. Source-order and recovery-envelope regressions added. Matching-head CI/real authenticated owner acceptance remain separate.
- [x] 2026-10-30 09:00 UTC: J3 measurement-vault claim now validates a single unexpired stored profile and tailor observations before linking an owner, mirroring locked-design claim. Missing/corrupt recovery never returns claimed success; regression guards RPC ordering and invalid envelopes. Real customer signoff remains pending.

- [x] 2026-10-30: T2/J3 authenticated claim now requires a second, owner-scoped read of the same locked revision or measurement/tailor profile after a true set-owner receipt, before reporting `claimed:true`. Missing, malformed, expired or contradictory owned recovery fails closed; optional production ownership propagation follows confirmed design recovery. Source-order and negative-envelope regressions added. Exact-head CI and real authenticated owner acceptance remain independent gates; no live writes/migrations, paid AI, merge or deployment.

- [x] 2026-10-30: T2/J3 authenticated secure **store** now confirms owner-scoped retrieval of the exact saved design revision/hash or measurement/tailor profile after a successful owner-link receipt, before returning `accountOwned:true`. Missing, malformed, expired or contradictory owned reads downgrade to recovery-token-only with explicit warning; optional production ownership propagation waits for verified design recovery. Source and negative-path regressions added. Exact-head CI and real signed-in Supabase recovery acceptance remain separate gates; no production writes, migrations, paid AI, main merge or deployment.

- [x] 2026-10-30: J3 authenticated design-vault store/claim owner recovery now compares the immutable parent revision and exact lock instant in addition to verified recipe hash/revision ID. A valid same-garment owner read with altered lineage cannot be reported as the saved lock. Added pure agreement and both-route source regressions; exact-new-head CI/browser and real authenticated owner acceptance remain pending. No live data writes, migration, paid AI, main merge or deployment.

- [x] 2026-10-30: Reproduced exact #533 CI and Non-3D production-build TypeScript failure in `style-spec-v2.ts` at the redundant `legacySelectable!==false` comparison after the false case was already excluded. Removed the no-op branch and updated source regression; canonical advanced-only options, legacy photo fallback and original model remain unchanged. New exact-head CI, browser and real physical/customer acceptance are still required; no live write or deploy.
- [ ] Verify new child PR exact-head dependency audit, quality, 1,201+ Node tests, engine, preview-performance, release check, production build, 390/768/1440 Chromium and Non-3D; retain human/photo/stock/tailor/owner gates as BLOCKED/PENDING.

- [x] 2026-10-30: M40 exact-head Non-3D browser exposed a second J2 defect: `open_short_hem_cuff` (livePreview:none) was auto-written into the legacy photo cuff because the legacy selector lists provisional options. Both adapter directions now refuse photo projection of unphotographed cuts; canonical v2 construction is preserved. Added positive/negative pure and source regressions. Re-run exact-new-head browser and CI; physical/photo signoff still pending.

## 2026-10-30 — M43 quote reconciliation
- [x] Reproduce and fix raw-adjustment versus persisted-paise total discrepancy; nine quote regressions pass. Source/test a24434c93d4f6f4d2d86ea04ee357fad02d1d6be.
- [ ] Exact-head Linux full suite/build/390/768/1440 Chromium/Non-3D; local process spawning blocked by EPERM. Human/physical/stock/owner gates remain pending. Next independent J4 share/consent validation.


- [x] 2026-10-30: T5/J4 real HTTP privacy regression for signed public share links: both full CI and Non-3D now start a LOCAL Next server with an ephemeral CI-only share secret and fetch a synthetic signed 200 share, rejected 404 share, and ordinary homepage. Assert actual no-referrer, private/no-store and noindex/nofollow response headers; the fixture has deliberately unverified non-stock fabrics. This is code/browser-server evidence only, NOT real customer consent, live Supabase owner verification, physical inventory or security signoff. Exact new-head workflows and genuine human gates remain pending.

- [x] 2026-10-31: T5/J5 operator quote/order GET now validates individual typed SQL receipts (UUIDs, lock lineage, currency/line items/money, status, timestamps, duplicate IDs) and overlapping accepted quote/order identity before exposing records or enabling operator controls. A 200 JSON array containing malformed rows is no longer a valid production ledger. Historic long labels, historical monetary precision and older quotes omitted from the capped newest-100 page remain compatible. Pure positive/negative regressions added; exact-head CI/browser and genuine operator/physical acceptance pending. No production writes, migrations, paid AI, main merge or deployment.

- [x] 2026-10-31 M47 follow-up: typed operator quote browse also rejects materially contradictory subtotal/total versus persisted line items and adjustment, with up to two paise tolerance for historical PostgreSQL independent rounding. Tests cover forged totals and historical precision. New exact-head CI/browser pending; no real financial audit certification.

- [x] 2026-10-31 M48: Operator Production Desk now independently validates the complete 200 HTTP quote/order envelope in the browser, including configured state and optional evidence availability, before enabling mutation controls. A backend-not-configured reply cannot carry apparently genuine rows. Changing or reloading a recovery token invalidates the previously loaded lock, and a new lock clears the old linked quote selection. Pure and UI source regressions added. Exact child CI, responsive Chromium, authenticated real operator/Supabase acceptance and physical proof remain pending; no merge, deploy or production write.

- [x] 2026-10-31 M50: Dedicated finished-garment QC GET and browser now reject malformed, duplicate, chronologically impossible and mismatched order/inspection records instead of trusting 200 arrays. Browser clears stale ready-order controls on failed reload and requires a literal confirmed inspection UUID after POST. Legacy blank-provenance inspections remain visible but are labelled unverified, not release proof. Exact-head CI/browser and genuine tailor/physical QC remain separate gates; no live write, schema, paid provider, merge or deploy.

- [x] 2026-10-31 M51: Delivery status and operator delivery-button gate now require all six exact literal true finished-garment QC checks in the newest approved receipt, not merely an approved string and named provenance. Missing, coerced, false or unknown check fields fail closed; newer rework still vetoes earlier approval. Pure regressions added. Exact-child CI and genuine physical/operator signoff remain pending; no production writes, schema, paid provider, merge or deployment.

## 2026-10-31 — J5 canonical PostgreSQL UUID lookup for delivery status (stacked draft)
- [x] Reproduced a source-level mismatch: operator status parsing canonicalizes an input UUID to lowercase, while the typed newest-150 production-order receipt may legally use uppercase UUID hex. A raw `row.order_id===orderId` lookup loses the ready order and incorrectly rejects otherwise matching physical QC.
- [x] Resolve the current order by the existing strict literal UUID receipt normalizer, preserving the capped complete-order page, newest QC approval/rework veto, six literal physical checks, immutable revision/hash and chronology. Add uppercase-order regression and release source guard.
- [ ] Verify this exact final draft SHA's audit, quality, full Node, engine, preview-performance, release check, build, responsive Chromium and Non-3D. Human/physical supplier stock, authenticated owner/operator, tailoring/QC, native Blender, real devices, beta/delivery, security/privacy and owner release approvals remain BLOCKED/PENDING. No live writes, paid services, migration, main merge or deploy.

## 2026-10-31 — M55 optional production evidence chronology (draft)
- [x] Reject installed optional QC inspections, customer outcomes and learning contexts dated before a visible production order; reject nonblank QC revision/hash contradicting its locked recipe. Keep older rows outside the independently capped order page and historical blank/null QC provenance readable but unverified. Add positive/negative source regressions and static release guard.
- [ ] Verify exact child SHA's audit, quality, full Node, engine, preview, release check, build, 390/768/1440 Chromium and Non-3D. Real authenticated operator, supplier stock, physical QC/tailor, native Blender, devices, beta deliveries, privacy/security and owner approvals remain BLOCKED/PENDING. No live writes, schema changes, paid services, main merge or deployment.

## 2026-10-31 — M56 J5 operator mutation receipts and canonical history (draft)
- [x] Reject success-shaped HTTP 200 operator mutation replies unless they carry a literal confirmed quote/order UUID plus exact locked/learning verification flags, or a literal `updated:true` status receipt. Do not report success or reload as if the action completed on an unverified receipt.
- [x] Match operator outcome/context rows by canonical PostgreSQL UUID and quote/order packet selection by equivalent SHA-256 hex casing, without relaxing strict UUID/hash validation or fabric/physical truth. Add pure negative regressions and static release guard.
- [ ] Verify exact child SHA dependency audit, quality, full Node tests, engine, preview-performance, release check, production build, responsive Chromium and Non-3D QA. Real authenticated owner/operator, genuine supplier stock, physical tailoring/QC, native Blender, devices, beta/first-ten deliveries, security/privacy and owner approvals remain BLOCKED/PENDING. No production writes, schema migration, paid provider, main merge or deployment.


## 2026-10-31 — M57 J5 operator recovery must be independently verified in browser (draft)
- [x] Reject success-shaped HTTP 200 design-vault load responses with malformed, unlocked or tampered revision/hash before enabling quote/order creation or production exports. Clear stale quote/order revision/hash/quote ID immediately on every recovery attempt; preserve existing server-side verification and recovery-token change invalidation. Add source regression and release guard.
- [ ] Verify this exact child head's dependency audit, quality, full Node, engine, preview-performance, release check, build, responsive Chromium 390/768/1440 and Non-3D. Real authenticated owner/operator, supplier stock, physical tailor/QC, native Blender, devices, beta/first-ten deliveries, privacy/security and owner approvals remain BLOCKED/PENDING. No live writes, schema, paid provider, main merge or deployment.

## 2026-10-31 — M61 J5 operator production/QC response privacy (draft)
- [x] Route every operator production and garment-QC GET/POST outcome (including unauthenticated, unconfigured, validation, upstream failures and success) through a private `Cache-Control: private, no-store` and `Pragma: no-cache` responder. Previously only successful GET ledgers and one POST failure explicitly set no-store; other quote/order/QC receipts could be cacheable under intermediaries.
- [x] Add source regressions, an anonymous **real built-Next** four-request GET/POST loopback header smoke in both CI browser lanes, and static release gate. Anonymous smoke never writes to Supabase or calls paid providers.
- [ ] Verify child exact-head dependency audit, quality, full Node tests, engine, preview-performance, release check, build, 390/768/1440 Chromium and Non-3D. Authenticated private-response/live operator proof and genuine stock, physical tailor/QC, native Blender, devices, beta/first-ten deliveries, privacy/security and separate owner approvals remain BLOCKED/PENDING. Server-side idempotency and transactional QC/status remain unproven; no production writes, migration, main merge or deployment.


## 2026-10-31 — M64 J1 Stock Desk browser receipt and snapshot verification (stacked draft)
- [x] Reuse the existing pure strict stock snapshot validator in the operator browser: a 200 response with malformed/duplicate SKUs, forged provenance or inconsistent physical/reserved/available metres now fails closed instead of rendering fabricated availability.
- [x] Independently verify every 200 stock mutation acknowledgement by action: exact event/reservation UUID or literal released/consumed true. Invalid, swapped, coerced or missing acknowledgements remain ambiguous and cannot display success or confirm a reservation. Add positive/negative pure regressions, UI source regression and static release check.
- [ ] Verify this exact draft SHA's dependency audit, quality, full Node, engine, preview-performance, release check, build, responsive Chromium and Non-3D. Physical supplier stock, authenticated operator, real reservation/SQL installation, tailor/QC, Blender, devices, beta/first-ten, privacy/security and owner approval remain BLOCKED/PENDING. No schema/production writes, paid AI, main merge or deploy.
