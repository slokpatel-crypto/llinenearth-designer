# TITAN M112 — atomic delivery and physical-QC acceptance design (review required)

Status: **DESIGN ONLY; no delivery SQL / route change authorized or applied.** Base: M111 PR #613 head `48e7676c0b616469be20f3e1e5cec6af3b795d12`. Do not merge/deploy. This document is a prerequisite for owner-approved migration design, not evidence of physical readiness.

## Verified existing behavior and defect

`src/app/api/operator/production/route.ts` handles `order_status: delivered` by separately fetching `finished_garment_qc_list(500)` and `production_order_list(150)`, validating with `hasVerifiedLatestDeliveryQc` and `hasVerifiedDeliveryQcOrderLineage`, then executing `production_order_set_status`. The checks are defensive, capped reads, not a SQL transaction. Another transaction can append rework QC or alter the order after the reads and before delivery status/event commit. Current M111 `production_order_set_status_idempotent` **explicitly rejects delivery**; do not route delivery through it or claim it fixes QC concurrency.

## Mandatory acceptance contract for a future implementation

1. Introduce an additive **service-role-only** `production_order_deliver_with_qc_idempotent(request_key,order_id,note)` RPC, and a private RLS receipt ledger storing only the original request UUID, order UUID, SHA-256 intent fingerprint and audit-safe QC inspection UUID (no inspector name, reference, notes, measurement, customer recovery token or full payload). Strict UUID v4, bounded note and least-privilege GRANT/REVOKE checks.
2. Serialize **all** writes affecting delivery truth using a shared per-order transaction lock: delivery, QC inspection insertion, order revision/recipe changes and status transitions. Merely locking delivery is insufficient. An advisory lock works only if every relevant writer cooperates; prefer row locks on the exact order and enforce the same lock order across every writer. Investigate all actual SQL writers before implementing. Prove that rework insertion cannot race a delivery commit.
3. Within the *same SQL transaction* as the canonical status/event mutation: lock the current order row, require `ready`, validate immutable revision ID, exact 64-hex recipe hash, order creation timestamp and latest order QC at database precision; reject missing, malformed, tied/ambiguous or out-of-order provenance. The **latest** physical receipt must be `approved`, carry an actual inspection UUID, matching order/revision/recipe, valid inspector/reference and all six explicitly known QC checks **strict boolean true**; no unknown fields. Reject newer rework and inspections older than order creation. SQL must derive the check IDs from the repository's canonical `FINISHED_GARMENT_QC_CHECKS` and verify that schema persistence matches this contract.
4. Preserve canonical `production_order_set_status` state machine and single event semantics only if it can execute under the lock without releasing transaction ownership. In same transaction persist request receipt and event. On identical original key/intent return original success **without producing a second event**; changed intent conflicts; failed validation consumes no key. Lock original request key before receipt lookup, define a consistent order-vs-key lock ordering to prevent deadlock; verify all writers follow it.
5. Do not rely on capped `_list` queries for a SQL proof. The operator route must call only the verified transactional RPC for delivery after schema approval; remove the legacy split preflight+mutation path only when new tests pass. Until then, existing delivery path remains **not transactionally certified**; release remains blocked.
6. Privileged route must continue strict authentication, no-store responses, bounded input, safe error redaction. No client-supplied "approved" flag; no fabricated QC, simulated physical acceptance or paid AI.

## Required isolated PostgreSQL acceptance tests

- Approved latest QC for exact ready order/recipe commits delivery with one event and receipt; exact same-key retry returns true with no new event.
- Same key changed order/note fails; invalid input and missing QC don't consume key; distinct keys cannot deliver twice.
- Newer rework vetoes older approval; ambiguous tied latest time vetoes; forged inspector/reference/checks/inspection UUID, missing check, wrong revision/hash, stale inspection and wrong order all veto.
- Concurrent **two independent SQL sessions**: transaction A holds order lock while transaction B appends rework; verify serialization and the resulting appropriate outcome. Repeat with reversed order; use actual committed event and QC queries, not merely successful HTTP statuses.
- Competing status/revision/recipe changes serialize; cancelled or non-ready order can never be delivered.
- GRANT/REVOKE, RLS, service-role-only function, no sensitive receipt columns; rollback test for failed transition; migration replay and dependency order.
- Matching-head full CI, Node, engine, preview, release, optimized Next build, signed HTTP, 390/768/1440 browser, independent Non-3D, stock PG and new real disposable PG workflow.

## Blocking information and approvals

Before writing executable migration: inspect the existing source SQL definitions for `private.production_orders`, the QC inspection writer/table and `public.production_order_set_status`, all triggers and role grants; ensure real QC evidence cannot be overwritten or backdated by an untrusted role. Owner must review transaction semantics, security, privacy and additive schema before any live migration. Independent real tailor QC/fitting, stock/metres, original model Blender evidence, novice beta and actual deliveries remain unverified. Keep main merge and production deployment pending separate explicit approval.

## Next exact action

Trace all QC/order SQL writers and table constraints; choose one deterministic locking order compatible with their existing calls. Implement migration + route switch and concurrent database tests in a **separate reviewed draft** only after that trace, without weakening any existing QC checks.

## Follow-up source trace — 2026-10-31

Verified in `20261001_production_quotes_orders.sql`: `private.production_orders` has primary key `order_id`, immutable-looking `revision_id` and `recipe_hash` columns (but no database-level immutability trigger in this migration), `status` and creation time. Its public `production_order_set_status` locks the target order row with `SELECT ... FOR UPDATE` and allows `ready -> delivered` **without inspecting QC**. It then updates status and appends a `private.production_order_events` row in that SQL transaction. Therefore a SQL delivery wrapper can reuse the row lock and canonical transition, but **cannot** be secure while this existing service-role legacy entry point can still directly deliver without QC. New work must revoke/wrap that direct delivery capability or modify the canonical function to enforce QC for every caller; preserve non-delivery behavior.

Verified in `finished-garment-qc.ts`: six exact check identifiers are `recipe_match`, `fabric_match`, `measurement_check`, `pattern_alignment`, `stitching_finish`, `clean_damage_free`. This is the exact vocabulary SQL must check, not guessed synonyms.

Verified `src/app/api/operator/garment-qc/route.ts` history: record calls `finished_garment_qc_record_v2`, rather than directly inserting into QC tables. **Critical unresolved trace:** the migration implementing this RPC and its order-row locking, schema, timestamp ordering and QC insert privileges have not yet been verified on the current head. No executable transactional wrapper should be described as race-safe until that definition and all other insert paths are inspected. `20261030_finished_garment_qc.sql` was an unverified filename guess and does not exist at that path; do not use it as evidence.

Locking target: have the QC write RPC acquire `production_orders(order_id) FOR UPDATE` *before* writing an inspection; delivery also acquires the same order lock *before* reading latest QC. If an inspection may be inserted by another path without this lock, a new post-check insert can race the delivery. Re-check service-role function grants and direct table write grants. Preserve database timestamp precision; define inspection ordering unambiguously using inspection UUID as a deterministic tie-breaker only if the schema guarantees that ordering reflects insertion chronology, otherwise reject ambiguous ties.

## QC write-path trace — operator boundary verified

Current `src/app/api/operator/garment-qc/route.ts` enforces the operator cookie, same-origin secure JSON, 16 KiB request bound, canonical order UUID, literal physical QC draft validation and an exact returned inspection UUID. Its **only observed mutation call** is the service-role `finished_garment_qc_record_v2` RPC with `p_order_id`, `p_decision`, `p_checks`, `p_defects`, `p_note`, `p_inspector` and `p_inspection_reference`. Its GET calls two **separate** capped `production_order_list` and `finished_garment_qc_list` reads; this is not a transactional delivery proof. Browser validation is not a security boundary for other service-role callers.

The API source **does not prove** that `finished_garment_qc_record_v2` locks the order, checks `ready`, verifies the immutable recipe lineage or prevents post-delivery inspection. The implementation SQL and direct QC table grants still need discovery. Therefore no claim that the existing QC writer is serialized with the order-status row lock. Priority before executable M112: locate the migration creating `finished_garment_qc_record_v2` and `private.finished_garment_qc` or equivalent table, inspect GRANTs/triggers/indexes and test both races. In particular ensure QC writes acquire the same per-order row lock **before** inserting, rather than implementing delivery-only locking and leaving a race.

## Correction after locating actual SQL migrations (2026-10-31)

The earlier statement that canonical SQL permits delivery *without checking physical QC* was overstated. The migrations are indexed in `scripts/release-readiness.mjs` and were fetched on this branch:

- `20261002_finished_garment_qc.sql` creates `private.finished_garment_qc_inspections`, `finished_garment_qc_record` and replaces `production_order_set_status` to check the latest inspection is approved before delivery.
- `20261027_finished_garment_qc_provenance.sql` adds `inspection_reference`, `finished_garment_qc_record_v2` and again replaces the canonical status function to require the latest inspection's `decision=approved`, nonempty named inspector and reference.
- **Both QC record functions already acquire `private.production_orders ... FOR UPDATE` before their insertion**, as does the canonical order transition before its latest-QC query. The earlier claim that the RPC lacked an established order lock is disproved. This shared lock serializes these two functions for the same order, within ordinary SQL transactions; it does not certify all other direct table writers or later migration overrides.
- The actual canonical SQL delivery gate is **weaker** than the application's six-exact-true-check, latest-timestamp-ambiguity, complete order/recipe lineage and inspection time requirements. It checks decision and named provenance only. As a result a direct privileged call to `production_order_set_status` can bypass those *stronger* API-level conditions, even though it cannot bypass the basic SQL QC gate.
- The inspection schema has `created_at timestamptz DEFAULT now()` and an index on `(order_id, created_at DESC)`; selecting `ORDER BY created_at DESC LIMIT 1` without tie handling means simultaneous/same-transaction timestamps are ambiguous. SQL must reject ties or adopt a justified monotonic receipt sequence, rather than assume UUID order is chronological.
- `finished_garment_qc_record_v2` checks all six required flags are true on approval, but does not reject extra JSON object keys at SQL boundary. A direct service-role caller might bypass stricter TypeScript normalization. Require precisely six true known keys in transactional delivery acceptance.

**Revised engineering scope:** preserve existing shared row locking, strengthen the canonical SQL delivery gate itself to enforce full provenance/check/lineage and unambiguous latest QC for every caller, then add request-key replay receipts in the same transaction. Confirm no subsequent migration redefines these functions before implementation. Real material and human QC approvals remain blocked.
