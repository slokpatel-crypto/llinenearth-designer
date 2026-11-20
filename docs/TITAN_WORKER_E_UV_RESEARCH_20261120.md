# Worker E — experimental dominant-plane garment UV face charts

Date: 2026-11-20 — **RESEARCH / NOT FOR MAIN**

This branch changes only the Blender six-panel **source candidate** authoring function and a native fixture; the customer photo and model identity remain `linen-earth-studio-model-v1`.

## Hypothesis
The previous global X/Z UV projection mathematically collapses genuine Y/Z side and X/Y horizontal hem/rim faces. An adaptive projection using the dominant face-normal axis can remove those zero-area UVs on three orthogonal test surfaces without changing geometric vertex positions, body clearance, thickness, cloth dimensions or camera angles.

## What the native test actually proves
An evaluated Blender mesh with X/Z, Y/Z and X/Y triangles receives noncollapsed UV0 triangles; reversing a side-facing triangle still maps correctly, and vertical faces keep V increasing with Z. This is a synthetic fixture only. It **does not** prove the pinned CC0 six-piece source is physically correct, nor does it prove original photographed silhouette, true garment topology, seam continuity, fabric repeat width, or drape.

## Why experimental
Each face can choose a different planar chart. Such joins may break visible striped/check alignment, alter UV handedness or move texture seams. The authoring script stamps `linen_earth_uv_seams_reviewed=false` and `linen_earth_repeat_scale_measured=false` on each candidate garment. Promotion would require source Blender before/after UV and crossing reports; measured fabric scale evidence; review of collar/armholes/waist/cuff/seat/hem seams at all four same-source angles; and independent approval.

Leave this branch and PR unmerged, even if synthetic unit tests pass. No real-world measurements have been supplied or fabricated. No Vercel deployment, source-mannequin replacement or live production data change.

## Authentic CC0 comparison — negative result (2026-11-20)

Real six-panel Blender 4.5.14 preflight evidence from [research run 44771977135](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44771977135) and the unchanged-source [production-safety run 44776075666](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44776075666) shows identical evaluated mesh budgets in all six panels (8,680 torso, 3,144 triangles per sleeve, 6,864 waistband, 5,452 per trouser leg). **Both runs have zero collapsed UV triangles, zero non-finite UV triangles and zero degenerate faces per panel.** Hence this face-chart experiment did **not** repair a measurable collapsed-UV defect in the current actual CC0 model. The current UV preflight also does not prove grain/stripe seamlessness or physical textile repeat calibration.

Decision: keep the branch in research history but **do not merge it**; close the research PR as an unneeded optimization with potential discontinuous woven patterns. A future UV initiative should first demonstrate a physically observed repeat-orientation/seam/texel-density failure with authentic before/after image and measured textile evidence, without replacing the original model.
