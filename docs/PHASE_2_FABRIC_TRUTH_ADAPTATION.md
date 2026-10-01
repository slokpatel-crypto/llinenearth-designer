# Phase 2 — Fabric Truth Adaptation

Status: existing foundation is substantially implemented; Roadmap v2 becomes a calibration and evidence-completion phase rather than a greenfield rebuild.

## Existing foundation to keep

- 66 stock fabric images and generated render tiles.
- Deterministic colour / palette / pattern measurement.
- Repeat-period and stripe-width measurement in pixels.
- Physical scale support from either a declared repeat or a measured swatch width.
- Explicit `unknown` state when physical scale evidence is absent.
- Image-quality checks for blur, glare, exposure, colour cast and framing.
- Content identity / hashes and evidence fingerprints.
- Private Fabric Analyzer workflow with stock binding.
- Owner / supplier physical-evidence notes and source URLs.
- Designer Data Desk captures structured physical provenance (`physical_roll`, `supplier_document`, `lab_report`, `owner_measurement`) with reference, checker, optional date/URL; GSM/drape do not count as verified without it.
- The bulk fabric worksheet carries the same physical-provenance fields so real stock evidence can be entered across the catalogue without weakening provenance rules.
- Human approve / correct / reject review loop.
- Dedicated append-only controlled physical colour-check workflow with LAB/hex evidence and CIEDE2000 comparison.
- Ground-truth and calibration workflows.
- Reviewed physical evidence can flow into the runtime Designer catalogue.
- Build-time fabric tiles preserve pattern direction and avoid mirroring patterned cloth.

## Roadmap v2 gaps that still require real-world work

1. Record physical scale evidence for stock fabrics that have visible repeats.
2. Build the 50-fabric reviewed ground-truth set with unique stock IDs.
3. Add verified GSM / fibre / physical drape only where owner, supplier or inspection evidence exists.
4. Use the new Physical Colour Calibration desk to complete colour checks against physical cloth under a controlled capture setup.
5. Keep source imagery / capture procedure consistent enough that re-analysis is meaningful.
6. Do not call any image-derived drape / GSM / fibre estimate a verified physical fact.

## Publishing rules

A patterned fabric may be labelled true-scale only when the runtime fabric record carries non-unknown physical scale evidence and the renderer can reconstruct the scale deterministically.

A solid fabric does not need pattern-repeat evidence for visual repeat scale, but physical colour / composition / weight claims remain separate evidence questions.

If a patterned swatch has no physical scale evidence:
- keep it available for browsing,
- render it as approximate,
- clearly disclose that scale is approximate,
- never silently upgrade it to verified.

## Engineering work already connected by Phase 1

- `/api/designer/catalog` feeds reviewed / evidence-backed fabric metadata into the proof and customer Designer.
- `applyRuntimeFabricScale` updates existing render assets from runtime physical evidence without requiring a tile rebuild.
- The photographic mannequin compositor now uses that runtime scale.
- The proof route exposes the selected fabric directly to the Analyzer desk.
- The proof can export an auditable scale / performance / realism record.

## Phase 2 completion gate

Engineering:
- [x] deterministic image analysis foundation
- [x] physical scale contract
- [x] provenance path
- [x] private review workflow
- [x] runtime Designer merge
- [x] direction-preserving patterned tiles
- [x] approximate/verified UI distinction
- [x] controlled physical colour evidence capture + descriptive ΔE metrics
- [x] structured physical provenance capture in single-fabric and bulk Designer Data workflows
- [ ] CI green for Roadmap v2 branch

Physical evidence:
- [ ] 50 unique stock fabrics reviewed
- [ ] visible-repeat fabrics have measured repeat or swatch-width evidence where true-scale publishing is desired
- [ ] 10 controlled physical colour checks recorded (workflow implemented; real evidence still required)
- [ ] verified GSM/drape/fibre entered only from trusted records or inspection
- [ ] scale errors above the roadmap threshold block true-scale claims

## Do not rebuild

Do not replace the existing Analyzer, catalogue, tile builder or evidence store just to mirror the roadmap document. Extend the existing contracts only where a measured physical fact cannot currently reach the renderer or customer-facing disclosure.


## Reviewed-evidence boundary
Customer-facing physical truth now upgrades only from Analyzer profiles that have been explicitly reviewed (`approved` / `corrected`). A high-confidence or provisional model result may still inform internal analysis, but it cannot silently mark pattern scale, GSM, drape or fibre content as verified in the Designer. This keeps Phase 1 true-scale preview and Phase 7 final-render pattern QA tied to the same reviewed fabric-truth source.


## Field-level physical provenance hardening

- A reviewed Analyzer profile no longer upgrades all physical fabric facts merely because the overall profile was approved.
- True pattern scale, GSM, drape and fibre content are promoted independently only when the exact field carries declared/reviewed physical provenance from the validated Analyzer input path.
- Reviewed legacy profiles without the corresponding field provenance remain provisional for that physical claim instead of silently becoming verified customer-facing truth.
