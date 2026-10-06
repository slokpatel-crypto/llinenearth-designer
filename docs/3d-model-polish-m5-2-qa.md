# Linen Earth Live Designer 3D Model — M5.2 QA

This file exists to trigger and document the full CI verification for the completed model-polish milestone.

## Identity lock

- Canonical identity: `linen-earth-studio-model-v1`
- Reference: `/designer/studio-tucked.webp`
- Reference height: 1727 mm
- Front / 3/4 / side / back use one fixed model.

## Measured visible-model targets

- Total height: 1727 mm
- Shoulder seam width: 388 mm
- Outer arm silhouette: 574 mm
- Tucked shirt waist width: 294 mm
- Trouser waist width: 344 mm
- Hand-centre spacing: 500 mm
- Leg-centre spacing: 210 mm
- Trouser hem width: 64 mm

The model build now fails if these values drift outside their narrow tolerances.

## Visible polish

Faceless ivory head, neck, articulated mannequin hands, classic point collar, cuffs and cuff buttons, shirt placket/buttons, tucked waist transition, trouser waistband/fly/button/belt loops, front creases, tailored lower-leg break and white shoe/sole/lace treatment.

## Next-stage boundary

The CC0 MakeHuman body source is retained separately as a non-visible collision source for the upcoming fabric/drape engine. It is deliberately not rendered in M5.2 so the approved Linen Earth silhouette is not changed by a generic anatomical body.
