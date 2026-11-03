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
