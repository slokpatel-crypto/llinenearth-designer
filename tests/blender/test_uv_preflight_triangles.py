"""Native Blender test: every UV triangle must be finite and noncollapsed.

Tests evaluated mesh data, not a mocked parser. Does not claim measured fabric
repeat, UV seam topology or garment/photographic production readiness.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

source = Path(__file__).resolve().parents[2] / "scripts/blender/preflight-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("titan_preflight", source)
assert spec is not None and spec.loader is not None
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)

def mesh_with_uv(coords):
    mesh = bpy.data.meshes.new("TITAN_UV_TEST")
    mesh.from_pydata([(0, 0, 0), (.02, 0, 0), (0, 0, .05)], [], [(0, 1, 2)])
    mesh.update(calc_edges=True)
    uv_layer = mesh.uv_layers.new(name="TestUV")
    for loop, uv in zip(mesh.polygons[0].loop_indices, coords):
        uv_layer.data[loop].uv = uv
    obj = bpy.data.objects.new("TITAN_UV_TEST_OBJECT", mesh)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.update()
    return obj

assert preflight.uv_triangle_issue([(0, 0), (1, 0), (0, 1)]) is None
assert preflight.uv_triangle_issue([(0, 0), (0, 0), (0, 0)]) == "collapsed"
assert preflight.uv_triangle_issue([(0, 0), (0.1, 0.1), (0.2, 0.2)]) == "collapsed"
assert preflight.uv_triangle_issue([(0, 0), (float("nan"), 0), (0, 1)]) == "nonfinite"
assert preflight.uv_triangle_issue([(0, 0), (float("inf"), 0), (0, 1)]) == "nonfinite"

valid = mesh_with_uv([(0, 0), (1, 0), (0, 1)])
good = preflight.evaluated_mesh_stats(valid)
assert good["uvLayers"] == 1 and good["activeUv"] == "TestUV", good
assert good["uvCollapsedTriangles"] == 0 and good["uvNonFiniteTriangles"] == 0, good
bpy.data.objects.remove(valid, do_unlink=True)

collapsed = mesh_with_uv([(0, 0), (0.5, 0), (1, 0)])
bad = preflight.evaluated_mesh_stats(collapsed)
assert bad["uvCollapsedTriangles"] == 1, bad
assert bad["uvNonFiniteTriangles"] == 0, bad
bpy.data.objects.remove(collapsed, do_unlink=True)

print("TITAN_NATIVE_EVALUATED_UV_COLLAPSE_GATE_PASSED")
