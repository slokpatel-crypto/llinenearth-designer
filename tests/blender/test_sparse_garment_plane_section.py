"""Real Blender: cloth surface crossings cannot be lost to sparse vertex bands."""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

import bpy

source = Path(__file__).resolve().parents[2] / "scripts/blender/preflight-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("titan_preflight", source)
assert spec is not None and spec.loader
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)

bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.42, 0.0, 0.6))
cube = bpy.context.object
cube.name = "SPARSE_WAIST_SAMPLE"
cube.scale = (0.5, 0.2, 1.2)
bpy.context.view_layer.update()
world = [cube.matrix_world @ v.co for v in cube.data.vertices]
assert all(abs(v.z - 0.6) > 0.018 for v in world), "fixture must lack guide-band vertices"
section = preflight.triangle_plane_span_x(cube, 0.6)
assert section is not None, "actual surface crosses guide even without nearby vertices"
assert math.isclose((section[0]+section[1])*0.5, 0.42, abs_tol=1e-5), section
assert math.isclose((section[1]-section[0]), 0.5, abs_tol=1e-5), section
assert preflight.triangle_plane_span_x(cube, 3.0) is None
assert preflight.triangle_plane_span_x(cube, float("nan")) is None
assert preflight.triangle_plane_span_x(cube, None) is None

empty_mesh = bpy.data.meshes.new("EMPTY_WAIST")
empty = bpy.data.objects.new("EMPTY_WAIST", empty_mesh)
bpy.context.scene.collection.objects.link(empty)
assert preflight.triangle_plane_span_x(empty, 0.6) is None

# A rotated source object must be sampled in its evaluated world frame.
cube.rotation_euler.z = math.radians(22)
bpy.context.view_layer.update()
section = preflight.triangle_plane_span_x(cube, 0.6)
assert section is not None and section[0] < 0.42 < section[1], section

print("TITAN_NATIVE_REAL_SPARSE_GARMENT_PLANE_SECTION_PASSED")
