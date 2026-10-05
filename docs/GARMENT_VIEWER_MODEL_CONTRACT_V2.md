# Linen Earth GarmentViewer — Production GLB Contract v2

This contract lets the current GarmentViewer swap the temporary engineering mannequin for an approved realistic office-wear model without rewriting fabric, camera or interaction logic.

## Source rule

The approved model is server-selected with `LINEN_GARMENT_MODEL_SRC`.

Only same-origin files under `/models/*.glb` are accepted. Example:

`LINEN_GARMENT_MODEL_SRC=/models/linen-earth-officewear-v1.glb`

Remote model URLs are intentionally rejected.

## Required garment material slots

The GLB must expose these material names exactly once:

- `ShirtTorsoFabric`
- `ShirtSleeveLFabric`
- `ShirtSleeveRFabric`
- `TrouserWaistFabric`
- `TrouserLegLFabric`
- `TrouserLegRFabric`

The viewer replaces these six material textures independently. This is what allows one physical fabric scale to remain consistent across unequal torso, sleeve, waistband and leg panels.

Skin, hair, shoes and non-fabric accessories must use other material names and are never recoloured by the fabric mapping engine.

## Geometry target

The production asset should preserve the Linen Earth approved model direction:

- adult male, approximately 5'8" reference height,
- neutral premium-office proportions,
- tucked-in shirt,
- realistic neck-to-collar junction,
- shirt and trouser surfaces fitted to the same body,
- no jacket/hood geometry in the default model,
- hands must not intersect shirt or trouser cloth,
- clean waist occlusion with waistband in front of tucked shirt,
- no garment-to-skin or garment-to-garment self-intersections in the four catalogue views.

The temporary block GLB does **not** satisfy this realism target; it only satisfies the material interface.

## UV and physical-scale convention

Each required garment material must have usable UV0 coordinates.

The current viewer treats each panel's UV span as a physical panel rectangle and applies a repeat transform from the stored/calibrated Linen Earth tile width. Production UVs should therefore:

1. maintain consistent texel density across each panel,
2. avoid arbitrary per-panel UV resizing,
3. preserve vertical grain direction from body top to bottom,
4. keep left/right paired pieces at the same physical density,
5. avoid mirroring directional stripes/checks unless intentionally required by construction.

For patterned fabrics, the customer-facing scale may only be called calibrated when the Fabric Analyzer/metadata layer has reviewed physical repeat or swatch-width evidence. Unknown scale remains approximate.

## PBR convention

Fabric materials are non-metallic.

The viewer owns:
- base-colour fabric texture,
- repeat transform,
- roughness control,
- linen normal detail.

The production mesh must not bake a coloured shirt or trouser pattern into the garment albedo.

Neutral photographic-style form may be baked into geometry/normal/AO, but it must not prevent replacement swatches from reading accurately.

## Camera contract

The same model must support:

- front,
- three-quarter,
- side,
- back,
- free orbit/touch inspection.

The current M1 camera presets remain the interface baseline. Final M2 camera distances can be tuned after the realistic mesh is loaded, but view identity must remain deterministic.

## Runtime gate

A candidate production GLB is not considered contract-ready unless:

- all six required garment materials exist,
- none of the six are duplicated,
- shirt has torso + two sleeves,
- trouser has waistband + two legs,
- all six can receive independent physically scaled textures.

Passing this material contract is necessary but **not sufficient** for customer release. Realism, boundary, mobile-performance and pattern-scale QA still have to pass separately.

## Customer promotion gate

Do not replace the current photographic Designer with the 3D model until all of the following are true:

1. approved model silhouette matches the Linen Earth reference direction,
2. collar/neck, hands, tuck and waistband boundaries pass visual QA,
3. patterned cloth scale passes the existing <=8% calibration gate,
4. front/3/4/side/back identity is stable,
5. mobile interaction stays usable,
6. no paid AI render is required for normal fabric/style changes.


## Sidecar manifest

Every approved GLB requires a same-name sidecar:

`/models/linen-earth-officewear-v1.glb`  
`/models/linen-earth-officewear-v1.viewer.json`

The sidecar binds physical panel dimensions and optional camera orbits to the exact model identity:

```json
{
  "version": "linen-earth-garment-viewer-v2",
  "modelId": "LE-OFFICEWEAR-V1",
  "referenceHeightMm": 1727,
  "panels": {
    "ShirtTorsoFabric": { "widthMm": 580, "heightMm": 780, "offsetU": 0, "offsetV": 0, "rotationDeg": 0 },
    "ShirtSleeveLFabric": { "widthMm": 180, "heightMm": 540, "offsetU": 0.12, "offsetV": 0, "rotationDeg": 0 },
    "ShirtSleeveRFabric": { "widthMm": 180, "heightMm": 540, "offsetU": 0.12, "offsetV": 0, "rotationDeg": 0 },
    "TrouserWaistFabric": { "widthMm": 540, "heightMm": 260 },
    "TrouserLegLFabric": { "widthMm": 240, "heightMm": 760 },
    "TrouserLegRFabric": { "widthMm": 240, "heightMm": 760 }
  },
  "cameraOrbits": {
    "front": "0deg 76deg 2.65m",
    "three-quarter": "35deg 76deg 2.65m",
    "side": "90deg 76deg 2.65m",
    "back": "180deg 76deg 2.65m"
  }
}
```

Panel dimensions must come from the actual approved garment mesh/pattern workflow. The values above are only the current M1 engineering reference and must not be copied blindly into a production asset.

## Local asset check

Before configuring a new model:

```bash
npm run garment:model-check -- public/models/linen-earth-officewear-v1.glb
```

The checker verifies GLB 2.0 structure, six unique garment material slots, POSITION/NORMAL/UV0 coverage, absence of remote buffer/image dependencies and the matching sidecar manifest.

## Evidence revision binding

Production QA is bound to SHA-256 hashes of both the GLB and its sidecar. If either file changes, old pattern-scale, interaction-latency, realism and boundary evidence can no longer satisfy the customer-promotion gate.

The operator desk at `/operator/garment-viewer` reports structural blockers and the latest evidence gate. Fabric-change latency is collected automatically in the 3D Lab only when an approved production model contract is active.


### Pattern phase / grain controls

Each panel can optionally define `offsetU`, `offsetV` and `rotationDeg`. These are applied through the <model-viewer> texture sampler after physical repeat scale is set, so stripes/checks can be phase-aligned across torso, sleeves, waistband and legs without changing the real repeat size.

- `offsetU` / `offsetV`: repeating UV offset, bounded to -10…10.
- `rotationDeg`: panel textile/grain rotation, bounded to -360…360.
- Leave all three at zero when the production UVs are already authored to match the intended grain and seam phase.

These controls are for verified production alignment, not for visually stretching or rotating a fabric to hide bad UVs.


## Independent realism rubric

All 8-person realism evidence uses `linen-earth-garment-viewer-realism-rubric-v1`. Reviewers compare the same five criteria against the current `studio-tucked.webp` Linen Earth reference:

1. premium officewear silhouette and body proportions,
2. cloth drape / garment fit on the body,
3. collar-to-neck connection,
4. hands, tucked waist and trouser boundary cleanliness,
5. overall photographic believability.

A 4/5 or 5/5 rating means no major mismatch on those criteria. Evidence created under a different rubric version is ignored rather than silently satisfying the promotion gate.


## Designer catalogue parity

The 3D Lab and the customer Designer now use the same server-side active-stock loader. Verified metadata and provenance-ready live stock therefore remove or retain the same fabrics in both paths. The 3D Lab must not keep a separate hard-coded shortlist that can drift away from the current Designer catalogue.

This parity only covers fabric availability/source-of-truth. It does not promote 3D to customers; the GLB revision must still pass the full production, scale, latency, realism and boundary evidence gate.
