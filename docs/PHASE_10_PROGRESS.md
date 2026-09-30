# Phase 10 implementation record

## Verified on 30 September 2026

Phase 10 is now materially beyond the original foundation brief.

### Shared contracts and Designer intelligence

- **A complete:** shared closed vocabularies, exact normalization, Analyzer v4 enums, v3 adapter and exact pairing protections.
- **B implemented:** Option Library v2 covers shirt type, collar, cuff, placket, pocket, sleeve, fit, length, hem, back, wear and button; trouser type, fit, rise, pleat, waistband, hem and break. Legacy labels remain stable and StyleSpec v2 adapters preserve old saved looks.
- **C implemented:** named scoring weights plus data-driven cross-garment rules are active. High-rise/tuck, wide-trouser proportion, pattern load, camp-collar, formality and climate/drape checks produce explanations.
- Designer search now keeps small occasion-band misses as reviewable/rankable trade-offs rather than collapsing an entire Safe/Elevated/Statement tier. Hard construction conflicts remain blocked.
- Deterministic CI regression now checks Formal, Casual and Semi-Formal top-three output, tier order, distinct pairs and repeated-input stability.

### Fabric Analyzer v4

- Deterministic measurement runs before AI vision:
  - sRGB/LAB dominant colour and palette
  - nearest closed colour family + ΔE
  - pattern orientation, density, scale and contrast
  - pixel repeat/stripe estimates
  - millimetres only when owner/supplier physical scale is declared
  - blur, glare, exposure, colour-cast and framing quality
  - SHA-256 content identity + perceptual hash
- **Three-photo protocol is active:** flat image is authoritative for measured colour/pattern; optional macro is used for texture/weave appearance; optional fold is used only for visual fall/structure appearance.
- Macro/fold captures are passed to the model only when their quality checks pass.
- Verified GSM, physical drape class and fibre content are accepted only as declared owner/supplier facts with provenance. They are never inferred from pixels.
- Top-k real textile references are retrieved instead of injecting the whole corpus into every prompt.
- Unreviewed Analyzer intelligence remains conservatively weighted until human review/evaluation supports higher trust.
- The Analyzer remains server-only/customer-hidden.

### Private operator workflow

- `/operator/fabric-analyzer` is now an authenticated private desk.
- It supports flat/macro/fold capture URLs, declared catalogue context, owner/supplier scale, verified GSM/drape/fibre facts, measured result review and approve/reject workflow.
- The private desk displays corpus counts, image quality, measured colour/ΔE, pattern evidence, physical-scale state, capture evidence and review priority.
- Quality gates protect the operator authentication and ensure Analyzer internals do not enter customer Designer UI.
- Designer Data Desk now includes an evidence-coverage queue that merges verified merchandising metadata with reviewed Analyzer evidence, prioritizes missing availability/physical-scale/GSM/drape/fibre/formality facts, and never fills missing physical facts by inference.
- `/operator/designer-evaluation` now provides a deterministic 48-case ground-truth benchmark across occasion, climate and intention contexts. The operator selects the best of three Designer directions (or none), creating auditable labels that remain evaluation evidence and do not automatically change live ranking weights.

### Instant preview and model system

- 66 catalogue cloth assets are prepared at build time with placeholder-first loading.
- Live fabric scale is calibrated against the model when real swatch/repeat millimetres are supplied; otherwise the UI explicitly labels scale approximate.
- `LiveConstructionPreview` uses deterministic SVG geometry and local state, so garment-option swaps do not require AI generation.
- Front / 3/4 / Side / Back construction study uses the same selected cloth pair and deterministic approximate projection, and supports:
  - shirt type, collar, cuff, placket, sleeve, fit, length, hem, pocket, back, tucked/untucked state and button choice
  - trouser type, fit, rise, pleat, waistband, hem and break
  - body build, height and skin-tone controls
- Saved measurements can inform the body build and Designer fit logic.
- StyleSpec v2 and body profile persist with the Designer draft and flow into the canonical garment specification.

### Final AI Studio and caching

- FASHN remains the final photoreal render step rather than the instant option-change renderer.
- Final render requests are canonicalized server-side against stock fabric IDs and the locked StyleSpec/body profile.
- Multi-view final output remains Front / 3/4 / Side / Back with visual inspection.
- Measured render evidence is carried into final rendering and QA prompts.
- Deterministic final-render QA now checks owner-measured stripe/repeat scale against the selected body-height anchor, with conservative tolerances to catch gross AI rescaling without claiming tailoring-CAD precision.
- The photoreal viewer now exposes structured Colour / Pattern / Fabric / Construction / Model QA states plus measured colour ΔE and detected pattern axis when available, so review/repair decisions are visible rather than hidden in backend logs.
- Durable Supabase render caching is implemented, including cache keys tied to fabric, canonical construction, body profile and source render identity.
- Popular-pair cache observability exists so pre-render decisions can be made without blindly spending render credits.

### Evaluation / CI

The main CI now runs:

1. production dependency audit
2. static quality/privacy gates
3. unit tests
4. deterministic Phase 10 rule evaluation
5. deterministic Designer top-three regression
6. release-readiness checks
7. production Next.js build

Latest verified run passed all stages.

## Still owner/physical-evidence dependent

These items should not be invented in code:

1. Real swatch width or pattern repeat in millimetres for each stock fabric that needs true-scale rendering.
2. Owner/tailor approval of provisional Korean/baggy trouser proportions and any new construction option before calling it an offered house style.
3. Owner-labelled 40–50 fabric ground-truth cases and 40–60 outfit preference cases for meaningful Analyzer/Designer accuracy percentages.
4. Verified GSM, fibre content and physical drape for each roll where supplier records or physical inspection support them.
5. Visual acceptance testing on the target phones/desktop hardware for the final sub-second interaction target.

## Deployment status

Code is on `main` and the full CI/build passes. Vercel production deployment is still separately blocked by the previously observed Vercel build-rate limit; do not treat the latest `main` as production until a later deployment is verified READY.
