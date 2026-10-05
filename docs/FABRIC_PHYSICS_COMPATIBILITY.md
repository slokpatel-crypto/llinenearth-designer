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

Existing catalogue values can enter as declared evidence. Unmeasured structure, breathability, wrinkle resistance and stretch remain unknown until operator/supplier/physical evidence exists.

A high physical-fit score does not become a `strong` recommendation unless critical fields and enough trusted evidence are present.

## Current integration

`/api/designer/catalog` now attaches:

- `physicsProfile`
- `garmentCompatibility`

to each calibrated Designer fabric. The customer-facing Designer UI is intentionally unchanged in v1; the data is available for later Style Director, operator calibration and garment-expansion work.

## Calibration next

Before exposing six-garment scores as customer claims:

1. Measure/verify GSM on representative Linen Earth rolls.
2. Create repeatable drape/structure tests and operator scales.
3. Add supplier/physical evidence for breathability, wrinkle behaviour and stretch where available.
4. Compare scores with finished garments and tailor feedback.
5. Revise provisional target bands from real Linen Earth outcomes.
