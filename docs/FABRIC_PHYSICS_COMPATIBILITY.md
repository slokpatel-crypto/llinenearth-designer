# Fabric Physics Compatibility v1

This module adapts the useful physical-suitability idea from the uploaded Fabric → Design Engine into the existing Linen Earth Deep Engine.

## What it adds

- Evidence-aware physical profile for:
  - GSM
  - drape
  - structure
  - breathability
  - wrinkle resistance
  - stretch
- Compatibility scoring for:
  - shirt
  - trouser
  - suit
  - blazer
  - kurta
  - bandhgala / Jodhpuri
- Separate evidence coverage and confidence so an incomplete fabric cannot look production-ready.
- Hot/humid comfort adjustment without replacing the existing Designer climate/style rules.

## What it does not replace

The existing systems remain authoritative for:

- colour and pattern pairing
- occasion/formality
- Safe / Elevated / Statement search
- construction and cross-garment rules
- measurements, ease and block strategy
- live/photo rendering
- design locking and SHA-256 revisions
- tailor / production handoff

## Fabric Truth policy

The compatibility layer must not invent physical truth.

Existing catalogue GSM can enter as declared evidence. A reviewed Analyzer field can supply a missing value only through the existing auditable, field-level physical-evidence gate. Its original declared/reviewed status is retained; approval of a different Analyzer value cannot upgrade an existing catalogue declaration.

Categorical drape is converted to a provisional **estimated index**, even when the category itself was reviewed. This mapping is not a measured drape coefficient. Unmeasured structure, breathability, wrinkle resistance and stretch remain unknown until operator/supplier/physical evidence exists.

GSM accepts finite numbers from 20–1000, matching the existing physical-evidence contract. Other numeric indices accept finite numbers from 0–1. Nulls, strings, non-finite and out-of-range values stay unknown; they are never clamped into valid evidence. The scorer repeats this validation for direct profile callers, including climate adjustments. The Analyzer adapter also preserves missing GSM as null rather than coercing it to 20.

A high physical-fit score does not become a `strong` recommendation unless critical fields and enough trusted evidence are present. An estimated critical field prevents `strong`, even when unrelated reviewed fields raise overall confidence. Every result retains the provisional-rules warning. Software scores do not approve a fabric or finished garment for production.

## Current integration

`/api/designer/catalog` now attaches:

- `physicsProfile`
- `garmentCompatibility`

to each calibrated Designer fabric. The customer-facing Designer UI is intentionally unchanged in v1; the data is available for later Style Director, operator calibration and garment-expansion work.

The pure `attachCatalogFabricPhysics` adapter preserves accepted catalogue precedence, real stock filtering, existing allowed garment IDs and photographic facts. The six-family compatibility matrix does not expand the shop's currently offered garments or alter Designer ranking. Public results do not include private checker names or evidence notes. No database migration or paid provider call is introduced.

## Regression coverage

- Valid and invalid physical values, missing/unknown evidence, 0/1 index boundaries and bounded finite outputs.
- Climate scoring cannot use facts marked unknown or invalid.
- Critical estimates cannot be offset by unrelated reviewed evidence.
- Category-to-index mapping remains estimated; explicit numeric inputs retain their own provenance.
- Catalogue declarations retain their values and cannot inherit a different Analyzer review.
- Missing GSM survives Analyzer adaptation as unknown, including legacy v3 records.
- The actual catalogue GET handler preserves stock and metadata behavior while adding six-family results, with isolated data adapters and no external calls.

## Calibration next

Before exposing six-garment scores as customer claims:

1. Measure/verify GSM on representative Linen Earth rolls.
2. Create repeatable drape/structure tests and operator scales.
3. Add supplier/physical evidence for breathability, wrinkle behaviour and stretch where available.
4. Compare scores with finished garments and tailor feedback.
5. Revise provisional target bands from real Linen Earth outcomes.
