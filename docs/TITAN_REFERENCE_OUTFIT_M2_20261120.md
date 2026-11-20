# TITAN Roadmap v2 — Reference Photo → Designer Outfit M2 (2026-11-20)

## What is actually built
The already-merged Reference Look M1 ranked real catalogue swatches from a single locally sampled colour, but **did not** carry a chosen outfit into Designer. M2 adds the missing customer vertical slice:

1. One local JPG/PNG/WebP (max 8 MB) shows in a browser-only canvas. The customer explicitly labels a *shirt* region and a *trouser* region, or chooses the centre with a keyboard-accessible button. Neither clothing segmentation nor fabric identification is claimed.
2. Two independent median photo samples are maintained in local React state. A new photo resets both; resampling or clearing either target clears that target's prior fabric choice, not the other one.
3. For each garment, customer explicitly selects one of the six ranked real catalogue swatches. No automatic fabric selection; invalid/unknown/cross-garment IDs fail closed.
4. Only when both choices exist, the UI offers an actual **Open this outfit in Designer** link. The bounded v1 transport contains exactly `from`, `referenceVersion`, `shirt`, `pant` with allowlisted catalogue IDs; it does **not** carry any photograph, RGB colour, PII, inventory, fit or physical claims.
5. Designer Studio validates every transport parameter against the existing shirt/pant catalogue, rejects duplicates, and restores only those two fabric IDs into its **existing StyleSpec v2** construction and versioned browser draft. It does not spoof the signed Style Director handoff. A clear origin/disclaimer is shown.

## Files
- `src/lib/designer/reference-outfit-handoff.ts`: fail-closed pair selection, v1 URL encode/decode.
- `src/lib/designer/reference-look-matcher.ts`: independent local shirt/trouser samples.
- `src/components/ReferenceLookMatcher.tsx` + CSS: real customer tool and accessibility.
- `src/components/DesignerModule.tsx`: validated handoff and preserved v2 style.
- `tests/reference-outfit-handoff.test.ts`: positive and negative pure tests.
- `scripts/verify-reference-look.cjs`: 390/768/1440 browser flow through real Designer local draft.

## Acceptance and unresolved work
**Requires exact-head** CI including quality, tests, eval:engine, eval:preview-performance, release:check, build, full browser QA/screenshots and independent review. This implementation is not production-approved until those complete. No Vercel deployment or main merge.

Physical cloth colour/scale and confirmed stock are separate, unverified inputs. No AI vision, semantic garment recognition, matching patterns or tailoring fit; customer choices are not authenticated purchases or factory-cut instructions. The outfit draft remains existing browser state until the separate durable private-vault workflow passes its release gates. Browser matching never sends the uploaded photo to a server.
