# TITAN 3D — Reject unapproved research scenes before GLB export

The pinned original model is still blocked by 16 real geometry preflight reasons.
Surface-aware UV experiments on research PR #1009 create a separate candidate .blend
with experimental charts. A future source topology repair might make the full
geometry preflight pass; that alone must never approve those research UV maps.

The exporter now independently rejects scene statuses beginning research-, the
titan_surface_uv_research_candidate_only marker, an explicit false UV approval
flag, any six-panel mesh tagged titan_surface_uv_candidate_only, and any mesh
holding the TITAN_SurfaceGrain_RESEARCH UV layer. Clearing a scene status
cannot launder an experimental garment UV into production.

The guard runs after the existing GLB destination preservation check but
BEFORE physical preflight or any GLB/sidecar content mutation. All existing
real-body, identity and measured-scale preflight gates remain mandatory.

Native Blender tests exercise the real scene-marker and mesh-layer rules,
plus existing old GLB/sidecar preservation. Full CI, Studio QA and exact-head
native export checks must pass before this production-safe guard merges.
No Vercel deployment, live data writes or unapproved model promotion.


## Follow-on: cross-research quarantine variant coverage

The original exporter quarantine covered the independent Worker E research
`TITAN_SurfaceGrain_RESEARCH` and lower-case `research-*` statuses.
Native original-CC0 source research PR #1010 independently produces a
**different** UV layer, `TITAN_RESEARCH_SURFACE_GRAIN`, and uses
`linen_earth_asset_status=RESEARCH-ONLY-source-UV-unapproved`
(uppercase), `linen_earth_research_surface_grain_uv=True` on the scene,
and `linen_earth_research_uv_grain_only=True` on six source-derived
garment meshes. Those exact values were not recognized before this follow-on.

Exporter guard now checks case-insensitive research status; both explicit
UV layer names; scene flags for original-source UV, disjoint armholes,
single-Solidify upper/lower garment topology, open research rims; and
mesh-level research/candidate identity or explicit unapproved state.
The rejection executes before physical preflight and before any GLB or
sidecar write. Native Blender tests cover each marker in isolation using
real mesh objects, so clearing one flag cannot bypass a still-present
named research UV layer. The existing measured-panel output preservation
tests and all physical preflight gates stay intact.

This is a **fail-closed safety integration** between two already existing
unmerged research streams, not a certificate of production geometry,
cloth grain, tailoring, fit, fabric scale or model likeness.
