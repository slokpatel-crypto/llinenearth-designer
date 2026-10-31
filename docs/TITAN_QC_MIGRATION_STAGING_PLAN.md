# TITAN physical-QC / delivery database rollout — staging review plan

**Status:** DRAFT — requires owner schema, security and privacy approval. **Do not run these migrations in production from ChatGPT or an unattended CI job.** This document does not certify a physical garment, supplier, original-model likeness or completed delivery.

## Why rollout order matters

M112–M114 replace or extend the canonical physical-QC / delivery logic. The migration filenames establish a strict dependency chain; do not skip a predecessor or deploy the application using a new RPC against a database missing it.

| Order | Migration | Contract | Risk / staging check |
| --- | --- | --- | --- |
| 1 | `20261110_delivery_qc_sql_gate.sql` | First SQL-side delivery QC checks in `production_order_set_status` | Check existing status transitions and six literal QC flags |
| 2 | `20261111_delivery_idempotency.sql` | Private RLS request-key receipt and same-key replay | Replay same order/intention once; changed intention rejects; no duplicate delivery event |
| 3 | `20261112_finished_garment_qc_sequence.sql` | Nullable inspection sequence and per-order counter, insert trigger under the production-order row lock | Previous QC has **NULL** sequence. **Never backfill old approvals as proven chronology**. A new physical inspection is necessary before future delivery |
| 4 | `20261113_delivery_qc_sequence_gate.sql` | Replaces the canonical delivery-status function again, requiring newest ordinal = order counter | Old unsequenced approval cannot release; newer rework vetoes an older approval |
| 5 | `20261114_delivery_eligibility_read.sql` | Service-role-only capped advisory read, without inspector/reference/notes | Exact locked order identity, six checks and QC sequence; read hint is **not delivery authorization** |
| 6 | `20261115_finished_garment_qc_immutable.sql` | Reject direct UPDATE/DELETE/TRUNCATE of all historical and new physical QC rows | Existing evidence remains readable; corrections require a new sequenced inspection; privileged direct edits and deletes fail |

The sixth migration must be installed **after** the prior QC/read functions; no direct SQL evidence edits, deletions or truncation are permitted after rollout. These are tail migrations, not the full historical schema. A clean staging database must first contain every earlier prerequisite migration, including production order, finished-garment QC, provenance and order-status receipt structures. Restore a representative **redacted** staging snapshot before exercising this chain. Never substitute synthetic CI fixtures for real QC.

## Preconditions and human stop/go

1. Owner reviews the exact integrated Git commit, migration scripts, schema diff, RLS grants, security-definer search paths and operator privacy. Obtain a separate **written approval for staging schema testing**. Production deployment is a different later approval.
2. Capture the staging database version, schema migration history, protected backup and tested restore procedure. Validate that the backup is restorable to an **isolated** environment. An additive DDL migration is not necessarily transactionally reversible on a live system.
3. Confirm no unfinished physical-QC inserts or delivery-status writes are operating during staging schema transition; decide and document a maintenance window. Do not infer absence from a capped UI list.
4. Preserve the original design revision, recipe hash, customer consent and recorded human inspector references. Staging data must be synthetic or anonymized; real customer private data never enters GitHub artifacts.
5. Explicitly notify operators that historic inspections without a sequence remain visible **but cannot be used to approve a new delivery**. Plan actual post-migration physical reinspection for orders already in `ready` status rather than inventing backdated approvals.

## Read-only installed-schema preflight

After written owner staging authorization, approved schema migration and an
isolated restore rehearsal, execute only
`scripts/ci/m122-qc-schema-readonly-preflight.sql` through the authorized
staging SQL client with read-only access. The script begins `BEGIN READ ONLY`
and verifies the **actually installed** function definitions, QC append-only UPDATE/DELETE/TRUNCATE triggers, QC sequence
column constraints, partial unique index, enabled BEFORE INSERT trigger,
RLS, SECURITY DEFINER fixed search paths and `anon`/`authenticated`
EXECUTE restrictions. **It does not execute the migrations.** A PASS proves
catalog configuration, not that a human checked any garment.

This preflight also runs in the disposable PostgreSQL creation workflow
**after** the six migration files, so absent/disabled triggers and missing
service-only grants fail CI. Keep the staging output redacted: no row-level
inspector, customer, recovery token, supplier or QC evidence should be copied
into GitHub. If it fails, do not use this document as permission to bypass the
gate or mutate the staging/production schema; investigate and peer-review a
separate repair.

## Staging verification (no automatic live changes)

Apply the six migrations **in ascending order**, only after the separate staging approval and restore check. Then verify the following, recording run IDs, time, redacted evidence and installed migration versions:

- `private.production_orders.qc_latest_sequence` exists; `private.finished_garment_qc_inspections.inspection_sequence` exists; the unique partial index and BEFORE INSERT trigger exist.
- `private.production_delivery_request_receipts` has RLS enabled; `anon` and `authenticated` cannot execute either `public.production_order_deliver_idempotent(uuid,uuid,text)` or `public.production_delivery_eligibility_list(integer)`; `service_role` may execute these functions through the authenticated backend only.
- Historical approved QC rows still have **NULL** sequence and **do not** authorize a new delivery. New reinspection appends ordinal one (or later); latest rework blocks delivery. Attempted privileged UPDATE/DELETE/TRUNCATE of either historic approval or newer rework must fail, with no event or request receipt; corrections append a new inspected row.
- The QC trigger and delivery state machine serialize a two-session QC-vs-delivery race, without a duplicate event or an idempotency receipt on a failed delivery. An original request UUID replay returns the same durable result; mismatched instructions reject.
- A signed real operator sees existing order history if the *optional read* is temporarily unavailable; delivery remains hidden until fresh SQL evidence is validated. Server-side delivered mutation rechecks the physical QC in the same locked transaction even if the UI shows an option.
- No unexpected service-role fields, inspector names, customer contact or private notes leak through the delivery eligibility JSON or HTTP error response; all responses are `private, no-store`.
- Re-run exact-head quality/Node/engine/preview/release/build, full Chromium and independent Non-3D. The disposable PostgreSQL CI run covers synthetic SQL behavior **only**, not a signed staging operator walkthrough.

**Rollback/stop condition:** If any check fails, stop operator delivery writes, preserve incident evidence, and restore the protected staging backup or execute a separately peer-reviewed forward repair. **Do not** simply reverse migrations 12/13 to recover historic approvals: that can revive timestamp-only eligibility and violate order chronology. Any rollback of physical QC, event or receipt data must be authorized and audited; never delete evidence to manufacture a green state.

## Production go/no-go remains independent

Before any production schema rollout, require: successful owner-reviewed staging rehearsal and tested restore, exact final integrated commit/CI green, real supplier roll/metre proof, authenticated operator workflow, physical tailor/QC reinspection plan, privacy/security signoff, and separately requested owner **production migration, main merge, and deployment approvals**. A staging schema PASS does not prove production readiness, does not satisfy five real novice cases or first-ten genuine deliveries, and never authorizes automatic paid rendering.
