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

## Actual pinned real-CC0 native findings — 20 November 2026

Exact-head Blender native run [44809818798](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44809818798)
**passed as a rejection-quality research measurement**, not a fit approval.
The evidence is the unmodified original CC0 six-panel source, model ID
`linen-earth-studio-model-v1`; original source .blend hash and every original
mesh was restored after the virtual displacement trials.

| Inward shift / sleeve | Measured cuff spacing | Extra left/right sleeve-body contacts | Reduction in left/right sleeve-leg contacts | Research gate |
|---|---:|---:|---:|---|
| 0 mm control | 574.711 mm | 0 / 0 | 0 / 0 | No movement |
| 10 mm | 554.713 mm | +882 / +867 | -967 / -848 | REJECT |
| 20 mm | 534.715 mm | +729 / +721 | -968 / -846 | REJECT |
| 30 mm | 514.716 mm | +762 / +759 | -983 / -863 | REJECT |
| 37 mm | 500.718 mm | +772 / +771 | -979 / -857 | REJECT |

All four actual translations worsen native body–sleeve penetration, even
when sleeve/trouser crossings improve dramatically. The 20mm shift crosses
the allowable cuff-spacing tolerance (536mm upper limit), yet it adds
729 and 721 genuine body-sleeve intersecting triangle pairs.
The 37mm shift nearly matches the 500mm centre target but adds
772/771 intersections. **No translation candidate is safe for further
production geometry use.** The geometric conflict is real: sleeve cuffs
cannot be pulled into the photographed hand positions while retaining
the old anatomical body-derived sleeve surface without penetration.

**Engineering implication:** the next model revision must explicitly
reconstruct garment sleeve and cuff construction over the locked body,
including armhole seam and clearance, rather than translate inherited
skin-shell fabric as if it were a sewn cuff. UV phase and cuff-to-hand
clearance must also be reviewed in all four canonical views.

Native trial report: `titan-cuff-original-source-contact-audit` artifact,
with the complete 21 contact-pair counts on each of the five candidates.
The export and default six-panel source remain unchanged; do not merge
this displacement algorithm into production.
