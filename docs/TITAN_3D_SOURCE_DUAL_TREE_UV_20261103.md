# TITAN 3D — genuine source trouser UV spanning forest, measured unclosed cycles

**Status: Original-mesh-adjacency UV research only. NOT complete cloth, supplier textile mapping, fitted crotch, cutting pattern, printable fabric panel, UV production approval or main-branch change.**

## Exact parent physical/native evidence

Branch `work/titan-3d-original-source-dual-tree-uv-20261103` stacks on draft [#894](https://github.com/slokpatel-crypto/llinenearth-designer/pull/894) at `12ce5e6c2036ac3a293668e7617e47ef7a6532ed`. Real native source [run 41699148128](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41699148128) succeeded as rejection/diagnostic evidence, NOT production acceptance:

| Actual 2650 original trouser-source quads | Measured native Blender 4.5.14 |
|---|---:|
| Original source vertices | 2,717 |
| Native geometry-only research UV face loops | 10,600 |
| Shared original source edges | 5,234 |
| UV shared edges disconnected with 2,650 isolated face charts | **5,234 of 5,234** |
| True metric triangle edge discrepancy at 8-decimal report precision | **0 mm** |
| 3D vs 2D summed original source quad triangle area | 778,267.3882 mm² each |
| Research UV maximum unstitched display gap | 3,817.55881 mm (not a physical seam measurement) |
| Native original source/body BVH intersections | **29,600**, unchanged |
| Original original-left/right 1325 face source-stage UV layers | **0 each** |
| Original full six-garment preflight | **10 hard blockers** |

This proves metric flattening each original quad independently can preserve triangle lengths, but it leaves **all 5,234 original shared edges unjoined**. No physical sewn UV map exists yet. Previous cylinder mapping had 50 discontinuities but huge local edge-length distortions; neither method is production-ready.

## This next ORIGINAL SOURCE topology-aware UV experiment

Pure Python `source-trouser-dual-tree-uv.py` consumes only the **actual original trouser source four-corner faces**, all corresponding **2,650 exact-geometry per-quad metric 2D arrays** from the parent helper, and the **actual 8 original unmatched cut-edge identities**.

1. Enumerate each original shared source mesh edge by its two original face-owner indices; reject >2 owners, invalid face quads, wrong shared-edge direction, missing genuine source cut-edge owners and unusable/nonfinite UV loops.
2. Build a deterministic **face-dual graph** from original shared edges. Traverse its actual connected components breadth-first, **rigidly orient and translate each new original quad chart** until both genuine shared mesh edge endpoints match the previously placed parent chart to **≤0.001mm**. No face chart is scaled or distorted to force a join.
3. The original source has mesh cycles; a spanning forest joins exactly `original source face count - connected component count` shared UV edges. It does **not** imply loop closures. Measure all **remaining non-tree original-source edges**, including count of UV closure failures, worst and RMS 2D seam gap. Any naturally closed cycles are measured, not invented.
4. Copy the original 2,650-quad source geometry into a **separate unsaved nonexport Blender research object** `TITAN_RESEARCH_OriginalTrouserDualTreeUVUnclosedCycles` with a finite UV layer containing all **10,600 actual face loops**. The source leg meshes, official exported six garments, body scan, original `linen-earth-studio-model-v1` photograph and production UV remain untouched.
5. In native Blender, fail if source geometry/body BVH pairs change from the unchanged **29,600** or if the 132 source open edges, eight unmatched cut edges, source face count or loop count differ.
6. Keep `sourcePanelsFullyStitchedInUV=false`, `cyclicSeamsHaveBeenPhysicallyClosed=false`, `surfaceUvOverlapCertifiedAbsent=false`, `realSourceToBridgeUvJoined=false`, supplier repeat null, UV grain/scale, seam allowances and production approval false. Geometric rigid-tree joins alone are NOT cloth physics or real sewing.

### Test/gate checkpoint

- [x] Rejected prior unstitched original quad atlas with exact measured 5,234/5,234 shared UV discontinuities
- [x] Implemented original-source dual-graph traversal and no-scale per-quad rigid UV edge joining
- [x] Implemented native 2,650 original face / 10,600 loop UV tree research object with actual body BVH geometry invariance
- [x] Implemented deterministic planar fixture (all flat cycle closure expected), disconnected component test, nonmanifold and invalid UV fail-closed tests
- [x] Added exact-head official source workflow assertions and separate Node structural guard
- [ ] **New exact-head** original body Blender run: measure actual original dual-graph component count, tree-connected edges, non-tree closure failures, seam gap, unchanged body contacts
- [ ] **New exact-head** CI, Non-3D QA and native collision checks must finish successfully; green diagnostic QA is not production fit approval
- [ ] Develop actual source UV cuts, nonoverlapping flattened fabric panels with measured grain/repeat and supplier provenance, real cloth thickness, seam allowance, genuine sewn crotch geometry and canonical photographic fit
- [ ] Fix original ten hard six-mesh preflight blockers and obtain independent tailor verification

**No main merge; no source/GLB asset replacement; no Vercel deployment; no tailor/production acceptance.**
