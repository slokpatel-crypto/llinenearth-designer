# TITAN Worker A — photo repeat-scale clamp truth (2026-11-20)

Base: `b011e86acba5cde88eebe0529d9e1f92761f8516` on `main`. Independent branch: `work/titan-worker-a-photo-scale-clamp-truth-20261120`.

## Confirmed gap
The deterministic photo compositor clamps texture transforms for display safety.
A reviewed repeat measurement plus accepted photographic px/mm calibration was
previously sufficient to show a *verified* pattern scale, even when one of the
draw-time clamps altered the physical target repeat spacing.

## Scope
- Introduce a pure renderer-bounds gate matching the existing photo-tile and
  canvas transform limits. Reject nonfinite/absent calibration values.
- Apply the gate independently to selected shirt, selected trousers and any
  visible patterned craft panel. A scale-limited item stays **approximate**.
- Expose `data-photo-scale-trust` for per-viewport Chromium assertions.
- Add boundary and source-wiring tests, extend the existing real-catalogue
  Chromium browser check at 390/768/1440.

No new physical numbers, material evidence, IDs, cut geometry, model/photo
assets, supplier stock, paid AI calls or database migrations. The original
`linen-earth-studio-model-v1` is unchanged.

## Verification required before merge
- `npm run quality`, `npm test`, `npm run eval:engine`,
  `npm run eval:preview-performance`, `npm run release:check`, `npm run build`.
- Full pinned Chromium `scripts/verify-photo-form.cjs`: screenshots, no
  overflow or console errors at 390/768/1440, protected-pixel invariance,
  stable shirt/trouser striped panels and the new scale-status assertion.
- Compare exact PR head, changed-file list, checks and current main just
  before any merge. Do not deploy Vercel. This only repairs scale-disclosure
  fidelity; it does **not** certify textile measurements or realistic tailoring.
