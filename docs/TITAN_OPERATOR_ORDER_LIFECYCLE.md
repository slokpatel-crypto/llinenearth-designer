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
