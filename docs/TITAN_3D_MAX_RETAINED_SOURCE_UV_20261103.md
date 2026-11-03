# TITAN 3D — maximum retained real source-edge UV forest comparison

**RESEARCH ONLY. No approval of cut fabric, model fit, tailoring seams, physical textile grain, UV charts, or production export.**

## Authoritative parent

This isolated branch stacks on draft [#896](https://github.com/slokpatel-crypto/llinenearth-designer/pull/896) exact `0b9f94cd2d52ed3487aac05d197409c1e7dd5698`. Locked Studio model `linen-earth-studio-model-v1`, canonical original photo, six original production garment meshes, body geometry, original stage UV (none), `LinenEarthExport`, inventory and all other workstreams are unchanged.

The pinned Blender 4.5.14 original source job [41702187405](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41702187405) **PASSED as diagnostic/rejection evidence**, not as a garment fit gate. On the genuine original 2,650 source quads / 2,717 original source vertices:

| Actually measured source-geometry research finding | Native result |
|---|---:|
| Original two-owner quad shared edges | **5,234** |
| Real original source connected components | **3** (1,220, 715, 715 faces) |
| Real-face UV BFS spanning tree edges joined | **2,647** |
| Remaining original UV cycle seams, all unclosed | **2,587** |
| Combined REAL original mesh edge geometry length of proposed unclosed UV cuts | **40,750.56966mm** |
| Original UV candidate cut graph connected networks | **66** |
| Candidate source vertices touched by unclosed UV cut graph | **2,653** |
| Branching cut graph junction vertices (degree 3 or more) | **134** |
| Largest unclosed UV chart gap | **1,516.99436mm** |
| Real original source BVH body-contact pairs | **29,600**, unchanged |
| Original source left/right stage UV layers | **0 each** |
| Original full six-production-mesh hard preflight blockers | **10** |

**40.75 metres is a SUM OF UV-DISCONNECTED ORIGINAL MESH EDGE GEOMETRY, not a real textile cutting requirement.** The source remains unfit/UV-unapproved; do not mistake these metrics for a manufacturer handoff.

## New independent true mesh-alternative

Instead of joining the first neighbor encountered in original face-index BFS, `scripts/blender/source-trouser-max-retained-uv.py` applies **Kruskal's maximum spanning forest on ACTUAL original source two-face edges, weighted by REAL 3D source edge length** (geometry metres expressed in mm). It keeps all original components connected while preserving their longer shared edges. Maximum retained edge length is equivalent to minimizing the 3D length of **omitted non-tree original mesh edges** among forest selections. This is a mathematical lower bound for this particular face-tree technique, **NOT an optimal practical cutting pattern**.

To make this a REAL Blender geometry comparison rather than a number-only heuristic:

1. Existing `source-trouser-dual-tree-uv.py` now optionally accepts the selected shared-edge forest, fails closed on missing, duplicated, noncanonical, nonshared or cycle/disconnected selections, and rigidly joins source quads along those exact original faces without rescaling.
2. Official pinned Blender constructs a **SECOND independent unsaved, nonexport 2,650 original-quad / 10,600 research UV-loop mesh**. It traces actual body contacts, exact original source 132 open edges, 8 original unmatched cut edges and 3 components. No original six garment asset changes.
3. Run the existing full source UV cut network audit on BOTH strategies. Measure real original 3D source edge lengths and actual **unclosed** UV candidate cuts, seam branching/networks, largest/rms UV gaps. We do NOT assume the alternative improves seams: geometry may have long cycle gaps or new unclosed paths.
4. Compare the actually measured BFS original 40,750.56966mm versus Kruskal-weighted true unclosed cut-network length. The max-tree `minimumOmittedOriginalSourceEdgeLengthMm` is a bound on all forest omissions; actual unclosed UV edges may differ only when non-tree loops happen to close naturally.
5. All textile/genuine tailor cutting, source UV continuity, cloth physics, measured grain/repeat, source-to-bridge UV, body fit, original-model photographic identity and production flags remain false. No Vercel deployment or main merge.

### Acceptance

- [x] Measured real original UV cut network length, components and junctions from parent Blender run
- [x] Added deterministic pure maximum-retained-original-edge graph selector and actual source-mesh validation
- [x] Added safe explicit-tree option to original 3D quad UV joining routine
- [x] Added SECOND native unsaved research source UV mesh and old-vs-new same-body metrics
- [x] Added Python planar/curved real-topology fixture, adversarial original source tests, Node and native assertions
- [ ] New exact-head native Blender source measurement must report weighted true omitted edge length, actual non-tree cycle count, native cut-network length, branching, unchanged source/body intersection count and no physical approval
- [ ] New exact-head Full CI, Non-3D and independent collision QA pass as diagnostic engineering evidence only
- [ ] Genuine continuous low-strain original trouser pattern UV, selected manufacturing cuts and seams, measured fabric grain/repeat, source collision removal, original photo and tailor QA all **outstanding**
- [ ] Resolve original ten six-piece mesh hard production preflight failures

**No production merge/deploy. No physical approval. No fabric fact invented.**
