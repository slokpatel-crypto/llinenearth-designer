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

## Remaining blockers and verification

- [x] Original seam edge winding fixed in research and native measured; body collisions and original source missing UV verified
- [x] Pure deterministic exact-length bridge triangle flattening implemented for all four actual unmatched source seam segments
- [x] Non-export Blender six-triangle UV witness, real original cut-edge length mismatch measurements and failure-closed numerical checks added
- [x] Dedicated Python and Node unit regression plus real pinned native Blender workflow assertions implemented
- [ ] **Exact-head** native source Blender must actually measure four charts, six source triangles, original seam length mismatches and research UV-loop completion; inspect true values
- [ ] Exact-head Full CI, Non-3D QA and standalone Blender collision suite pass
- [ ] Body/leg collisions: at least 20 research bridge/body pairs remain and ten original full garment physical preflight blockers remain unresolved
- [ ] Connect real trouser UV charts to mapped original source, supplier measured grain and repeat, actual cutting/seam allowances, body clearance, pre-shrunk textile, cloth thickness/drape, canonical four-angle photographic and independent tailor evidence

**NO MERGE / NO VERCEL DEPLOY / NO PRODUCTION FIT or UV APPROVAL.**
