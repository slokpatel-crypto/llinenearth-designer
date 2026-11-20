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
