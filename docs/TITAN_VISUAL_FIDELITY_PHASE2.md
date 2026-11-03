# TITAN Designer Studio — photographic construction fidelity phase 2

**Scoped branch:** `titan-parallel-visual-fidelity-phase2`
**Starting main SHA:** `4dd8020abd83429449ff53ea5bb71b046394d86e`
**Earlier baseline:** photographic phase alignment PR #864, merged November 2, 2026.

## Why this change exists
The canvas compositor keeps three real front photographs: tucked straight-leg,
untucked pleated, and untucked wide-leg. The actual selected construction can
differ from that source photograph. In particular:
- The untucked source shirt has a **curved shirttail**, while a valid selected
  v2 construction can use `straight_flat_hem` or side vents.
- A tucked wide-leg choice still retains the **straight-leg** tucked source.
- Wide-look legacy conversion may produce a **flat-front** v2 pleat even though
  the source photograph visibly has a single pleat.
- Advanced collar, cuff, placket, half-sleeve, fit, pocket, rise, waistband
  and trouser hem options do not automatically have photographic reconstructions.

## Actual code and acceptance
- Pure `photoConstructionMismatches(style,styleSpec)` compares photographed
  baseline construction with the **actual selected versioned IDs**; no
  magic label remapping or garment spec mutation.
- Customer `PhotoOutfitPreview` shows a compact, accessible mismatch notice
  when a construction choice is not actually rendered in the fixed photograph.
- Dedicated Node regression tests cover baseline, advanced v2 values even when
  legacy display names are unchanged, untucked hem, wide/flat-front, tucked
  wide, rise/waistband, deterministic nonmutation and live preview wiring.

This is a **preview truth/fidelity guard**, not a redraw of unsupported garment
geometry and **not** physical tailoring validation. Original model
`linen-earth-studio-model-v1`, underlying photographs, textured panels, seams,
masks, FASHN endpoint, physical scale and saved style spec remain unchanged.

## Still blocked on actual visual source evidence
Collar variations, French/short-sleeve cuffs, alternate plackets, varied body
fits, physical tucks, flat/double trouser pleats, waist construction and
multiple actual photographic angles need matching photographed/approved geometry
or verified garment reconstruction. Do not mark them visually correct based
only on saved option selection or a canvas mask.

## Required exact-head gates
1. `node --experimental-strip-types --test tests/photo-preview-fidelity.test.ts`
2. `npm run quality`, `npm test`, `npm run eval:engine`,
   `npm run eval:preview-performance`, `npm run release:check`,
   `npm run build`.
3. Pinned Chromium Studio proof including 390, 768 and 1440px screenshots,
   no overflow, no unexpected console or protected-region pixels. Examine
   photoreal/source comparisons; this branch changes only the visible warning.
4. Compare changed-file scope with latest main and exact-head workflow status.

**Current status:** code committed to isolated branch; quality/build/browser
CI results and human screenshot review **not yet claimed**. Keep as draft PR;
do not merge to main or deploy Vercel until checks and review pass.
