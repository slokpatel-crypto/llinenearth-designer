# Linen Earth Live Designer 3D Model — M5.2 Final QA

Full CI verification marker for the completed model-polish milestone.

## Identity lock
- Canonical identity: `linen-earth-studio-model-v1`
- Reference: `/designer/studio-tucked.webp`
- Reference height: 1727 mm
- Front / 3/4 / side / back use one fixed model.

## Build-enforced measurements
- Total height: 1727 mm
- Shoulder seam width: 388 mm
- Outer arm silhouette: 574 mm
- Tucked shirt waist width: 294 mm
- Trouser waist width: 344 mm
- Hand-centre spacing: 500 mm
- Leg-centre spacing: 210 mm
- Trouser hem width: 64 mm

The generator fails when these values drift outside their narrow tolerances.

## Visible model polish
Faceless ivory head, articulated mannequin hands, point collar, cuffs/cuff buttons, shirt placket/buttons, tucked waist transition, trouser waistband/fly/button/belt loops, front creases, tailored trouser fall and white shoe/sole/lace treatment.

## Drape-engine boundary
The CC0 MakeHuman body source is prepared separately as a non-visible collision source for the next fabric/drape phase. It is deliberately not rendered so the approved Linen Earth visible silhouette remains unchanged.

QA rerun includes the patched source-map-js 1.2.2 dependency and updated M5.2 quality-gate expectations.
