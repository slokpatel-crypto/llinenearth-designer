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
