# Worker A — source-reference swipe comparison in photographic Designer Studio

Base main: `3b4f481f80090f5a7c0e1e6336b0fe31b02b43e3`; branch: `work/titan-worker-a-source-split-compare-20261120`.

## New customer-visible workflow
The existing Compare action only flips completely between the unmodified
source and the selected look. Add **Split compare** for a drag/keyboard-controlled
original-versus-selected source wipe, with 0–100% range, proper semantics,
a full-height split line and explicit source provenance.

The left side is **the original fixed studio photograph** and the right side
is **the actual deterministic selected-fabric canvas**. Source pixels are never
rebuilt, and the selected canvas is never painted over. It is not a two-look
saved design, alternate photographic angle, physical seam/fit proof or new
fabric/scale calibration. The wide-leg source has a different shirt photograph;
its provenance caveat remains visible in the split. The Save action continues
to export only the selected canvas, never a screenshot of the wipe.

Existing Compare still shows the full original photograph, and now exits split
view first; switches to AI also dismiss the wipe. Selection changes clear
the wipe/slider state. Pinned photographed zooms (collar, sleeves, waist, hem)
are applied identically to both original and selected layers.

## Verification
- Pure bounded clip formula, import and source-state regression tests.
- Actual Chromium at 390/768/1440: split control accessible and 44px high,
  0/50/100 keyboard-controlled source wipe, locked selected canvas hash,
  real wide-leg photograph provenance, no mobile overflow, same CSS transform
  for original/selected, existing Compare still works and disables split
  when showing full original; screenshots `split-before-after-{width}.png`.
- All previous photo-form and studio QA still required; exact-head CI, Non-3D
  studio workflow, all release gates and inspected browser artifacts before
  merge. No Vercel deploy, live customer/stock writes or physical claims.
