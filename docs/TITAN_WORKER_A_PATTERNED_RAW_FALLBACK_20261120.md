# Worker A — patterned fabric raw-swatch fallback parity

Base main: `2e991d51c62a5e0c93c17ee2c3268e6739e507d3`. Branch: `work/titan-worker-a-pattern-fallback-parity-20261120`.

## Confirmed visual bug
Prepared `/fabric-tiles/*` swatches use a caption-safe square from the upper cloth
field, then either mirror plain fabric or repeat the original directional cloth
four times. When prepared assets fail to load, the existing photo compositor
previously used different broader mid-source crops for stripes and prints:
stripes could change apparent repeat spacing and printed catalogue labels could
be tiled across the pictured shirt or trousers.

## Implementation
- Raw catalogue fallback now uses exactly the shared
  `photoFabricCaptionSafeCrop()` geometry for plain, striped, checked and
  printed fabrics, with a four-panel 320px tile.
- Only visually solid cloth is mirrored. Stripes/prints/checks retain natural
  axis and print handedness without reversing or double-stretching the motif.
- Existing generated assets and colour/physical repeat metadata are untouched.
  This is not a measured physical repeat or cutting-placement claim.
- Regression unit tests pin crop consistency, non-mirrored patterned layout,
  and absence of legacy oversized crop paths.
- Real Chromium (tucked original photographed model) composes two synthetic
  printable swatches identical over the upper cloth field, one with a bright
  lower catalogue caption. The shirt uses Printed; trousers use Pin Stripe.
  Final rendered pixels must match exactly, and both cloth areas must differ
  from the solid reference. Screenshot `raw-fallback-caption-safe.png`.
- Existing photo-form browser suite verifies 390px, 768px, 1440px UI,
  original model, actual catalogue prints, stripe leg coverage, physical-scale
  disclaimers and protected regions.

## Merge gate
`npm run quality`, `npm test`, `npm run eval:engine`,
`npm run eval:preview-performance`, `npm run release:check`,
`npm run build`, both Full CI and Deep Engine Non-3D Chromium workflows at
the **same exact PR head**, inspect artifacts and latest main. No Vercel deploy,
customer/stock mutation, fabricated measurements or replacement mannequin.
