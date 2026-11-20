# Worker E — real CC0 garment UV surface-grain candidate, NOT production approved

**Branch:** research/titan-worker-e-native-surface-grain-uv-20261120  
**Source:** pinned Blender 4.5.14 Human Base Meshes v1.4.1 six-panel candidate  
**Model identity:** linen-earth-studio-model-v1, /designer/studio-tucked.webp

## Actual 3D engineering
The current body-derived shirt/trouser candidate uses a planar X/Z UV
projection. On a 3D surface, cap and fabric-thickness rim triangles can have
nonzero physical triangle area but zero UV triangle area. This makes stripes,
weave and fabric repeat unusable around side angles.

This research produces a **second .blend** from the identical locked CC0
candidate: six evaluated physical panels stay geometrically byte-identical,
and each keeps the original UV as a separate untouched layer. A new
TITAN_SurfaceGrain_RESEARCH layer follows each panel's *actual scanned*
longitudinal axis, uses angular surface arc length for transverse grain,
unwraps ±π face crossings, and falls back to separate face-local UV islands
for genuine radial-projection collapses (caps/thickness edges). It does not
invent physical scale, seam matching, true cutting dimensions, cloth drape,
or production fit. Fallback islands remain unsewn/unreviewed.

Native fixture tests use actual Blender cylinder and sloping sleeve meshes
with degenerate planar UV caps; they must have no collapsed triangles under
the candidate, without changing a single world-space vertex or baseline UV.
Degenerate source geometry is rejected, not hidden.

## Real pinned evidence
Run the existing source-candidate GitHub workflow on this branch. It
downloads the exact checksum-pinned Blender binary and original CC0 scan,
builds the six existing panels, runs native geometry tests and writes a
*research-only .blend* plus source-vs-surface-UV metrics under native
evidence. The workflow checks unchanged original candidate file SHA,
identity, six panels, unchanged native source mesh geometry, and explicit
production-rejection flags. None of the baseline physical collision and
photographic silhouette gates is relaxed. The main six-panel preflight and
four-angle candidate render must still reject unapproved geometry.

## Independent acceptance remaining
1. Inspect actual original-source before/after structural UV statistics,
   scan for chart overlaps, seam discontinuity, inverted handedness and grain.
2. Achieve zero unapproved real world-space body/garment and garment/garment
   collisions (currently 16 full preflight rejection reasons documented).
3. Reconstruct approved actual collar/cuffs, waist, crotch/hem stitching,
   measured textile repeat and physically plausible drape.
4. Compare fixed **same** model in front/3/4/side/back against the approved
   original reference; secure owner/tailor fit review and physical-scale proof.
5. Re-run production GLB preflight and mobile browser gates before any
   customer promotion.

**No Vercel deployment, no production GLB, no customer data changes.**

The native source-candidate workflow archives the research-only **JSON report**
next to the unchanged production rejection report; it intentionally does not
archive or promote the unapproved .blend output. The experimental .blend is
regenerated deterministically from the pinned source when independent review
is authorized. Blender vector initialization is explicit 3D world coordinates.

## Native-geometry correction from first exact-head test
Pinned native Blender source job on initial head `7c967cdfdbefa8a3d525c74dbc6d35f147165499`
failed before the full CC0 comparison. Its adversarial **upright cylinder**
contained 64 degenerate original X/Z UV triangles; candidate mapping reduced
them to zero while preserving geometry, but inferred a **tilted** axis
`[-0.17556,-0.015406,0.984348]` due selecting only arbitrary subsets
of equal-Z ring vertices. Such angular drift would distort real woven grain.
The code now uses ALL measured vertices in the upper and lower 12% physical
Z bands, preserving tied rings and rejecting missing bands. The native test
asserts a true vertical axis for a vertical cylinder and zero mapped UV
collapse; no production promotion. Requires fresh native and full CI.

Second native fixture run on `4e228e6c754d9ff9ccb9e6365c1392743b29c6bf`
measured the *tilted* synthetic cylinder independently: 64 collapsed planar
source UV triangles became **zero** candidate collapses, geometry/original UVs
unchanged. The true scanned axis `[0.373655,0,0.927568]` reflects the 25°
rotation, and its cap projection needed **zero** face-local islands. The test
had incorrectly assumed every oriented cap must use fallback. Replaced that
assumption with more precise controls: upright caps require fallback, tilted
axes must follow the actual inclination, and **both** must have zero collapsed
candidate UV triangles. This does not claim true woven grain or scale approval.

## Pinned source availability — independent of geometry
The next native run on `4908791b1d05e11dd0e8c068d82797a466aa7653`
passed the local Blender fixtures and collision tests, then stopped because
Blender's primary official CC0 asset URL returned **HTTP 403** before mesh
preparation. The source-candidate workflow now retries ONLY Blender's official
mirror URL for the exact same pinned Human Base Meshes v1.4.1 archive, then
passes it to the existing strict `--archive` verifier for the pinned
50,643,039-byte ZIP plus safe extraction. Neither a CDN failure nor a failed
mirror can be mislabeled as a completed source comparison. This is a scoped
workflow fallback, not an upstream library rewrite or physical model repair.
