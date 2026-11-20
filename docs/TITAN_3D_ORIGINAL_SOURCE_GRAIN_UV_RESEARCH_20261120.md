# TITAN 3D — original CC0 source-surface UV research

Date: 2026-11-20. **Research only; do not merge to production or advertise as a completed model.**

## Actual model and preserved identity

Canonical Real Model Designer photo: `/designer/studio-tucked.webp`.
Locked identity: `linen-earth-studio-model-v1` (1727 mm height, same source in all four views).
Real Blender 4.5.14 pinned CC0 human-body bundle v1.4.1 remains the sole body source for the experiment.
No replacement mannequin, retargeted body, new 3D asset, outfit photograph or customer-facing GLB is produced.

## Original defect being investigated

The candidate's six meshes are UV-mapped using only x/z world coordinates. A planar
x/z map projects the two horizontal solidified rims into zero UV area and can
collapse some circumferential side faces, even when the original source mesh
triangles have positive geometric area. The current preflight only checks
nonfinite and collapsed UV triangles; that is necessary but does not prove
seam placement, real fabric grain direction, yarn count, measured pattern
repeat or physical drape. Existing native source evidence still has six
body/shell penetrations and multiple panel-panel crossings. This research
**does not address those geometry and fit blockers**.

## Implemented candidate algorithm

`scripts/blender/research-source-grain-uv.py` adds a second, named
`TITAN_RESEARCH_SURFACE_GRAIN` UV layer to each original Blender authored
garment panel. The primary candidate unwraps circumferential surface
longitude at an observed (geometry-derived) radius and uses height as the
longitudinal coordinate. Horizontal cap faces project in x/y. Whenever a
triangulated face degenerates under that projection, an actual polygon-normal
dominant-axis fallback is tried; unresolved UV degeneracy rejects the trial.

All UV coordinates are **geometry-space metres**, not measured textile repeat
data. Caps, open seams, body/arm tilt and polar unwrap seams require later
tailor/textile and native seam-chart acceptance. Existing UV data is untouched,
the original source body is byte/geometry preserved, and each panel's exact
world vertices and polygon topology must remain unchanged.

The research report separately counts **true source-mesh boundary edges,
non-manifold edges and candidate UV discontinuities across shared polygon
edges**, comparing original vs experimental UV layers. The new cylindrical
projection can cure collapse while *introducing unsewn UV chart breaks*;
that tradeoff is recorded, never silently treated as a finished pattern.
The report preserves these counts even where native UV triangle area passes.

## Reproducible native QA

The isolated `TITAN — RESEARCH original CC0 surface-grain UV` workflow:
1. Downloads official Blender 4.5.14 with the pinned published SHA-256.
2. Runs real Blender cylinder/rim, invalid-source and unchanged-geometry fixture.
3. Bootstraps the exact pinned CC0 source and the existing original six-panel
   authorer, without replacing the locked body.
4. Writes a distinct unapproved candidate .blend, JSON report and preserves
   the source blend byte-for-byte.
5. Runs the **same** preflight on control and candidate. All 15 garment-panel
   contacts, body/garment contact values, model identity and every non-UV
   rejection reason must be identical; only actual UV nonfinite/collapse
   rejections may disappear. It must still be rejected as a production model.
6. Renders source-derived front/3-4/side/back diagnostic views, checks image
   hashes, source-file preservation and explicit unapproved status.
7. Uploads diagnostics only. It never exports or promotes a production GLB,
   deploys Vercel, writes live customer/stock data, or claims tailor fit.

## Production gate remains open

- Original six mesh body/garment and garment-to-garment contact matrix cleared.
- Collar, cuffs, armholes, waist, crotch, hems and sewn topology approved on
  actual source meshes, not via collision-count tolerances.
- Full UV chart seam network, cross-panel continuity, warp/weft direction and
  **supplier/physically measured** repeat millimetres validated.
- Four-angle photographic match to existing identity, device/browser QA and
  owner/tailor fit approval with real evidence.
- Only then independently review and consider an approved export. This
  research branch is intentionally unmerged, including if all CI is green.
