# Phase 10 implementation record

## Verified on 29 September 2026

The attached build brief was made from an earlier snapshot. Current `main` already contains:

- **A:** closed vocabulary IDs, exact normalization, Analyzer v4 enums, v3 adapter, exact pairing and 13 unit tests. See `PHASE_10A_REPORT.md`.
- **B foundation:** Option Library v2, legacy labels and StyleSpec v2 adapters, Korean/extra-high-rise options, validation and hash-input roundtrip test. The expanded choices are provisional; the current saved Designer look still uses legacy selections.
- **C foundation:** named weights and a data rule evaluator used by the Designer engine. Unit tests cover the proportion, tuck, pattern and festive cases. The top-three Designer snapshot comparison requested by the brief is still outstanding.
- **E1–E3 and part of E5–E7:** measured colour/pattern and image quality, content hash, top-k references and more conservative unreviewed influence. Ground-truth ΔE and per-field accuracy need owner-labelled fabrics. Multi-image capture, operator upload and per-field feedback statistics remain.

The quality gate initially failed on stale prose checks after the Analyzer v4 prompt changed. Its checks now point to the actual evidence and provenance wording without weakening the underlying constraints.

## Live preview slice delivered

- `scripts/build-fabric-render-assets.mjs` creates 66 tile/placeholder pairs from the 66 catalogued fabric photos during test, development and build. Central cloth crops omit printed captions and selvage. Mirroring makes a continuous tile; it may mirror a print motif, so the output is labelled an approximation.
- `public/fabric-tiles/manifest.json` tracks tile size, detected visual orientation, colour, and scale status. Every stock swatch currently has **unknown physical scale**. `scripts/fabric-scales.json` is empty until the owner measures swatches or repeats.
- The default photographic preview now loads prepared cloth tiles with a source-photo fallback; this avoids putting printed swatch captions and broad photo folds on a garment.
- The instant preview visibly marks pattern scale, fit and drape as approximate pending a physical sample.
- A lazy-loaded **Live cut study** sits beside the existing photographic model on `/designer-studio`. It has separate shirt/pant areas, front/back views, shirt/collar/cuff/sleeve/fit/pocket/back controls, trouser fit/rise/pleat/waistband/hem controls, provisional rule reasons and per-option accuracy.
- The photograph remains the default because the construction drawing is not photorealistic. Expanded study choices are explicitly not yet part of the saved look or AI render request.

## Manual checks

1. Run `npm run fabric:tiles`, `npm run quality`, `npm test`, `npm run build`.
2. Open `/designer-studio`, select fabrics, switch from **Photographic model** to **Live cut study**.
3. Change to Korean Straight Wide, Extra-High Rise, Short Sleeve, and a different collar. Check front/back and the explanation panel.
4. Compare plain, stripe and print fabric tiles. For any photographed stripe, inspect orientation and ask the owner for real repeat/width in millimetres before making a true-scale claim.

## Known gaps and acceptance status

- **Phase D is in progress.** The construction shapes are approximate illustration geometry, not a physically tailored pattern. Visual acceptance on six combinations and mobile <100 ms measurements have not been run.
- Pattern rotation is based on visual orientation; catalogue photography and mirroring can distort some motifs. Manual orientation review and measured repeat input are needed.
- The existing FASHN endpoint still accepts a legacy style and has not gained locked StyleSpec v2 colour/pattern QA.
- **Phase F/G are in progress.** Expanded options must become canonical saved spec fields, and the mobile controls need a unified flow; no fabricated golden-set labels will be committed.

## Owner questions

1. Supply physical swatch width or pattern repeat in millimetres for each fabric to establish scale.
2. Approve Korean/baggy trouser proportions, shirt ease, and which tailoring choices are actually offered.
3. Label 40–50 fabrics and 40–60 outfits for accuracy evaluation.
4. Provide verified GSM/fibre/drape only where the physical roll or supplier documentation supports it.
