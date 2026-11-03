# TITAN 3D — actual source crotch seam winding and native UV provenance

**Status: disconnected from production approval. Research-only original-source edge topology, never a sewn trouser GLB or a known physical fabric scale.**

## Latest measured parent and blocker

Parent draft [#891](https://github.com/slokpatel-crypto/llinenearth-designer/pull/891), exact checkpoint `c0ced297f1900e5fb6ab9fde3ef50066af57e1a9`, stacked on #890/#889/#888/#887/#885/#857. The original locked Studio identity remains `linen-earth-studio-model-v1`. There are **10 hard original six-panel physical preflight blockers**, and the connected original crotch source prototype has **126 open shell boundary edges** after welding/bridging. No tailor approval.

Native official Blender 4.5.14 [source run 41691544928](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41691544928) tested genuine original six trouser crotch-adjacent source faces, retriangulated as 24 connected research triangles. Equal-topology source-area contacts increased for scanned-body 7/9/11mm centroid offsets: control **3,470.9054mm²**, +7 **3,757.8055mm²**, +9 **3,943.5968mm²**, +11 **4,162.9391mm²**. Each remained physically rejected despite reductions in polygon BVH pair count.

## New necessary original-source sewing-topology experiment

Branch `work/titan-3d-source-seam-winding-uv-20261103` is based on the exact PR #891 checkpoint and changes only dedicated Blender source research, a pure Python topology solver, its native and regression tests, and this document.

The source previously connected 4 pairs of the actual 8 unmatched original cut-edge segments by appending **6 research bridge triangles**. It verified edge count and nonmanifold constraints, but **did not prove that original trouser and newly added bridge triangle windings oppose one another** along those shared cut edges. A triangle sewn onto a real source face with the same directed edge instead of opposite can invert the seam. That is a concrete topology defect to check before trying more cloth geometry.

`scripts/blender/source-crotch-seam-winding.py` exhaustively evaluates **all 64 flip combinations** of the six genuine research bridge triangles while fixing **all 2,650 original trouser faces**, original source vertices, actual 8 unmatched cut-edge identities and source face winding. It scores only two-owner shared edges touching research bridge faces, minimizes mismatched directed edge windings, then minimizes number of flipped faces for deterministic selection. It also separately reports **pre-existing original-source orientation conflicts** without claiming to repair them. Any true source cut edge must have exactly one original owner and one research bridge owner, or the solver fails closed. A best candidate may retain winding mismatches; it is never automatically approved.

The native workflow creates a **new real Blender mesh** of original source faces plus the empirically chosen oriented research bridge faces, entirely in unsaved `TITAN_CrotchStageResearch`. It rejects changes to the 126 original research shell boundary edges, nonmanifold geometry and original source face identity. It measures actual scanned original-body BVH bridge collision count and contacted bridge area after orientation; reversing winding does **not** change the source point coordinates or solve existing body overlap.

### UV physical truth (do not manufacture)

The workflow inspects the actual two source leg *stage objects* for original Blender UV layer names, UV loop counts versus original mesh loops, finite UV coordinates and an active UV layer. It records incomplete or absent UV as **unknown/invalid**, never silently fills a synthetic repeat/scale. The newly generated bridge faces have no verified measured pixel/mm, physical repeat, yarn grain alignment, seam texture continuity or tailor-approved UV mapping. `sourceSewnGarmentUVApproved` and `newResearchBridgeHasCertifiedPhysicalUVScale` remain **false** even if original stage UVs are present. Measured supplier repeat remains `null`.

## Official first pinned native Blender result

Official exact-code Blender 4.5.14 [source workflow 41693837306](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41693837306) **PASSED as non-production research evidence**, after the Python 64-combination ownership unit test and original source-body calculations. Native measured:

| Original 2,650-face source plus 6 research bridge triangles | Unoriented research seam | Winding-corrected research seam |
|---|---:|---:|
| Inconsistent two-owner edges involving experimental bridge | **6** | **0** |
| Reversed existing research bridge face indices | — | **0, 1, 5** |
| Actual original source cut edges with opposite directed ownership | not all | **8 / 8** |
| Original source polygon winding errors | **0** | 0 |
| Original research source open shell boundary edges | **126** | 126 |
| Real original-body bridge BVH intersection pairs | **20** | **20** |
| Original-body contacted bridge area after correction | — | **1,083.9614mm²** |

**Scope:** The orientation fix is REAL topological improvement but body overlap remains **20**; no finished cloth candidate is approved. All six original production garments and export remain unchanged.

Original Blender source-stage UV inspection:

- `TITAN_RESEARCH_selectedBodyShell_TrouserLegLFabric`: **1,325 original polygons, zero UV layers**, no active UV
- `TITAN_RESEARCH_selectedBodyShell_TrouserLegRFabric`: **1,325 original polygons, zero UV layers**, no active UV

Neither source trouser stage carries usable UV mapping. There is **no verified original texture grain, mm/repeat scale or sewn-patch UV continuity**. The source cannot be called visually/physically textile-ready merely because geometric edge winding is corrected.

This specific native workflow verifies code at Git SHA `ef367c435aa413aa0fcb35c4bdd7e3bb88a0afcb`. Subsequent checkpoint-only commits require their own exact-head CI verification, and green CI remains a rejection/diagnostic result rather than physical fit.

## Acceptance

- [x] Defined genuine original-source cut-edge ownership/orientation contract without changing original six garment meshes
- [x] Implemented exhaustive deterministic six-bridge-face winding solver plus pure Python unit test with invalid-topology counterexamples
- [x] Added native Blender duplicate research mesh, actual original-body contact measurements and original source UV loop provenance
- [x] Added fail-closed native and Node regression guards, without changing any physical preflight threshold
- [x] Native actual-source evidence: 6→0 bridge winding conflicts, all eight genuine cut-edge ownerships valid; body collisions remain 20; both original trouser source stages have zero UV layers (no textile approval)
- [ ] Exact-head CI, source-native, non-3D and independent Blender collision QA pass
- [ ] Reconstruct full actual tailored crotch seam including missing source boundaries, seam allowances, safe body/leg clearance, UV grain/repeat scale, thickness/drape and front/back/side photo verification
- [ ] Resolve ten original physical preflight blockers; get independent tailor/material approval before production release

**No merge to main; no GLB or `.blend` export; no Vercel deployment.**