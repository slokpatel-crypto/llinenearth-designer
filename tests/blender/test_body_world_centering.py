"""Native Blender: centering the licensed body keeps shape and hierarchy."""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

import bpy
from mathutils import Vector

source = Path(__file__).resolve().parents[2] / "scripts/blender/prepare-linen-earth-body.py"
spec = importlib.util.spec_from_file_location("titan_body_prepare", source)
assert spec is not None and spec.loader
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

parent = bpy.data.objects.new("SOURCE_COLLECTION_PARENT", None)
bpy.context.scene.collection.objects.link(parent)
parent.location = (-2.31, 0.43, 0.0)

bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-2.31, 0.43, 1.0))
body = bpy.context.object
body.name = "Body"
body.parent = parent
body.matrix_world.translation = Vector((-2.31, 0.43, 1.0))

bpy.ops.mesh.primitive_cube_add(size=0.2, location=(-1.85, 0.43, 0.5))
independent = bpy.context.object
independent.name = "RELATED_SOURCE_OBJECT"
bpy.context.view_layer.update()

def bounds(obj):
    points = mod.world_bounds(obj)
    return (
        max(p.x for p in points)-min(p.x for p in points),
        max(p.y for p in points)-min(p.y for p in points),
        max(p.z for p in points)-min(p.z for p in points),
    )

size_before = bounds(body)
relative_before = (independent.matrix_world.translation -
                   body.matrix_world.translation).length

shift = mod.normalize_horizontal_center([parent, body, independent], body)
assert abs(shift[0]+2.31) < 0.001, shift
assert abs(shift[1]-0.43) < 0.001, shift
points = mod.world_bounds(body)
assert abs((max(p.x for p in points)+min(p.x for p in points))*0.5) < 0.002
assert abs((max(p.y for p in points)+min(p.y for p in points))*0.5) < 0.002
assert all(math.isclose(a,b,abs_tol=1e-5)
           for a,b in zip(size_before,bounds(body)))
relative_after = (independent.matrix_world.translation -
                  body.matrix_world.translation).length
assert math.isclose(relative_before,relative_after,abs_tol=1e-5), (
    relative_before,relative_after
)
repeat = mod.normalize_horizontal_center([parent, body, independent], body)
assert max(abs(v) for v in repeat) < 0.002, repeat

print("TITAN_NATIVE_LOCKED_BODY_HORIZONTAL_CENTERING_PASSED")
