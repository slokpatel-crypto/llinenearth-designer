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

## November 3 — raw-swatch fallback parity follow-up

- The generated-asset path was corrected at `3dcf077e`, but the client-side
  `PhotoOutfitPreview.swatchTile` fallback for plain swatches still used a
  centre-biased 22–44% source crop. This could reintroduce supplier printed
  captions when generated fabric tiles are unavailable or fail to load.
- The plain-fabric fallback now uses exactly the same pure
  `photoFabricCaptionSafeCrop(image.width,image.height)` geometry as the
  build-time generator. Direction-preserving striped tile cropping is unchanged.
- Added regression assertions proving the fallback cannot silently revert to
  the old `plain ? .22` crop. No stock/supplier data, photo-model identity,
  physical-scale provenance, measurements or fabrication claims changed.
- **Review gate:** rebuild actual generated tiles and inspect black, offwhite,
  sky-blue and light-green source garments at 390/768/1440 widths. Verify
  browser source-fallback behaviour alongside real path where possible.
- New exact-head CI remains mandatory; no claim that preceding runs on
  `3dcf077e` verify these additional fallback changes. Keep draft, do not
  merge or deploy.

## November 3 — browser-sized synthetic swatch regression (CI fix)

- Exact head `322e9e7` **FAILED both Full CI #41688002752 and
  Deep Engine Non-3D QA #41688002755** on `verify-photo-form.cjs` after the
  quality, unit, engine, preview-performance, release and build gates passed.
  GitHub logs show `RangeError: Expected swatch image dimensions of at least
  150px` in `photoFabricCaptionSafeCrop` called by `swatchTile`.
- Root cause is concrete: the real-browser photo-form regression intentionally
  builds a **64×64 solid synthetic control** before exercising full-size
  320×320 stripe tiles. Those synthetic samples are not production supplier
  catalogue images. A build-time 150px source-asset check was inadvertently
  duplicated in a general-purpose browser crop helper.
- Fixed the pure crop helper to accept square or rectangular **32px+ valid
  image/QA tiles**, keeping the same upper 4–36% caption-safe geometry. It
  still rejects malformed/zero/unready source dimensions. The catalogue
  generator retains its independent **150px minimum source** enforcement, so
  tiny supplier source images do not enter generated production assets.
- Added focused regression coverage for the exact 64×64 synthetic case, 96px
  and 128px tiles, invalid 31px cases, deterministic integer crop coordinates,
  upper-cloth-only crop and the preserved 150px catalogue source gate.
- No physical scale/provenance upgrade, original model change, texture
  falsification, paid rendering dependency, production deploy or merge.
- **Next:** verify both fresh exact-head GitHub CI runs, including real
  390/768/1440 photographic checks; save/check artifacts before considering
  independent visual approval. Older failed/green runs do not certify the fix.

## November 3 — expanded real-browser construction coverage

- The previous exact head `47080752a4c32297023caf18469c3de0267d3317`
  passed **both** full CI run `41689972498` and Studio/Non-3D QA run
  `41689972183`, including original-source photo and craft QA.
- Next acceptance gap: pure tests covered advanced `StyleSpecV2` mismatch
  reporting, but the actual customer UI only tested the untucked shirt hem.
- `scripts/verify-photo-form.cjs` now exercises *real* Studio controls at
  **390/768/1440px**: expand Precision tailoring, select half sleeves and
  double-forward trouser pleats; verify both selected values persist, the
  photographic-mismatch notice reports **sleeve length** and **trouser
  pleats**, there is no horizontal overflow, and save screenshot evidence at
  each width.
- The 1440px run additionally selects a Mandarin collar, French cuff and
  hidden/fly-front placket through the customer's existing cut selectors.
  Their unsupported photographic geometry must be disclosed, never silently
  attributed to the unchanged original model; save a source screenshot.
- Source test requires the real-browser harness to retain these UI cases.
- No new garment geometry, photo/model replacement, added AI calls, physical
  measurement assumptions, saved-design rewrites, stock/catalogue changes or
  Vercel deployment. Run **new exact-head** source, browser, build and release
  gates; keep the PR draft pending independent review.

## November 3 — pixel-invariance QA for specification-only cuts

- Retrieved the exact-head green Studio QA artifact for `f36147a`.
  `photo-form/summary.json` confirms advanced construction warnings at
  **390, 768, 1440px** and the 1440px collar/cuff/placket warning, with
  `errors:[]`, no paid AI calls, no responsive overflow, zero protected-pixel
  changes and zero waistband spill for tucked, pleated and wide photos.
- Reviewed `advanced-construction-disclosed-390.png`: the source full-sleeve
  photographed garment remains visibly intact while the customer-selected
  half sleeve/double pleat are disclosed as unrendered construction.
- Added another **actual pixel acceptance gate**, not just text matching:
  `actualPhotoPixelHash` samples real Studio canvas RGB pixels before and
  after selecting half sleeves and double-forward pleats. The test now
  asserts that versioned spec-only changes do **not** alter the trusted fixed
  photograph, and records `specOnlyPhotoPixelsUnchanged:true` for all three
  responsive widths. Browser proof uses actual customer selectors and real
  pixels, without invoking AI.
- Focused test protects the existence of this browser pixel-invariance
  assertion. This is a guard against *false* visual accuracy, not a claim
  that alternative sleeves/pleats have been reconstructed.
- **Next:** exact-head CI, real Chromium and screenshot inspection required
  after the new tests. Do not mark the new head verified from preceding green
  SHA or merge/deploy without independent review.

## November 3 — green exact-head pixel proof and on-photo warning visibility

- Both exact-head checks for `f1cb20430ff0608b827428ee6a1261bd0d9731b6` completed **SUCCESS**:
  Full CI run **41695949575** and Studio/Non-3D run **41695949445**.
- Downloaded Studio artifact **13261042443**. In its real Chromium
  `photo-form/summary.json`, `specOnlyPhotoPixelsUnchanged:true` at
  **390/768/1440px**; zero overflow, page errors, wrong-waist/protected
  pixel changes or paid calls. Tucked, untucked pleated and wide trouser
  photographs each retain both stripe legs. This validates *no spurious
  geometry change* for selected half sleeves/double pleats, not reconstruction.
- Reviewed both `advanced-construction-disclosed-390.png` and
  `collar-cuff-placket-disclosed-1440.png`. Floating contact links can
  overlap the lengthy detailed photo-construction explanation near the
  bottom of a photographed preview; preserve that detailed text for scroll
  and accessibility, but make the status immediately visible on the photo.
- The existing top overlay is now conditionally
  `FRONT / STUDIO MODEL · CUTS APPROX.` when the selected construction
  differs from the fixed source. Exact photographed cuts retain
  `FRONT / STUDIO MODEL`, and a real final photoreal view retains its own
  `PHOTOREAL` label. No shape, image, mask, physical-scale or locked-spec
  changes; no fabric-colour claim is introduced.
- Added a real-browser label assertion at all **390, 768, 1440px** viewports
  and source-contract regressions to prevent removal of the warning. Still
  requires **fresh exact-head** source/unit/CI/photographic browser validation.
  The preceding green head alone cannot approve this UI change.
- Remains a draft PR; do not merge, deploy or claim physical tailoring signoff.
