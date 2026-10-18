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


## Continued next work — source-cut graph and phase safety (2026-10-18)

The source-derived UV cut classifier now groups **all** genuinely shared, discontinuous source polygon edges into connected components by their original mesh vertex IDs and failure class, rather than relying on the first 16 sampled failures. It distinguishes a simple open path, a closed-cycle *candidate*, and a branched group (junction count >2). This is topology for an actual tailor/UV seam review, **not** proof of sewability or a declared pattern grain; sampling affects only printed examples, never graph totals. The authoring stage attaches/prints this diagnostic on both sleeves and trouser legs. Exact integer-turn candidates, unapproved tangent boundaries, and nonperiodic tears remain separate groups.

The previously existing full-turn UV phase stitcher is now **transactional per connected candidate chart component**: after each candidate phase change, the audit requires (1) no inconsistent graph cycle in that component, (2) no pre-existing shared-edge continuity lost anywhere, including across deliberately excluded tangent faces, and (3) no increase in the full real shared-edge tear count. An unsafe component trial leaves *all* of its source face UVs unchanged and records an explicit rollback reason and count; a separate, provably safe component can still be accepted. Geometry positions are never changed. Dedicated tests exercise the inconsistent closed ring, protected tangent-chart continuity, independent safe-component salvage, two-edge paths, forked topology, and closed UV tear cycles.

**No seam-placement approval or fabrication claim:** a connected UV-cut group does not establish sewing allowance, true factory selvage, grain direction, material repeat, likeness to the locked reference photograph, calibrated drape, correct sleeve spacing, or tailor authorization. Native Blender workflow and independent preflight remain authoritative; after every commit, read the exact HEAD's run status. Keep PR #311 **DRAFT / NO MERGE / NO DEPLOY**.


## Continued Task 2 — full source-cut inventory and independent scene verification

A 16-item sample can hide a source UV seam group even when its edge count was
aggregated correctly. The candidate diagnostic now inventories **every** cut
component separately by classification (periodic cylinder cut, near unapproved
tangent face, or nonperiodic tear), recording total edge count, number of
branches, highest junction degree and, only when actual source vertex XYZ is
available, summed path length, longest path and maximum vertical span in mesh
millimetres. Group totals are independent of the sample limit, including zero.
No numerical output describes real cloth grain, actual flat pattern, sewn
allowance, factory repeat, GSM, bending, verified drape or clothing approval.

A new separate evaluated-Blender preflight now recomputes each sleeve/leg cut
report from its **evaluated** mesh UV loops and mesh XYZ, then compares the
**complete unsampled group inventories**, classification totals and metric
extents to the author's stored receipt. Missing authoring evidence, changed
topology, altered metrics, unmeasured geometry or spoofed approval flags fail
closed. Metric comparison permits at most 0.25 mm numerical drift for floating
point source-scene quantization; no release threshold is relaxed. Unit
regressions check disconnected hidden groups, absent XYZ, tampering, scale
drift, false approval and invalid tolerances.

This remains an unapproved diagnostic on the **original** locked source body,
not a fix for the locked hand spacing, an authored seam, fabric construction or
photo identity. Native Blender and independently completed CI/browser
workflows on the exact final commit are required before any further claim.
The six-pane customer garment and original photographic Designer Studio are
not replaced, PR #311 remains **DRAFT**, and no main merge/deployment is
authorized.
