"""Real Blender fixture for research-only adaptive garment UV face charts.

This tests actual UV loops on mutually perpendicular cloth faces and reversed
winding, not a substitute for native CC0 source results or calibrated repeat.
The face joins remain unreviewed and must never be promoted automatically.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

root = Path(__file__).resolve().parents[2]

def load(label, rel):
    spec = importlib.util.spec_from_file_location(label, root / rel)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

author = load("titan_uv_author", "scripts/blender/author-linen-earth-officewear.py")
preflight = load("titan_uv_qa", "scripts/blender/preflight-linen-earth-officewear.py")

mesh = bpy.data.meshes.new("TITAN_3D_FACE_CHART_FIXTURE")
# Three perpendicular physical cloth faces, including a hem-like XY plane
# and YZ lateral face. A naive whole-mesh XZ unwrap collapses both.
mesh.from_pydata(
    [(0, 0, 0), (0.1, 0, 0), (0, 0.1, 0), (0, 0, 0.1)],
    [], [(0, 1, 3), (0, 2, 3), (0, 1, 2), (0, 3, 2)],
)
mesh.update(calc_edges=True)
obj = bpy.data.objects.new("ShirtTorsoFabric", mesh)
bpy.context.scene.collection.objects.link(obj)
bpy.context.view_layer.update()

author.planar_grain_uv(obj)
assert obj["linen_earth_uv_authoring_method"] == "dominant-plane-face-charts-research-v1"
assert obj["linen_earth_uv_seams_reviewed"] is False
assert obj["linen_earth_repeat_scale_measured"] is False

uv = mesh.uv_layers.active
assert uv is not None
mesh.calc_loop_triangles()
assert len(mesh.loop_triangles) == 4
for tri in mesh.loop_triangles:
    points = [tuple(uv.data[i].uv) for i in tri.loops]
    assert preflight.uv_triangle_issue(points) is None, (
        f"UV chart collapsed on orthogonal fabric surface: {points}"
    )

# Vertical grain must increase along world Z on all genuine vertical faces.
for face in mesh.polygons[:2]:
    by_vertex = {
        mesh.loops[loop].vertex_index: tuple(uv.data[loop].uv)
        for loop in face.loop_indices
    }
    assert by_vertex[3][1] > by_vertex[0][1], by_vertex

# A changed face winding still needs a valid projection.
mirror_mesh = bpy.data.meshes.new("TITAN_REVERSE_CHART")
mirror_mesh.from_pydata([(0, 0, 0), (0, 0, 0.1), (0, 0.1, 0)], [], [(0, 1, 2)])
mirror_mesh.update(calc_edges=True)
mirror = bpy.data.objects.new("ShirtSleeveLFabric", mirror_mesh)
bpy.context.scene.collection.objects.link(mirror)
author.planar_grain_uv(mirror)
mirror_mesh.calc_loop_triangles()
assert preflight.uv_triangle_issue([
    tuple(mirror_mesh.uv_layers.active.data[i].uv)
    for i in mirror_mesh.loop_triangles[0].loops
]) is None

print("TITAN_RESEARCH_ORTHOGONAL_GARMENT_UV_TRIANGLES_PASSED_NOT_APPROVED")
