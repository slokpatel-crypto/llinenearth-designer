# TITAN 3D — connected original crotch source-face retriangulation (native research)

**Status: real Blender geometry research; NOT fitted, UV-correct, production sewn garment.**

## Verified preceding physical blocker

Latest parent draft [#890](https://github.com/slokpatel-crypto/llinenearth-designer/pull/890) at `ea61b43eca6d7b286e187ec795b4f34f0f97391c`. Exact original scanned-body Blender 4.5.14 [run 41688568098](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41688568098) verified matching original-source face IDs:

| Matched original trouser-source region | Unmodified baseline body BVH pairs | Previous cut-edge displacement falloff | Each original vertex body-normal reprojection |
|---|---:|---:|---:|
| 14 source faces | 98 | 146 | 143 |
| 24 source faces | 158 | 238 | 222 |

Per-vertex nearest scanned-body normal modestly reduced collision compared to old falloff, but **both remain WORSE than unchanged original garment source.** Those variants are not ready to merge. Ten production preflight blockers remain.

## New physical geometry experiment — true face reconstruction

Previous research only deformed vertices in unchanged original 2,656-face source+bridge topology, so existing polygon interiors were never explicitly reconstructed. The new isolated helper `scripts/blender/prototype-crotch-connected-face-remesh.py` actually replaces each of the **six** original trouser-source polygon faces touching the four genuine worst original cut-edge vertices with a connected **triangular centroid fan**, keeping the original source polygon's entire outside edge cycle.

Creates two native Blender objects in the unsaved `TITAN_CrotchStageResearch` collection:

- **Control**: original seam cut-edge vertices independently relocated +9 mm along measured nearest original scanned-body normal; each genuine adjacent source face is retriangulated around its unprojected geometric centroid
- **Body-guided centres +9 mm**: identical new face indices, topology and source seam vertices, but each of the six new face centroids is independently projected to nearest actual scanned-body surface +9 mm along its original-body normal

The same genuine original **2,650 original source faces plus six experimental bridge triangles** are used; no synthetic garments. Each target source face has explicit original-face index → rebuilt-face triangle ID provenance. Actual original open source edge *identities* must be unchanged after retriangulation, which proves connectivity remains tied to the unmodified surrounding source faces. Polygon ownership must remain ≤2 and all new triangle areas positive.

Full physical comparisons on **equal triangle topology only**: real original-body BVH pairs and contacted area **only on retriangulated six-source-face regions**; untouched original source-face contacts and research bridge contacts must be equal between both runs. Measured seven-point clearances on the two unchanged original cut-edge identities, displacement bounds for four genuine source vertices and six new interior centroids (≤25 mm), and altered triangle normal reversals.

**Crucial distinction:** an original-source face retriangulation is geometry, not a tailored seam. The original research source still has 126 open boundaries and cannot be promoted as sewn cloth. Face splitting creates UV seam obligations with no measured fabric repeat/orientation; no cloth thickness/drape or original 4-view photographic acceptance is inferred. BVH face-pair counts are compared only among equal-topology variants. If either run is invalid or worse, preserve rejection.

## First actual equal-topology Blender measurement and correction

Exact commit `d458091cb98df0cccfcc07291f2b0809671d10d4`, official real original-body run [41690080551](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41690080551). The source Blender process produced a complete actual JSON report, but **the inline GitHub workflow step failed afterwards** with `KeyError: 'afterCentroidDisplacementBodyBVHPairs'`: its newly added per-remesh validation loop accidentally overwrote an earlier existing `trial` report binding. This is a *test reporting defect*, NOT a measured Blender-source failure, and was fixed by renaming the loop variable to `remesh_row`; do not label the old run green.

Source report actual genuine connected geometry:

| Measured equal-face topology | Control | Source-centroid +9mm |
|---|---:|---:|
| Original affected source face IDs | `167, 196, 215, 1492, 1521, 1540` | same six |
| Rebuilt research triangles | 24 | 24 |
| Original open boundary edges preserved | **126** | **126** |
| Body-BVH collision pairs on rebuilt original faces | **79** | **69** |
| Contacted source surface area | **3,470.9054mm²** | **3,943.5968mm²** — worse |
| Body pairs from untouched original source faces | **29,555** | **29,555** |
| Extra bridge-body pairs | 1 | 1 |
| Original source cut-edge samples under 7mm | 0/14 | 0/14 |
| Reversed new research face normals | — | 0 |

**Do not promote** the +9mm surface: body pair counts decrease but contacting area INCREASES; the full unapproved trouser geometry still fails ten hard source preflight blockers. Crucially, remeshed equal-topology evidence is comparable only with its own equal-topology control, not original 6 large faces.

New bounded native trial extends the identical face/edge topology comparison to **7, 9 and 11mm** projected original-body face centroids, validates genuine nearest original-body polygon and all six centroid movements <=25mm, identical untouched original-source and bridge contact counts, original boundary preservation, and independent flipped-face reports. No presumed benefit, UV, cloth drape or final fit.

## Acceptance and next steps

- [x] Native real-source matched-region old approach measured worse than unmodified source, confirmed no production fit
- [x] Isolated real connected-face centroid retriangulation, original source identity and open boundary continuity implemented
- [x] Same topology real scanned-body experiment, contact-area and flipped-normal verification added
- [x] Exact-head native assertions and Node structural invariants added
- [x] Official first native source geometry report measured, confirmed +9mm reduces pair count but increases area; corresponding workflow reporting bug fixed
- [x] Added +7/+11mm equal-face-topology native geometry candidates, with independent physical readouts (new run still pending)
- [ ] Pass new exact-head Blender source experiment and record +7/+9/+11mm measured original-body contact count, contacted area and face normal reversals
- [ ] Pass exact-head Full CI and Non-3D QA as well as Native collision and rejected-source workflow checks
- [ ] Design real manufacturing-sewn original crotch cut seams, physical trouser body clearance, UV/grain/physical fabric thickness and drape, identity/photo four-angle QA, independent tailor approval
- [ ] Resolve ten existing production preflight blockers; no PR merge or production deploy until approved

**No original six garment edits; no UV fabrication; no unauthorized main merge; no Vercel deployment.**
