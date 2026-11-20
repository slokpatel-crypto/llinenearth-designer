# TITAN Worker E — Original CC0 armhole face-ownership experiment

Status: **UNMERGED RESEARCH / NOT PRODUCTION APPROVED** (2026-11-20).

## Physical source and controlled change
The identity `linen-earth-studio-model-v1`, the photograph `/designer/studio-tucked.webp`, the scanned CC0 body, its locked guides, the 7 mm body offset, the 1.6 mm default fabric thickness, established source garment selections for torso and trousers, and UV rendering stay unchanged. No new mannequin is generated.

The current original garment source partitions torso faces at |x−center| ≤ 245 mm and sleeve faces at |x−center| ≥ 155 mm. This means the same original scanned body faces can be cloned into both torso and sleeve shells within the shared 90 mm side region. Native world-space BVH detected 1,434 torso/left-sleeve and 1,345 torso/right-sleeve intersecting pairs in the existing candidate.

The optional `--experimental-disjoint-armholes` flag instead assigns arm source faces only beyond the torso 245 mm boundary. This is a controlled **candidate surface change**, not a sewn armhole reconstruction. It may reduce duplicated source polygons but create open/too-short sleeve joints. Unmodified authoring remains the default, and this trial never changes the customer GLB.

## Independent evidence workflow
`.github/workflows/titan-research-armhole.yml` uses checksum-verified official Blender 4.5.14 and the original pinned Blender Human Base Meshes v1.4.1. It authors both original and disjoint scenes from the same identity-locked body and verifies the original body source file was not altered. Blender fixtures count actual original shared source-face indices and the evaluated world-space BVH intersections for torso/sleeve, sleeve/leg and sleeve/sleeve pairs. They require same body SHA-256 and unchanged model lock, record all before/after counts and do not claim a physical repair. Four true camera views (0°, 35°, 90°, 180°) are rendered from the trial .blend with frame SHA-256, while all approved-status manifest flags remain false.


## Native results and independent four-angle inspection — 2026-11-20

Exact experimental source head `699bec4eae31ef5c2d1f93c13f4562e3d674bf75`, [native source run 44775486700](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44775486700) **passed**. Source body mesh SHA-256 remained `db195b223b23c1f501fc24cc20d20456d9c4d6cd6e63d2204b489b133f39df76` in both scenes. Original armhole source-face duplication reduced 191/190 to 0/0, while real world-space BVH contacts changed:

| Real crossing | Original | Disjoint trial | Remaining blocker |
| --- | ---: | ---: | --- |
| Shirt torso / left sleeve | 1,434 | 88 | 88 |
| Shirt torso / right sleeve | 1,345 | 67 | 67 |
| Left sleeve / left trouser leg | 1,109 | 1,052 | 1,052 |
| Right sleeve / right trouser leg | 989 | 931 | 931 |
| Left sleeve / right sleeve | 0 | 0 | 0 |

Four unchanged-source camera views were rendered and hashed at 0°/35°/90°/180°. **Manual inspection did not approve them:** the garment panels closely follow the anatomical source body rather than a convincing tailored shirt/trouser silhouette; cut edges remain prominent across the chest, arms, hip/seat and trouser joins, and finished collar/cuff/placket construction is absent. The trial may have introduced open armhole gaps not quantified by BVH intersection counts. No production garment, likeness, cloth physics or drape claim is supported. Keep this branch unmerged.


Additional pixel-level comparison of the saved 480×640/8-sample native frames (same body, scene, camera and lighting) with the original candidate gave whole-frame RGB RMSE values **0.249 front, 0.343 three-quarter, 0.324 side, 0.482 back** on a 0–255 channel scale. Therefore the contact-count reduction is **not accompanied by a materially different or visibly corrected shirt/trouser silhouette** in these diagnostic render settings. These are internal before/after image diagnostics, not photograph-match acceptance or real garment fit evidence.


## Original source cut-edge topology — independently measured (2026-11-20)

Exact native Blender [research run 44784063060](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44784063060) passed using the same pinned real CC0 source body and model identity; the offline pinned-source-mirror tests (3 cases) and native adversarial edge topology fixture passed. The original body face boundaries were independently reconstructed from polygon incidence and measured in original world coordinates:

| Original-source armhole metric | Baseline left / right | Disjoint left / right |
| --- | --- | --- |
| Source torso cut edges | 246 / 246 | 246 / 246 |
| Source sleeve cut edges | 102 / 102 | 82 / 82 |
| Near-interface torso edges | 38 / 38 | 38 / 38 |
| Near-interface sleeve edges | 36 / 36 | 38 / 38 |
| Identical original-source cut edges | 0 / 0 | 38 / 38 |
| Torso-to-nearest sleeve cut midpoint median | 91.470 / 91.487 mm | 0 / 0 mm |
| 90th-percentile source cut midpoint distance | 108.658 / 108.728 mm | 0 / 0 mm |

**Interpretation:** The geometry trial improves *original body source polygon ownership*: 38 matching interface source edges on both sides, rather than source selection boundaries separated by approximately 9 cm. This is measured on the original body cut **before** separate garment modifiers. The 88/67 residual torso-sleeve BVH crossings and remaining sleeve/leg crossings remain real. Zero source cut distance must **never** be called closed post-thickness cloth, watertight sewing, calibrated fabric pattern, photographic fit or tailor acceptance. The trial stays unmerged pending post-modifier seam evaluation and original-photograph review.

## Promotion blockers
Do not merge this trial until independently reviewed full topology/sewing feasibility, native armhole gap and cuff-to-hand measurements, all 15 garment-panel and body/garment intersections, photographed front/three-quarter/side/back identity and grain/UV orientation checks prove no new defects. Passing synthetic fixtures alone is insufficient; unmeasured fabric repeat, genuine cloth drape and tailor fit must remain unknown. No Vercel deploy or live data mutation.
