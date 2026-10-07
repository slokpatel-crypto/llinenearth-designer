# Linen Earth — Same Model Turntable

Canonical identity: `linen-earth-studio-model-v1`  
Exact Real Model Designer reference: `/designer/studio-tucked.webp`  
Reference height: **1727 mm**

This is the visual target for both the Real Model Designer and the reusable 3D GarmentViewer. There is only one model identity. Camera rotation may reveal hidden surfaces, but the body itself must not change between views.

| View | Camera | What must remain visibly identical |
| --- | ---: | --- |
| Front | 0° | faceless matte head, shoulder width, torso taper, relaxed arm spacing, hip/leg proportions, stance, shoes |
| 3/4 | 35° | same shoulder/hip proportions with natural depth revealed; no broader chest, narrower waist or changed limb length |
| Side | 90° | same height, posture, neck/head profile, arm length, torso depth, seat/thigh line and shoe length |
| Back | 180° | same shoulder span, back/waist taper, hip width, leg length, arm/hand scale and floor contact |

## Garment behaviour by angle

**Front** is the truth anchor because it is the existing Real Model Designer photograph. Collar-to-neck fit, tucked waistband layering, sleeve termination, trouser gap and fabric scale are calibrated here first.

**3/4** reveals shirt chest/side drape, sleeve volume, waistband depth, front pleat depth and trouser fall. It must look like the front model physically rotated, not a regenerated body.

**Side** exposes posture, shirt back/front balance, tuck bulk, seat/thigh ease and trouser break. The model cannot gain or lose chest, abdomen or seat volume just to make the clothes look cleaner.

**Back** exposes yoke/back shape, sleeve pitch, cuff alignment, shirt tuck at the rear waist, trouser seat and back-leg fall. Front-approved fabric identity and physical repeat scale must continue around the body.

## 3D acceptance

The production GLB can only be promoted when its sidecar declares:

```json
"modelIdentity": {
  "id": "linen-earth-studio-model-v1",
  "referenceImage": "/designer/studio-tucked.webp"
}
```

Blender preparation stamps this identity into the scene. Preflight rejects a missing or unlocked identity. Export propagates the identity into the viewer manifest. The browser then rejects a production manifest that points to any other mannequin.

The four customer camera presets are the same turntable angles used by the Real Model Designer: **0°, 35°, 90°, 180°**.


## Shared physical target metrics

The identity JSON now owns the physical front-silhouette targets used by both the deterministic web model and the Blender production-body intake: 1727 mm height, 388 mm shoulder seam span, 574 mm outer arm silhouette, 294 mm shirt waist, 344 mm trouser waist, 500 mm hand-centre spacing, 210 mm leg-centre spacing and 64 mm trouser hem width.

The Blender body-preparation script creates a non-rendering `LinenEarthIdentityGuides` collection from the same identity file. These guide bars are the production sculpt/fit target; they are not exported as customer geometry.
