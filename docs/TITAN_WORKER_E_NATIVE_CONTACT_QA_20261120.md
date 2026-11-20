# TITAN Worker E — native garment 3D contact matrix and four-view evidence

Date: 2026-11-20  
Identity lock: `linen-earth-studio-model-v1` and `/designer/studio-tucked.webp`

## Verified original blocker, NOT a completed physical repair
GitHub issue #823 records authentic Blender 4.5.14 CC0-source body collisions, leg/leg crossings, tucked shirt/waist intersections and photographed-silhouette mismatches. Original source Blender meshes are not physically accepted. This change **does not** invent a mannequin, resize the body, relax geometry tolerances, or claim a new pattern/fit/drape sign-off.

## New native fail-closed geometry acceptance
The native preflight previously measured all six body/garment pairs but only 2 of 15 distinct garment-to-garment pairs. It now measures the other **13** actual world-space BVH contacts, also reports the original two values as a complete `garmentPairIntersections` matrix, and blocks missing/unevaluable pairs. All previously unreviewed cross-panel contacts have a zero-contact requirement; the existing trousers leg/leg zero-contact and tucked shirt/trouser 120-pair tolerance are unchanged. Sewn armholes, side seams and waist joins require independently verified mesh topology/construction review before allowing any deliberate overlap. No numeric body/photo tolerances have changed.

## Native QA
- `tests/blender/test_all_garment_pair_contacts.py` uses actual evaluated Blender cube surfaces, not faked contact counts. It verifies 13 excluded-gate pairs, zero-contact controls, real sleeve/leg and torso/sleeve penetration, and fail-closed missing panels.
- Native collision workflow runs this test beside real world-BVH and evaluated UV triangle tests.
- The source-candidate **rejection-evidence** workflow runs the test and renders front 0°, three-quarter 35°, side 90°, back 180° from a single authored source scene, at an explicitly labeled diagnostic 480×640/8-sample setting. It checks identity, reference photograph, image SHA-256, all unapproved flags and a byte-for-byte unchanged source .blend.
- The artifact archives these same-source **QA candidates**, not replacement photographic mannequins or customer-facing GLBs.

## Remaining production blockers
Actual source garment topology, original photographic four-angle visual comparison, UV seam/physical grain/repeat verification, true body and garment collision elimination, cloth alignment and owner/tailor-reviewed fit remain **blocked**. Any UV unwrapping or collision-remediation modeling experiment must remain in a separate unmerged research branch until real Blender before/after data and independent acceptance prove no regressions.

## Reproduce
```sh
blender --background --factory-startup --python-exit-code 1 --python tests/blender/test_all_garment_pair_contacts.py
npm run quality
npm test
npm run eval:engine
npm run eval:preview-performance
npm run release:check
npm run build
```
Run the exact-head GitHub native source-candidate and collision workflows. No Vercel deploy, live database write, real-world fit claim or model promotion.
