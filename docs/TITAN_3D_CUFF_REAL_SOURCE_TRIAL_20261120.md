# TITAN 3D Worker E — real CC0 cuff/hand alignment research

Status: experimental research only. The customer model, body and production
GLB remain unchanged.

The real original CC0 source has measured sleeve-center spacing of 574.71mm
against the identity-locked photographed hand-center target of 500±36mm.
Reducing that difference is not automatically good tailoring: moving sleeves
could introduce genuine body penetration or sleeve/trouser crossings.

New source-backed native Blender trials move ONLY lower sleeve geometry
inward by 0, 10, 20, 30 or 37mm per sleeve, with a smooth vertical
145mm fade ending at the original photographed hand-height guide.
For each candidate it independently counts all six body-to-garment and
15 garment-to-garment BVH pair categories, the same exact 0.5mm epsilon
as physical preflight. A trial is marked interesting ONLY if the cuff
spacing becomes closer to the 500mm target AND no body/garment contact
category increases. It can still have outstanding physical defects.

The original 1727mm scanned body, four other garments, six-panel source
geometry, source .blend hash and exact photographed model identity never
change. Only synthetic fixture meshes are modified and restored in tests.
On the real body, every simulated shift restores the original vertices
before the next shift and before the process exits. The workflow archives
only JSON native evidence; it never produces or promotes a research GLB.

Exact-head workflow: TITAN — RESEARCH original CC0 photographed cuff geometry.
Fail-closed controls: source signature/identity, exact official Blender and
CC0 bundle versions, zero baseline movement, 21 real contact categories,
no hidden increased intersections, no physical approval flags.

Even a good trial cannot certify cuff sewing, real textile repeat, collar,
trouser fit, four photographic angles or tailor/owner acceptance.
Do not merge this geometry experiment into default authoring.
See research PR and latest native evidence for measured outcomes.

The synthetic Blender geometry fixture applies primitive location before
moving cuff vertices. The actual source-authoring contract requires identity
object transforms; moving local vertices on an un-applied translated mesh
could silently shift the wrong physical-height band. The native trial now
rejects translated/rotated/scaled garment objects rather than inventing a
new coordinate frame. No native result may be claimed until exact-head QA.
