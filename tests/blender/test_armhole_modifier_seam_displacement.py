"""Actual Blender regression: independent sleeve modifier stages measure a known seam gap.

This is a synthetic fixture; it never certifies actual original CC0 fit or
fabric thickness and is not a replacement mannequin.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

source = Path(__file__).resolve().with_name("test_actual_armhole_source_ownership.py")
spec = importlib.util.spec_from_file_location("titan_armhole_stage_gap", source)
assert spec is not None and spec.loader is not None
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

body_mesh = bpy.data.meshes.new("TEST_BODY_TWO_ADJACENT_CC0_FACE_IDS")
body_mesh.from_pydata(
    [(0.0, 0.0, 0.0), (0.03, 0.0, 0.0),
     (0.0, 0.03, 0.0), (0.03, 0.03, 0.0)],
    [], [(0, 1, 2), (1, 3, 2)],
)
body_mesh.update(calc_edges=True)
body = bpy.data.objects.new("TEST_PINNED_FACE_INDEX_SOURCE", body_mesh)
bpy.context.scene.collection.objects.link(body)
collection = bpy.data.collections.new("TITAN_ArmholeStageResearch")
bpy.context.scene.collection.children.link(collection)

def fixture(name, source_faces, stage, x_shift):
    indices = sorted({
        index for face in source_faces
        for index in body_mesh.polygons[face].vertices
    })
    verts = []
    for i in indices:
        point = body_mesh.vertices[i].co.copy()
        point.x += x_shift
        verts.append(point)
    mesh = bpy.data.meshes.new("TEST_" + stage + name)
    mesh.from_pydata(verts, [], [])
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new("TITAN_ARMHOLE_RESEARCH_" + stage + "_" + name, mesh)
    obj["sourceStage"] = stage
    obj["candidateOnly"] = True
    obj["productionApproved"] = False
    collection.objects.link(obj)

for stage, offset in [
    ("selectedBodyShell", 0.0),
    ("afterSmoothing", 0.002),
    ("afterBodyClearance", 0.003),
    ("afterClothThickness", 0.004),
]:
    fixture("ShirtTorsoFabric", {0}, stage, 0.0)
    fixture("ShirtSleeveLFabric", {1}, stage, offset)

metric = mod.actual_shared_seam_modifier_displacement(
    body, {0}, {1}, "ShirtSleeveLFabric"
)
assert metric["sharedOriginalSeamEdges"] == 1, metric
assert metric["sharedOriginalSeamVertices"] == 2, metric
stages = metric["preSolidifySourceVertexDisplacementMm"]
assert set(stages) == {"selectedBodyShell", "afterSmoothing", "afterBodyClearance"}
assert stages["selectedBodyShell"]["max"] == 0, stages
assert abs(stages["afterSmoothing"]["median"] - 2.0) < 0.001, stages
assert abs(stages["afterBodyClearance"]["median"] - 3.0) < 0.001, stages
assert metric["postSolidifySeamSewnVerified"] is False
assert metric["postSolidifySeamWatertightVerified"] is False

# Missing stage mesh must fail, never imply zero seam separation.
missing = bpy.data.objects.get(
    "TITAN_ARMHOLE_RESEARCH_afterBodyClearance_ShirtSleeveLFabric"
)
bpy.data.objects.remove(missing, do_unlink=True)
try:
    mod.actual_shared_seam_modifier_displacement(body, {0}, {1}, "ShirtSleeveLFabric")
except RuntimeError as error:
    assert "absent/untrusted" in str(error), error
else:
    raise AssertionError("Missing actual seam snapshot must not pass")

print("TITAN_NATIVE_REAL_MODIFIER_STAGE_ARMHOLE_GAP_FIXTURE_PASSED")
