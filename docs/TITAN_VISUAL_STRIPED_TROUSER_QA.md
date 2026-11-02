# TITAN photographic trouser stripe browser verification

## Starting checkpoint
- Merged visual phase-alignment PR #864 landed on `main` at `b952981b92d168921041ef82c60cc552a9139bbc`.
- Original model identity `linen-earth-studio-model-v1` and photographs remain unchanged.
- PR #864 source, unit, release/build, browser and 390/768/1440 responsive gates were green on exact candidate `3e8946c10b34a9ad5a805d1d7100901bdecc4a76`; the post-merge main CI must be checked independently.

## This narrow follow-on
The real Chromium `verify-photo-form.cjs` suite previously applied its synthetic striped test tile only to the shirt. Mathematical trouser seam-pivot unit checks were present but could not prove the stripe was actually displayed on *both* trouser legs in the browser.

- Render an independently striped *trouser* beside the previously existing solid control, with the exact existing fixed real photographic model and garment regions.
- Assert changed pixels on both photographed leg interiors for tucked, untucked pleated and untucked wide cuts; fail when either leg silently loses selected fabric.
- Assert skin, hands, shoes, floor, head and the central leg gap retain the solid control's pixels.
- Save `before-after-pant-stripe-{tucked,pleated,wide}.png` as visual QA artifacts; keep shirt stripe and source-fold tests intact.
- Add a unit source-contract test that requires these real-browser checks to remain in the suite.

## Exact-head acceptance (pending)
1. `npm run quality`, `npm test`, `npm run eval:engine`, `npm run eval:preview-performance`, `npm run release:check`, `npm run build` and the pinned Chromium browser workflows succeed on this branch's **exact head**.
2. Inspect all three trouser stripe comparisons, and recheck 390px, 768px and 1440px responsive screenshots and error/overflow assertions.
3. Recheck newest `main` and changed-file scope before any merge; this work cannot be treated as a new garment geometry or physical fabric-scale approval.

No paid rendering calls, original model replacement, DesignerModule edits, inventory/stock/catalogue changes, or Vercel deployment.
