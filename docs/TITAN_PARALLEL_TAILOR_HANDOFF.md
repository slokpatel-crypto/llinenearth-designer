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
- [x] CI #42018326569 and Non-3D #42018326584 exposed a real regression in verified packet export: forged `generatedAt` earlier than the immutable revision's `lockedAt` was accepted. Tests reported `true !== false` at handoff-measurement-integrity test 389. PostgreSQL job passed, but both workflows failed unit gates.
- [x] Added lock-before-export chronological verification to `buildVerifiedProductionHandoff` and `verifyProductionHandoff`; new regression tests reject pre-lock timestamps and explicitly document that `generatedAt` is not cryptographically signed and later timestamps cannot be authenticated from a recipe hash alone.
- [ ] Run new exact-head CI and record results following the chronology fix; earlier passes are not transferable to this follow-up.
- Test measurements (100/84/102 cm etc.) are synthetic. Neither physical model measurements nor a real tailor approval exists; cutting remains prohibited.

## Cryptographically verified printable export continuation
- [x] Introduced additive `buildVerifiedTailorTechPackHtml` export boundary, requiring `verifyProductionHandoff` against the exact locked SHA256 garment recipe before generating trusted printable HTML.
- [x] Added synthetic SHA256 round-trip and negative cases for forged fabric names, cut options, targets, fit calibration version, packet status, invalid or pre-lock generated timestamps and tampered locked revisions. Chronological consistency does not make a timestamp cryptographically signed; the HTML explicitly says "export metadata (not lock-signed)".
- [ ] Confirm new exact-head CI for this continuation before claiming these tests pass. Head `4c92b21d51de13d1b559573d2a4c14c0abca40c4` failed CI `42018326569`: 872/873 tests passed, but an earlier generatedAt mutation expectation was wrong. Concurrent follow-up added explicit pre-lock timestamp rejection and a regression allowing valid later timestamps. Revalidate the final branch SHA before marking this fixed. Legacy sync HTML builder remains for review-only display; production export callers should use the verified async boundary.
- These checks certify software integrity only. No physical measurement, fabric fact, seam tolerance, approved cutting pattern or human signoff is inferred.

## Claimed ease approval authenticity continuation (2026-11-05)
- [x] Identified an independent source-trust gap: a correct `fit-construction-calibrated-2` + `approved_house_calibration` pair and arbitrary bounded calibration version can be copied from user-controlled locked recipe without external human approval evidence.
- [x] New pure measurement provenance audit adds an explicit outstanding human review item for such self-consistent claims. This downgrades handoff to `review_required`, never inventing a signed ease model, measured body or actual fit approval.
- [x] Added dedicated synthetic regression for matching approved-looking source/version tuple and unsigned printable review output.
- [ ] Confirm new exact-head Full CI, Non-3D, PostgreSQL, browser after changes; older results must not be transferred. Review integration and approval evidence remain blockers.
- Production cutting approval remains prohibited pending physically verified measurements, final garment tolerances, approved block/pattern and actual tailor signoff.

## Safe download filename continuation (2026-11-05)
- [x] Hardened `techPackFilename` to reject traversal, path separators, controls, encoded punctuation, bidi/Unicode tricks and overlong revision IDs rather than generating ambiguous download paths. Canonical locked revision IDs retain the exact prior filename.
- [x] Added synthetic negative filename regression cases in dedicated handoff tests. This does not replace verified SHA256 recipe/handoff export.
- [ ] Exact-head CI required for this filename hardening; no claimed pass from earlier commits. Signed physical tailor and cutting approval remain unavailable.

## Unresolved source decision review-gate continuation (2026-11-05)
- [x] Independently audited `buildProductionHandoff` and the legacy `buildTailorTechPackHtml` against canonical `buildCanonicalGarmentSpec` readiness semantics. Confirmed a locked `ready_for_tailor_review` status can coexist with source `unresolved` notes, and a manually inconsistent status can coexist with review/warning construction checks.
- [x] Fail-closed handoff status if any original or derived unresolved note remains or any construction check severity is `review` or `warning`. All original records remain in the reconstructable packet; they are never auto-cleared or approved.
- [x] Printable review-only HTML now uses the same pending-note and construction-check gates instead of accepting a stale ready flag. The verified asynchronous export still checks SHA256-locked recipe integrity.
- [x] Added three synthetic regressions: unresolved source decisions, open construction checks despite ready source status, and tampered printable review-badge protection.
- [ ] Verify exact-head Full CI, Non-3D browser QA and disposable PostgreSQL jobs before marking these specific changes verified. No synthetic evidence can substitute for a physical sample or human cutting authorisation.

## Unknown optional landmark review gate (2026-11-06)
- [x] Revalidated isolated branch against main `4dd8020abd83429449ff53ea5bb71b046394d86e`: the five scoped paths were the only PR changes and branch was not behind main. Branch head `a2895a1090e43e483a73038def1115ae16396a5d` had matching completed successful Full CI #42023363586 and Non-3D #42023363578 (including their respective jobs), before this continuation.
- [x] An extra valid-looking target with an unrecognised landmark label was previously accepted alongside all required target anchors with no outstanding review note. This could make a custom, method-undefined measurement look tailor-review-ready.
- [x] Dedicated measurement audit now preserves the custom legacy target for reconstruction but adds explicit unresolved human landmark/unit/basis review. A cross-garment known landmark still fails as an error; canonical recognised labels are unaffected.
- [x] New synthetic-only test covers unknown additional shirt and trouser labels, positive canonical controls, status downgrade, preserved target data, unsigned review-only HTML and no cutting authorisation.
- [ ] Verify exact-head CI after the new code/test and checkpoint commits. No local execution possible in this connector-only environment; prior green runs do not certify new code.
- [ ] Independently verify the final exported packet and reconcile any new CI failures. No real measured body, model sample, calibrated fabric, pattern, or human signoff; cutting remains blocked.

## Tucked-shirt length review boundary (2026-11-06)
- [x] Reviewed locked StyleSpec v2 `shirt.wear` and fit-construction length semantics against current main. A complete chest/shoulder/sleeve review packet could previously claim `ready_for_tailor_review` for a **tucked** shirt without any `Shirt-length anchor`, if source construction checks had not flagged it.
- [x] The pure measurement audit now accepts optional garment wear context and requires a recorded shirt-length anchor for tucked construction only. Both canonical production-handoff and independent legacy printable tech-pack audit use the exact locked StyleSpec v2 wear choice, falling back to the shorthand wear for historic records. This is a review-data presence gate, **not** a body-size estimate or approval.
- [x] New synthetic-only regressions check untucked compatibility, tucked missing-anchor review downgrade, reconstructable known length permitting review-ready **software** status, and stale handoff printable badge downgrade. All printed packets still say **NO CUTTING AUTHORISATION**.
- [ ] Confirm exact-head Full CI, Non-3D, disposable PostgreSQL, build and browser test outcomes for the final branch head. Earlier successes are not evidence for this code.
- [ ] Physical sample, finished garment length and balance, verified customer/model dimensions, signed seam allowances, tailor approval and actual cutting pattern remain unavailable. Do not merge or deploy.

## Resume
On each `continue`, inspect latest main, branch SHA and PR checks; address the first unfinished acceptance item with real code or recorded evidence. Keep draft until all relevant checks pass. Do not merge/deploy without revalidating main and physical evidence. No approval or measured physical value is inferred here.
