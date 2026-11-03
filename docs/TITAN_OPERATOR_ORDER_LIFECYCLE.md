# TITAN operator order lifecycle — isolated checkpoint

## Scope and decision

The existing persisted production order contract in `src/lib/designer/production-state.ts` remains the only deployed status vocabulary: `created`, `cloth_reserved`, `cutting`, `stitching`, `fitting`, `ready`, `delivered`, `cancelled`. Its SQL RPCs and finished-garment QC transaction checks remain authoritative. This branch deliberately **does not** modify that contract, production routes, Supabase migrations, stock/inventory, auth, measurements, DesignerModule, preview or the original `linen-earth-studio-model-v1` model.

`src/lib/operator/order-lifecycle.ts` introduces a separate, pure, proposed operator lifecycle with explicit **acceptance → cutting → stitching → finishing → QC → dispatch → delivery** and audited cancellation, QC rework and recovery. It is **not wired into production**, and its richer states (`accepted`, `finishing`, `qc_pending`, `qc_rework`, `qc_approved`, `dispatched`, `recovery_pending`) must not be persisted into the existing SQL status column without an owner-reviewed compatible migration and transactional enforcement. This separation avoids a false claim that a UI-only state is durable.

## Implemented invariants

- Every event must match the locked order ID, current status, next sequence, previous event ID and strictly increasing timestamp; duplicate event IDs, replay, stale updates and tampered replay destinations are rejected. Applied audit replay requires an explicitly present and exact `to` status (missing, null and undefined are rejected); raw unapplied event inputs do not require `to`. Calendar validation rejects impossible local dates, invalid clock fields and offsets outside ±14:00 before `Date.parse` can normalize them; valid leap days and timezone offsets remain accepted.
- Every event requires an identified actor and external evidence reference; cancellation, QC rejection, recovery hold and resumption require a documented reason.
- No stage skipping; only QC approval with all six existing finished-garment check IDs, a named inspector, physical inspection reference and matching immutable revision/recipe hash permits dispatch. Dispatch is mandatory before delivery.
- QC rework returns to stitching; any recovery from a previous QC approval returns to stitching and requires new finishing and QC. A recovery hold cannot be used to jump to dispatch. Re-approval must cite a new inspection reference; an old QC receipt cannot be reused, including during audit replay.
- Cancellation is terminal and unavailable after dispatch. Delivered orders are terminal. Replays validate event ordering without mutating inputs.

**Evidence limitations:** The module validates the *shape* and consistency of a claimed physical receipt but cannot establish that a tailor inspected a garment or that a courier dispatched it. Client-supplied event metadata is not a trusted audit until an authenticated, transactional, append-only server store independently verifies identity, provenance and monotonic revisions. Do not enable production controls or infer stock, customer acceptance, QC, delivery, paid AI use or genuine human testing from these synthetic tests.

## Follow-up hardening — 2026-11-02

- Corrected independent central-review findings on the isolated state machine: a deleted `to` field can no longer pass applied audit replay; February 30 / April 31 / invalid leap days, hours and offsets are rejected before chronology evaluation.
- Added focused negative and positive synthetic tests for missing/null/undefined/tampered `to`, valid leap-year and offset-aware timestamps, invalid calendar and UTC-equivalent duplicate event time.
- This does **not** provide cryptographic event integrity or prove real-world QC. An authenticated transactional server with immutable append-only records, actor permissions, physical receipt verification and coordinated SQL status mapping is still required.

## Audit snapshot hardening — 2026-11-03

- Lifecycle states, audit arrays, applied events, QC approval objects and six named QC-check records are now frozen at runtime, not merely marked `readonly` in TypeScript. Consumers cannot silently mutate a returned in-memory approved audit to claim a different stage, operator or QC result.
- An external event `evidenceRef` may appear **only once per order**. A second transition claiming the same receipt is rejected, including when replaying tampered stored history. Separate QC inspection-reference freshness remains required across rework/recovery.
- Added two focused regression tests for duplicate event evidence (live reducer and stored replay) and runtime mutation attempts (state, audit, event and QC checks).
- These protections do **not** authenticate a real operator, establish receipt ownership or replace a transactional append-only database. No production state or schema changes were made.

## Verification for latest hardening

- The prior exact head `320a8a001712939cd7984f1df52450d5124af8bc` passed Full CI #41531261832 and Non-3D QA #41531261782, including synthetic HTTP and disposable PostgreSQL checks. **These successes predate the runtime immutability and receipt-reuse patch.**
- New exact-head CI/Non-3D must finish before the current patch can be described as repository-verified. Do not infer local full-repo tests or physical signoff.

## Local verification

- `node --experimental-strip-types --test tests/operator-order-lifecycle.test.ts`: 10/10 passing in Node 22.16.0, local isolated test run.
- `tsc --noEmit --strict --target ES2022 --module esnext --moduleResolution bundler --skipLibCheck src/lib/operator/order-lifecycle.ts`: passed with local TypeScript 5.8.3.
- Full repository `npm run quality`, `npm test`, `npm run eval:engine`, `npm run eval:preview-performance`, `npm run release:check`, `npm run build` and browser checks: **not run locally for this follow-up**. The prior 10/10 Node tests and strict TypeScript validation were on the earlier head, not evidence of the new hardening code. New exact-head CI and Non-3D QA were queued after source/test edits; wait for results.

## Serialized snapshot replay gate — 2026-11-03

- Added `restoreOrderLifecycleSnapshot(raw)` to rehydrate a serialized lifecycle only after replaying every applied event and comparing the claimed status, sequence, last event ID and recovery origin with the computed canonical result. The result is a new immutable snapshot, not the mutable persisted input.
- Added synthetic regression coverage for valid JSON round-trip and continuation; corrupted stage, sequence, previous-event pointer, recovery origin, truncated/tampered audit, wrong order identity, wrong locked revision/hash and missing audit must fail closed.
- **Trust boundary:** this catches internal inconsistency and malformed serialized state, but a malicious writer capable of replacing the entire internally consistent audit can still forge events. A trusted authenticated, append-only transactional server, authorization, physical proof and integrity guarantees remain required before production.
- Previous exact head `86a3ccc0333a43e5c87f7f20f21b5b0a852af9c5` has now passed Full CI #41539874575 and Non-3D QA #41539874515. Those runs predate this new snapshot gate. New exact-head checks are pending until the commit is published.
- Main has advanced to `4309ce97660067ba949fc3f215d0b1dfbf2243e6` (stock provenance integration). No operator-file overlap in the inspected main delta; the operator branch is not rebased, merged or deployed.

## Next checkpoint

1. Obtain **new exact-head** Full CI and independent Non-3D QA for the hardening commit; previous success on `f849cf7b` does not verify these changes. If either fails, fix only isolated order-lifecycle files and retest.
2. Coordinate the proposed states with the central integration owner and current SQL state machine; secure approval for persistence, audit events, idempotent writes, verified actor/physical evidence, cancellation/refund policy and recovery semantics. **Do not** modify shared SQL or production routes from this branch.
3. After authorized backend implementation in a separate coordinated integration, add authenticated end-to-end tests for concurrency, audit replay, QC rework, cancellation after dispatch, dispatch/delivery evidence and operator device widths 390/768/1440.
4. No main merge, Vercel deployment or production customer-data changes from this branch.

## Trusted-state provenance gate — 2026-11-03

- A structural TypeScript `OrderLifecycleState` is not proof that the object was produced by the validated reducer. Previously, an arbitrary object with `status: "qc_approved"`, zero audit events and matching order fields could be supplied to `applyOrderLifecycleEvent()` to dispatch without any actual QC transition. A fabricated `recovery_pending` object could likewise resume an invented recovery.
- The reducer now keeps a module-private `WeakSet` of in-process states it minted through `createOrderLifecycle()`, `applyOrderLifecycleEvent()` or `restoreOrderLifecycleSnapshot()`. Every new transition requires an exact trusted object identity; clones, inherited objects and JSON-deserialized snapshots are refused until full audited replay rehydrates them. This prevents accidental/forged stage escalation by callers while preserving immutable branching and canonical rehydration.
- Added regression tests for forged QC approval, forged recovery, JSON clones, prototype clones, and successful continuation after audited restore. These are **synthetic, in-process invariants**, not authentication, receipt validation, or cross-process guarantees.
- **Previous exact head `c32c693a88a20724e9b99935b96f2f8cd7e28eae`:** Full CI **SUCCESS** #41548066944 and Non-3D QA **SUCCESS** #41548066905. The new code/test commits supersede those runs; obtain matching-head CI and Non-3D results before claiming this gate verified.
- Main advanced to `05c180c215929df6f487a1d3a758cce7df75fa58`. Compared all three intervening main commits and active Security #863, Fabric #862, Style #868, Stock #874, Tailor #861, and Docs #871: none touch the operator source, test or checkpoint paths. This branch remains isolated, draft and unreconciled; no main merge, deployment, SQL migration or production customer-data access.
- **Next:** verify exact-head workflows, repair failures without weakening tests, then coordinate a separately approved authenticated transactional append-only backend and explicit mapping to existing SQL statuses. This `WeakSet` does not establish database concurrency safety, actor identity or real-world QC evidence.

## Blank-only evidence hardening — 2026-11-03

- The shared `nonEmpty` validator previously accepted strings containing only spaces when they met minimum lengths (for example an eight-space external receipt, three-space cancellation reason or two-space QC inspector). This allowed an apparently evidenced transition without meaningful operator/receipt/reason data.
- The isolated lifecycle validator now rejects whitespace-only strings for all named evidence fields, including operator actor, external evidence reference, QC inspector, inspection reference and mandatory cancellation/recovery reasons. Existing well-formed values and stage rules are unchanged. A regression test covers these negative cases and a valid acceptance.
- Previous exact head `29c77456190f6c239bdbb688b8cfcdb9c719efbf` passed Full CI #41554636606 and Non-3D QA #41554636801. **These checks predate this patch.** Obtain new matching-head results before calling this change CI-verified.
- Main `05c180c215929df6f487a1d3a758cce7df75fa58` and active PR patches #863/#862/#874/#868/#861/#871 were inspected; none touched these three operator files. Branch remains draft and not reconciled with main. No deployment, SQL or production data modifications.
- **Next:** verify exact-head CI and Non-3D QA, then coordinate the SQL status mapping and authenticated append-only transactional persistence with central integration. Real QC and courier receipts remain unverified.

## 2026-11-03 02:45 UTC — timestamp precision hardening

- New code head `2cb99efe43389ddc0d44daa10cdf15112d1effef` (two sequential commits: `f0c27817` and `2cb99efe`).
- Audit event timestamps now require ISO-8601 fractional seconds to be at most three digits. JavaScript Date.parse silently truncates extra precision, so accepting a purportedly more precise timestamp can misrepresent chronology and allow indistinguishable instants in persisted audit data. The validator and its parsing expression use the same bound.
- Added negative cases for four/six fractional digits, valid one/three digit cases and snapshot replay rejection of extra precision. No production order state or physical QC facts were changed.
- Previous exact head `e8bc0f63`: Full CI #41561895184 SUCCESS; Non-3D QA #41561895185 SUCCESS. **New head CI not yet established at checkpoint; do not inherit prior green status.** No local full-repository verification claimed.
- Latest main observed via AGENTS.md `006e0bb3f8864fda6e1de6649d7a063113be9403`; comparison main-vs-operator showed stock/catalogue/3D/workflow changes only, no overlapping operator lifecycle source/tests. The draft remains isolated and not reconciled to main.
- Next: verify exact-head CI, inspect and repair failures, check concurrent PR overlaps, then reconcile latest main only after independent review. Authenticated SQL transaction and physical QC evidence remain blockers. No merge, Vercel deploy or production data changes.

## 2026-11-03 03:45 UTC — action-scoped reason integrity

- Previous exact head `2dbd65acaf9a5c4fc385e21a72ab665832cca50d` passed Full CI #41567923108 and Non-3D QA #41567923199. Those results do **not** verify this continuation.
- Ordinary lifecycle actions previously accepted arbitrary `reason` text, making an extra unvalidated justification part of the immutable audit despite no corresponding action requiring one. Now only cancellation, QC rejection and recovery hold/resume may include reasons; these actions still require a nonblank documented reason. Replay rejects retroactively inserted reasons on normal transitions. Regression tests cover normal transitions, persisted replay and legitimate cancellation.
- Main observed at `fd2f29771a24ae888719d64504a0b1fb3595ffb1`; intervening main files were stock, catalogue, viewer, SQL and CI, with **no overlap** with this isolated three-file operator scope. Other active workstreams were inspected; no shared operator file detected. No main merge or rebase, deployment, production data or physical evidence changes.
- **Verification pending:** exact-head CI and Non-3D QA on the new code/test/docs head; no local npm suite run claimed. Next check those workflows and fix any failures, then coordinate SQL status compatibility, authenticated transactional append-only persistence, physical QC and independent approval with central integration.

## 2026-11-03 04:45 UTC — persisted audit schema integrity

- Previous exact head `a6974ee60846be6cf14c84e87bce4935dfad0088` passed Full CI #41573644901 and Non-3D QA #41573644856. Those checks predate this patch.
- Stored audit replay previously accepted arbitrary additional fields (such as `operatorApproved` or `customerPaymentConfirmed`) and silently discarded them while reconstructing a canonical event. This could hide unrecognized asserted evidence during audit rehydration. Replay now rejects unknown top-level applied-event fields, retaining the existing versioned event contract and strict transition rules. The live event reducer is unchanged; the restriction is specifically on stored applied events.
- Added negative replay and snapshot-restore regressions for invented operator, payment and QC override fields, plus a valid restored transition.
- Exact-head CI and Non-3D QA for the new source/test/docs commits must be checked before declaring verification. No local full-repo test run is claimed.
- The latest inspected main was `fd2f29771a24ae888719d64504a0b1fb3595ffb1`; this continuation compared the branch with current main and found only the three isolated operator files on the branch. No main merge, Vercel deploy, SQL migration, shared auth/stock/Designer files or production data changes.
- **Next:** verify new exact-head workflows; coordinate authenticated transactional append-only storage, SQL state compatibility, real physical evidence and independent signoff before any production integration.


## Unknown-field enforcement repair — 2026-11-03

- Fixed a mismatch between declared QC/snapshot field allowlists and runtime enforcement: `validateQc` now rejects extra top-level QC fields and extra QC-check keys, while `restoreOrderLifecycleSnapshot` rejects extra snapshot fields before replay. These checks prevent unsupported evidence claims from being silently dropped.
- Existing regression test `unknown QC and snapshot evidence claims are rejected during live approval and restore` covers forged QC fields, forged check keys and extra snapshot metadata; no tests were removed or weakened.
- Source commit `c997c16b02d6cf8d9012c5ca0b71c0121207656c` is **not yet CI-verified**. The prior exact-head checks cannot validate this patch. Obtain Full CI and Non-3D QA for the new head and correct failures within this isolated scope.
- Compared current main `fd2f29771a24ae888719d64504a0b1fb3595ffb1` against branch merge-base: no overlapping operator source/test/checkpoint paths. Branch remains isolated; 11 main commits behind. No production persistence, SQL, auth, stock, model, merge or deployment changes.


## Incoming event field integrity — 2026-11-03

- The live reducer now rejects unexpected top-level event fields instead of silently dropping fabricated operator, payment or QC claims. This complements the existing stored-audit allowlist and does not authenticate actors or receipts.
- Added a focused negative regression test for three forged live-event claims and a valid acceptance control.
- Source/test commit `51e5c38da518bb1613d8fdb9913fc2063f4a6273`. **Exact-head CI and Non-3D QA must be checked; no passing claim until verified.** Previous head `4f8a618c` passed both workflows.
- Main `fd2f2977` was 11 commits ahead of branch merge base at inspection; operator paths were isolated. Next: verify exact-head workflows, coordinate SQL-state and authenticated transactional integration with central owner. Do not merge or deploy.


## Live destination-claim validation — 2026-11-03

- A live event previously could include a fabricated `to` destination that the reducer silently ignored. Now any supplied `to` must exactly match the computed permitted transition, including recovery and QC paths; omitting `to` remains valid for unapplied input events. Applied stored audit replay still requires an explicit matching `to`.
- Added regression cases for forged, null, undefined and valid live destination claims, including recovery. Preserved the existing `Tampered audit destination` diagnostic used by replay tests.
- Prior branch head `10a7d1011006b45f1375faacd8fa9b0bca5d0496` passed CI #41598682561 and Non-3D QA #41598682398. **These checks predate this change**. The new exact head must pass both workflows before being called verified; no local tests were run in this connector session.
- Compared against main `fd2f29771a24ae888719d64504a0b1fb3595ffb1`: only the three isolated operator files differ on this branch. Next: check new exact-head CI, coordinate SQL state mapping and authenticated transactional persistence with central integration. No merge, deployment, production data access or model changes.


## Explicit optional-evidence presence gate — 2026-11-03

- Prior exact head `5a06e09123a81df7419a470f77b98ea202f71018` passed CI #41605620195 and Non-3D QA #41605620218. Those results predate this patch.
- Live and replayed ordinary events now reject explicitly present `reason: undefined` instead of silently omitting that unsupported claim. Non-QC events likewise reject `qc: undefined` or `qc: null` instead of discarding the evidence field. Legitimate QC approval validates its physical-evidence shape once, preserving the immutable canonical event.
- Added focused regression tests for live/replayed explicit-undefined fields and valid QC approval. Source commit `903bb1b4`; test commit `771fb594`. **New exact-head CI and Non-3D QA not yet verified.** No local npm suite claimed.
- Main `fd2f2977` diverges by 11 commits after the operator merge-base; comparison showed no overlap with operator source, test or checkpoint paths. This remains a draft proposal without authenticated transactional persistence or physical QC verification.
- Next: confirm exact-head workflows; coordinate SQL status mapping, authenticated append-only persistence, verified physical receipts and integration review. No main merge, Vercel deployment, production data, stock or shared routes modified.

## Audit display-control hardening — 2026-11-03
- Operator actor, revision ID, evidence reference and reason fields now reject Unicode bidirectional override/isolate controls (U+202A–U+202E and U+2066–U+2069), which can visually reorder audit claims in logs and reviews. The existing ASCII identifier restrictions remain unchanged.
- Added synthetic regression coverage for live events, cancellation reasons and stored audit replay. This is a source-level checkpoint: exact-head CI is required before claiming a verified pass.
- Production persistence, actor authentication, SQL status mapping and physical receipt verification remain separate central-integration gates. No shared scope was edited.

## Invisible audit text hardening — 2026-11-03

- Reject invisible Unicode formatting characters U+200B–U+200F, U+2060 and U+FEFF in audit text, in addition to existing bidi overrides and ASCII controls. These can disguise otherwise distinct actor, evidence, reason and locked-revision values.
- Added regression cases for live inputs, stored replay and a valid transition. This is synthetic validation only, not authentication or physical evidence.
- Prior head `11de729e` passed CI #41621555354 and Non-3D QA #41621555223. Those runs predate this change; **new exact-head CI is pending**. No local full-repository test claim.
- Next: verify new exact-head checks, reconcile main and coordinate authenticated transactional persistence, SQL compatibility and physical QC receipts with central integration. No production writes, merges or deployment.

## 2026-11-03 — hidden control and separator integrity

- Expanded the existing audit text rejection set to cover C1 controls U+0080–U+009F, soft hyphen U+00AD, combining grapheme joiner U+034F, Arabic letter mark U+061C, Mongolian vowel separator U+180E, Unicode line/paragraph separators U+2028–U+2029, and remaining U+2061–U+2065 format controls. These characters can conceal differences in operator identities, evidence receipts, reasons or locked revision labels in logs and audit review.
- Added focused live-event, cancellation, locked-revision and persisted-replay negative tests, plus a valid event control. The existing state machine, public types, and persisted schema are unchanged.
- Prior exact head `a2bf62706bbeac7f498be4fd6f9c7ab36696044c` passed CI #41630028292 and Non-3D QA #41630028249. **Those runs predate this patch.** Source commit `0325bd059aa68e96ba1acc0427e9b50e3bba0d36`, test commit `54f9a028fa0f65202a4a4d433c1982c6989695a6`; obtain exact-head checks after this documentation commit before claiming verification. No local npm run is claimed.
- Main `4dd8020abd83429449ff53ea5bb71b046394d86e` differs by 12 commits; the branch comparison lists only three isolated operator files. No overlap detected in main comparison. Preserve draft status and do not merge, deploy, modify shared SQL, or access production customer data.
- **Next:** Verify exact-head CI and Non-3D QA, coordinate SQL-state mapping and authenticated transactional append-only persistence with central integration, and require independently verified physical QC and delivery evidence before production integration.

## 2026-11-03 — live audit length parity

- Closed a live/replay mismatch: persisted replay rejects more than 10,000 events, but previously a trusted live reducer could produce 10,001 events, making its own output impossible to restore. Live transitions now stop at 10,000 applied events, before reading the next untrusted event.
- Added a synthetic 10,000-event acceptance/recovery-cycle regression checking the boundary, valid replay at the limit and rejection of event 10,001. This is not a production retention or archival policy; coordinate any long-lived audit partitioning with the authenticated persistence owner.
- Prior exact head dfb90cb89e7d37f03d162e98e17358315414528b passed CI #41638215373 and Non-3D QA #41638215372. These checks predate this patch. New exact-head verification required. Main 4dd8020abd83429449ff53ea5bb71b046394d86e changes no operator-owned paths; no merge or deployment.

## 2026-11-03 — plain-data audit boundary

- Reject non-plain event, QC, QC-check and snapshot records, accessor properties and symbol-keyed claims before validation. These values cannot be faithfully represented in persisted JSON and could previously inject inherited claims, execute getters or silently discard symbol evidence.
- Added focused synthetic negative tests for inherited live/replayed events, accessor actors, symbol evidence, forged snapshot prototypes and accessor QC checks, plus valid replay.
- Source commit `6ddf151d`; regression commit `6a3699f9`. **Exact-head CI remains pending after this checkpoint commit; no local npm checks are claimed.** Earlier `6014be8a` passed CI #41647107160 and Non-3D QA #41647107224, but those results do not cover this change.
- Main comparison found no operator-file overlap (12 main-only commits at inspection). Remain draft/unmerged; do not deploy or modify production data. Next: verify new exact-head workflows, then coordinate authenticated transactional persistence, SQL state mapping and physical QC evidence.

## 2026-11-03 — non-enumerable evidence integrity

- Previous exact head `6b548a2b65ce4f2078fcdf5fbe293f8336a79fd9` passed CI #41656813695 and Non-3D QA #41656813851. These results do not verify the new patch.
- Plain-record validation now also rejects non-enumerable own properties. Such fields can carry hidden payment, operator, QC or snapshot assertions that `Object.keys` and JSON serialization silently discard. Accessor and symbol rejection remain intact.
- Added focused negative tests for hidden live/replayed event claims, snapshot claims, QC metadata and check claims; retained a valid replay control.
- Source commit `ea34634b`, test commit `00571284`. Exact-head CI and Non-3D QA are **pending**; no local full-repository test run or physical inspection is claimed.
- Current main `4dd8020a` has no overlap with the three operator-owned paths, but is 12 commits ahead of the merge base. Keep this PR draft and coordinate SQL state mapping, authenticated append-only persistence and physical QC proof with central integration. No merge, deploy or production data modifications.

## 2026-11-03 — exact-head CI failure and regression fixture repair

- Inspected branch `b36051d280d48f01c0ac367a9653f2759393f9df`: CI run #41666496049 and Non-3D QA run #41666496085 both **FAILED**. CI quality passed, but `npm test` failed at `tests/operator-order-lifecycle.test.ts:495` (`Missing expected exception`); the Non-3D source/unit gate also failed. This is not a passing checkpoint.
- Root cause: the live-event negative test spread a record with a non-enumerable `paymentApproved` property. JavaScript object spread intentionally drops non-enumerable fields, so the live input contained no hidden claim to reject. Fixed the test fixture to define the hidden field directly on the live event. The stored-audit, snapshot and QC negative cases remain unchanged; no production validation was weakened.
- Test-only repair commit `3bbb2fc06a05c49bff39a7d6b377a9b207cd487d`. **Exact-head CI and Non-3D QA for the repair remain pending; no local test execution claimed.** If they fail, inspect exact-head logs before further changes.
- Main `4dd8020abd83429449ff53ea5bb71b046394d86e` is 12 commits ahead of merge base; reverse comparison shows no operator-owned path overlap. Draft PR #869 stays unmerged and unreconciled. No shared stock/auth/SQL/model files, production data or Vercel deployment changed.
- Next: confirm both exact-head workflows pass, then coordinate SQL-state mapping, authenticated transactional append-only persistence and independently verified physical QC evidence with central integration.


## 2026-11-03 — audit array structural integrity

- Stored lifecycle audit arrays now reject non-index metadata (including hidden and symbol fields), accessor index properties, sparse history, and inherited/exotic array prototypes before invoking any event getter. Previously, even strict per-event validation could silently ignore attached array-level approval claims or evaluate a hostile accessor during replay.
- An ordinary JSON-parsed array and runtime-frozen reducer audit remain supported. Replay and snapshot restoration use the same validator; a synthetic regression covers valid/empty audits, metadata, symbols, getters, holes, prototypes and snapshot corruption.
- Source commits `326c626f` and `80ee35ac`; test commit `adcc88c7`. Matching-head CI and Non-3D QA after the documentation checkpoint are required before asserting repo-wide green. No local full-repository run is claimed.
- The open draft remains an isolated pure lifecycle proposal, **not** an authenticated transactional store. Production enablement remains blocked on coordinated SQL status mapping, idempotent persisted writes, verified operator identity and physical QC/delivery evidence, cancellation/refund policy and independent approval. Do not merge or deploy.


## 2026-11-03 — deterministic idempotent retry decision

- Added `applyOrderLifecycleEventIdempotently` to the **isolated pure order lifecycle library**. On a new event ID it uses the existing validated reducer, enforcing exact next sequence and previous-event linkage. A repeated ID with the same complete canonical event data returns `already_applied` and the **unchanged frozen current snapshot**; no audit row or status is generated twice. An older exact retry remains acknowledged even after subsequent valid transitions, without rolling the order backward.
- Reuse of the event ID with a different actor, action, sequence, previous event, stage, timestamp, evidence, destination, reason or QC receipt/checks is rejected. Unknown or non-plain fields remain blocked; callers may omit the derived `to` field on an unapplied/retried input, but may not supply a wrong destination. Snapshot trust checking runs **before** any retry acknowledgment.
- Added focused synthetic regression tests for new transitions, exact retries, historical retries, malicious collision payloads, stale new IDs, QC modification, recovery, delivery and forged/unrestored snapshots.
- Implementation commit `954af6c6`, regression commit `0f4ffb4d`. **Exact-head CI and independent Non-3D QA must complete before declaring this patch verified.** No local full-repository tests claimed.
- This helper is **not** durable idempotency or concurrency safety. Production requires a centrally reviewed, authenticated database transaction with unique `(order_id, event_id)` constraints, atomic order-version compare-and-set, append-only events, physical evidence and actor verification, and explicit mapping to current SQL statuses. No schema, routes, auth, inventory, stock, measurement or UI files changed; no merge or Vercel deploy.



## 2026-11-03 — exhaustive 156-combination transition matrix

- Added an independent test oracle for **all 12 reachable lifecycle stages × 13 actions**. Every permitted transition must reach the expected destination, extend the immutable audit exactly once and replay successfully; every prohibited stage-action combination must throw without changing the input snapshot.
- This explicitly covers QC pending/rework/approval, cancellation throughout pre-dispatch, hold/resume recovery, mandatory dispatch, and the delivered/cancelled terminal restrictions. Future unreviewed changes to stage or action vocabulary will also fail the exhaustive test.
- Test-only commit `c9079074`. The latest previously verified head `cf1d76c` passed CI #41680636634 and Non-3D QA #41680636318; the subsequent idempotent source/test patch `9cdd2435` had matching-head workflows #41687257770 and #41687257457 still running at this checkpoint. **Neither prior green result can certify this latest test addition.** Obtain new matching-head workflows and repair failures.
- No shared production files, database schema or routes were changed. The separate server-side transactional append-only persistence, deployed SQL-state mapping, real actor authentication, physical QC/delivery proof and cancellation/refund policy remain integration blockers. Keep draft; do not merge or deploy.
