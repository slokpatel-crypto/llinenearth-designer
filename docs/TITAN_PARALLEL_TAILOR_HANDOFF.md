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

## Cross-field circumference review protection (2026-11-06)
- [x] Inspected existing `reviewMeasurementConsistency`: it flags neck >= chest and differences greater than 75 cm between trouser waist/seat as **review**, never a declaration of invalid bodies. A hand-built locked spec with no upstream checks could previously bypass both flags and claim `ready_for_tailor_review` in handoff.
- [x] The dedicated final `auditHandoffMeasurements` now independently rechecks both conditions against canonical recorded **bodyCm** targets. It returns explicit human review notes and does **not** reject safe review export or invent physical fit thresholds; the 75 cm discrepancy comes from the existing shared reviewer.
- [x] Synthetic positive/negative regression covers valid controls, both discrepancies, source construction checks omitted, preserved original data, status downgrade and stale unsigned printable badge.
- [ ] Require Full CI, Non-3D and browser checks matching the final branch SHA before claiming a pass. This checkpoint must never inherit green checks from an earlier SHA.
- [ ] Actual tailor measurement/review, physical fitting, approved cutting pattern, signed tolerances and fabric evidence remain external. No cutting, merge or deploy.

## Locked revision identity integrity continuation (2026-11-06)
- [x] Audited `design-lock.ts` and verified handoff: recipe SHA256 verifies garmentSpec but its `revisionId` and `lockedAt` were not checked against the deterministic lock generation format. A tampered metadata-only revision could previously be accepted by a handoff builder despite valid recipe hash.
- [x] Added a scoped, pure final-boundary check that `lockedAt` is the exact normalized ISO timestamp and `revisionId` matches `LE-LOCK-<timestamp>-<12-digit uppercase recipe SHA256 prefix>`. Both `buildVerifiedProductionHandoff` and `verifyProductionHandoff` now enforce it; legacy unverified synchronous preview output remains unchanged.
- [x] New synthetic regression covers genuine `lockGarmentSpec` positive verified export, substituted revision ID, changed lock timestamp and equivalent-but-noncanonical timestamp, verifying rejection both before trusted handoff and at SHA256-verified printable tech-pack export.
- [ ] Exact-head Full CI, Non-3D, build, browser and DB evidence still required. Tests are not claimed to have passed before the workflow reports success.
- [ ] This check establishes **internal metadata consistency**, not cryptographic authenticity of `lockedAt` or `parentRevisionId`, which are not covered by the current recipe hash. No claim of independent signed timestamp, operator approval, material verification or cutting authorization.
- [ ] Physical sample/measurements, approved seam tolerances and pattern identity, human tailor acceptance remain external; no merge or deploy.

## Non-negative ease contract check (2026-11-06)
- [x] Read canonical `house-ease.ts` (`validEaseRange`) and `ease-calibration.ts` provenance: official provisional/calibrated house ease ranges have non-negative minima. The isolated handoff boundary previously accepted a mathematically coherent `easeCm.min<0` if the resulting finished garment bounds were still positive.
- [x] Final `auditHandoffMeasurements` now rejects negative ease minima as an integrity error at both handoff creation and independent tech-pack rendering; canonical positive ranges are unchanged. This validates the locked software range contract, not a physical fit tolerance or body-shape assumption.
- [x] Added synthetic regression for coherent negative ease at handoff, mutated printable packet and a standard positive-ease control. No real body or model measurements inferred.
- [ ] Verify the exact-head quality/unit/engine/preview/release/build/DB/browser checks before claiming a pass. Previous successful steps are not transferable between heads.
- [ ] Independent integration review, physical measurements, sample fitting, actual pattern block, signed seam allowances and human tailor approval are still required. No cutting, merge or deployment.

## Verified versus unsigned HTML readiness separation (2026-11-06)
- [x] Audited the existing printable HTML builder: a caller of the synchronous `buildTailorTechPackHtml` could receive a `ready for tailor review` badge whenever the packet self-claimed ready and the final local audits saw no pending notes, even though its locked recipe was never checked.
- [x] Introduced a private HTML rendering path with an explicit, internally sourced verified-lock flag. Legacy `buildTailorTechPackHtml` now **always** displays `review required` and `UNVERIFIED PACKET PREVIEW — lock not checked`, while retaining the original cut, measurements and caveats. Only async `buildVerifiedTailorTechPackHtml`, after `verifyProductionHandoff` has succeeded, can show a valid `ready for tailor review` badge and `LOCKED RECIPE VERIFIED` notice.
- [x] Added a synthetic-only regression for legacy status spoofing, successful SHA256 lock round-trip, matching verified/unsigned badge behavior and explicit `NO CUTTING AUTHORISATION` in both render paths.
- [ ] Verify Full CI, Non-3D, PostgreSQL, browser and build on the new exact-head SHA. Earlier successful quality/unit results do not certify this continuation.
- [ ] Neither badge nor lock-verification wording establishes physical size accuracy, a signed lock timestamp, fit tolerance, pattern approval or human cutting authorisation. No merge or deploy.

## Malformed construction check review gate (2026-11-06)
- [x] Inspected construction review semantics at both locked handoff and printable tech-pack boundaries. Previously only `review` and `warning` severities blocked readiness; invalid or unrecognized severities could be ignored, even when a caller's locked recipe claimed review-ready status.
- [x] Added a pure final-boundary construction check audit that requires an array of valid records, nonempty bounded ID/message and exactly the known `info`, `review`, `warning` severity vocabulary. Malformed checks now fail closed in both `buildProductionHandoff` and the independent tech-pack rendering boundary. No new physical readiness claims were added.
- [x] Synthetic-only regression covers valid `info`, invalid severity, blank ID/message, null records/missing collection, post-handoff tampered printable checks and a SHA256-locked malformed recipe. No measurements from the original model have been invented.
- [ ] Confirm Full CI, Non-3D, DB, browser, build and exact-head tests for the final SHA. Older passing workflow steps do not transfer to new head.
- [ ] Independent integration review, verified real measurements, physical fit approval, pattern/allowance signoff and material evidence still outstanding; cutting, merge and deployment remain blocked.

## Stored-packet verification failure contract (2026-11-06)
- [x] Audited the SHA256 trust boundary in `verifyProductionHandoff`: malformed external/stored payloads and null/partial lock objects could previously throw before reaching its existing `try/catch`. As a result the trusted export could leak a raw runtime failure instead of its standard unsafe-export rejection.
- [x] The verifier now wraps input-shape checks, locked recipe verification, revision metadata consistency, generation-time ordering and full canonical reconstruction in one fail-closed catch. Malformed input returns `false`; `buildVerifiedTailorTechPackHtml` consistently rejects with `Unsafe tailor tech pack export`. Valid verified exports preserve the exact same data and status.
- [x] Added synthetic-only regression for genuine SHA256 lock and byte-identical repeat HTML, null/undefined/empty/partial/tampered packets, missing construction or unresolved collection, null/undefined/empty/partial lock records and corrupted lock timestamp/hash.
- [ ] Confirm Full CI, Non-3D, build, browser and disposable database checks **matching the final head SHA**. Prior green steps are not sufficient.
- [ ] No new human pattern or timestamp signing authority is asserted. Physical customer measurements, sample fit, approved pattern and tolerances, real cloth evidence and tailor signoff remain unavailable. No cutting, merge or deployment.

## Provisional ease version provenance consistency (2026-11-06)
- [x] Verified `assessFitConstruction` obtains provisional source ranges from the single pinned `HOUSE_EASE_TABLE_VERSION` in `house-ease.ts`. The final handoff audit previously allowed arbitrary nonempty provisional table version identifiers, even though that source/version pair did not identify the actual deterministic ranges.
- [x] Final `auditHandoffFitProvenance` now compares the declared provisional table ID against the canonical constant. A mismatch stays **reconstructable and review-required**, with a specific unresolved original-range confirmation; legacy records are not silently relabeled, discarded or promoted to approved.
- [x] Existing synthetic fixtures now reference the canonical house constant; new regression covers current-source review-ready software status, older mismatched version review downgrade, independent HTML audit of stale provenance, and SHA256-verified handoff/export that preserves the original mismatch and prints **NO CUTTING AUTHORISATION**.
- [ ] Exact-head Full CI, Non-3D QA, build, browser and DB checks must be recorded before declaring final software verification. Earlier successful runs don't certify new code.
- [ ] A matching version string proves only internal provenance coherence, not the validity of actual physical ease, approved fabric, pattern dimensions or human tailor signoff. Never merge or deploy or authorize cutting.

## Final ease-range upper-bound parity (2026-11-06)
- [x] Confirmed `normalizeHouseEaseCalibrationDraft` rejects calibrated ease ranges with `max > 80` cm, but previously the final `auditHandoffMeasurements` only rejected negative/reversed/nonfinite values and could accept coherent 81+ cm ranges.
- [x] The dedicated measurement-export audit now enforces the same 80 cm maximum in addition to the existing non-negative/min-max checks. Invalid source ranges fail in both production handoff creation and independent unverified tech-pack rendering; no new physical fitting tolerances are asserted.
- [x] Added synthetic-only regression for a coherent 81–82 cm but unsupported ease range, altered printable source, canonical positive control and a supported 79–80 cm boundary value. The 80 cm boundary is **software validation only**, not a recommendation for tailoring.
- [ ] Confirm matching-head Full CI, non-3D, build, browser and DB gates before any software signoff. Prior green checks apply to prior commits only.
- [ ] Actual body dimensions, garment samples, tailor-approved pattern, physical cloth calibration and human review still unavailable. No merge, deployment or cutting authorization.

## Conditional high-rise front-rise landmark (2026-11-06)
- [x] Audited locked `StyleSpecV2.pant.rise` and earlier `assessFitConstruction`: a high/extra-high-rise trouser cannot be reconstructed for physical fit review from waist/seat, inseam and outseam alone. A stale source with no upstream construction finding could otherwise claim ready status without any `Front-rise anchor`.
- [x] Extended the dedicated `auditHandoffMeasurements` with optional `trouserRise`. It requires a separately recorded front-rise anchor only for `high_rise`, `extra_high_rise` or legacy `High Rise` designs. Production handoff and independent printable audit use the exact locked StyleSpec v2 ID first, with historic shorthand fallback.
- [x] Synthetic regressions verify mid-rise compatibility, missing high/extra-high front rise yields unresolved review-only, a valid recorded front rise preserves software review readiness, stale printable packet loses its claim, and legacy High Rise stays review-required. This does not estimate a physical rise or grant cutting permission.
- [ ] Require matching-head quality, unit, engine, preview, release, build, browser and disposable database checks before software signoff. Prior green workflow runs are not proof for this SHA.
- [ ] Genuine customer/model measurements, garment sample fitting, real pattern and seam tolerances, material truth and signed tailor acceptance remain unavailable. No merge, deployment or cutting approval.

## French/double-cuff wrist measurement gate (2026-11-06)
- [x] Reviewed existing `assessFitConstruction` and the actual option IDs. French/double-cuff construction requires a wrist reading, but a stale locked spec with no upstream warning could previously be declared review-ready without `Finished cuff circumference`.
- [x] Extended the final measurement audit's optional construction context with `shirtCuff`. A locked `french_double_cuff` ID (or legacy `French / Double Cuff`) now requires an explicit finished-cuff target derived from a recorded wrist and an actual recorded ease range. Handoff and independent HTML audits use the locked StyleSpec v2 cuff ID first, with historic shorthand fallback; no wrist value is inferred.
- [x] Added synthetic-only regression for unaffected open short-sleeve hems, missing French-cuff wrist target, preserved recorded cuff target, stale printable packet, legacy missing wrist, and verified SHA256-locked review-only export with a missing target. Both print paths retain **NO CUTTING AUTHORISATION**.
- [ ] Verify latest matching-head full CI, non-3D, build, browser and DB checks before claiming completion.
- [ ] Actual customer wrist/body readings, confirmed cuff sizing and ease, measured garment fitting, approved pattern/material and tailor signoff are still unavailable. No merge or deployment.

## Pattern-block adjustment review integrity (2026-11-06)
- [x] Inspected `block-strategy.ts` and `garment-spec.ts`: actual pattern block adjustments can carry `review`/`warning` findings, but the source's main `constructionChecks` status gate does not necessarily include them. A source flagged ready with an open adjustment could previously pass the handoff and unsigned tech-pack audits without an unresolved block note.
- [x] New isolated `auditHandoffBlockAdjustments` requires a valid list of adjustment records with recognised garment, ID, area, severity and message. It preserves the exact review/warning instructions as human unresolved items; malformed/unknown severity fails closed. An info-only block does not lower software readiness.
- [x] Both `buildProductionHandoff` and `buildTailorTechPackHtml` enforce this independent audit. Synthetic regression covers info, review, warning, stale printable packet, invalid severity, malformed adjustments and a SHA256-verified unsigned review-only packet. No invented physical block fit or cutting approval.
- [ ] Record exact-head Full CI, Non-3D browser, quality, unit, engine, preview, release, build, and disposable DB checks. Older successful steps do not certify the new SHA.
- [ ] Actual pattern and physical fit review, measured seam allowances and fabric, customer body measurements and tailor signoff remain external. Do not merge, deploy or approve cutting.

## Locked pattern-block source version consistency (2026-11-06)
- [x] Checked the canonical garment source contract: `source.blockStrategyVersion` is a separate locked property from `blockStrategy` (whose detailed block choices have no duplicated version field). The tailor-handoff builder previously accepted a declared source version with no block or a recorded block with missing source provenance.
- [x] Production handoff now rejects unknown block source versions and versioned-but-absent blocks as contradictory locked recipes. A legacy block with a missing version is preserved byte-for-byte for reconstruction but receives an explicit unresolved human provenance review rather than a software review-ready status. Records with neither block nor version remain valid legacy review inputs, and the valid `block-strategy-provisional-1` pair retains its earlier behavior.
- [x] Updated the synthetic block-adjustment positive fixture to use the actual version identifier. Added positive/negative regression for matching block/version, missing version with preserved block, version declared without block, unsupported version and verified review-only export from a legacy source. This changes no stored packet schema; the authenticated handoff builder applies the locked source gate.
- [ ] Exact-head Full CI, Non-3D, browser, build, PostgreSQL and release checks must be confirmed on the newest commit before software verification can be declared.
- [ ] Source version coherence does not authenticate physical block geometry, model measurements, cloth, signed tolerances, fitting or human tailor approval. No cutting, merge or deployment.

## Closed-vocabulary pattern block identifiers (2026-11-06)
- [x] Checked the authoritative `block-strategy.ts` unions and the existing final handoff/print block-adjustment audits. Previously a version-matched block could carry unsupported `shirtBlock`, `trouserBlock`, `torsoShape` or `seatShape` strings and be printed as if they were supported construction selections.
- [x] The pure `auditHandoffBlockAdjustments` now enforces the exact known four closed vocabularies for non-null block records. Unknown identifiers are integrity errors in handoff/print; the documented `unknown` placeholder retains its meaning but creates an explicit unresolved human block-confirmation note (rather than software review readiness).
- [x] Synthetic regression covers valid block IDs, unknown placeholder review-only, an invalid ID in every one of the four fields at handoff and printable boundaries, and a real SHA256-verified review-only export. Does not infer any physical pattern geometry.
- [ ] Match the **new head SHA** to the full CI, Non-3D, quality, unit, engine, release, build, browser and PostgreSQL gates before marking software checks green.
- [ ] Physical body readings, actual sample/pattern alignment, real material checks, seam tolerances and tailor approval remain unavailable. No cutting authorization, merge or deploy.

## Open construction checks in unresolved instructions (2026-11-06)
- [x] Audited the final packet and HTML review decision: `constructionChecks` with `review`/`warning` correctly downgraded status, but the separate `unresolved` field and printable **Unresolved before production** section could still say `None recorded`, especially for stale/hand-authored locked recipes without upstream `spec.unresolved` notes.
- [x] The existing pure `auditHandoffConstructionChecks` now emits explicit outstanding human review notes with original check IDs/messages for recognised `review`/`warning` severities. `info` does not create a blocker, unknown/malformed check still fails closed. Both `buildProductionHandoff` and independent `buildTailorTechPackHtml` combine these notes into unresolved items without weakening status checks.
- [x] Added synthetic-only positive/negative regressions for normal `info`, both open severity classes, stale packet whose unresolved list was not refreshed, and a real SHA256-locked verified review-only tech-pack export. Physical approval is **never** inferred from any packet.
- [ ] Record latest exact-head quality/unit/engine/preview/release/build/PostgreSQL/browser results. Earlier checks cannot certify a newer commit.
- [ ] Real customer body measures, fabric facts, sample garment fitting, approved pattern and seam tolerances, human tailor acceptance and cutting permission remain external and unavailable. No merge/deploy.

## Creative visual-review and craft safeguards at tailor export (2026-11-06)
- [x] Reviewed `buildCanonicalGarmentSpec`: any creative direction lacking recorded passing visual evidence, with open semantic review, or with a craft construction requires further human review. Final `buildProductionHandoff` and HTML print previously relied on the upstream `status`/`unresolved` fields and could accept a stale, self-asserted ready recipe even where a creative review was absent or craft was present.
- [x] Added a pure `auditHandoffCreativeReview` that keeps absent/failed photographic review, unavailable visual evidence, unrecorded/open semantic review and any proposed craft construction explicitly **review-required**. Malformed review status or craft type is rejected. Both the handoff builder and independent printable tech-pack audit enforce this; no creative-engine or rendering code changed.
- [x] Synthetic tests cover no-creative and internally coherent passing-source controls; missing/failed visual review, absent evidence, open semantic review, present unapproved craft, stale printable packet, invalid review state, and a SHA256-verified review-only export. Synthetic passing flags demonstrate internal data consistency **only**, not external image-evidence authenticity or physical garment approval.
- [ ] Latest exact-head quality, unit, engine, preview, release, build, PostgreSQL and browser CI evidence still required; results of older commits cannot substitute.
- [ ] Real visual evidence, physical body and garment fitting, fabric data, signed pattern/seam tolerances and tailor acceptance are unavailable. Do not merge, deploy or grant cutting authorization.

## Resume
On each `continue`, inspect latest main, branch SHA and PR checks; address the first unfinished acceptance item with real code or recorded evidence. Keep draft until all relevant checks pass. Do not merge/deploy without revalidating main and physical evidence. No approval or measured physical value is inferred here.
