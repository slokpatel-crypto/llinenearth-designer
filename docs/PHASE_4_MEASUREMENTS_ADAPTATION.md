# Phase 4 — Measurements & Fit Adaptation

Status: strong existing foundation; calibrate and persist instead of rebuilding.

## Existing implementation to keep

- Guided shirt and trouser measurement studio with highlighted blueprint lines.
- Plausibility ranges and user warnings.
- Versioned measurement profile contract.
- Measurements already feed Designer body preview proportions.
- `fit-construction.ts` already converts body measurements into provisional finished-garment targets using explicit ease bands.
- `block-strategy.ts` already selects provisional shirt / trouser starting blocks and flags shoulder, posture, seat and mobility concerns.
- Canonical garment specification already carries finished targets, construction checks, block strategy and measurement-profile version.
- The system already states that these are tailoring decision-support values, not cutting patterns.

## Roadmap v2 adaptation

Do not create a second measurement engine. The roadmap's Phase 4 work becomes:

1. Validate the current capture flow with real people.
2. Compare self-measurements with tailor measurements and record error.
3. Measure a Linen Earth set of finished shirts / trousers and calibrate the existing provisional ease bands.
4. Version every owner-approved ease-table revision.
5. Keep body measurements distinct from finished-garment targets.
6. Move customer-critical profiles from browser-only storage to durable authenticated persistence before operational launch.
7. Keep local browser save as an offline / convenience cache, not the system of record.

## Current limitation

The current Measurement Studio and customer measurement profiles still rely on browser storage in important paths. Clearing browser data or changing devices can remove them. This is acceptable for the lab / development flow but not for a production order handoff.

## Calibration gate

- [x] measurement fields and blueprint guidance
- [x] plausibility ranges
- [x] body-preview linkage
- [x] provisional ease engine
- [x] finished-garment target engine
- [x] provisional block strategy
- [x] canonical spec integration
- [ ] 10-person self-measurement comparison recorded
- [ ] median chest error below roadmap target
- [ ] median sleeve error below roadmap target
- [ ] owner/tailor finished-garment calibration set recorded
- [ ] approved ease-table revision versioned
- [ ] durable customer persistence enabled

## Safety rule

Never silently convert a provisional ease range into a cutting instruction. The canonical spec can become tailor-ready only after the measurement evidence, house ease calibration and tailor review requirements are satisfied.
