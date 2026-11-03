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

## Native Blender experiment — verified actual weighted source geometry

Original pinned Blender 4.5.14 [exact-code run 41703890457](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41703890457) **COMPLETED SUCCESS as diagnostic/rejection evidence**, not a physical garment approval. It used exact source code commit `5874517bc65814fefe7da58d80f894f618e6772f`, original 2,650 quad faces, original 2,717 source vertices, original scanned body BVH, and independent unsaved Blender research UV witnesses.

| Real original-source comparison | Old breadth-first UV forest | New maximum-retained true-3D-edge-length forest |
|---|---:|---:|
| Genuine source connected components | 3 (1,220 / 715 / 715 faces) | same |
| Strictly joined original shared source tree edges | 2,647 | 2,647 |
| Remaining non-tree shared original source edges | 2,587 | 2,587 |
| Naturally closed original non-tree UV edges | **0** | **2** |
| **Actually unclosed** original source UV seams | **2,587** | **2,585** |
| Total original 3D mesh lengths of those UV candidate edges (mm) | **40,750.56966** | **32,491.00439** |
| Longest 2D UV seam gap (mm) | **1,516.99436** | **1,072.40848** |
| RMS unclosed seam gap (mm) | **168.47247** | **102.53023** |
| UV cut-candidate graph connected networks | **66** | **40** |
| **Branching UV-cut vertices, degree≥3** | **134** | **323** — **WORSE** |
| Real source/body BVH face intersection pairs | **29,600** | **29,600**, unchanged |
| Actual source loop UV research geometry | 10,600 loops | 10,600 loops |
| Production fabric/fit/cut approval | false | false |

**Measured cut candidate length decreases by 8,259.56527mm (~20.27%).** This DOES NOT make the weighted tree a tailored pattern: its high-branching topology is substantially worse (323 vs 134 potential cut junctions), even though the total cut-candidate length, UV seam gaps and number of connected cut networks improve. These changes are all in *research UV loop coordinates*; original garment geometry, production UV, actual material and tailor cutting remain untouched.

Independent maximum-retained selection physics-free graph metrics:

- Total real original two-owner shared source-edge length: **77,338.40804 mm**
- True original source edge length retained in max spanning forest: **44,828.26310 mm**
- Theoretical minimum total omitted source-edge length for any spanning forest on that actual source graph: **32,510.14494 mm**
- Actual measured unclosed weighted cut network: **32,491.00439 mm**, slightly lower because two non-tree UV edges happen to close within the research 0.001mm numerical threshold
- Distinguish these *source mesh* lengths from any approved cloth cut seam lengths, which do not exist

The longest weighted remaining UV gap is still **1,072.40848 mm**, and 2,585 face junctions remain unclosed. Weighted source/body intersections remain 29,600; original six garment hard preflight fails ten gates. Both original 1,325-face trouser-stage meshes still have no original production UV layer. The max-weight alternative is a **diagnostic UV topology improvement on length metrics with a worsening of seam branching**, not garment production readiness.

### Acceptance

- [x] Measured real original UV cut network length, components and junctions from parent Blender run
- [x] Added deterministic pure maximum-retained-original-edge graph selector and actual source-mesh validation
- [x] Added safe explicit-tree option to original 3D quad UV joining routine
- [x] Added SECOND native unsaved research source UV mesh and old-vs-new same-body metrics
- [x] Added Python planar/curved real-topology fixture, adversarial original source tests, Node and native assertions
- [x] Exact-code native Blender source experiment verified 8.260m shorter UV candidate edge length and 445mm lower worst UV gap, but more branching junctions (323 vs 134), no physical approval
- [ ] New exact-head Full CI, Non-3D and independent collision QA pass as diagnostic engineering evidence only
- [ ] Genuine continuous low-strain original trouser pattern UV, selected manufacturing cuts and seams, measured fabric grain/repeat, source collision removal, original photo and tailor QA all **outstanding**
- [ ] Resolve original ten six-piece mesh hard production preflight failures

**No production merge/deploy. No physical approval. No fabric fact invented.**
