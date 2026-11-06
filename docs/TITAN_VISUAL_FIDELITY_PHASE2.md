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

## November 5 — button material and tucked construction preview truth

- Original photographed buttons are not reconstructed by canvas. A legacy `Mother-of-Pearl` selection or v2-only `corozo` option now yields `shirt.button` as a specification-only mismatch; the saved spec and original pixels do not change.
- Alternative tucked `shirt_length_regular` and `straight_flat_hem` options are explicitly disclosed as unreconstructed behind the waistband, not claimed as photographed shape.
- Added positive/negative unit regressions and Chromium customer-control selection, fixed-photo pixel invariance and screenshot capture at **390/768/1440px**. No new source images, generated model, physical measurement or paid render calls.
- Prior head `3b72a93fb1636a2dc0f08e37e4368ecddc22acf9` had green full CI #41699895439 and Studio QA #41699895143. These older runs **do not verify the new commit**; exact-head CI/browser artifacts and screenshot review are required. Keep the PR draft; no merge/deploy.

## November 5 continuation — wide-leg Compare source photo provenance

- Discovered a customer-facing comparison defect: the untucked wide-leg deterministic preview uses the canonical pleated photo for the shirt/background and the canonical `studio-wide.webp` photo for trousers, but `Compare` overlaid the unrelated pleated source photograph. A customer could mistake the straight-leg original for the original source of the displayed wide trousers.
- The existing `Compare` image now selects the actual `template.src` (wide/pleated/tucked as appropriate). In wide mode its alt text, on-photo SOURCE label and existing disclaimer explicitly disclose that the *shirt* of the instant preview comes from a separate pleated source photo; no fabricated combined photograph is claimed.
- Added source-level regression and an actual Chromium UI exercise at 390, 768 and 1440px: select the real wide-leg trouser control, click Compare, assert raw wide source image URL, accessible provenance, on-image source status, zero horizontal overflow, save `wide-source-compared-<width>.png`, and return to the design view.
- This changes **only the reference comparison overlay**, not compositor texture, garment geometry, original/canonical photographs, original model identity or physical fabric evidence. The pre-existing photo accuracy gaps remain. All current-head CI and visual evidence must be freshly verified; prior-head CI does not certify this change. Keep DRAFT; no merge/deploy.

## November 5 — contact-dock overlap: photo-local readability correction

- Exact prior head `8ca76594f9c292cf4a18462be75bbcd79dde4008`: Full CI #42017698984 and Studio QA #42017699423 both **completed SUCCESS** with genuine 390/768/1440 Chromium evidence and no paid render calls; Studio artifact #13409824375 was inspected. Those results apply only to the earlier head.
- Source screenshot inspection confirmed that the fixed global contact dock could cover the detailed `Photographic construction limits` text located *below* the photograph, particularly on tablet/desktop widths. The on-photo `CUTS APPROX.` status was visible but the full detail wasn't reliably legible.
- Moved the **single** detailed construction status into the existing `PhotoOutfitPreview` upper introductory region, before the source photo, with a readable neutral highlight and live screen-reader status. Kept general pattern/fit calibration disclaimer below, preventing duplicate warning nodes. No global contact UI, stylesheet, source image, canvas compositor, garment shape, fabric truth or customer spec changed.
- Added source contract and real Chromium per-viewport regression that scrolls the notice into view, checks a visible nonzero bounding box and no geometric intersection with the fixed contact dock, saves `construction-notice-readable-{390,768,1440}.png`, and retains pixel-invariance assertions.
- This is **visual readability only**; it does not imply true reconstructed cuffs, buttons, plackets or body fit. Fresh current-head QA, screenshots and CI required; **draft** PR, no merge or Vercel deployment.

## November 5 — hidden banner regression repair (CI failure)

- The previous current-head `503a2be9923665a62f744454b19cb1f3f7000ada` failed both exact-head browser jobs after all six npm quality/release/build gates passed: [Full CI #42020536280](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/42020536280) and [Studio QA #42020536153](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/42020536153). Both log the same Playwright timeout at `scripts/verify-photo-form.cjs:67`: the construction notice rendered but was hidden by the existing `.newDesignerPhotoIntroCompact p{display:none!important}` rule in `designer-light.css`.
- Fixed the **actual visibility defect**, not the test: the sole `role=status` construction-limits notice now renders as a standalone `div` directly inside `.newDesignerPhoto`, immediately below the compact intro and *above the photograph*. The banner retains the actual selected unsupported construction labels, original model identity and no new physical claims.
- Strengthened unit regression to verify it is a non-paragraph, outside the compact intro's CSS hiding rule, and browser regression now selects the direct-child warning. Its bounding-rectangle non-overlap test against `.floatingContactDock` still runs at 390/768/1440px, with screenshots. No global CSS, contact widget, image asset, compositor, masks, stock, measurements, or renderer physics were changed.
- Fresh exact-head CI/browser screenshots required after this corrective commit. Do not claim the prior failed head passed or merge/deploy.

## November 6 — customer preview state / rapid fabric switching

- `PhotoOutfitPreview` now hides the old canvas while another fabric image is pending (`ready=false`) and marks the stage busy. A failed new render must not leave an old outfit visibly posing as the new design.
- A design signature change closes any previous `Compare` source photo. Source comparison now requires a ready instant preview, and photoreal versus source controls explicitly switch modes, preventing source images from covering a photoreal render.
- New source regressions and actual customer-control Chromium scenario at 390, 768, 1440px: delay an unseen fabric photo, select it with Compare open, immediately switch back, assert no old-canvas flash/source overlay, correct selected fabric, stable final pixels and no horizontal overflow.
- Scope: `src/components/PhotoOutfitPreview.tsx`, `tests/photo-preview-fidelity.test.ts`, `scripts/verify-photo-form.cjs`, this checkpoint. Existing photographed model `linen-earth-studio-model-v1`, source photographs, crop/textile rules, spec, inventory, measurements and native 3D remain unchanged.
- Browser regression is authored but not yet verified. Require new exact-head Full CI, Non-3D Studio QA, screenshot artifact inspection and all six npm release gates. Do not carry forward prior `6d27577` green results. DRAFT only, no merge/deploy or claimed physical approval.

## November 6 continued — compare/export provenance truth

- Confirmed a customer-visible mismatch: while a raw original photo was on-screen in Compare, Save could export the selected canvas, not the displayed image; a customer could also lock the design while looking at the source reference. Source comparison is for visual inspection only, not a design output.
- `PhotoOutfitPreview` now disables Save, initial Lock final design and Final photoreal while Compare is active. The Save label says `Show design to save`; clicking `Show design` restores normal selected-design actions. No behaviour change to deterministic draw or approved photoreal export.
- Add pure source contracts and real Chromium at 390/768/1440 to check disabled compare Save/lock, visible wide-trouser source provenance, and restored Save on return to the selected preview.
- Preserve original `linen-earth-studio-model-v1`, image files, all physical-fabric uncertainties, saved specs, compositor masks and textile scaling. No other modules touched.
- Full CI and Studio QA must be rechecked at exact new head after these commits; any previous pass belongs to its own commit only. Screenshots must be reviewed before merge; PR remains DRAFT and no deployment.

## November 6 continuation — make compared source photograph truth immediately visible

- Before this change, wide-source provenance appeared below the photo in the general approximation paragraph where the fixed contact dock could cover it, while selected construction mismatch text remained displayed above the original source photo. This could imply selected construction was actually present in the original image.
- In `PhotoOutfitPreview`, Compare now shows one visible direct-child ORIGINAL SOURCE warning above the canvas for both the standard/tucked and wide templates. The wide notice identifies the two distinct source photographs: wide trousers from `studio-wide.webp`, shirt from the pleated template. Selected cut-mismatch notices show only on the selected design preview, not on the original source.
- The lower approximation text remains for general calibration/fit uncertainty; duplicated wide-source provenance was removed from that lower paragraph. The photograph and compositor masks are unchanged.
- `tests/photo-preview-fidelity.test.ts` pins the source warning placement, uniqueness and selected-cut separation. `scripts/verify-photo-form.cjs` exercises Compare/Show design for studio and wide sources at 390/768/1440px, captures `studio-source-compared-<width>.png`, checks wide provenance is above the photograph and does not overlap the contact dock, and requires source-mode construction warnings to be absent.
- Required exact-head gates: npm quality, test, engine, preview performance, release check, build, plus Full CI/Studio QA and artifact inspection. DO NOT use earlier cancelled CI runs as passing evidence. Original model `linen-earth-studio-model-v1`, physical evidence status, garment geometry and saved specs unchanged. PR remains DRAFT; no merge/deploy.

## November 6 continuation — boundary QA belongs only to the selected instant preview

- The `Boundary QA` switch previously allowed photographic garment clip outlines to sit on top of a raw original source Compare image, or a reviewed photoreal display. Those contours describe the deterministic Canvas masks, not unverified source-photo anatomy or approved 3D geometry.
- `PhotoOutfitPreview` now renders those outlines only while the selected deterministic Canvas is ready and neither Compare nor photoreal image is displayed. The QA toggle cannot be activated in an unsuitable view; on returning to the selected design, a previously enabled QA outline resumes only over its own Canvas.
- Source regression verifies the conditional and the disabled/pressed control states. The real Chromium `verify-photo-form` suite opens Boundary QA for the wide-trouser design at 390/768/1440px, switches to Compare, requires zero source-photo outlines and disabled boundary control, then returns to the selected design, verifies outlines restore, and hides them. Existing source provenance, no-paid-call and screenshot checks remain.
- Scope remains strictly `PhotoOutfitPreview`, its source tests, photo-form browser script and this checkpoint. Original `linen-earth-studio-model-v1` photographs, textile calibration/provenance, specs and native geometry unchanged.
- These are implementation changes requiring fresh exact-head npm quality/test/engine/preview-performance/release/build, responsive Studio QA, screenshot review, and CI outcomes before any approval. Keep PR #886 DRAFT, no merge/deploy or physical reconstruction claim.

## November 6 continued — Zoom Fit boundary transform alignment

- Found a preview geometry alignment defect: the existing `.newDesignerPhotoStage.inspectFit canvas` CSS scales the model by 1.42 around 50% / 35%, but `.newDesignerBoundaryQa` outlines originally remained at the unzoomed 1.0 transform. This made selected QA seam contours visually detach from the zoomed garment.
- Added the exact 1.42/1.0 transform, 50%/35% origin and 0.28s transition to the boundary SVG inside `PhotoOutfitPreview`, matching the existing canvas behavior without changing global CSS or source masks. The overlay remains hidden over raw original Compare and photoreal images.
- Focused source regression checks transform parity. Actual Chromium at 390, 768 and 1440px selects wide trousers, enables boundary QA, zooms, compares computed browser canvas/SVG transforms and transform origins, restores full view, and checks source-Compare isolation/restored selected QA behavior. No invented physical geometry, new model or fabric claim.
- Changed only PhotoOutfitPreview, dedicated fidelity tests, verify-photo-form browser script, and this checkpoint. Full exact-head quality/tests/engine/performance/release/build and both GitHub browser workflows must finish green; review screenshot artifact for independent visual acceptance. Keep DRAFT; no merge/deploy.

## November 6 continuation — reset new-look zoom/QA and accessible displayed image

- Audit of `PhotoOutfitPreview` found that changing the design signature reset Compare and the final render but left `inspectFit` and `showBoundaries` active. A new shirt/trouser or cut could therefore open cropped at 1.42x with the previous diagnostic QA overlay enabled. The new-look layout-effect now resets both to a neutral full-frame, outline-free view, while the intentional Compare → Show design transition within the *same* look retains the user's QA choices.
- Source view accessibility also previously kept the behind-image Canvas `role=img` announced for selected fabrics while the untouched original or photoreal image was displayed. Its `aria-hidden` now follows actual visible mode/readiness, without changing the canvas pixels or canonical photographs.
- Added dedicated source tests and actual Chromium across 390/768/1440px: enable zoom and QA on a wide selected design, open Compare, switch to a different shirt with an uncached delayed image, verify zoom/QA reset and stale photo hidden, then return to the chosen look with stable pixels. Compare source must mark the covered selected canvas as aria-hidden and restore it when Show design is selected.
- Only `PhotoOutfitPreview.tsx`, `tests/photo-preview-fidelity.test.ts`, `scripts/verify-photo-form.cjs`, and this checkpoint modified. Preserves `linen-earth-studio-model-v1`, source photos, physical material evidence, saved garment specs, masks, 3D and inventory.
- Required release evidence: green exact-head Full CI and Studio QA, all six npm gates, 390/768/1440 Chromium screenshot outputs inspected. Do not credit earlier cancelled/nonmatching-head runs. Keep PR #886 DRAFT; no merge/deploy or physical acceptance.

## November 6 continuation — live preview rendering status truth

- The photo status badge previously claimed `FRONT / STUDIO MODEL` or `CUTS APPROX.` even when the newly selected fabric was still loading or its source image failed. The canvas was properly hidden, but the badge looked like successful visual proof of the selected garment.
- `PhotoOutfitPreview` now shows `PREPARING SELECTED LOOK` until a matching committed Canvas is ready, `PREVIEW UNAVAILABLE` when the render fails, and source/cuts/photoreal tags only after the selected preview has loaded. Loading/error body messages and the original photo sources remain unchanged.
- Added focused source regression for state ordering and actual 390/768/1440 browser assertions during uncached delayed fabric switching. Pending state cannot claim a completed photographed look, and previous pixels remain hidden.
- Scoped changes exclusively to the PhotoOutfitPreview component, its regression tests, the photo-form Chromium QA and this checkpoint. The original model `linen-earth-studio-model-v1`, masks, physical fabric facts, signed off cuts, saved specs and 3D assets remain untouched.
- Require fresh exact-head Full CI and Non-3D Studio QA, all six npm gates and screenshot artifact review before approval. Keep PR #886 DRAFT; no merge/deploy.

## November 6 continuation — source photo caption matches the displayed image

- Both exact-head workflows **passed** on prior checkpoint `1d70ef8e8e73b1913e437bfd4654086dfb6a46a8`: Full CI run #42190229268 and Non-3D Studio QA #42190229148. The new responsive Studio QA artifact was reviewed (390/768/1440 source and rapid-switch examples), with no browser error/paid render claim. Those passing results do not certify new commits.
- Identified a further customer-facing provenance error in the reviewed source screenshot: the fixed original comparison had an `Instant preview` pattern calibration caption beneath it, wrongly describing the original photograph as the selected outfit. The original source and selected look must have different captions.
- The existing single `.newDesignerPhotoApproximation` paragraph now uses `data-photo-caption="source"` and explicit original-source wording during Compare. Its existing actual instant-preview textile/physical-verification disclaimer appears only for the selected deterministic canvas (`data-photo-caption="instant"`); the paragraph is absent during loading and error states. The pre-photo source provenance banner remains above the photograph.
- Dedicated source tests preserve the unique caption and enforce mode-specific wording. Real Chromium QA at 390/768/1440 checks both tucked/standard and wide original Compare, selected-design return, and no complete-image caption during a delayed uncached fabric selection. The harness records `sourceCaptionModeVerified`.
- Only `src/components/PhotoOutfitPreview.tsx`, `tests/photo-preview-fidelity.test.ts`, `scripts/verify-photo-form.cjs` and this checkpoint have changed. Original `linen-earth-studio-model-v1`, all photographs, textile evidence, geometry, spec and inventory remain unchanged.
- Require **new exact-head** npm quality/test/engine/preview-performance/release/build and CI/Studio QA browser screenshot review. PR #886 stays DRAFT; no merge/deploy or physical signoff.

## November 6 continuation — source-mode header and selected fabric summary

- The unchanged source-photo comparison continued to show the heading `LIVE PREVIEW` and the selected shirt and trouser names under generic `SHIRT` / `TROUSER` labels, which could imply that the original photographed garment was wearing the customer's chosen fabrics.
- In `PhotoOutfitPreview`, when comparing a ready original source image, the header now says `SOURCE REFERENCE` and the names below it are explicitly labelled `SELECTED SHIRT` and `SELECTED TROUSER` (selection metadata, not proof of what is in the original photo). On returning to the actual selected deterministic preview or reviewed photoreal image, the familiar `LIVE PREVIEW` and `SHIRT` / `TROUSER` labels return.
- The existing pre-photo provenance warning, source-only lower caption, source mode save guard, model photo and pattern calibration disclaimers remain unchanged. No alteration to source image, mask or wardrobe reconstruction.
- Focused source contract tests and actual Chromium assertions check standard and wide source Compare, then the selected image, at each required 390/768/1440px. `sourceHeaderAndFabricLabelsVerified` is recorded in the browser summary.
- Only `PhotoOutfitPreview.tsx`, dedicated photo fidelity tests, `verify-photo-form.cjs` and this checkpoint have changed. Run all six npm release checks and exact-head Full CI plus Studio QA; inspect new screenshot artifacts. PR #886 DRAFT, no merge/deploy or physical fit approval.

## November 6 continuation — physical repeat and fit disclaimer readable on mobile

- Previous exact-head Full CI #42193623080 and Studio QA #42193623245 both **passed** on `da1a9efb7e564005c499959cc60649fc45e9ea8e`; the new Studio QA photographic artifact was examined. Its 390px screenshots demonstrate the bottom instant/source disclaimer can fall underneath the long source photo into the fixed contact/docked navigation region. This verification belongs only to the preceding SHA.
- Moved the existing single mode-aware `.newDesignerPhotoApproximation` caption **above** the photo stage, after visible construction/source warnings, and applied a scoped inline 12px readable font, 1.6 line height, padded warm background, accent border and safe word wrapping. Source Compare retains its honest original-source caption; the selected instant Canvas retains exact current pattern-scale and fit/drape uncertainty language. Neither caption is shown while loading/error or on reviewed photoreal display.
- Actual browser at 390/768/1440 verifies the complete scale/fit caption exists before the image (bounding rectangles), has computed font >=12px, includes the physical fit/drape caveat, does not collide with the floating contact dock, and records `physical-disclosure-readable-<width>.png` plus `physicalDisclaimerUnobstructed=true`. The source comparison caption is also required above the original photo. Dedicated source tests enforce one unique caption and its before-image placement.
- Scope: PhotoOutfitPreview component, tests/photo-preview-fidelity.test.ts, scripts/verify-photo-form.cjs, this checkpoint only. Preserve existing source/model `linen-earth-studio-model-v1`, physical provenance values, design specs, garment masks and geometry, inventory, 3D and security. No new claims of measured fabric repeat or fit.
- Require fresh exact-head npm quality/test/eval:engine/eval:preview-performance/release:check/build plus Full CI and Non-3D Studio QA with actual screenshot inspection. PR #886 remains DRAFT; no merge/deploy.

## November 6 continuation — readable selected fabric labels at compact widths

- Both workflows **passed on previous checkpoint** `2e77ccabd6ebb75ee5a70ad66ef46fcf71aebfbd`: Full CI #42195991206 and Non-3D Studio QA #42195990889. The Full CI `preview-lifecycle-browser` artifact was opened and its 390/768/1440 `physical-disclosure-readable` screenshots and JSON proof examined. Physical disclaimer is now above the photo, visible at 12px and not overlapping the floating contact dock. Previous green evidence is not a passing claim for this new commit.
- A further reproducible mobile readability problem was visible in the 390px screenshot: shared compact CSS sets garment summary labels to 6px and selected fabric names to 9px. Customers could not clearly read which shirt/trouser fabrics were selected.
- Without editing the shared stylesheet, the existing `span`/`strong` summary DOM now wraps its actual label and name text in scoped child type at **10px labels / 13px names**, overrides strong's nowrap/clipping on these two entries only, and keeps the full selected fabric name as the `title`. This does not change selected option IDs, photo pixels, composition, source identity or real-fabric facts.
- Dedicated source regressions require two labels and names with the legible child font styles. Real Chromium checks at 390/768/1440 measure computed fonts, ensure the full names are not horizontally clipped, confirm the visible text matches the full-name title, and capture `fabric-summary-readable-<width>.png`. Browser summary records `fabricSummaryReadable`.
- Scope: `src/components/PhotoOutfitPreview.tsx`, `tests/photo-preview-fidelity.test.ts`, `scripts/verify-photo-form.cjs`, this checkpoint. All six npm release gates and fresh **exact-head** Full CI and Non-3D Studio QA plus screenshot review remain required. Keep PR #886 draft; no merge/deploy or unsupported photo geometry claims.

## November 6 continuation — nonblank visual evidence for responsive fabric summary

- **Exact-head prior verification**: Full CI #42199154000 and Non-3D Studio QA #42199153995 both completed SUCCESS on `9e86447d8099aa6e993b3c568fdf8da6d5bf7156`; all six npm release checks, SQL stock regressions and existing browser QA passed. The Studio QA `photo-form/summary.json` reported three viewport successes (`fabricSummaryReadable` 390/768/1440), no browser errors and no paid render calls.
- **Manual artifact inspection uncovered an evidence gap despite green checks**: `fabric-summary-readable-390.png` and `-768.png` showed the 10px labels/13px full fabric names, but the standalone element screenshot `fabric-summary-readable-1440.png` was pure white (only one RGB colour). The same 1440 photo-card screenshot showed both shirt/trouser names and buttons correctly drawn; this is an element capture/evidence defect, not proof of a missing garment selection or a failing customer view. Do not claim the 1440 prior standalone screenshot was visually validated.
- Updated the dedicated Chromium `verify-photo-form.cjs` to capture the actually painted full photo card first, compute the child summary region inside it, crop with the **existing direct sharp dependency** and write the standalone `fabric-summary-readable-<width>.png`. Raw cropped pixels are tested for >100 non-white/ink pixels so empty evidence cannot pass even when DOM text and font computed styles look valid. No changes to the actual application UI, fabric data, photos or physical calibration.
- Added a source test enforcing the full-card crop and nonblank evidence invariant and disallowing the prior unreliable element screenshot path. The real 390/768/1440 browser checks remain authoritative for actual DOM type, unclipped full names, no console errors, no paid APIs and responsive screenshots.
- Scope: dedicated `scripts/verify-photo-form.cjs`, `tests/photo-preview-fidelity.test.ts` and this checkpoint only. Fresh exact-head Full CI and Studio QA browser evidence, new nonblank image inspection and six npm checks required before signoff. Keep PR #886 DRAFT; no merge, deploy or fabricated physical confirmation.

## November 6 continuation — solid colours must not imply verified physical motif scale

- Previous exact-head `76e0ef6550e671e13a92f747b4d9c7ff30b73ccb` was **green**: Full CI #42201823736 and Non-3D Studio QA #42201823640. Inspected both final browser artifacts and `photo-form/summary.json` for 390/768/1440. Cropped fabric-summary screenshots now contain real text and buttons at **all three widths**, including nonblank 1440 (531×94px; 922 distinct colours, 3,280 dark/ink pixels); browser errors 0, paid calls 0 and no viewport overflow. This evidence is only for that prior SHA.
- **New accuracy defect found in actual screenshot**: Black - Jute Feel shirt and Beige trousers, both catalogue-classified `Solid`, displayed `pattern scale uses reviewed physical evidence plus accepted studio calibration` solely because solid colourways are exempt from motif-repeat calibration in the `previewScaleVerified` boolean. Lack of a visible repeat is not evidence of measured physical calibration.
- Added a deterministic pure `photoPatternScaleDisclosure` in `src/lib/designer/photo-preview-fidelity.ts`: when all visible selected colourways are `Solid`, the instant caption states `no visible motif repeat is recorded for these solid selections`; patterned fabrics retain reviewed-calibration copy only if the applicable physical/studio proof is actually verified, otherwise retain specific approximate-fabric names. The optional visible craft panel participates, and unknown patterns never inherit the solid exemption. Fit/drape verification disclaimer is unchanged.
- Unit tests cover all-solid, mixed stripe, measured repeat, unverified craft panel, missing pattern classification and source-to-UI wiring. Real Chromium at 390/768/1440 selects the actual Black - Jute Feel + Beige outfit, rejects false measured-repeat text, checks accurate solid wording and records `solid-fabric-scale-truthful-<width>.png` and `solidScaleClaimTruthful=true`.
- Scoped changes only to PhotoOutfitPreview, dedicated pure fidelity library, fidelity tests, photo-form Chromium browser QA and this checkpoint. Preserve actual pixels, original model `linen-earth-studio-model-v1`, physical data, garment shapes and other workers' modules. Require six npm release gates plus fresh exact-head Full CI, Studio QA and screenshot inspection. PR #886 DRAFT; no merge/deploy.

### Quality-gate repair: keep approved physical-repeat caption in UI source

- New material-copy commit `9c3cb84b6de4861f9a68e93ae303c6ca60e34f43` failed both exact-head workflows at `npm run quality` before browser tests. Exact GitHub logs show: `Customer photo calibration regression: preview missing accepted studio calibration`. Root cause: moving the existing approved caption text entirely to `photo-preview-fidelity.ts` violated the existing source-contract test in `scripts/quality-check.mjs`, which requires the text in `PhotoOutfitPreview.tsx`. This was a genuine integration failure, not a physical-evidence gap.
- The pure disclosure helper now takes the approved pattern-calibration caption as an explicit argument **from** `PhotoOutfitPreview.tsx`, retaining the exact expected source text and its valid verified-pattern branch. For all-solid colourways the helper still outputs the no-recorded-motif disclaimer, never the physical-proof claim. Unit tests updated to exercise both branches with that exact UI string.
- No quality gates loosened, deleted, or bypassed. Only pure fidelity helper, preview component, corresponding tests and checkpoint changed. Fresh exact-head quality/test/engine/performance/release/build and responsive browser QA required. PR stays DRAFT, no merge/deploy.

## November 6 continuation — unobstructed physical-caption screenshot evidence

- Both exact-head workflows PASSED on previous `9a65bd68178ae4f3fa8055f3b9dc7b51f98b7a68`: Full CI #42216850204 and Non-3D Studio QA #42216850080. Downloaded actual Studio QA screenshot archive and inspected all 390/768/1440 `solid-fabric-scale-truthful` captures. Browser summary reports 3/3 viewports, zero overflow, zero paid calls and no JavaScript errors. Solid no-motif wording correctly appears and prior all-solid false proof claim is absent.
- **New QA coverage gap:** At 1440, `solid-fabric-scale-truthful-1440.png` included the fixed WhatsApp/Instagram/Location dock covering the center of the warning. The actual card contains an accurate caption, but that screenshot could not be treated as readable customer proof. Existing physical-disclaimer geometry QA ran at a different scroll position and did not catch this.
- The dedicated Chromium `verify-photo-form.cjs` now scrolls the physical-pattern disclaimer into the centre of the customer viewport and checks its full bounding rectangle is within the viewport and does not overlap `.floatingContactDock`, at 390/768/1440. Only after those checks does it capture the `solid-fabric-scale-truthful` screenshot. Dedicated source regression requires the scroll/viewport/non-overlap checks and `solidScaleNoteUnobstructed=true` per viewport.
- This work changes only the photographic browser QA, focused photo-preview source test and this checkpoint; no customer design pixels, fixed dock, CSS, garment geometry, model photographs, fabric data or other workers' files changed. Recheck six npm gates, Full CI, Non-3D Studio QA and screenshot evidence on the new exact SHA; do not claim physical acceptability. PR #886 draft, no merge or deploy.

## November 6 continuation — truthful source comparison heading

- The prior exact-head `a17f92a72911a93ac437ac22b23ffa66646b3ab1` is **green**: Full CI #42230235545 and Non-3D Studio QA #42230235486. Inspected the actual Studio QA `photo-form/summary.json` and screenshot images at 390/768/1440: all have `solidScaleNoteUnobstructed=true`, `physicalDisclaimerUnobstructed=true`, source mode and pixel-protection regressions passed; 0 browser errors, 0 paid calls and 0 overflow. All `solid-fabric-scale-truthful` screenshots show unobstructed text.
- A customer-facing title inconsistency remained in Source Compare: the top label said `SOURCE REFERENCE`, but the large heading still said `Your look.` while the unmodified studio source photo was visible. This made it easier to confuse the original photographic source with the selected garment.
- `PhotoOutfitPreview.tsx` now switches `#designerPhotoTitle` to `Studio source.` exclusively while the unchanged original source photo is ready and visible; `Your look.` returns immediately on Show design, while loading or showing the actual photoreal/instant garment. The fixed source identity, fabric, canvas, construction and saved design remain unchanged.
- Dedicated source contracts and actual Chromium 390/768/1440 browser tests check source/selected header state and photo captions, including wide-source Compare. A `sourceHeadingModeVerified` flag records the browser proof. Only preview component, dedicated photo fidelity test, photo-form browser script and checkpoint changed.
- Require fresh exact-head npm quality, test, engine, performance, release, build and both Full CI and Non-3D Studio QA with screenshot review. PR #886 remains DRAFT; no merge, deployment or physical calibration signoff.

## November 6 continuation — one source photo provenance panel, no duplicated warnings

- **Prior exact-head validation:** Full CI #42233790696 and Non-3D Studio QA #42233790728 completed SUCCESS at `0bbdcbce44233de2e84fbe4d41a17b67a6d5cb78`. Inspected `preview-lifecycle/photo-form/summary.json`: responsive 390/768/1440 `sourceHeadingModeVerified`, `sourceHeaderAndFabricLabelsVerified`, `sourceCaptionModeVerified`, `physicalDisclaimerUnobstructed`, `wideSourceComparisonVerified` all true; no overflow, browser errors or paid render calls. Review of `studio-source-compared-390.png` independently identified two redundant source warnings stacked above the unchanged photograph.
- **Customer-visible fix:** Compare mode now shows **one** `data-photo-source-comparison` provenance banner before the source photograph. The second `.newDesignerPhotoApproximation` source-specific block was removed. The surviving standard warning explicitly identifies the unchanged original; the wide-trouser source warning preserves the separate pleated-shirt versus wide-trouser photo origins and the return-to-selected-design instruction. Source reference heading/badge and selected fabric summaries remain truthful.
- **Fabric-truth guardrail:** The physically qualified scale/fit/drape paragraph now renders exclusively in ready **instant selected-design** mode (`!showOriginal && !showCreativeAi && ready`, `data-photo-caption="instant"`). It remains absent in source Compare, photoreal and loading/error states. This does not change textile calibration, rendered pixels, garment selection, source templates or the locked design.
- Browser QA now verifies zero `.newDesignerPhotoApproximation` paragraphs in Compare and exactly the provenance banner above the source image at 390/768/1440, then restored instant-only caption after Show design. Dedicated source tests enforce uniqueness, conditions and positioning; old source-caption assertions were updated rather than bypassing proof.
- Scope strictly PhotoOutfitPreview, scripts/verify-photo-form.cjs, tests/photo-preview-fidelity.test.ts and this checkpoint. New exact-head Full CI + Non-3D Studio QA with screenshot review required; keep PR #886 DRAFT and do not merge/deploy or imply physical acceptance.

## November 6 continuation — compact photographic actions readable and tappable

- Previous exact-head `210794f0c3143dad8d35c5222dd9af512c2df69e` has green Full CI #42237246435 and Non-3D Studio QA #42237246414. Downloaded actual Studio QA artifact and reviewed 390 and 1440 studio source comparison and 390 wide-trouser original: exactly one upfront original-source banner, correct `Studio source.` title, unchanged original model, no source-caption duplication. Browser summary verifies 390/768/1440 modes, zero console errors and zero paid calls. This green proof belongs to the previous SHA only.
- New usability issue found from the same real mobile screenshot and scoped CSS audit: `.newDesignerPhotoActionsCompact button{...font-size:7px!important}` makes the Preview action labels (Lock, Compare, Save, unlock/render paths) exceptionally small with short tap targets, even after fabric names were made readable. This affects visible controls, not underlying garment images.
- In `PhotoOutfitPreview` all seven conditional action buttons now share a **minimum 44px height** and their actual label text sits in a scoped child `<b>` at **12px / 1.4 line-height** with normal 500 weight and safe wrapping. Using a child `b` deliberately avoids the existing summary `span{font-size:6px!important}` rule; adding an inline button `fontSize` would *not* override stylesheet `!important`. Event handlers, button disabled states, labels, save/lock/review identity and original model are unchanged. No shared stylesheet modifications.
- Dedicated source regressions check seven 44px action shells and seven 12px labels, while retaining the source Compare disabled-Save/Lock assertions. Real Chromium at 390/768/1440 measures the **computed text font** and button rectangles (>=12px, >=44x44px), verifies the action row fits in a customer-scrollable viewport without being obscured by the floating contact dock, and records `compact-actions-readable-<width>.png` viewport crops. Existing complete-card garment evidence stays intact. Browser summary adds `compactActionsReadable=true`.
- Strict scope: PhotoOutfitPreview.tsx, tests/photo-preview-fidelity.test.ts, scripts/verify-photo-form.cjs, this checkpoint only. Require fresh exact-head npm quality, unit, engine, preview perf, release, build, Full CI and Non-3D Studio QA, plus screenshot review. Physical fabric/fit acceptance still blocked. PR #886 remains DRAFT; no merge/deploy.

### Source-contract repair for accessible action label wrappers

- Fresh Studio QA #42241350376 at interim `0e2d11cd65f9b9ce75c31aa798f7118de7d0dab7` failed during `npm test` (not the browser) on photo-preview fidelity test `source comparison cannot silently export or lock a different pictured design`: the test still expected the old direct button child at `disabled={!ready || creativeAiLoading || showOriginal}>{creativeAiLoading ...}`. The new photo action uses the identical `disabled` logic and nested legible `b` label.
- Updated that source assertion to match the unchanged disabled photoreal guard and new `<b style={PHOTO_ACTION_LABEL_STYLE}>` wrapper. Confirmed all four source disabled/aria assertions match the actual component at the latest branch SHA. Seven 44px buttons and seven 12px nested `b` labels are present; shared compact CSS `span`/`button !important` is untouched. No weakening of intended lock/save guard or tests.
- Fresh exact-head Full CI and Studio QA required; compare screenshot and action-button viewport crop still need inspection, and physical fit approval remains pending. PR #886 stays draft; no merge or deploy.
