"""Real Blender regression: collision BVHs must share world coordinates.

Run with blender --background --factory-startup --python tests/blender/test_world_collision_bvh.py
The imported scan can have a non-zero source object origin while the authored
garment is world-space; local BVH comparisons are not admissible fit evidence.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

source = Path(__file__).resolve().parents[2] / "scripts/blender/preflight-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("linen_earth_preflight", source)
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)

bpy.ops.mesh.primitive_cube_add(size=1, location=(-4.0, 0.0, 0.0))
body = bpy.context.object
body.name = "TEST_SCAN_WITH_OFFSET_ORIGIN"
# Same geometry in world space, but the native scan's vertices stay offset
# from its translated object origin.
for vertex in body.data.vertices:
    vertex.co.x += 4.0
# Direct data mutation is NOT guaranteed to update the evaluated dependency
# graph. The old fixture could report a false-negative world-space BVH hit.
body.data.update()
bpy.context.view_layer.update()

# Offset Y and Z as well as X: coincident top/side faces yield BVH
# coplanarity ambiguities, not a reliable genuine triangle crossing fixture.
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.35, 0.1, 0.15))
garment = bpy.context.object
garment.name = "TEST_GARMENT_WORLD_SPACE"

hits = preflight.intersection_pair_count(body, garment)
assert hits is not None and hits > 0, (
    "Real mesh overlap was missed because source/garment BVHs used different local frames: "
    + repr(hits)
)
garment.location.x = 3.0
bpy.context.view_layer.update()
false_hits = preflight.intersection_pair_count(body, garment)
assert false_hits == 0, (
    "World-separated meshes were incorrectly recorded as colliding: " + repr(false_hits)
)
garment.location.x = 0.35
garment.scale.x = 0.8
bpy.context.view_layer.update()
scaled_hits = preflight.intersection_pair_count(body, garment)
assert scaled_hits > 0, "Evaluated object scale must be reflected in world contact evidence"

print(f"LENEN_EARTH_WORLD_SPACE_COLLISION_TEST_PASSED hits={hits}, separated={false_hits}, scaled={scaled_hits}")
