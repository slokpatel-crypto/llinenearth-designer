# TITAN — fabric intelligence provenance checkpoint (2026-11-02)

**Scope:** Pure fabric measurement, validation, customer-facing evidence promotion, and dedicated regression tests. No stock, inventory, operator availability, catalogue loading, DesignerModule, photographic preview or model changes. No paid model requirement or Vercel deployment.

**Baseline:** `main` at `5835a5533281b8306e9bfa1fd9786a30d59c8053` at branch creation.

## Provenance distinctions (do not conflate them)

- **Image measured:** pixel colour, pixel repeat, image stripe axis and apparent texture. These are *not* physical colour checks, fibre composition, GSM, yarn/Lea count or verified weave construction.
- **Measured physical:** record a real calibrated reference and measurement method/evidence; review and retain field-level provenance. The code does not create such a measurement or invent a fabric value.
- **Supplier/owner declared:** use only an auditable supplier record or owner's explicitly documented measurement with field-level declaration and human approval. The declaration's provenance must remain distinct from an independent measured fact.
- **Estimated/model judged:** may support visual suggestions only, never verified pattern size, yarn count, composition, GSM, grain direction or physical colour.
- **Unknown:** no verified physical claim and no true-scale preview certification.

## Code invariants added

1. An actual detectable pixel-period and unambiguous repeat axis are required to calibrate motif mm, even when an external repeat is declared.
2. A *width-only* reference calibrates horizontal image distance (vertical stripe motifs), not horizontal stripe spacing on the image Y axis or two-dimensional grid spacing.
3. Physical repeat and swatch-width dimensions must be finite, positive, bounded and resolvable at existing reported precision. No zero-mm rounded physical repeat is published.
4. Consumer-facing reviewed evidence additionally rejects missing or incompatible repeat/stripe widths, invalid source URLs, invalid GSM/drape/fibre values and field-level unproven claims. Existing verified fibre values retain precedence.
5. Physical input validation rejects explicitly supplied nonfinite or malformed numeric values and malformed HTTPS URLs rather than silently treating them as absent.
6. Customer-facing projection revalidates persisted JSON field provenance as literal strings, rejects malformed/oversized supplier URL or notes, and does not promote a declared physical repeat without a matching observed stripe axis; width-only calibration requires vertical orientation. Older incomplete metadata remains unverified.
7. Stale `trust:reviewed` is not authority to promote a rejected or pending fabric profile; approval must have the explicit `approved` or `corrected` review status. Older missing-status records fail closed.
8. At customer projection, even already-reviewed persisted JSON cannot certify an oversized fibre/composition literal; the 220-character supplier evidence limit is rechecked without truncation, independently from valid GSM or drape.
9. Persisted render metadata must use literal booleans for repeat detection and finite positive integer pixel dimensions; JSON coercion of strings/arrays/null must never manufacture image repeat evidence or an invented tile size.
10. Physical inspection receipt dates must be real dates and cannot claim an inspection several days in the future; permit UTC tomorrow only for legitimate UTC+14 local calendar offsets. A valid date still does not prove inspection happened.
11. Legacy/corrupt approved profiles with missing or wrong-shape nested measurement/physical objects must return original unverified fabric unchanged rather than throwing a customer-facing runtime error.
12. At the customer-facing boundary, physical supplier URL, note, and fibre literals are bounded *before* trimming, so oversized whitespace-padded persisted JSON cannot bypass source/evidence length constraints. Exact-limit valid declarations remain accepted.
13. Previously verified fabric render-scale evidence is not overwritten by later analyzer projections; an unverified fabric may still adopt reviewed, sourced scale. Existing verified fibre, GSM and drape precedence remains.

## Physical acceptance still open

- No real roll measurement, documented calibrated pixel/mm ratio, warp/weft repeat and grain-rotation measurement, lab/cutter GSM, composition certificate, Lea/yarn count certificate, verified weave, controlled-light colour capture or independently reviewed supplier evidence was supplied in this branch.
- Source colour extraction remains a **screen-photo observation**. A named D65/colourimeter session and actual physical sample are required for colour truth.
- A verified single-axis repeat does **not** certify whole cloth grain orientation, a two-axis check pattern, fabric drape or all garment panel mappings.
- Existing v4 profile contract is unchanged; no migration. Old profiles with incomplete evidence are intentionally **not upgraded** by these checks.

## Verification plan and evidence

- Dedicated Node regression suites: `tests/phase10-measurement.test.ts`, `tests/fabric-intelligence-evidence.test.ts`, `tests/phase10-physical-evidence-provenance.test.ts`, `tests/fabric-pattern-scale-provenance.test.ts`.
- Required CI gates via pull request: `npm run quality`, `npm test`, `npm run eval:engine`, `npm run eval:preview-performance`, `npm run release:check`, `npm run build` (plus CI native/browser checks). Record result from **latest head SHA**.
- Local full-repository execution was not available in this tool environment because direct GitHub checkout failed DNS resolution. Do not mark checks green from code inspection.
- Do not merge before green matching-head checks, latest main reconciliation and independent production evidence; do not deploy Vercel.

## 2026-11-03 — Classification evaluation denominator integrity

- Ground-truth scorecard must never score approved Analyzer backfills as self-confirming 100% accuracy. Corrected-profile history also reconstructs only edited fields and cannot independently certify all untouched classifications.
- Retain historical records for operator review, but mark both forms of backfill `eligibleForAccuracy:false` in the in-memory label contract. Quantitative scoring excludes these records; actual explicit owner labels remain eligible, including older labels without the optional flag.
- Tests reject artificial 100% from approved backfills, overcounting of corrected history and a newer synthetic duplicate eclipsing a valid owner label. No persisted schema migration or new source dependency; production score becomes `null` rather than a fake percentage when no independently labelled cases exist.
- Physical GSM, weave, fibre certificates, repeat calibration and independent owner labels are still not supplied. Keep PR draft, no merge, no deployment.

## 2026-11-03 — No-image classifier guard
- Development classification must not default to a fictional Linen fabric and navy colour when no image visual signals exist.
- Without image or material filename hints: zero alternatives, blank palette, unresolved material/colour and zero unsupported confidence. With a filename hint only: retain the known family as provisional confidence 0.3, **not** as an image measurement or physical fibre certificate.
- Regression tests cover both cases. No vocabulary, customer model or stock changes; `FabricProfile` retains its existing structure, but clients must tolerate an empty alternatives/palette array where no evidence exists.

## 2026-11-03 — Explicit owner-label input integrity
- The cloud ground-truth intake now normalizes explicit operator labels with a pure fail-closed parser before counting them as independent accuracy comparisons.
- Arrays/objects/booleans, oversized literal fields and malformed ordinal formality/statement values are rejected rather than coerced into apparently real labels; empty label states cannot populate the scorecard. Numeric 1–5 formality/statement entries remain compatible with older operator records.
- Persisted label identifiers and metadata must be literal bounded text; no shortening of an oversized/forged identifier into a valid stock ID. Incomplete but genuine owner-labelled fields remain allowed and are excluded from their own per-field denominator.
- New regression tests cover malformed persisted JSON and valid partial labels. No database schema changes or stock / visual changes.

## 2026-11-03 — Partial independent-label denominators
- Genuine owner labels with absent original or final classification values remain independently labelled records but must not be scored as disagreement, a correction, or an exact-profile failure.
- Field-level accuracy counts only pairs of known original/final values; correctedFabrics counts actual known mismatches. Exact-profile accuracy is withheld (`null`) whenever any labelled case lacks a complete before/after nine-field comparison, preserving the operator desk's existing exact-matches / unique-fabrics denominator without a misleading percentage.
- Pure scorecard now exposes completeFabrics and incompleteFabrics for future evidence audits (additive API shape). Regression tests cover missing initial values, partial genuine corrections, mixed complete/partial batches and unknown final values.
- No UI, stock, model or database changes. Independent physical fabric evidence and approved owner-labelled benchmark remain outstanding.

## 2026-11-03 — low-resolution source-photo physical calibration
- A 128x128 normalized analyzer frame can be an upscale of a tiny original. The width-only swatch ruler path now requires an original integer image width of at least 400 px, matching the existing source-quality floor. The server also passes the original image height and rejects width-only physical calibration when either source dimension is below 400 px.
- Direct pure-library callers without source-height metadata remain compatible; if source height is provided it must pass the same minimum. The separately sourced real-repeat declaration path is kept distinct and is not automatically converted into a width-ruler calibration.
- Regression tests cover tiny upscaled photographs, narrow and short originals, fractional pixel dimensions, 400px source boundary and separately declared repeats. This does not certify physical scale without the other required supplier / ruler review evidence.

## 2026-11-03 — persisted adapter physical-record boundaries
- The legacy v3/v4 profile adapter now rejects supplier fibre, HTTPS source and inspection-note **raw** literals exceeding their field bounds *before trim*, matching the physical intake and customer-projection checks. Whitespace-padded overlength evidence must not transform into acceptable shorter documentation.
- Corrupt persisted `measured` and `imageQuality` arrays can no longer be cast to typed physical measurement objects; they normalize to `null`, without implying any measured fabric facts.
- Targeted regression tests cover all three padded supplier fields, valid unrelated field preservation and array-shaped physical records. Existing v4 contract and physical provenance semantics unchanged; no schema migration.

## 2026-11-03 — persisted Analyzer confidence and enum literal integrity
- V3/V4 profile adapter no longer uses `Number(value)` to coerce arrays, booleans, null, or stringified values into classifier confidence; out-of-range confidence falls back to 0, rather than clamping to an unjustified 100% value.
- Literal numeric 1–5 integer formality/statement rankings are accepted; malformed ordinal values use the existing safe defaults. Classification enum inputs must be literal strings, not arrays converted via `String(["stripe"])`.
- Valid v4 numeric and string classifications remain unchanged. Regression tests cover valid boundaries, invalid JSON types and out-of-range values. No persistence migration or physical proof inferred.

## 2026-11-03 — Nested persisted visual measurement shape integrity
- The profile adapter must not trust a top-level `measured: {}` object as a full FabricMeasuredData contract. Downstream server projection dereferences `measured.colour`, `measured.pattern` and `measured.imageQuality`; missing or array-shaped nested values can cause runtime errors or contaminate physical-scale fields.
- Validation now rejects incomplete nested records, malformed image colour and deltaE, invalid orientation/scale status and nonnumeric pattern measurements. Invalid records become `measured:null`; valid independent verifiedPhysical evidence remains separate and unchanged.
- Standalone image-quality evidence requires a finite literal numeric 0–100 score. Coerced `"100"`, `[100]`, booleans and out-of-range values cannot create apparent high-confidence visual evidence. Existing well-formed profiles remain usable; no schema migration.
- Tests cover malformed nested objects, mixed good/bad visual readings, valid scores and rejected forged scores. This is shape validation, **not** independent proof of physical fibre/GSM/weave/repeat.

## 2026-11-03 — complete quality diagnostics and literal profile version
- The v3/v4 adapter now requires a complete source-image-quality diagnostic record before accepting a persisted quality score as measured evidence. A bare `{score:100}` previously passed adapter validation even though the actual evaluator always emits dimensions, quality issues, blur variance, glare %, mean luminance, channel spread and border-to-center delta. Every numeric field must be finite and within the physical capture domain; dimensions must be safe integers, and issues a bounded list of literal strings.
- Invalid partial/forged quality records normalize to `null`, keeping fabric trust provisional rather than manufacturing an image quality or calibrated physical claim. Valid historical records emitted by `assessImageQuality` remain unchanged.
- The analyzer profile version must be a literal v3/v4 string; arrays such as `["fabric-analyzer-v4"]` can no longer masquerade as a supported serialized contract. Added regressions for both boundaries.
- No changes to stock/inventory/customer rendering, no schema migration, no physical certificate implied.

## 2026-11-03 — Active stock binding for owner-labelled accuracy
- The scorecard loader previously accepted any literal `payload.fabricId` in an explicit operator event, even if it was not a real current Linen Earth catalogue fabric. Fabric labels for unknown or retired stock IDs could inflate the 40-case benchmark and render misleading confidence.
- The loader now checks exact canonical IDs against currently in-stock `FABRIC_STOCK` members for both explicit labels and historical backfills before counting or scoring them. This does not edit stock, change availability, or infer that listed stock is physically verified.
- Added a pure predicate and regression tests for exact stock IDs, unknown IDs, array/object coercions, whitespace suffixes and mixed label sets. No UI/schema/stock ledger changes; independent owner labels are still required.

## 2026-11-03 — Canonical owner labels and raw exact stock IDs
- A persisted literal string such as `pinstripe` (an alias rather than a canonical `patternFamily` ID), an invalid color family, or an invented weave/scale descriptor was previously accepted as an independently owner-labelled classification. The explicit ground-truth parser now validates all seven categorical fields against the shared color and pattern vocabularies and the Analyzer v4 closed sets; 1–5 ordinal fields remain strictly validated. Unknown fields remain empty rather than becoming invented facts.
- Exact active-stock validation is now applied to `payload.fabricId` before any trim or normalization, so trailing-space, prefixed or unrelated IDs cannot be altered into a valid current stock ID. No edit to stock inventory or availability semantics.
- New regression tests cover aliases/typos/invalid categories, legitimate unknown partial values and canonical categories. No database schema or Designer Studio/UI changes; owner-labelled physical observations and independent approval still required.

## 2026-11-05 — Base fabric / independently scoped colour-print-lot variants

- Added isolated pure `src/lib/fabric-base-variants.ts` and `tests/fabric-base-variants.test.ts`. No catalogue loader, stock ledger, operator inventory, DesignerModule, photographic UI, auth, 3D or schema migration was touched.
- A common GSM, composition, weave, yarn count or width specification may be represented **once** as a base claim only when its explicit covered `(variantId, lotId)` pairs are listed. A colourway's new lot is not covered by the previous lot's receipt. Colour family, print family, photo hash and lot IDs are always distinct variant identities, never inherited from the base.
- Base and variant physical values require literal field type/range/precision validation, a source of the correct kind (physical/lab/owner measured vs supplier declared), and a separately supplied matching independent-review snapshot. That snapshot binds value, evidence source, calibration and covered lots. Estimated/unknown, rejected/pending/stale, forged JSON, duplicate IDs and competing claims do not become usable physical facts.
- A pending lot-specific observation prevents silent fall-through to an older base value. If a specific reviewed lot fact conflicts with a base claim, **both are blocked for that field** pending independent adjudication, not silently superseded.
- X/Y repeat calibration is variant-photo hash-bound, requires >=400 px in both original dimensions, literal X/Y axis and measured pixel period, physically consistent mm and declared resolution. One reviewed axis does not certify the other; any changed photo invalidates the scale claim.
- The schema is **candidate-only**: its value fingerprint and reviewer metadata are *not cryptographic signatures*. An integration must pass approvals from an authenticated, separately controlled review ledger rather than supplier-provided JSON. Neither data nor tests invent real certificates or reviewer signoff.
- Before this checkpoint's documentation commit: initial code commits `6651e72a0e50cf2085b778b8bc806071973de75f` and `2ca4d783adf7a441b8227b66cfb13327240c533f`. Full exact-head GitHub CI and Non-3D QA must be checked after the final checkpoint commit; do not transfer prior `029180d` green results to these changes.
- Remaining blockers: no independent real roll/swatch GSM, fibre composition, weave, Lea/yarn, width, calibrated warp/weft repeat and grain photographs; no approved owner-label benchmark or authenticated reviewer ledger integration. Keep **DRAFT / UNMERGED / NO VERCEL DEPLOYMENT**.

### 2026-11-05 follow-up — cross-base approval replay blocked

- Each candidate physical claim now requires an exact `baseId`; this identity is included in the canonical claim snapshot reviewed by the independent approval ledger.
- The pure family resolver rejects claims for any other base even when variant/lot IDs, supplier receipt and review payload otherwise match. Added negative regression covering both unchanged receipt replay and altered claim identity.
- Code commits `73d6fc018bb8af418af2b532f9e8b46582fe9cdf` and `50861c2918bbab097e086576c5019505865350a8`. Latest exact-head full CI and Non-3D QA must re-run after this checkpoint update; earlier `585c9ec` runs are not sufficient.
- Scope remains pure fabric library, dedicated tests and checkpoint documentation only. No physical evidence, authenticated review infrastructure, merge or deployment inferred.

### 2026-11-05 — canonical pattern-family IDs

- Variant colour IDs resolve against `colorFamilies` and variant print/pattern IDs now resolve against the existing `patternFamilies` shared vocabulary. Aliases like `pinstripe` cannot impersonate the canonical `stripe` ID in a versioned variant record.
- Source and regression commits `503733ca4479da80efc6079ba701313901b0eea9` and `91c7059d83ee11aa3ab03f66fd77eb5aba40912c`; new exact-head CI is required after this documentation commit. Existing typed saved-design, catalogue, preview and stock APIs are unchanged; this new pure candidate resolver is opt-in only.
