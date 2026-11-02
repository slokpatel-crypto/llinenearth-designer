"""Native Blender adversarial checks for actual world-space diagnostics."""
from __future__ import annotations
import importlib.util
from pathlib import Path
import bpy
from mathutils import Vector

path = Path(__file__).resolve().parents[2] / "scripts/blender/diagnose-linen-earth-contact.py"
spec = importlib.util.spec_from_file_location("titan_actual_contact", path)
assert spec is not None and spec.loader is not None
diagnostic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnostic)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.mesh.primitive_cube_add(size=2, location=(4, 0, 0))
body = bpy.context.object
body.name = "Body"
# Smaller cube crosses the +X body face without coinciding with body Y/Z faces.
bpy.ops.mesh.primitive_cube_add(size=1, location=(5.2, 0, 0))
garment = bpy.context.object
garment.name = "ShirtTorsoFabric"
bpy.context.view_layer.update()

first = diagnostic.diagnose(
    diagnostic.evaluated_world_geometry(body),
    diagnostic.evaluated_world_geometry(garment),
)
assert first["bodyGarmentIntersectingTrianglePairs"] > 0, first
assert len(first["contactPairsByBodyHeightOctile"]) == 8, first
assert sum(first["contactPairsByBodyHeightOctile"]) == first["bodyGarmentIntersectingTrianglePairs"], first
assert first["contactPairsByBodyHeightOctile"][4] > 0, first

assert first["evaluatedTriangles"] == 12, first
assert first["negativeBodyNormalProjectionCount"] > 0, first
assert first["positiveBodyNormalProjectionCount"] > 0, first
assert first["boundaryEdges"] == 0, first
assert first["nonManifoldEdges"] == 0, first
assert first["minimumNearestBodyDistanceMm"] >= 0, first

# Translating BOTH real meshes must NOT change physical contact measurements.
body.location.x += 7.0
garment.location.x += 7.0
bpy.context.view_layer.update()
shifted = diagnostic.diagnose(
    diagnostic.evaluated_world_geometry(body),
    diagnostic.evaluated_world_geometry(garment),
)
assert first == shifted, (first, shifted)
# Every real intersection must remain assigned to the same relative-height band.
assert sum(shifted["contactPairsByBodyHeightOctile"]) == shifted["bodyGarmentIntersectingTrianglePairs"]


# Fail closed when the real source is not a surface mesh.
empty_mesh = bpy.data.meshes.new("NoSurface")
empty = bpy.data.objects.new("EmptyCandidate", empty_mesh)
bpy.context.scene.collection.objects.link(empty)
try:
    diagnostic.evaluated_world_geometry(empty)
except RuntimeError as error:
    assert "no evaluated surface triangles" in str(error)
else:
    raise AssertionError("Empty garment was accepted as measured contact evidence")

# Source/asset identity is mandatory; no report may be treated as approval.
try:
    diagnostic.diagnostic_report(bpy.context.scene)
except RuntimeError as error:
    assert "identity lock" in str(error)
else:
    raise AssertionError("Missing photo-model identity lock was accepted")
try:
    diagnostic.overlap_height_bands(
        [Vector((0, 0, 0))], [Vector((0, 0, 0))], [(0, 0, 0)], [(0, 0)]
    )
except RuntimeError as error:
    assert "height" in str(error)
else:
    raise AssertionError("Flat body was accepted as measurable world-height collision evidence")

collinear = diagnostic.surface_topology(
    [Vector((0, 0, 0)), Vector((1, 0, 0)), Vector((2, 0, 0))],
    [(0, 1, 2)],
)
assert collinear["collapsedTriangles"] == 1, collinear
assert collinear["boundaryEdges"] == 3, collinear

print("TITAN_REAL_WORLD_CONTACT_DIAGNOSTICS_PASSED")
