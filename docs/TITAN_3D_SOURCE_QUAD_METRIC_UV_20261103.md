# TITAN 3D — source trouser metric quad flattening (unstitched UV islands)

**Only original-geometry research. Never a production source atlas, certified physical fabric scale, cloth cutting chart, or a fitted sewn crotch.**

## Parent exact source evidence and why this is needed

Parent draft [#893](https://github.com/slokpatel-crypto/llinenearth-designer/pull/893) exact `36af64c208349af86f85dc13b7052688eb900328`, stacked on #892/#891/#890/#889/#888/#887/#885/#857.

Real original Blender 4.5.14 source [run 41697664649](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41697664649) **passed research rejection evidence**, verifying:

| Original 2,650-face trouser source projection | Native measurement |
|---|---:|
| Original source loops explicitly filled only on non-export research copy | **10,600** |
| Real source mesh vertices | **2,717** |
| Original shared source edges | **5,234** |
| Source shared edges discontinuous in cylindrical UV projection | **50** |
| Max original UV chart seam gap | **1,905.30908mm** |
| Max source geometry-to-UV edge stretch | **913.97518mm** |
| RMS UV edge stretch | **26.11989mm** |
| Collapsed projected faces | **0**, but 2D/3D face area ratios **0.00960631 to 14.06171595** |
| Original source shell body BVH contact pairs, unchanged | **29,600** |
| Genuine original 8 cut edges | all originally measured; display distortion at each |
| Original source-stage UV layers | **zero on either original leg** |
| Original remaining open source-shell edges | **132** before bridge, **126** after bridge |

The cylindrical witness succeeded as **a distortion diagnostic**, not as a source UV repair. All original fabric/grain/repeat certification flags remain false. These massive measurement deviations make it impossible to treat a simple body-cylinder UV projection as physically accurate.

## This next real original quad-source reconstruction

Branch `work/titan-3d-original-source-quad-flat-20261103` uses the same **2,650 genuine original four-corner trouser-source faces** and 2,717 original vertex positions.

Pure Python helper `source-trouser-quad-metric-uv.py` mathematically flattens each original quad by preserving both actual source 3D triangles `(A,B,C)`, `(A,C,D)`. Place A at origin, B on the exact original 3D AB length; use circle intersections for C then D on the opposite side of the real diagonal AC. This preserves all **four perimeter edges plus the triangulated diagonal AC to ≤0.001mm** within each quad, with no deformation of original 3D garment geometry. A nonfinite vertex, invalid face, collapsed triangle, missing cut edge, nonmanifold original edge or unflattenable quad fails closed.

All 2,650 real quads are placed in **separate UV islands** using a mathematical display grid (53 columns, 5mm research display gap). Each quad has four explicit UV loops. The display gap is NOT a 5mm sewing allowance. Native Blender builds another separate unsaved, non-export **10,600-loop source UV research object**, leaving the unmodified original source stage meshes and zero original UV layers untouched.

The experiment records actual shared original source edge ownership, open boundary count, total 3D/2D triangle surface areas, max local metric edge error, true **UV discontinuity count on shared source edges** and max research island gap. A metric unwrap can have zero individual quad edge-length error while being **totally unstitched**: this is expected and must not be reported as a better production atlas. Native scanned-body BVH overlap must match the original unchanged source 29,600 pairs exactly.

### Critical acceptance state

- [x] Real source UV cylindrical diagnosis exposed catastrophic stretch and 50 discontinuities; rejected for production
- [x] Implemented original source quad-by-quad exact geometry flattening and kept each chart island disconnected
- [x] Added genuine source-mesh Blender UV research witness with all 10,600 loops, original contact invariance and no original asset edit/export
- [x] Added deterministic pure Python adversarial regression and dedicated structural Node/native guards
- [ ] Run exact-head official Blender source workflow and capture real original-quad geometry length error, disconnected shared seam count, unmodified source contact count and UV-loop correctness
- [ ] Run exact-head Full CI, Non-3D, native collision and source rejection QA
- [ ] Actual **joined** UV cuts along source panel sewing seams, curvature/strain optimization, fabric grain, physical supplier repeat, cut allowance, cloth thickness/drape, full original 10 hard physical blockers and independently checked photo/tailor fit remain outstanding

**No main merge, Vercel deployment, GLB/source alteration or production UV/fit approval.**
