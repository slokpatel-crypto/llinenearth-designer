# TITAN 3D — original crotch bridge geometric 2D flattening

**Research only. Not a sewn/tailored pattern, not measured linen repeat, not verified original trouser UV, no model GLB or production export.**

## Exact parent and physically measured reason for work

Parent stacked draft [#892](https://github.com/slokpatel-crypto/llinenearth-designer/pull/892), SHA `e351fa0edb1407dcf1408b6a537f15cace22abe3`. Original locked `linen-earth-studio-model-v1`, real body, six production garments, image, original export unchanged. All 10 original hard preflight blockers persist.

Official Blender 4.5.14 native source [run 41693837306](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41693837306) verified the actual existing 2650 original trouser source faces plus six experimental bridge faces. Enumerating all 64 face-winding flip masks corrected **6→0** incompatible two-owner edges, preserving all eight real source cut-edge identities and **126** original open research shell boundaries. Native scanned body still intersects research bridge in **20** BVH face pairs, contacted area **1083.9614mm²**; no fit approval.

**Critical original UV truth:** Each of the real original left and right trouser research-stage meshes is **1325 faces, 0 UV layers**. There is no existing original stage physical textile grain, mm/px ratio, woven-repeat length or sewn patch/source UV continuity to extend. UV data must never be invented as verified supplier material.

## This isolated branch's actual 2D geometry work

Branch `work/titan-3d-original-bridge-flat-pattern-20261103` implements `scripts/blender/source-crotch-bridge-flat-charts.py` (pure Python; no Blender edit). It unfolds the six actual original-source research bridge triangles into exactly **four connected 2D charts**, one per source seam pair: 2,1,2,1 triangles. It uses actual native 3D source vertex lengths (Blender geometry in metres; reports mathematical triangle coordinates in millimetres), Heron/circle intersection geometry and opposite-side shared-edge placement for two-triangle charts. 

- The 2D geometry preserves each real 3D source bridge triangle's **all three edge lengths to within 0.001mm**, and rejects zero-length, flattened/degenerate, disconnected or winding-inconsistent triangles. These are mathematical dimensions of a research mesh, **not verified measured textile lengths, pre-shrunk cut lengths, sewing ease or finished fabric drape**.
- Each chart records the **two genuine original cut-edge segment lengths and the mismatch in mm**, original bridge triangle IDs, 2D vertex coordinates, triangle areas and maximum metric edge deviation. A physical sew/cut decision needs accurate tailor seam allowances, actual material and fitting; a low edge mismatch alone is insufficient.
- Native Blender creates a separate six-triangle unsaved object `TITAN_RESEARCH_CrotchBridgeUnverifiedUVOnly`, not touching original source faces or their absent UVs. It assigns a display-only UV layer to **all 18 bridge face loops**, arranged as four separated islands with a 5mm synthetic display gap, preserving research triangle geometry. The display coordinate is arbitrary and **not certified supplier physical pattern scale**, not source trouser-leg UV continuity, and not a shop-floor cutting chart.
- Asserts genuine 3D-vs-flattened surface area agreement, 6 native bridge triangles, 18 explicitly finite UV loops, no unassigned loops, no export, no source edits, and independent native scannned-body physical rejection gates unchanged.
- Pure Python topology/geometry adversarial tests plus dedicated Node static regression guarantee no unsupported textile, origin UV or production approval claim.

## Official native Blender 4.5.14 actual original-source geometry outcome

The pinned source [workflow 41695867287](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41695867287), tested at `8eb263bd848a670e37d8d6d022014e5fae8af9dd`, **completed successfully as research measurement/rejection evidence**, not a fitted garment. Native Blender built the **four** research geometric flat charts (2 + 1 + 2 + 1 real source bridge triangles), attached **18 out of 18** finite research UV loops and retained no original trouser-source UV.

| Genuine original cut-edge source pair | Source left edge (mm) | Source right edge (mm) | Difference (mm) | 3D-triangle geometric surface (mm²) |
|---|---:|---:|---:|---:|
| 0 | 28.47255 | 28.49421 | 0.02166 | 662.12512 |
| 1 | 24.67540 | 24.64113 | 0.03427 | 80.85468 |
| 2 | 25.65192 | 25.79545 | 0.14354 | 578.19631 |
| 3 | 25.49605 | 25.06933 | **0.42672** | 290.29003 |

The four flat-chart triangle areas total **1,611.46614 mm²** (rounded to 5 decimal places per chart); the independent real Blender original 3D research six-face mesh measured **1,611.46609 mm²**. Every chart recorded `maxActualBridgeEdgeLengthErrorMm=0` when rounded to 8 decimals, and the native **≤0.001 mm** length preservation assertion passed. This is exact geometry research, **not a guarantee that cut linen can be sewn under 0.001mm tolerance**.

**Longest real edge mismatch** is the fourth source cut-edge pair (**0.42672 mm**). Do not assume a tailored stretch/ease allowance without a real tailor and fabric test; no approved seam lengths, shrinkage, supplier grain and repeat, physical cloth scale or fabrication instructions exist. Original left/right trouser stage UV remains absent, so the additional bridge-only UV witness is deliberately **not connected to original garment texture charts**. Original 20 research bridge-body pairs, 126 open shell edges and all ten hard full six-garment preflight blockers remain.

## Next native research: complete UV witness for all actual original trouser source faces

The latest branch continues the verified bridge-only chart research into a **separate unexported research copy of all 2,650 original trouser source faces**. Original production garment data, original 1,325-face left and 1,325-face right source-stage meshes, original model identity and source lacking UVs remain unchanged.

`scripts/blender/source-trouser-provisional-uv.py` constructs mathematically reproducible, source-coordinate-derived **provisional cylindrical UV display coordinates** for every actual original source-face loop. It uses the two legs' shared original geometry center and a real geometry-derived mean radius; no supplied physical print/grain, repeat or material identity is presumed.

New native evidence records:

- Actual 2,650 original faces, original source vertex count, complete Blender research UV loops, exact eight original unmatched cut edges, original 132 open source-shell edges and every actual shared original source edge
- For **all original face edges**, true 3D geometry-vs-display-UV length errors, maximum and RMS in millimetres, and 2D/3D original-face area distortion, including collapsed projected faces
- Every shared original source edge's 2D chart discontinuity (UV endpoint distance), true continuous versus discontinuous edge counts and maximum gap; *not* a claim that interleg/bridge seams are sewn
- The eight original cut-edge identifiers, their true 3D edge lengths, display-projection lengths and measured flattening discrepancy, with all physical-scale approvals false
- An independent native scanned-body BVH check that adding the research-only UV layer changes **zero original source geometry/body contacts**; original unmodified source-stage UV provenance remains reported accurately

The Blender research copy `TITAN_RESEARCH_OriginalTrouserPanelsProvisionalUVOnly` has explicit 2D coordinates on all real original-source loops, but the projection is **not a tailored UV unwrap**. It may stretch, collapse, or open seams, and none of those defects can be hidden. Its display coordinate scale is geometrically derived from the source body, not supplier measured repeat or calibrated weaving grain. Real source-to-bridge UV joins, fabric scale, thermal/shrinkage allowances and cloth drape remain **unverified**.

A dedicated Python adversarial numeric test and Node structural regression verify this fail-closed provenance. Actual native numeric results require new **exact-head** Blender workflow evidence; any green diagnostic workflow is not a garment quality approval.

## Remaining blockers and verification

- [x] Original seam edge winding fixed in research and native measured; body collisions and original source missing UV verified
- [x] Pure deterministic exact-length bridge triangle flattening implemented for all four actual unmatched source seam segments
- [x] Non-export Blender six-triangle UV witness, real original cut-edge length mismatch measurements and failure-closed numerical checks added
- [x] Dedicated Python and Node unit regression plus real pinned native Blender workflow assertions implemented
- [x] Official source Blender measured four charts, six genuine triangles, 18 research UV loops, true cut-edge lengths and mismatches; research-only native gate passed
- [ ] Exact-head Full CI, Non-3D QA and standalone Blender collision suite pass
- [ ] Body/leg collisions: at least 20 research bridge/body pairs remain and ten original full garment physical preflight blockers remain unresolved
- [ ] Connect real trouser UV charts to mapped original source, supplier measured grain and repeat, actual cutting/seam allowances, body clearance, pre-shrunk textile, cloth thickness/drape, canonical four-angle photographic and independent tailor evidence

**NO MERGE / NO VERCEL DEPLOY / NO PRODUCTION FIT or UV APPROVAL.**
