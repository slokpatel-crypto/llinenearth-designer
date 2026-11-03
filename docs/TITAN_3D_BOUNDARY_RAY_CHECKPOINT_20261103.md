# TITAN 3D — fixed original cut-edge versus original-body ray evidence

Status: **research only; NOT production geometry, physical fit, UV, sewing, or cloth approval**.

## Exact lineage

- Parent: [draft PR #857](https://github.com/slokpatel-crypto/llinenearth-designer/pull/857), head `f251cf2ada1b8d7c30f84188143850d724a7ad7b`.
- Branch: `work/titan-3d-source-boundary-body-ray-20261103`, stacked on #857 rather than rebasing old source experiments onto independent `main`.
- Model identity: `linen-earth-studio-model-v1`; original `/designer/studio-tucked.webp` remains the authoritative photo.
- This branch changes the non-export original-source research script, exact native rejection workflow assertions, and a dedicated unit invariant test. Do not merge stacked research without resolving parent dependencies and verifying exact-head checks. Do not deploy Vercel.

## What prompted this follow-on

The actual Blender 4.5.14 source job [41633611168](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41633611168) passed as an **evidence/rejection** job, NOT as acceptance:

- Unchanged actual full garment preflight: **10 hard physical blockers**.
- Real source bridge: **6 triangles, 132 → 126 open boundaries, 20 original-body BVH pairs**.
- Controlled 18-triangle body-normal 7 mm displacement: **20 → 139** BVH pairs; contacting bridge area **454.3199 → 3215.2379 mm²**, worsening contact.
- Bounded radial alternative on same 18-triangle topology: **20** pairs; contacting area **630.6605 mm²**, not an improvement.
- Worst original cut-edge pairing: left `[216,217]` / right `[1580,1581]`; **17 of 20 original source bridge contacts**, so its simple interior-centroid displacement was inadequate.
- Targeted fixed-quad normal control: **16** body BVH pairs; positive-normal **18**, negative-normal **31**. None approved, and no change to the six original garment meshes.

## Narrow next experiment

On the original locked body BVH, cast an actual finite world-space ray along each of the **four immutable research-patch perimeter edges** for the worst original seam pair. Keep the real left/right source cut segments explicitly distinct from the two synthetic bridge connectors. Trim only the first/last 0.01 mm (or a safe shorter span) to detect *strict interior* ray/triangle hits without counting endpoint coincidences.

Report the original segment identity, edge kind, length, original-body hit flag and first intersected original-body polygon/distance. Assert the two original source cut edges are exactly members of the same four-vertex research patch, with finite nondegenerate measurements and no changes to the original body, six production garments, or research geometry.

The same locked original-body BVH additionally supplies **seven nearest-surface samples on each boundary edge**, at interior fractions 1/8 through 7/8. Report finite per-edge sampled minimum/maximum unsigned body distance, nearest original-body triangle IDs and the number of original source-edge sample points below the **research-only 7 mm** clearance threshold. A single below-threshold original edge sample demonstrates that preserving that exact edge cannot achieve a 7 mm separation everywhere, but no collection of seven samples proves continuous clearance. These are not UV, texture, garment thickness, body-inside/outside or tailor-fit certificates.

If a real original cut edge has a strict interior hit, moving only the patch interior centroid cannot remove that intersection while preserving the edge unchanged. If no hit is found, **do not infer clearance**: a ray may miss tangencies, close parallel contact, cloth thickness, inter-leg intersections and the other physical fit blockers. The synthetic connector rays are never treated as approved original seam evidence.

## Acceptance conditions

- [x] New isolated non-export diagnostic and exact original cut-edge provenance check implemented.
- [x] Native workflow assertions and regression guard added (not equivalent to a passing run).
- [x] Seven-point original-body proximity sampling added to the same bounded diagnosis, with explicit uncertain-continuity caveat.
- [ ] New exact-head **native Blender** workflow successfully executes the original CC0 body ray tests and uploads truthful numbers.
- [ ] Exact-head CI, non-3D QA, Blender collision and independent source jobs pass; review all relevant logs.
- [ ] Independent physical source pattern reconstruction, zero-intersection preflight, UV grain/scale, sewing allowances, four-angle visual proof, true textile supplier values and tailor fit approval remain **unmet**.

**Production approval remains false regardless of ray test result.** No GLB, blend, or source photographic model export.
