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
