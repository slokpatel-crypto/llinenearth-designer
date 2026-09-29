# Owner-labelled Phase 10 evaluations

Copy the two templates to `fabrics.golden.csv` and `outfits.golden.json` and label real Linen Earth cases. Do not infer the answers from the Analyzer itself.

- Fabric CSV: one stock image per row. Use the closed vocabulary IDs. For multiple garments/occasions, separate IDs with `|`. `measuredHex` is optional and must come from a real colour reading rather than a screenshot. Notes explain ambiguity.
- Outfit JSON: cases with `shirtFabricId`, `pantFabricId`, `occasion`, `climate`, `ownerTop3` and `ownerAvoid`. Each `ownerTop3` / `ownerAvoid` entry is a stable design/spec ID agreed by the owner.
- Predictions are produced separately as `fabrics.predicted.json` / `outfits.predicted.json` with the same fabric/case IDs. Never copy golden labels into predictions.

Run `npm run eval:analyzer` or `npm run eval:designer`. Reports are written to `evals/reports/`. With no labelled cases the scripts report `awaiting_owner_labels`; they do not invent an accuracy score.

Target set sizes: 40–50 fabrics and 40–60 outfits. No automatic pass threshold is enabled before those sets exist.
