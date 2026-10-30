# Designer Studio option accuracy — acceptance checkpoint (2026-10-30)

Base commit: `c66d263989b15aa02c2eeecbaecf6b94e130be9f`.
Scope: collar, cuff, placket, shirt tuck and trouser controls. Do not merge or deploy. Preserve `linen-earth-studio-model-v1`; no mandatory paid AI.

## Evidence inspected
- `src/lib/designer/preview-option-reviews.ts` enumerates `DESIGNER_STYLE_CHOICES` and assigns photographic support `exact | approximate | none`, with separate operator review status.
- `src/app/api/operator/preview-option-coverage/route.ts` exposes authenticated coverage and summary.
- `scripts/check-designer.mjs` asserts the tucked photographic boundaries, garment panel draw ordering and several construction constraints.
- These source inspections are **not** execution evidence. No matching-head tests or visual comparisons were executed in this checkpoint.

## Required acceptance (all pending until demonstrated)
1. Enumerate every supported option value from `DESIGNER_STYLE_CHOICES`, including shirt-wear/tuck and all trouser shapes, and map each to the visible Studio control.
2. For every collar/cuff/placket choice, verify the selected value persists through canonical garment spec, photographic/3D preview, saved design and tailor handoff. Compare visible geometry, not merely state changes.
3. For tucked and untucked, verify neckline, sleeves, waistline, overlap, masks and trouser layering without clipping.
4. For each trouser type, verify silhouette, rise, waistband, break and leg separation on desktop and mobile.
5. Mark approximate/unsupported variants explicitly rather than claiming exactness; fix mismatches, rerun relevant tests and inspect screenshots at 390, 768 and 1440 px.
6. Verify original model identity unchanged, core deterministic operation without paid AI, and matching-head lint, tests, build, browser QA.

## Blocker and next action
No live browser rendering, full repository test execution or authenticated operator review was performed in this GitHub-only inspection. Therefore **option accuracy is not certified**. Next: run the exact-head test suite and browser matrix, capture a screenshot for every supported value, compare each against its construction intent, implement failures and repeat until all checks pass. Obtain human visual approval for exactness where construction evidence cannot establish photographic fidelity. Do not request merge/deploy approval as part of this checkpoint.
