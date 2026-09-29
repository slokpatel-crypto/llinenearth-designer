# Phase 10A Report — Shared Closed Vocabularies

## Status
Complete and verified.

## What changed
- Added typed closed vocabularies for colour families, patterns, occasions, garment uses, climate tags and current Designer collar/cuff/fit/trouser options.
- Added exact normalisation: exact ID -> alias -> normalised label. Unknown values are dropped and surfaced in `reviewNeeded`; substring guessing is not used.
- Added CIEDE2000 and sRGB-to-LAB utilities plus a nearest colour-family mapper for later measured-colour work.
- Upgraded the private Fabric Analyzer contract to `fabric-analyzer-v4` with closed enum IDs for colour family, garments, occasions, climate, construction recommendations and pairing strategies.
- Added a v3 -> v4 adapter so existing stored profiles continue to influence the Designer safely.
- Designer search and Style Director now compare colour families and Analyzer recommendations by exact IDs.
- Legacy Designer TR/poly/viscose substring classification was replaced with resolved fabric IDs.
- Added `npm test` and CI coverage.

## Manual checks
1. Run `npm run quality`.
2. Run `npm test`.
3. Run `npm run release:check`.
4. Run `npm run build`.
5. Confirm customer Designer components do not import `fabric-analyzer`.

## Automated evidence
The Phase 10A tests cover:
- avoiding `blue_family` does not also avoid `teal_family`;
- unknown vocabulary is dropped and reported;
- a representative v3 profile adapts to v4 and resolves existing Designer option labels to stable IDs.

## Known gaps
- Option Library v2 has not yet expanded the garment catalogue; Phase A only gives stable IDs to the existing set.
- Measured colour/pattern scale and image-quality metrics are Phase E.
- Golden-set accuracy thresholds require owner-labelled examples.

## Owner questions carried forward
- Real-world fabric scale/repeat measurements.
- Approval of new shirt/pant proportions in Phase B.
- Which new tailoring options Linen Earth will actually offer.
