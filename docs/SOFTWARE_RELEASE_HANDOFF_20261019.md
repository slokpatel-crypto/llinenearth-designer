# Linen Earth — software release handoff (2026-10-19)

**Status: NOT APPROVED FOR PRODUCTION.** This is an engineering handoff and a checklist, not a certificate of fit, supplier material scale, photographic parity, tailoring, or launch. Preserve the locked photographic model identity `linen-earth-studio-model-v1` and `/designer/studio-tucked.webp`. Never promote a synthetic replacement or deploy an unapproved 3D candidate.

## Engineering streams and exact references

| Stream | Engineering reference | Software result | Outstanding production proof |
| --- | --- | --- | --- |
| 1. Real 3D body/garment geometry, contact & UV | [Draft #311](https://github.com/slokpatel-crypto/llinenearth-designer/pull/311), stacked on #309 | Source Blender collision/math/UV audit runs, independent preflight intentionally fails | Last native report: actual cuff-centre gap 563.5 mm versus 500 ±36 mm (upper limit 536 mm); unapproved seams/distortion; original 4-angle model comparison and tailoring approval |
| 2. Measured-scale texture mapping | [Draft #310](https://github.com/slokpatel-crypto/llinenearth-designer/pull/310), stacked on #308 | Per-panel UV preflight, base/normal sampler checks, stale async update prevention | Vendor-confirmed per-fabric repeat and directional grain; verified 3D seam UV, photoreal colour/drape |
| 3. Tailoring evidence & recommendations | [Draft #312](https://github.com/slokpatel-crypto/llinenearth-designer/pull/312) | Invalid measurements / corrupt stored aggregate cannot create false fit confidence; new malformed-event regressions | Real operator fit reviews, physical pattern/ease acceptance |
| 4. Deterministic preview performance | [Performance draft](https://github.com/slokpatel-crypto/llinenearth-designer/tree/work/preview-performance-release-20261019) | Indexed option lookup; Node CPU p95 broken out by view/build so a slow cohort cannot hide within an aggregate | Real customer-device paint, texture creation, network and interactive latency |
| 5. QA, integration and delivery | This handoff + existing CI and non-3D browser QA | CI can validate software gates on each independent draft head | Native release preflight, real photo parity, vendor measurements and human signoffs remain hard stop |

## Repeatable release validation

Execute on the **exact candidate commit** (not a previous passing SHA):

```bash
npm ci --include=optional
npm run quality
python3 -m py_compile scripts/blender/*.py
npm test
npm run eval:engine
npm run eval:preview-performance
npm run release:check
npm run build
```

Use the existing non-3D browser workflow to exercise responsive 390/768/1440 widths and preview lifecycle, and the source-locked native Blender workflow on the real source body to run collision/UV/seam/preflight/four-angle QA. A `CI: success` conclusion does **not** imply `Native 3D: pass`. Review workflow run IDs and SHA before recording any pass. Examine release artifacts, model provenance receipts, console errors and verified paint latency.

`eval-preview-performance` explicitly covers **Node deterministic geometry and rules**, not actual browser/device GPU paint. Its aggregate and all eight front/back × body-build p95 cohorts must meet the existing 100 ms CPU budget; this is a regression indicator only. Do not infer the sub-second customer experience from it.

## Blocking acceptance criteria (never bypass)

1. Native source-derived Blender candidate independently passes garment-to-body, garment-to-garment, seam topology and physically metric UV deformation checks. Correct the sleeve-centre geometry to within the unchanged 500 ±36 mm guide **without altering the locked body identity**, then rerun four-angle QA.
2. Real fabric tile width/height, repeat period, grain and provenance are recorded for applicable fabrics. Unknown scale remains labelled unknown; a formula, clamp or normal-map shader cannot authenticate a supplier value.
3. Real four-view side-by-side comparison of the **existing** Studio model, plausible cloth silhouette/drape and physical tailor/operator approval; no AI-generated substitute model may serve as proof.
4. Complete matching-head quality, unit, engine/performance, release, build, browser and native checks, with actionable artifacts and no red release gate.
5. Review the dependency chains of stacked draft PRs; merge to main only by approved sequencing, after the 3D asset, data and production gate is actually accepted. Do not deploy during exploratory phases.

## Remaining information not inferable from software

- Four reference photographs/views **of the same approved model** with consistent neutral framing, or the actual reference source accessible to the operator.
- Measured fabric repeat dimensions (U and V, mm), original swatch dimensions, stripe/check orientation and known supplier provenance for affected fabrics.
- Real-world garment ease and tailoring accept/reject decisions on actual bodies and samples.

## Deployment control

No production branch merge, live deployment, new model identity, synthetic vendor measurement or signoff is authorized by this document. Software-only commits and passing tests should remain reviewable as drafts until all independent proof is attached.
