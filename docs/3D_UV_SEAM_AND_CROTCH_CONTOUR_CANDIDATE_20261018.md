# Source-locked 3D candidate — seam continuity and crotch contour (2026-10-18)

**Branch:** `work/uv-seam-spatial-evidence-20261018`, draft PR #311, stacked on draft PR #309. This is candidate engineering only, **not approved production geometry**. Do not merge, deploy, change the customer photographic Designer Studio, or replace the existing locked `linen-earth-studio-model-v1` identity.

## Task 1: collision-safe trouser crotch contour

The source-locked native Blender evidence preceding this change reported roughly 100 inter-leg overlap pairs at a nominal 0-mm leg-gap correction. A 4-mm inner-seam separation trial removed inter-leg collisions but introduced 36/24 garment-vs-body collision pairs. Those measurements are historical evidence **not** proof the new contour trials work.

The new trial sequence retains all five original 65-mm lateral-falloff contour amplitudes (2, 4, 6, 8, 10 mm), then tries nine bounded alternatives (30, 45 and 80 mm lateral falloff, each at 3, 4 and 5 mm peak). Every trial starts from **the exact same original garment XYZ geometry**, attempts body-normal contact correction only when already leg-separated, and independently checks both trouser shells against each other and the locked body with world-space BVH. An unsuccessful trial restores every garment vertex's X/Y/Z; the original body is never moved. Zero-contact is required before any changed trial is retained.

The report now records the selected peak **and** the exact lateral falloff width, individual BVH counts and repair details. Native evidence must determine whether any trial succeeds; do not advertise the reduced gap until it does.

## Task 2: metric fabric seams

A pure Python edge auditor compares per-loop UVs at the two **same source-mesh vertices** on every adjacent pair of polygons, detecting real interior UV discontinuities, nonmanifold edges and their source polygon IDs. It retains metre units, bounded samples and explicit millimetre jump sizes. A newly added safe cylindrical phase pass removes only integer-full-turn angular-origin offsets when *both shared edge endpoints* have identical physical V and the U offsets match the estimated circumference within 0.01 mm. It never stitches the source's ambiguous per-face tangent charts, twisted panels or nonmatching grain.

The Blender candidate author records these seam counts and phase-alignment receipts. The independent preflight recomputes the shared-edge map from evaluated mesh geometry and **fails closed** for unreviewed discontinuities or nonmanifold topology, in addition to the existing cylinder/tangent-chart block and body/sleeve/leg collision constraints.

A numerically continuous UV surface alone does not prove cloth construction, textile manufacturer repeat, measured grain direction, realistic drape, approved seams, lighting or photo identity. No supplier data or tailor signature has been invented.

## QA and release boundary

New unit regressions cover adjacent continuous/discontinuous edges, cut-chart exclusions, nonmanifold topology, invalid metric coordinates, full-turn cylindrical phase correction, bounded crotch contour variants and full XYZ rollback in Blender. Source native CI uses `.github/workflows/model-source-candidate.yml`; a real pass/fail result and four-angle source photo comparison must be read from **the latest commit's workflow**, not inferred from static fixtures. The independent source preflight can fail while all unit tests pass.

**Outstanding production gates:** native zero-contact trousers + body, sleeve spacing within the locked identity guide without skin penetration, actual six-panel seam topology (including the known ambiguous sleeve/leg faces), vendor-measured textile scale/grain and fit/ease, source-vs-reference photo parity at four angles, human tailor approval, desktop/mobile browser QA and major-milestone authorization. Until evidence exists, keep this candidate draft and production unchanged.


## Task 2 continuation: conservative metric local-chart stitch (draft)

The candidate UV author now attempts **rigid rotation/translation only** of the source-derived ambiguous tangent-chart faces against already anchored adjacent cylinder faces. Both vertices of the *same mesh edge* must agree within 0.01 mm, source/target edge lengths must agree without stretch, rotation is limited to 8°, and the change must reduce discontinuities **without breaking any previously continuous neighbour edge**. Nonmanifold topology rejects chart modification entirely. The original per-face mesh positions, model identity and garment geometry are untouched.

The independent evaluated-mesh seam preflight still fails on remaining discontinuities, and all ambiguous charts **remain explicitly unapproved** even when their numeric UV endpoints happen to join. Numeric alignment cannot establish factory grain, textile repeat, a physically constructed seam, accurate drape or owner/tailor approval. Review the **new native CI logs** to learn whether any of the 83/85 sleeve and 38/38 leg seam defects can be safely reduced; no reduction is claimed without a run.


## Native verified candidate outcome and next UV-cut classification

Source workflow [39120510114](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/39120510114) executed source-locked Blender authoring, independent preflight and rejected diagnostic renders on `e5af903ab8af012b06466fe371ba125d8b6d4437`. The conservative tangent-chart rotation/translation did **not** lower the actual discontinuity counts: **83/85 sleeve and 38/38 leg** source-mesh interior UV breaks remain, including 4/4/2/2 unapproved tangent faces. The garment-only leg-gap result remained 3 mm per leg with no collision pairs; the sleeve trial again accepted only 11 mm per sleeve and measured 563.4 mm against 500 ±36 mm. The scene gate **failed as intended**; this evidence is not production-ready.

The next isolated change classifies these genuine tears into: (1) a cylinder **integer-circumference full-turn cut candidate**, (2) an edge adjacent to an **unapproved near-axis tangent chart**, or (3) a **nonperiodic discontinuity** that cannot be repaired with a periodic shift. The audit never quietly blesses any group as a sewn seam. This helps distinguish unavoidable periodic chart cuts from incorrect grain/UV layout before choosing a real garment seam path. Native counts must be read from a new run; no improvement is presumed.
