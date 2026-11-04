# TITAN 3D — non-export real source cut-edge reprojection

**Status: unapproved original-body physical research only. No source garment replacement, no fitted sewn mesh, no merged PR or Vercel release.**

## Verified prerequisite

Parent draft [#885](https://github.com/slokpatel-crypto/llinenearth-designer/pull/885) at `f720051e852d7e50a34b141a0542271f71317d2c`, stacked on [#857](https://github.com/slokpatel-crypto/llinenearth-designer/pull/857).

Original official Blender 4.5.14 native source job [41682374470](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41682374470) returned genuine source body samples:

| Real source cut edge | Nearest original-body samples (seven fractions) | Samples below research 7mm |
|---|---|---|
| Left `[216,217]` | min **0.50969mm**, max **1.20963mm** | **7 / 7** |
| Right `[1581,1580]` | min **0.55062mm**, max **1.33301mm** | **7 / 7** |

The source cut edges are effectively a near-body shell, not a measured garment with 7mm edge clearance. The earlier 7mm interior centroid shift worsened original body BVH contacts 20 to 139. Both genuine cut edges and research connectors yielded immediate 0.01mm ray hits; those alone are ambiguous, while the seven-point samples directly demonstrate local proximity. Original full garment physical preflight remains rejected with **10 hard blockers**.

## Actual new Blender experiment

Branch `work/titan-3d-source-cut-edge-reprojection-20261103` adds a bounded, research-only `trial_source_cut_edge_reprojection()` to the original source bridge experiment. It creates three **real** Blender mesh objects entirely inside `TITAN_CrotchStageResearch`:

- `unchangedControl`: four source patch vertices and original sewn-edge identities unchanged, same four-triangle fan topology as alternatives
- `positiveBodyNormal`: move all four corner source-cut vertices to the original scanned body nearest surface plus research 7mm along actual measured Blender body normal
- `negativeBodyNormal`: same actual surface but minus 7mm, so no unmeasured assumption about which original body normal is outward

All three variants create genuine Blender mesh faces and measure actual original-body BVH intersection pairs, contacted area, percent contacted area, finite source vertex movement (bounded ≤25mm), real cut-edge lengths, and seven nearest original-body distances along each reprojected source cut segment.

Original cut-edge coordinates **are deliberately changed in experimental copies only**. This is **not a sewn source garment repair**: moving the boundary in isolation may disconnect neighboring real trouser cloth, violate grain/seam allowances, or produce topology unsuitable for manufacturing. Original CC0 body, six garment objects, photographic model identity `linen-earth-studio-model-v1`, and existing export are preserved. An apparent local improvement does not certify continuous clearance, fabric thickness, UVs, native six-panel physical preflight, tailor fit or four-angle photographic match.

## Updated native physical evidence — PR #887, official source job 41683400833

Original locked body, same real source seam, strictly research-only isolated four-triangle patches (not physically sewn into the trouser legs):

| Variant | Original-body triangle BVH pairs | Sampled min cut-edge distance | Sample points under 7mm | Contacted bridge area |
|---|---:|---:|---:|---:|
| Unchanged | 16 | 0.50969mm | 14/14 | 486.0596mm² |
| Positive +7mm body normal | **0** | 5.51968mm | 14/14 | **0mm²** |
| Negative −7mm body normal | 16 | 7.42934mm | **0/14** | 546.2587mm² |

The *geometry* trade-off is real: +7mm eliminated intersection in this isolated four-face patch but fails the sampled 7mm target; −7mm achieves the sampled target but intersects the body. Neither is a viable sewn-garment choice.

### New actual geometry continuation

- Extend the same signed-body-normal research experiment with independent **positive +9mm and +11mm** variants, preserving exact four-face topology for all five controls/candidates.
- Measure zero-intersection criterion and seven-sample minimum distance for every real source cut edge from actual pinned Blender original body.
- Report `jointSampledZeroBVHAndSevenMmCandidateLabels` for candidates meeting **both** in the *isolated patch only*. This is a diagnostic observation, never automatic production promotion.
- Keep source vertex displacement bounded to 25mm, confirm no degenerate or nonmanifold faces and all original garment/identity/export contracts untouched.
- **Important:** Even both sampled criteria passing is not continuous clearance, watertight garment seam topology, cloth thickness, UV/fabric grain fit, photograph match or tailoring approval.

## Verification before any promotion

- [x] Real original body native evidence has demonstrated both source cut edges fail sampled research 7mm separation.
- [x] New source-vertex reprojection experiment, native workflow assertion, and Node regression guard implemented on isolated stack.
- [x] Official Blender +7mm/−7mm trial produced actual independent measured results; no accepted garment.
- [x] Positive +9/+11mm research variants and exact-head native evidence predicates implemented; this edit still requires new exact-head CI.
- [ ] Run new exact-head official Blender 4.5.14 **source native rejection job**; record numeric outcomes for all three signed-normal variants, not expected improvement claims.
- [ ] Run exact-head CI, Non-3D, native collision and relevant other checks; inspect logs.
- [ ] If a local patch improves, develop continuous trouser-leg seam topology connected to real surrounding faces; rerun collision, UV grain/scale, thickness, fitting and final source preflight.
- [ ] Physical cloth, supplier, tailor and independent four-angle production acceptance gates remain blocked.

**Research only. NEVER merge or deploy on green diagnostic CI alone.**
