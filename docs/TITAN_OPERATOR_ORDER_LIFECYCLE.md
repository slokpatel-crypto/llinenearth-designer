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
