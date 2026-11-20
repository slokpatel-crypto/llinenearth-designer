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
