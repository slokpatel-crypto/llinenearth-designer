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

## Measured native Blender 4.5.14 evidence on the original six CC0 meshes

Three independent **candidate-only** source runs were compared, with no
changes to actual geometry or the physically rejected original:

| UV experiment | Structural collapsed triangles | Discontinuous shared mesh edges | Source conclusion |
|---|---:|---:|---|
| Original x/z planar source layer | 0 | **0** | Structurally contiguous but textile/warp mapping and physical scale unverified |
| First cylindrical candidate with normal-selected caps | 0 | **3,162** | Native geometry intact, but excessive projection-created chart cuts |
| Continuous cylindrical projection with geometric collapse fallback | 0 | **552** | Fewer arbitrary breaks; not a sewn chart |
| Rear (+Y) oriented cylindrical projection | 0 | **313** | 308 rear-side and 5 front-side breaks; physical model still rejected |

The last run measured these per-panel UV discontinuities: shirt torso 74,
left sleeve 65, right sleeve 62, trouser waist 112, left leg **0**, right leg
**0**. The real four-view candidate render remained diagnostic only, and
the original and altered UV preflights each rejected the same **16 physical
blockers**. The actual source did not contain collapsed UV triangles, so
claiming this work *repaired* a UV collapse would be wrong. The contribution
is a measured reduction in the experimental projection's unintended seam
discontinuities and a more defensible rear-side chart-cut placement.

Evidence: native runs
[44795447974](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44795447974),
[44796165386](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44796165386)
and [44796788134](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44796788134).

The workflow also archives a **RESEARCH-NOT-PRODUCTION** source-derived
Blender `.blend` for source/UV seam inspection after all native checks pass;
it must not be deployed, treated as an approved 3D model, or used to
manufacture garments without physical evidence.


## Measured 2026-11-20 source-face periodic alignment, not a textile release

Source-derived pinned Blender 4.5.14 run [44809344414](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44809344414) **passed native UV, original CC0 six-panel source, preserved world-space contact matrices, unapproved GLB-preflight rejection and all four hashed candidate-only view images**. This experiment adds source-edge weighted union-find constraints that align neighboring UV faces by whole `2π × mesh-measured radius` circumference turns. The front (-Y) edges receive higher priority than rear (+Y) edges. Disallowed/no geometric overlap or original UV modifications.

| Original CC0 panel | Research seam edges before alignment | After alignment | Front seam edges after | Seam length after |
|---|---:|---:|---:|---:|
| Shirt torso | 74 | 56 | 0 | 1,297.760 mm |
| Left sleeve | 65 | 59 | 4 | 1,114.959 mm |
| Right sleeve | 62 | 50 | 1 | 957.278 mm |
| Trouser waist | 112 | 62 | 0 | 928.272 mm |
| Left trouser leg | 0 | 0 | 0 | 0 mm |
| Right trouser leg | 0 | 0 | 0 | 0 mm |
| **Total** | **313** | **227** | **5** | **4,298.269 mm** |

Front-facing seam length: **83.357 mm**. Native union-find solved
**16,364** source-edge face joins and recorded **219 conflicting
circumference-turn constraints** across six panels. There were no geometric
mutations; Blender export preflight still explicitly rejected the original
body/garment asset with the same **16** physical and photographic reasons.
The original x/z UV0 chart itself had **0 discontinuous edges** and
**0 collapsed UV triangles** on this source; do **not** interpret the
experimental 227 edges as an improvement over UV0. This experiment is useful
only as a measured approach to surface-aware grain mapping with fewer
artificial rear cuts, before genuine seam topology/warp-weft review.

The 4.3 metres of unsewn UV discontinuity and the five front edges **block
production use** of this research UV. Geometry proportions, actual neckline
and armholes, collar/cuffs, trouser crotch, realistic drape and original-photo
four-angle match remain **unapproved**. Never infer measured cloth repeat,
pocket/collar construction or real fit from these synthetic/CC0 tests.
