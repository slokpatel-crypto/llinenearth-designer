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
