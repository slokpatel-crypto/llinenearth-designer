# Phase 10 — Designer + Analyzer + Live Preview Plan

## Destination
Create a two-tier menswear design system:
1. **Live deterministic preview** for instant fabric and garment-option changes.
2. **AI Studio render** only after a design is locked, with colour/pattern QA against the deterministic preview.

The Fabric Analyzer remains server-only. Canonical design state remains deterministic and hash-stable.

## Delivery order
- **A — Shared closed vocabularies:** stable IDs for colour, pattern, occasion, garment use and existing Designer options; Analyzer v4 enums; v3 adapter; exact-ID matching.
- **B — Option Library v2:** data-driven shirt/pant options, StyleSpec v2 and legacy adapters without changing existing labels.
- **C — Cross-garment rules:** data rules for proportion, rise/tuck, pattern load, formality, climate and verified-fact limits.
- **E1–E3 — Measured Analyzer:** code-based colour, pattern metrics and image-quality gate.
- **D — Tier 1 live renderer:** deterministic front/back parametric renderer, real fabric tiles, scale confidence and capability badges.
- **G — Designer UX:** mobile-first Fabric / Shirt / Pants / Fit & Body / Verdict controls on top of Tier 1.
- **F — Evaluation:** vocabulary/rule/hash tests immediately; owner-labelled fabric/outfit golden sets incrementally.
- **D2 — AI Studio QA:** final FASHN render only after lock; compare colour/pattern against Tier 1 and retry once when outside tolerance.

## Invariants
- Existing display labels stay unchanged.
- Locked spec, version history, undo/redo and canonical hash remain authoritative.
- Image models never mutate canonical state.
- Exact GSM, fibre, drape, stretch, shrinkage or physical scale require declared/reviewed facts.
- Preview accuracy is labelled exact / approximate / not shown.
- Analyzer code stays out of the customer bundle.
- New rules/options are provisional until owner-approved.
- No secrets or customer photos are committed.

## Performance target
- Fabric-only preview swap: under 100 ms target on mid-range Android.
- Garment-option preview swap: under 100 ms target.
- Heavy renderer code lazy-loaded.
- FASHN reserved for final locked design.

## Owner questions
1. Swatch real width or repeat size in mm for each stock fabric.
2. Visual approval of provisional Korean/baggy trouser proportions and shirt ease values.
3. Which shirt/collar/cuff/pant options Linen Earth will actually make.
4. Who labels the 40–50 fabric and 40–60 outfit golden sets.
5. Whether customer-photo try-on is in scope and the consent/retention policy.
6. Which fabrics have verified GSM, fibre composition or drape observations.

Defaults remain explicitly provisional until these answers are supplied.
