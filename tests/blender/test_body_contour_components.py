"""Native Blender: separate central torso slice from disconnected arm contours."""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

import bpy
from mathutils import Vector

script = Path(__file__).resolve().parents[2] / "scripts/blender/measure-body-contours.py"
spec = importlib.util.spec_from_file_location("titan_contours", script)
assert spec and spec.loader
contours = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contours)

parts = []
for name, cx, width in (
    ("BodyTorso", 0.0, 0.36),
    ("BodyArmL", -0.48, 0.12),
    ("BodyArmR", 0.48, 0.12),
):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx, 0.0, 0.6))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (width, 0.18, 0.7)
    parts.append(obj)

bpy.ops.object.select_all(action="DESELECT")
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.object
bpy.context.view_layer.update()

def source_center():
    points = [body.matrix_world @ Vector(c) for c in body.bound_box]
    return (min(p.x for p in points)+max(p.x for p in points))*0.5

sections = contours.measured_plane_components(body, 0.6)
assert len(sections) == 3, sections
center = contours.central_torso_component(sections, source_center())
assert math.isclose(center["widthMm"], 360, abs_tol=0.5), center
outer = (max(c["maxX"] for c in sections)-min(c["minX"] for c in sections))*1000
assert outer > 1000, outer

body.location.x = -2.314
bpy.context.view_layer.update()
offset_sections = contours.measured_plane_components(body, 0.6)
offset_center = contours.central_torso_component(offset_sections, source_center())
assert math.isclose(offset_center["widthMm"], 360, abs_tol=0.5), offset_center
assert math.isclose(offset_center["centerX"], -2.314, abs_tol=0.001)
try:
    contours.measured_plane_components(body, float("nan"))
except ValueError:
    pass
else:
    raise AssertionError("Nonfinite guide accepted")

print("TITAN_NATIVE_REAL_BODY_ARM_TORSO_CONTOUR_SEPARATION_PASSED")
