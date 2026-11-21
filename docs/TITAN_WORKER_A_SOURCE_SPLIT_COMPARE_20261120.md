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

## CI compatibility correction
The first exact-head unit run (commit `f83019a8d7b543a7057993b91a8964115fc429e3`) passed 1053 tests but
failed two legacy source-string checks. The reset contract had gained
`setSplitCompare(false)` and `setSplitPercent(50)` between the previous
`setShowOriginal` and `setCreativeAi` statements. Source-mode handlers also
now clear the split. The old 7-button source contract becomes 8 with the new
accessible split action. Tests now assert the full reset, mutual exclusion,
new disabled/pressed states and all eight consistent 44px actions. The prior
behaviour was preserved, and fresh exact-head CI/browser QA is required.

## 2026-11-21 independent screenshot truth correction

Inspection of the exact-head CI artifact from `8a194604958a9a663147cb35570a1c17f871e5ff`
at 390, 768 and 1440px found that the 50% wipe still overlaid the selected-only
`FRONT / STUDIO MODEL · CUTS APPROX.` badge on top of original source pixels.
At 100% source coverage the heading still said `Your look.`, and the generic
`Save` label did not state that it exports the hidden selected canvas.

The follow-up derives a deterministic `selected` / `split` / `source` view mode
from the bounded slider value. The heading and in-photo badge now describe the
actual visible endpoint or mixed wipe, selected fabric names are explicitly
labelled while source pixels are present, and the action says `Save selected
design` throughout split mode. The source photograph, selected Canvas pixels,
style recipe, fabric calibration and export behavior remain unchanged. Chromium
must prove the 0/50/100 labels and save-target wording at 390/768/1440, with
fresh screenshot inspection and exact-head CI before acceptance.
