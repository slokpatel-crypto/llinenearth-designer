"""Real Blender mesh fixtures for cylindrical cloth grain + thickness rims.

No source mannequin is replaced, and synthetic meshes are never fit evidence.
"""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

import bpy

root = Path(__file__).resolve().parents[2]
p = root / "scripts/blender/research-world-surface-uv.py"
spec = importlib.util.spec_from_file_location("native_surface_uv_candidate",p)
assert spec is not None and spec.loader is not None
research = importlib.util.module_from_spec(spec)
spec.loader.exec_module(research)

def cylinder(name,angle=0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=0.14,depth=0.9,
                                       end_fill_type="TRIFAN")
    obj=bpy.context.object
    obj.name=name
    obj.rotation_euler[1]=angle
    bpy.context.view_layer.update()
    # Deliberately project X/Z onto a real 3D closed cylinder. Horizontal
    # end caps and their faces collapse in UV, just like source planar UV.
    uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name="UVMap")
    for polygon in obj.data.polygons:
        for index in polygon.loop_indices:
            pos=obj.data.vertices[obj.data.loops[index].vertex_index].co
            uv.data[index].uv=(pos.x,pos.z)
    return obj

for name,tilt in (("synthetic_vertical_cylinder",0),("synthetic_angled_sleeve",math.radians(25))):
    obj=cylinder(name,tilt)
    original=research.uv_metrics(obj,obj.data.uv_layers.active)
    assert original["collapsedUvTriangles"]>0,original
    geometry=research.world_mesh_signature(obj)
    uvname=obj.data.uv_layers.active.name
    uvhash=research.uv_signature(obj.data,obj.data.uv_layers.active)
    result=research.map_surface_grain(obj)
    assert result["original"]["collapsedUvTriangles"]==original["collapsedUvTriangles"]
    assert result["candidate"]["collapsedUvTriangles"]==0,result
    assert result["faceLocalFallbackIslands"]>0,result
    assert result["geometryPreserved"] and result["originalUvPreserved"]
    assert research.world_mesh_signature(obj)==geometry
    assert research.uv_signature(obj.data,obj.data.uv_layers[uvname])==uvhash
    assert obj.data.uv_layers.active.name==research.CANDIDATE_UV
    assert obj["titan_surface_uv_physical_repeat_verified"] is False
    assert result["inferredAxisWorld"][2] > (0.85 if tilt else 0.999),result
    if not tilt:
        # Upright cylinder has exact equal-height rings. Never misinterpret
        # hash/mesh vertex ordering as a sloping grain direction.
        assert abs(result["inferredAxisWorld"][0]) < 1e-5,result
        assert abs(result["inferredAxisWorld"][1]) < 1e-5,result
    # A second UV research pass cannot silently rebind source evidence.
    try:
        research.map_surface_grain(obj)
        raise AssertionError("Must reject a duplicated research UV layer")
    except RuntimeError as exc:
        assert "research UV" in str(exc),exc

# Degenerate physical geometry must fail, not be disguised with a UV island.
mesh=bpy.data.meshes.new("bad_scan_mesh")
mesh.from_pydata([(0,0,0),(1,0,0),(2,0,0)],[],[(0,1,2)])
mesh.update()
bad=bpy.data.objects.new("DegenerateSourceFace",mesh)
bpy.context.collection.objects.link(bad)
bad.data.uv_layers.new(name="UVMap")
try:
    research.map_surface_grain(bad)
    raise AssertionError("Must reject real degenerate source geometry")
except RuntimeError as exc:
    assert "degenerate real 3D triangle" in str(exc),exc

print("TITAN_NATIVE_SURFACE_UV_RESEARCH_MESH_FIXTURES_PASSED")
