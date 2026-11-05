# TITAN — parallel tailor handoff checkpoint

Branch: `titan-parallel-tailor-handoff` (originally isolated from main at `5835a5533281b8306e9bfa1fd9786a30d59c8053`, reconciled with main `4dd8020abd83429449ff53ea5bb71b046394d86e` via an explicit two-parent merge on this branch).

## Scope / preserved boundaries
Work only in measurement audit, existing production handoff and printable tailor tech-pack rendering, plus dedicated regression tests. No inventory, catalogue, visual rendering, operator orders, model identity, migrations, Vercel configuration or deployments.

## Verified source constraints
- `AGENTS.md`: locked designs must reconstruct from versioned IDs, internal physical measurements are centimetres, no invented tailor approvals or material facts.
- Existing locked SHA256 and advanced StyleSpec v2 are preserved.
- Physical tailor, patterns, cloth meterage, stock and actual measurements are **not validated by software**.

## Implemented, subject to exact-head checks
- [x] One pure audit of shirt/trouser finished target ranges: finite body/finished centimetres, range order, duplicate labels, recognised basis and body-plus-ease coherence with rounding allowance.
- [x] Fail closed at handoff and printable sheet boundary if a target is contradictory or invalid.
- [x] Missing shirt chest, trouser waist/seat and legacy non-versioned construction are explicit review items; sparse older designs remain exportable for **review**, never promoted to `ready_for_tailor_review`.
- [x] Tech pack separates body, ease, finished range and calculation basis; never implies that a recorded anchor or provisional ease is signed cutting guidance.
- [x] Added regression tests for coherent, missing, duplicate, non-finite, reversed and tampered targets, and unsigned physical acceptance.
- [x] Prior isolated head `3982df4078f28302b742a89e095d8b112b8d7d88` passed Full CI run `41501082501` (quality, all tests, engine, preview, release, build, HTTP, browser) and Non-3D run `41501082547` (actual Studio/mobile browser verification). Those passing results applied only to that previous commit.
- [x] Reconciled two-parent head `ef735f3e5a826918ab2d8cf26dfe1ff0312dfdf9`: exact-head Full CI #41682012582 (including quality, unit suite, engine, preview, release, build, HTTP and browser), disposable PostgreSQL job and Non-3D #41682012630 succeeded. These checks belong to that earlier head only.
- [ ] Re-run exact-head Full CI, Non-3D and all relevant quality/release/DB/browser checks after follow-up measurement hardening (code head before checkpoint: `ae77e0d32f5a4a6cc40dbc623f2bf1b758620209`). Never substitute earlier green runs for this head.
- [x] Added missing-length review gating: shoulder and sleeve anchors, trouser inseam and outseam are required to mark a packet ready for **tailor review** (still not cutting approval).
- [x] Added trouser cross-landmark order checks: outseam longer than inseam, front rise shorter than outseam, without inventing physical fit ranges.
- [x] Added source-version cross-check between locked StyleSpec v2 and source schema version; unversioned measurement source stays review-required.
- [x] Preserved historic pre-v2 packets with absent schema marker as review-only, without inventing new cut IDs.
- [x] Exposed unsigned seam allowances, units, conversion, body-versus-finished ease and finished tolerance signoff blanks in printed tech pack.
- [x] Added labelled synthetic-only positive/negative test fixtures. No test values are real model measurements.
- [ ] Recheck that current main has not moved again; isolate this five-file diff, and request independent integration review before readiness for merge.
- [ ] Revalidate integrated handoff reconstruction/physical-ease provenance against latest main; do not treat an unsigned tech pack as a cutting authorization.
- [ ] Real tailor-confirmed landmark definitions, measurement calibration, garment tolerances, pattern ID and signed physical fit evidence (external dependency).
- [ ] Representative measured cloth widths, shrinkage and actual order outcomes (external dependency).

## Landmark and ease-provenance continuation
- [x] Audit the known fit-construction landmark identities and enforce the required body-plus-ease versus anchor semantics, preserving unknown legacy labels for human review.
- [x] Reject contradictory, partial, or fabricated fit/ease version-and-source combinations at JSON handoff and printable tech pack boundaries.
- [x] Added negative regression fixtures for swapped labels, missing source data, forged approved-source claims and locked StyleSpec/schema drift.
- [ ] Run new exact-head CI and record results; earlier passes are not transferable to this follow-up.
- Test measurements (100/84/102 cm etc.) are synthetic. Neither physical model measurements nor a real tailor approval exists; cutting remains prohibited.

## Cryptographically verified printable export continuation
- [x] Introduced additive `buildVerifiedTailorTechPackHtml` export boundary, requiring `verifyProductionHandoff` against the exact locked SHA256 garment recipe before generating trusted printable HTML.
- [x] Added synthetic SHA256 round-trip and negative cases for forged fabric names, cut options, targets, fit calibration version, packet status, generated timestamps and tampered locked revisions.
- [ ] Confirm new exact-head CI for this continuation before claiming these tests pass. Legacy sync HTML builder remains for review-only display; production export callers should use the verified async boundary.
- These checks certify software integrity only. No physical measurement, fabric fact, seam tolerance, approved cutting pattern or human signoff is inferred.

## Resume
On each `continue`, inspect latest main, branch SHA and PR checks; address the first unfinished acceptance item with real code or recorded evidence. Keep draft until all relevant checks pass. Do not merge/deploy without revalidating main and physical evidence. No approval or measured physical value is inferred here.
