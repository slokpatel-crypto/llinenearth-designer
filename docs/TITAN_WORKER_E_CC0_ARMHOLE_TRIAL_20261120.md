# TITAN Worker E — Original CC0 armhole face-ownership experiment

Status: **UNMERGED RESEARCH / NOT PRODUCTION APPROVED** (2026-11-20).

## Physical source and controlled change
The identity `linen-earth-studio-model-v1`, the photograph `/designer/studio-tucked.webp`, the scanned CC0 body, its locked guides, the 7 mm body offset, the 1.6 mm default fabric thickness, established source garment selections for torso and trousers, and UV rendering stay unchanged. No new mannequin is generated.

The current original garment source partitions torso faces at |x−center| ≤ 245 mm and sleeve faces at |x−center| ≥ 155 mm. This means the same original scanned body faces can be cloned into both torso and sleeve shells within the shared 90 mm side region. Native world-space BVH detected 1,434 torso/left-sleeve and 1,345 torso/right-sleeve intersecting pairs in the existing candidate.

The optional `--experimental-disjoint-armholes` flag instead assigns arm source faces only beyond the torso 245 mm boundary. This is a controlled **candidate surface change**, not a sewn armhole reconstruction. It may reduce duplicated source polygons but create open/too-short sleeve joints. Unmodified authoring remains the default, and this trial never changes the customer GLB.

## Independent evidence workflow
`.github/workflows/titan-research-armhole.yml` uses checksum-verified official Blender 4.5.14 and the original pinned Blender Human Base Meshes v1.4.1. It authors both original and disjoint scenes from the same identity-locked body and verifies the original body source file was not altered. Blender fixtures count actual original shared source-face indices and the evaluated world-space BVH intersections for torso/sleeve, sleeve/leg and sleeve/sleeve pairs. They require same body SHA-256 and unchanged model lock, record all before/after counts and do not claim a physical repair. Four true camera views (0°, 35°, 90°, 180°) are rendered from the trial .blend with frame SHA-256, while all approved-status manifest flags remain false.

## Promotion blockers
Do not merge this trial until independently reviewed full topology/sewing feasibility, native armhole gap and cuff-to-hand measurements, all 15 garment-panel and body/garment intersections, photographed front/three-quarter/side/back identity and grain/UV orientation checks prove no new defects. Passing synthetic fixtures alone is insufficient; unmeasured fabric repeat, genuine cloth drape and tailor fit must remain unknown. No Vercel deploy or live data mutation.
