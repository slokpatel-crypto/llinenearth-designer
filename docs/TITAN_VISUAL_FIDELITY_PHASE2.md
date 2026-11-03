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

## Continued audit — versioned/photo drift protection (Nov 3)
- Pure fidelity guard now compares the selected v2 shirt-wear choice with the
  legacy choice actually used to pick the photograph. A mismatch is explicitly
  disclosed and cannot be mistaken for a visibly rendered tuck.
- v2 collar-contrast selection, trouser type and `pant.break` are compared to
  the photographed geometry independently of the legacy display labels.
- Rear shaping such as darts/pleats is explicitly unverified by a front-only
  photograph. No speculative vector overlays or substitutes were introduced.
- Added regression cases for these silent differences; corrected the wide-leg
  fixture to carry the actual versioned wide-trouser type/break IDs.
- The untouched original model has no matching new photographs of French cuffs,
  Cuban collars, alternative plackets, short sleeves, straight shirt hems or
  multiple trouser pleats; truthful labels do not complete those reconstructions.

**Review caution:** GitHub CI must be checked on the final exact PR head after
these commits. Any earlier green run applies only to its recorded SHA. No
claims of new real-world photographs or tailor acceptance.

## Nov 3 continued — real Chromium selector failure and fix
- Exact prior head `095cdef0`: all source/unit/quality/eval/release/build gates
  **passed**, and real `verify-photo-form.cjs` **passed** across 390/768/1440
  for tucked, pleated and wide + both striped trouser legs and protected regions.
- `Deep Engine — Non-3D QA` run **41682956453 FAILED** later at
  `scripts/verify-photo-craft.cjs:59`. The existing direct-child locator
  `.newDesignerPhoto>.newDesignerPhotoApproximation` became ambiguous because
  the new truthful construction note reused that paragraph class. The
  photographed model/pixel proof was not the failed assertion.
- Fixed by placing the construction notice as an inline
  `data-photo-construction-mismatch` span in the **existing singular** preview
  disclaimer, keeping all real fabrication limits visible without changing
  colour/geometry or weakening selectors.
- Added a source regression assertion against duplicate preview-disclaimer
  paragraphs and a real Chromium assertion that the untucked, selected
  straight-hem cut discloses its mismatch with the photographed curved hem at
  390/768/1440 widths.
- **Fresh exact-head CI required** after selector fix and new Chromium guard;
  preceding green test steps do not certify the new commit.

## November 3 — printed-caption contamination in photo fabrics
- Visual review of the 1440px photographic Studio artifact showed faint
  horizontal letter-like contamination on the dark "Black - Jute Feel" shirt.
  Checked the actual source images `public/fabrics/plain-60-07.webp`,
  `plain-60-01.webp`, `plain-60-09.webp`, and `plain-60-12.webp`:
  the supplier/reference images themselves contain printed fabric names.
- Source of contamination: `scripts/build-fabric-render-assets.mjs`
  previously sampled a central-square crop from **18% through at most 50%**
  of source image height. Text near the middle of source images could leak
  into the generated tiles as a false woven band.
- New pure `photoFabricCaptionSafeCrop` preserves the existing square crop
  size and horizontal alignment but moves its top edge to **4%**, keeping the
  entire crop inside the upper **38%** of the image. It rejects malformed
  source dimensions. The generator now uses this helper and declares
  `fabric-tile-v3-caption-safe` so its output can be distinguished from
  older renders. This is a **visual photographic sampling decision**, not a
  physical-repeat or vendor colour verification.
- New dedicated tests cover portrait/wide dimensions, deterministic
  coordinates, malformed dimensions, script wiring and preservation of
  approximate-vs-measured physical scale classification.
- The other independently running Fabric Intelligence branch does not
  modify this generator or new test/helper paths at this checkpoint.
- **Evidence gate:** inspect regenerated black and green studio textures for
  printed-name remnants in the actual 390/768/1440 Chromium artifact.
  Re-run all exact-head CI jobs; old green proof remains evidence only for
  the old head. No customer-facing production or tailors' physical
  acceptance is asserted.
