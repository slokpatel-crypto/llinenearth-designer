# TITAN 3D — per-source-vertex original-body-normal ring reconstruction experiment

**Research-only, no finished sewn garment, no UV/proven fabric, no physical approval.**

## Measured failure that this work addresses

Exact parent [#889](https://github.com/slokpatel-crypto/llinenearth-designer/pull/889) commit `09b2624c52142e1f1e17b9d22f5ecf6b50506373`. Official pinned Blender 4.5.14 source job [41687434521](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41687434521) measured the EXACT SAME original source face sets on original locked CC0 scan. All contacts below are **actual Blender original-body BVH polygon pairs**, not approval metrics:

| Matched original source faces | Unchanged | +9mm cut-edge only | Nearest cut-edge displacement falloff |
|---|---:|---:|---:|
| First-ring affected 14-face region | **98** | 134 | **146** (worse) |
| Two-ring affected 24-face region | **158** | 194 | **238** (worse) |

Area on the same 14 faces: unchanged **7569.0369 mm²**, +9mm only **12120.5165 mm²**, one-ring falloff **11793.5612 mm²**.
Area on the same 24 faces: unchanged **17787.7363 mm²**, +9mm only **22339.2159 mm²**, two-ring falloff **21512.4717 mm²**.

Thus earlier apparent six-face local success transferred contacts into the expanded adjacent original trouser shell. The previous falloff copied each neighboring vertex's nearest seam displacement vector. It did **not** use the neighboring vertex's own physically measured original-body surface normal.

## New actual independent Blender experiment

Branch `work/titan-3d-local-body-normal-rings-20261103`, stacked only on the exact parent above. Modify the existing unsaved research scene source script and native CI; never change production authoring, `LinenEarthExport`, canonical photograph or `linen-earth-studio-model-v1`.

Create two additional **real separate native Blender meshes** with exactly the same original source plus experimental bridge topology as the known unchanged, +9mm only and prior falloff controls:

- `localBodyNormalOneRing7Mm`: keep the same positive +9mm four original source cut-edge vertices; independently project seven source mesh first-ring vertices to **their own measured nearest original scanned-body position +7mm along that vertex's measured original-body normal**.
- `localBodyNormalTwoRings7And4Mm`: first-ring vertices +7mm from each genuine original nearest-body surface point and second-ring nine vertices +4mm. No claim this interpolation is a tailored pattern or full 7mm cloth clearance.

Every original vertex move is bounded at 25mm and each actual original face remains connected to its neighbors. Evaluate **original body BVH pair counts**, contacted surface area and original-face normal flips across the exact affected original 14- or 24-face sets for unchanged control, +9mm only and both new variants. Keep original cut edge seven-point distance checks and reject degenerate geometry.

These per-vertex local-normal trials address a distinct hypothesis: copying the nearest seam vertex direction creates unwanted original-body intersections, whereas a locally measured original-body normal might produce a less abrupt physical transition. Any improvements must be measured and must not be promoted when other source regions worsen.

## Acceptance state

- [x] Parent #889 full matched original-face diagnostic truth verified and rejected for production
- [x] New original-body nearest-point + local-normal Blender research variants implemented
- [x] Native source workflow + dedicated regression tests updated to attribute all modified original faces
- [ ] New exact-head native Blender source evidence must report real original-face pair/area changes, normal flips and original-body proximity for both variants
- [ ] Exact-head Full CI, Non-3D QA and independent native collision checks pass
- [ ] Geometry sewn to original six-piece garment, continuous source/body clearance, UV/grain, cloth thickness, physical drape, four-angle photographic proof, tailor/retail QA all **unmet**

**Never merge automatically, never deploy, never mark candidate production-approved.**
