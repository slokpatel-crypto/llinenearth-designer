# Phase 4 — Measurements & Fit Adaptation

Status: strong existing foundation with opt-in durable recovery now implemented; real-person accuracy and tailor calibration remain.

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
6. Keep local browser save as a convenience cache.
7. Offer an explicit opt-in secure measurement recovery vault now, while authenticated customer-account ownership remains a later launch dependency.
8. Keep raw measurement persistence private and never place recovery tokens in URLs.

## Durable recovery now implemented

Measurement Studio still saves locally by default, but it now also supports an explicit **Secure measurement copy**:
- private Supabase-backed storage,
- high-entropy recovery token,
- only the SHA-256 access-key hash is stored,
- recovery token is pasted into a POST flow rather than placed in a URL,
- profile and tailor observations can be recovered onto another device,
- secure copy expires automatically,
- user can explicitly delete the secure copy.

This is anonymous recovery, not a replacement for authenticated customer-account ownership.

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
- [x] opt-in durable measurement recovery enabled
- [ ] authenticated customer-account ownership enabled

## Safety rule

Never silently convert a provisional ease range into a cutting instruction. The canonical spec can become tailor-ready only after the measurement evidence, house ease calibration and tailor review requirements are satisfied.
