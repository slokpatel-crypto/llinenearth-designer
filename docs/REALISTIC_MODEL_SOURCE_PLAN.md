# Linen Earth — Realistic Officewear Model Source Plan

Status: research / asset-intake preparation only. This document does not promote any model to production.

## Goal

Replace the temporary block mannequin with one consistent realistic male officewear asset while keeping the existing GarmentViewer M2 material, camera, scale and QA pipeline.

The production asset must visually match the current Linen Earth studio target:
- neutral premium male proportions around 5'8" / 1727 mm reference height,
- tucked shirt,
- clean collar-to-neck junction,
- realistic shoulders/chest/waist,
- correct hand clearance,
- clean shirt/trouser waist overlap,
- straight officewear posture,
- front / 3-4 / side / back consistency.

## Preferred base source

### 1. Blender Human Base Meshes — preferred

Use Blender Studio / Blender community Human Base Meshes as the primary body source.

Why:
- official Blender asset bundle,
- realistic male body is based on scan data,
- quad topology and UVs are suitable for continued modeling,
- bundle is published CC0,
- no AI credits or per-render cost.

Research references:
- Blender Demo Files — Human Base Meshes v1.4.1, CC0
- Blender release notes — realistic male body replaced with scan-based geometry

This base body is not itself the finished Linen Earth asset. Shirt and trouser geometry still need to be authored/fitted around the body and exported to the six-panel GarmentViewer contract.

## Alternative base source

### 2. MakeHuman / MPFB — acceptable fallback

MakeHuman / MPFB core assets and exported models are CC0 and can be used commercially.

Advantages:
- fast body proportion generation,
- repeatable height/body setup,
- permissive output licensing.

Risks:
- clothing assets can come from third parties with different licenses,
- generic generated clothing may need cleanup for collar, tuck, cuffs and waist boundaries,
- final realism may require more sculpting/retopology than the Blender scan-based base.

Use only core CC0 assets or separately verified clothing licenses.

## Do not use as the default base

### MB-Lab / ManuelBastioni-derived meshes

Do not use as the default production source for Linen Earth.

Reason:
- the published model/database licensing can impose AGPL obligations on generated 3D models,
- that is unnecessarily restrictive for a proprietary production garment asset.

## Blender export helper

The repository includes `scripts/blender/export-linen-earth-officewear.py`.

It expects an already-approved Blender scene with:
- collection `LinenEarthExport`,
- body mesh named `Body`,
- six garment mesh objects named exactly like the GarmentViewer material slots,
- UVs on all six garment meshes,
- body height at 1727 mm ± 20 mm.

It assigns the exact material names and exports a self-contained GLB candidate. It intentionally refuses to auto-scale a wrong body or invent pattern dimensions.

## Production asset construction path

1. Start from the approved realistic male body base.
2. Set reference height to 1727 mm.
3. Lock body proportions and neutral officewear pose.
4. Build/finalize one tucked long-sleeve shirt mesh.
5. Build/finalize one tailored trouser mesh.
6. Keep skin/body geometry separate from garment geometry.
7. Assign the exact six GarmentViewer material slots:
   - ShirtTorsoFabric
   - ShirtSleeveLFabric
   - ShirtSleeveRFabric
   - TrouserWaistFabric
   - TrouserLegLFabric
   - TrouserLegRFabric
8. Ensure every garment primitive has POSITION, NORMAL and TEXCOORD_0.
9. Keep the GLB self-contained.
10. Author UVs so fabric grain and stripe/check phase can be aligned without texture stretching.
11. Measure physical panel dimensions and record them in the matching .viewer.json sidecar.
12. Export one production GLB.
13. Run:
   npm run garment:model-check -- public/models/linen-earth-officewear-v1.glb
14. Configure:
   LINEN_GARMENT_MODEL_SRC=/models/linen-earth-officewear-v1.glb
15. Run the operator GarmentViewer QA gate.
16. Do not promote to the customer Designer until all scale, latency, realism and boundary evidence passes.

## Geometry priorities

Order of work:
1. body silhouette/proportions,
2. shirt shoulder/chest/waist shape,
3. tucked waist overlap,
4. collar/neck junction,
5. sleeves/cuffs/hand clearance,
6. trouser waist/seat/thigh line,
7. trouser leg fall and break,
8. fabric UVs and physical pattern scale,
9. small surface refinement.

Do not spend time on facial detail before garment/body silhouette and boundary quality are solved.

## Mobile target

The final production asset should stay within the GarmentViewer advisory mobile budget already enforced by the project:
- GLB <= 24 MB preferred,
- rendered triangles <= 220,000 preferred,
- rendered vertices <= 280,000 preferred,
- actual fabric interaction p95 < 300 ms remains the final performance gate.

## Acceptance rule

The realistic asset is not considered finished because it looks better than the temporary model.

It is finished only when the exact GLB + sidecar revision passes:
- six-panel production contract,
- self-contained GLB inspection,
- verified stripe + check physical-scale error <= 8%,
- at least 12 interaction samples with p95 < 300 ms,
- at least 8 independent realism reviewers with >= 6 ratings of 4/5 or 5/5,
- neck, cuffs, waist and trouser-gap boundaries all pass.

## Recommended immediate choice

Use the Blender CC0 realistic male base as the body starting point, then create/finalize the Linen Earth shirt and trouser meshes around that locked body. Keep MakeHuman / MPFB as the fallback if body proportion generation is easier there.
