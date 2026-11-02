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
