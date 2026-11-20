"""Adversarial Blender fixture: open-rim Solidify is not a production seam repair.

This fixture uses artificial quads solely to prove native Solidify boundary
topology, never as replacement geometry or evidence of the pinned CC0 model.
"""
from __future__ import annotations

import bpy
import bmesh

def specimen(rim):
    base = bpy.data.meshes.new("research-synthetic-rim-base")
    base.from_pydata(
        [(0.0,0.0,0.0),(0.1,0.0,0.0),(0.1,0.1,0.0),(0.0,0.1,0.0)],
        [], [(0,1,2,3)]
    )
    base.update(calc_edges=True)
    obj = bpy.data.objects.new("TEST_SOLIDIFY_RIM_"+str(rim),base)
    bpy.context.scene.collection.objects.link(obj)
    modifier=obj.modifiers.new("research-candidate-solely", "SOLIDIFY")
    modifier.thickness=0.0016
    modifier.offset=1.0
    modifier.use_rim=rim
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
    graph=bmesh.new()
    graph.from_mesh(obj.data)
    open_edges=[edge for edge in graph.edges if edge.is_boundary]
    faces=len(graph.faces)
    open_count=len(open_edges)
    graph.free()
    return open_count,faces

open_edge_count,faces_without=specimen(False)
closed_edge_count,faces_with=specimen(True)
assert open_edge_count > 0, open_edge_count
assert closed_edge_count == 0, closed_edge_count
assert faces_with > faces_without >= 2, (faces_with, faces_without)
print("TITAN_NATIVE_SOLIDIFY_OPEN_CUFF_HEM_RESEARCH_FIXTURE_PASSED", {
    "openBoundaryEdgesWithoutRim":open_edge_count,
    "openBoundaryEdgesWithRim":closed_edge_count,
    "facesWithoutRim":faces_without,
    "facesWithRim":faces_with,
    "productionApproved":False,
})
