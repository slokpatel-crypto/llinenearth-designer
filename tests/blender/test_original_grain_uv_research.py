"""Native Blender geometry test for source-candidate UV mapping (NOT fabric scale)."""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

import bpy

root = Path(__file__).resolve().parents[2]
uv_source = root / "scripts/blender/research-source-grain-uv.py"
spec = importlib.util.spec_from_file_location("titan_unapproved_grain_uv", uv_source)
assert spec and spec.loader
research = importlib.util.module_from_spec(spec)
spec.loader.exec_module(research)
preflight = research.preflight_module()

# Cylindrical fabric panels have vertical side faces AND horizontal solidify
# rims. The legacy x-z projection collapses the entire horizontal endcap and
# some vertical facets of a realistic cylindrical garment surface.
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.150, depth=0.600)
obj = bpy.context.object
obj.name = "TITAN_ORIGINAL_UV_SURFACE_FIXTURE"
if not obj.data.uv_layers:
    obj.data.uv_layers.new(name="UVMap")
old_uv = obj.data.uv_layers.active
for loop in obj.data.loops:
    v = obj.data.vertices[loop.vertex_index]
    old_uv.data[loop.index].uv = (v.co.x, v.co.z)
bpy.context.view_layer.update()
baseline = preflight.evaluated_mesh_stats(obj)
assert baseline["uvCollapsedTriangles"] > 0, baseline
fingerprint = research.geometry_fingerprint(obj)
original = [tuple(p.uv) for p in old_uv.data]
report = research.apply_source_grain_uv(obj, preflight)
assert report["beforeCollapsedUvTriangles"] == baseline["uvCollapsedTriangles"]
assert report["afterCollapsedUvTriangles"] == 0
assert report["afterNonFiniteUvTriangles"] == 0
assert report["horizontalFaces"] >= 2
assert report["cylindricalFaces"] >= 8
assert report["measuredRepeatVerified"] is False
assert report["seamChartApproved"] is False
assert report["newUvLayer"] == research.UV_NAME
before_edges = report["originalUvEdgeContinuity"]
after_edges = report["researchUvEdgeContinuity"]
assert before_edges["sourceTopologicalEdges"] == after_edges["sourceTopologicalEdges"]
assert before_edges["sourceBoundaryEdges"] == 0, before_edges
assert after_edges["sourceBoundaryEdges"] == 0, after_edges
assert before_edges["sourceNonManifoldEdges"] == 0, before_edges
assert after_edges["sourceNonManifoldEdges"] == 0, after_edges
assert before_edges["uvDiscontinuityEdges"] == 0, before_edges
assert after_edges["uvDiscontinuityEdges"] > 0, (
    "Separate cap-projection charts must be disclosed as UV seams", after_edges
)
for stats in (before_edges, after_edges):
    assert stats["minusYCameraFacingSeamEdges"] + stats["plusYCameraAwaySeamEdges"] == stats["uvDiscontinuityEdges"]
assert after_edges["sewnSeamApproval"] is False
assert len(obj.data.uv_layers) == 2
assert [tuple(p.uv) for p in old_uv.data] == original
assert research.geometry_fingerprint(obj) == fingerprint
assert obj.get("linen_earth_research_uv_grain_only") is True
assert obj.get("linen_earth_measured_textile_repeat_approved") is False

# Never overwrite a UV research layer: it could erase original evidence.
try:
    research.apply_source_grain_uv(obj, preflight)
except RuntimeError as err:
    assert "overwrite" in str(err)
else:
    raise AssertionError("Duplicate candidate UV mapping must be refused")
bpy.data.objects.remove(obj, do_unlink=True)

# A malformed source coordinate fails BEFORE an experimental UV layer exists.
bpy.ops.mesh.primitive_cube_add(size=0.25)
bad = bpy.context.object
bad.name = "TITAN_BAD_SOURCE_UV_FIXTURE"
if not bad.data.uv_layers:
    bad.data.uv_layers.new(name="UVMap")
bad.data.vertices[0].co.x = math.nan
try:
    research.apply_source_grain_uv(bad, preflight)
except RuntimeError as err:
    assert "Invalid real world-space" in str(err)
else:
    raise AssertionError("Nonfinite source mesh may never be given UV approval")
assert bad.data.uv_layers.get(research.UV_NAME) is None
bpy.data.objects.remove(bad, do_unlink=True)

print("TITAN_ORIGINAL_CC0_GRAIN_UV_NATIVE_FALLBACK_RESEARCH_PASSED")
