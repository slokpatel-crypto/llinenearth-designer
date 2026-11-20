# TITAN Worker A — mobile-targeted photographic detail inspection

Base main: `2a73a2e6f119ab4c6f8d8555dfb57230db12fa90`; isolated branch: `work/titan-worker-a-mobile-garment-focus-20261120`.

## User-visible improvement
The existing Designer Studio had only one fixed 1.42x Zoom fit control. Customers
could not inspect shirt collar, sleeves, waist and trouser hem independently
on small screens. Add four named, touch-friendly inspection targets beside
the existing Zoom fit / Boundary QA controls.

The controls move only CSS zoom/transform origin around the *approved* fixed
1024x1536 front studio photo, including the original source and existing
photoreal review image. The diagnostic SVG uses precisely the same scale and
origin as the canvas; therefore a zoom cannot mislabel a seam. Inspection is
local UI state, resets on design selection changes, and never serializes as
a style or measurement field. Label copy explicitly rejects new physical-fit,
seam-matching or garment-construction claims.

## Checks
- `tests/photo-inspection-focus.test.ts`: deterministic focus definitions,
  preserved 1.42x compatibility, source- and overlay-transform parity
  contracts, reset semantics and 44px mobile-target source rules.
- `scripts/verify-photo-form.cjs` in actual pinned Chromium: original real
  model with all four controls at **390/768/1440px**; check pressed state,
  zoom and overlay affine parity, touch-target size and font size, horizontal
  overflow, focus reset. Store `inspected-collar-390.png` and
  `inspected-hem-390.png`; all previous photo-form and real-pattern tests
  remain mandatory.
- Exact-head gates: `npm run quality`, `npm test`,
  `npm run eval:engine`, `npm run eval:preview-performance`,
  `npm run release:check`, `npm run build`, full CI and Non-3D QA.
- Verify screenshot artifacts and concurrent main changes before merging.

No alteration to underlying photo, fabric tile, measured scale, body mesh,
warehouse records, customer evidence, supplier measurements or deployment.

## CI correction — preserved original zoom regression
The first exact-head CI caught two old source-string expectations, which pinned
`transform:scale(1.42)` and `setInspectFit(false)` literally. Existing behavior
still exists as the explicit `fit` preset (1.42x, 50%/35%) and a reset to
`photoFocus="full"`. The old test assertions have been updated to verify the
CSS-variable scale/origin contract and explicit selection-reset action. Browser
Canvas/QA affine equality assertions are retained, not skipped. The new commit
requires all exact-head CI and browser gates again.
