# 3D Candidate — UV Coordinate Units & Fabric Repeat Release Gate

**Status: engineering contract only. NOT APPROVED for the Linen Earth Real Model Designer.**

The production photographic Designer Studio stays unchanged. The source-body Blender
candidate and its sidecar are not a substitute for the exact approved human image.

## Unit contract

The existing generated GLB uses panel-local UVs normalized over each garment
panel's width and height. Texture repeat is therefore
`repeatU = physicalPanelWidthMm / measuredTileWidthMm` and
`repeatV = physicalPanelHeightMm / measuredTileWidthMm`.

A source-authored Blender candidate may instead use global metric UVs measured
in **mesh metres**. Its texture repeat is
`repeatU = repeatV = 1000 / measuredTileWidthMm`.

These formulas are *not interchangeable*. Applying a panel repeat to metre
coordinates double-scales the repeat and can falsify stripe/check dimensions.
The model viewer preserves the old normalized convention for existing manifests.
New authored assets may opt in using `uvCoordinateUnits: "mesh_metres"` in
their validated `.viewer.json`.

The Blender exporter reads this provenance from all six existing garment objects
(`linen_earth_uv_coordinate_units`). Exactly six equal, supported declarations
are required if any object declares one. Empty/unknown/mixed conventions are
rejected. A completely absent declaration remains legacy-compatible.

## Verification before a production merge

1. Preserve the original model identity/photo and require the unchanged scene
   identity, measured body guide, collision and garment construction checks.
2. Validate that no garment panel has missing, non-finite, collapsed or seam
   fallback UVs. A merely finite UV channel is insufficient.
3. Supply physically measured width/repeat in mm for every real supplier fabric,
   preserving uncertainty and lot provenance; never infer it from the photograph.
4. Verify on a real GLB and actual browser that a stripe/check measured in mm
   repeats consistently over front, back, side, sleeves and trousers. Check
   independently that panel switching does not swap UV conventions.
5. Require passing mobile readiness and four-angle human reference review.
   Operator and tailor acceptance must be recorded by real people.

**Current blocker:** source Blender candidate still fails native fit/UV gates.
An earlier run 39105743107 found cuff-centre spacing 574.9 mm against
500 ±36 mm despite zero reported body contacts at that then-current commit.
Later run 39107105986 after experimental sleeve movement found 538.9 mm,
1,230/1,170 sleeve-body contacts, and 4 sleeve / 2 trouser leg planar seam
fallback faces. These are per-run *rejected* diagnostic values; neither run
supports promotion. More recent branches must be judged by their own exact SHA.

No passing pure unit test, correct repeat arithmetic or scene identity string
is proof of supplier physics, photographic parity, sewn construction, approval
or authorization to deploy.
