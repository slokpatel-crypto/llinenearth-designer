# TITAN — photographic Designer Studio accuracy checkpoint

**Branch:** `titan-parallel-visual-accuracy`; original base main `5835a5533281b8306e9bfa1fd9786a30d59c8053`.
Recheck live main before merging. Do not merge or deploy without matching-head green gates.

## Scope and actual changes
- Photographic compositor only; canvas pattern orientation now matches the photograph's measured visual sleeve and trouser axes, rather than mirroring their lean.
- Same-garment panels use one shared fabric scale reference with individual photographed seam pivots. Arbitrary per-leg/sleeve phase offsets were removed. This repairs deterministic pattern alignment at joins; it does **not** establish true real-world repeat or guarantee tailored seam matches.
- Pure unit tests verify rotation sign, seam-pivot phase across scales and 90-degree cloth orientation, and rejection of malformed values. The existing browser photo-form suite now records tucked/untucked photographic screenshots at 390px, 768px and 1440px and compares the actual compositor's solid vs synthetic stripe pattern over the unchanged real model. All API provider calls remain mocked.
- Model identity `linen-earth-studio-model-v1` and photo `/designer/studio-tucked.webp` unchanged. No catalogue loaders, DesignerModule, inventory, stock metadata, Supabase, model geometry, AI models or deployment settings touched.

## Unsupported instant-photo details
- **Collars:** point collar photo geometry only. Spread, cutaway, button-down etc. remain specifications, not redrawn collars.
- **Cuffs and sleeves:** baseline 1-button barrel cuff, photographed sleeve length and armhole only. French/double cuffs, other cuts and lengths remain specifications.
- **Plackets:** photographic visible standard placket only; hidden/fly-front treatments are not actually reconstructed.
- **Shirt fit and tuck:** photographed regular silhouette; separate tucked and untucked templates exist, but selected slim/relaxed cut and full physical tuck handling cannot be claimed from these images.
- **Trousers:** source single-pleat straight and untucked wide-leg photographic templates; flat-front, different pleat counts, rises, waistband construction and hem breaks remain approximate. Tucked wide-leg selections still show tucked straight-leg silhouette.
- **Fabric and buttons:** button material not rebuilt. True pattern repeat, supplier measurements, physical seam matching, wearer fit, drape and four-angle photo accuracy require external evidence and remain unverified.

## Required verification / continuation
Run dedicated tests:
`node --experimental-strip-types --test tests/photo-panel-grain.test.ts tests/customer-designer-preview.test.ts`
and `npm run quality`, `npm test`, `npm run eval:engine`, `npm run eval:preview-performance`, `npm run release:check`, `npm run build`. In pinned CI Chromium run `node scripts/verify-photo-form.cjs` (requires immutable baseline fetched by CI). Inspect screenshots: `dark-tucked-{390,768,1440}.png`, `dark-untucked-{390,768,1440}.png`, `before-after-stripe-{tucked,pleated,wide}.png`. Reject console errors, overflow, body/sleeve pattern dropouts or any protected-region changes. Check latest main, exact-head CI, screenshot artifacts, and changed-file scope before considering merge. No Vercel deploy.

**Current verification:** Browser screenshots and full release gates are **pending** until the matching-head workflow runs; no browser screenshots are yet claimed as visually inspected.

## 2026-11-02 18:55 UTC — verified isolated visual section integrated into main

- **Affected criteria:** T4/J2 photographic deterministic pattern placement and T6/J6 code/browser regression coverage only. This does **not** certify all advertised garment options, true physical textile scale, native Blender geometry, customer/operator production, or full release.
- **Source and ancestry:** original main parent `5835a5533281b8306e9bfa1fd9786a30d59c8053`; source PR #864 exact reviewed head `3e8946c10b34a9ad5a805d1d7100901bdecc4a76` (12 source commits, exactly nine affected files, no upstream main drift at merge). Source branch `titan-parallel-visual-accuracy`.
- **Result:** expected-head guarded squash merge of PR #864 produced main `b952981b92d168921041ef82c60cc552a9139bbc`. Verified live main equals result after merge. The main `vercel.json` at the original parent explicitly set `git.deploymentEnabled=false`; the nine-file PR diff did not touch this configuration.
- **Matching-source-SHA PASS:** Full CI #41501902039 at `3e8946c10b34a9ad5a805d1d7100901bdecc4a76`: quality, full Node tests, engine, preview-performance, release check, build, synthetic authenticated HTTP, Chromium preview lifecycle, and disposable PostgreSQL all SUCCESS. Independent Non-3D QA #41501902106 at the same SHA: immutable original Studio photo, 390/768/1440 responsive Studio and actual photographic browser checks SUCCESS. Evidence artifact `linen-earth-deep-engine-non3d-evidence` ID `13169597201` (SHA-256 `1add588ed87a898ae740082ad3f229e31d2af4b6f56c7f8f488f92727f7056d7`).
- **Browser evidence review:** downloaded the exact-head Non-3D artifact; inspected dark tucked/untucked screenshots at 390, 768, 1440 and stripe comparison screenshots for tucked, pleated, wide. Screenshots visibly preserve original studio model and present the garment previews; `photo-form/summary.json` reports `errors:[]`, `protectedChanges:0`, `wrongWaistPixels:0`, no viewport overflow and `paidCalls:0`. This is browser/code evidence, **not** an independent tailor or physical cloth signoff.
- **Post-merge matching-main-SHA CI:** PENDING; source green does not automatically certify the squash result. The documentation-only checkpoint commit and its own CI are likewise PENDING until their exact SHA runs.
- **BLOCKED/PENDING:** true measured pattern repeat and drape, unimplemented photographic collar/cuff/placket/fit variations, native four-angle Blender preflight, real stock, authenticated owner/customer/operator end-to-end acceptance, physical devices, tailor fit, five beta testers, ten actual deliveries, staging and owner launch signoff.
- **Next 30–40-minute slice:** verify current PR #860 at its latest head and inspect real browser failures; repair the production Designer catalogue fail-closed path without losing known-ID internal 3D prototype recipe continuity. Require new exact-head Full CI and Non-3D before isolated integration; do not deploy.
