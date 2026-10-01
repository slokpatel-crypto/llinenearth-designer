# Phase 4 — Measurements & Fit Adaptation

Status: strong existing foundation with secure recovery, authenticated ownership, self-vs-tailor evidence capture, a versioned house-ease calibration registry, and controlled runtime activation of the one approved model; real evidence and approval remain.

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
2. Compare self-measurements with tailor measurements and record error in the private append-only calibration registry.
3. Measure a Linen Earth set of finished shirts / trousers through the new append-only House Ease Calibration desk and calibrate the existing provisional ease bands.
4. Register every replacement as a complete versioned table and require named owner/tailor approval.
5. Use only the currently approved complete model in the live Designer; drafts and retired models never change customer fit calculations. If no approved model exists, retain the explicit provisional fallback.
6. Keep body measurements distinct from finished-garment targets.
7. Keep local browser save as a convenience cache.
8. Offer an explicit opt-in secure measurement recovery vault and authenticated customer ownership without exposing raw measurements in account summaries.
9. Keep raw measurement persistence private and never place recovery tokens in URLs.

## Durable recovery now implemented

Measurement Studio still saves locally by default, but it now also supports an explicit **Secure measurement copy**:
- private Supabase-backed storage,
- high-entropy recovery token,
- only the SHA-256 access-key hash is stored,
- recovery token is pasted into a POST flow rather than placed in a URL,
- profile and tailor observations can be recovered onto another device,
- secure copy expires automatically,
- user can explicitly delete the secure copy.

Signed-in customers can now attach new or older secure copies to their Supabase-authenticated account. Recovery tokens remain an independent backup path.

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
- [x] finished-garment calibration evidence workflow + full 35-cell coverage gate implemented
- [x] versioned owner/tailor approval registry implemented
- [x] approved-model runtime loader + calibrated fit-engine source switching implemented
- [x] Designer assessment, search and brief paths share the same approved ease model
- [ ] owner/tailor finished-garment calibration set recorded with real garments
- [ ] approved ease-table revision created from real evidence (once approved, it becomes the runtime source automatically)
- [x] opt-in durable measurement recovery enabled
- [x] authenticated customer-account ownership enabled

## Safety rule

Never silently convert a provisional ease range into a cutting instruction. The canonical spec can become tailor-ready only after the measurement evidence, house ease calibration and tailor review requirements are satisfied.


## Measurement accuracy evidence hardening

- Self-vs-tailor comparison cases now use a private append-only Supabase registry behind the authenticated Operator API instead of generic browser event writes.
- The server validates plausible measurement ranges and recomputes absolute chest/sleeve error from raw pairs; clients cannot submit pass/error values.
- Every case requires an anonymous case ID, a physical comparison source, and a named checker/tailor. Latest-case semantics prevent repeat attempts from inflating the 10-person gate.
- The existing roadmap thresholds remain explicit: at least 10 unique cases, median chest error below 1.5 cm, and median sleeve error below 1.0 cm.
