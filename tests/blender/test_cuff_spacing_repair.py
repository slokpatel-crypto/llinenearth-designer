"""Native sleeve-spacing candidate regression on original-source-locked cloth.

No scanned human, garment fit, tailoring or visual/photo approval is inferred.
Run inside Blender with --python-exit-code 1.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

path = Path(__file__).resolve().parents[2] / "scripts/blender/author-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("le_source_cuff_author", path)
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)


def cube(name, center, dimensions):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.update()
    bpy.context.view_layer.update()
    return obj


body = cube("TEST_SOURCE_BODY_NEVER_MOVES", (1.2, 0, .64), (.1, .1, .1))
left = cube("ShirtSleeveLFabric", (-.32, 0, .64), (.1, .05, .08))
right = cube("ShirtSleeveRFabric", (.32, .005, .64), (.1, .05, .08))
source_before = tuple(tuple(vertex.co) for vertex in body.data.vertices)
left_before = tuple(tuple(vertex.co) for vertex in left.data.vertices)
right_before = tuple(tuple(vertex.co) for vertex in right.data.vertices)

result = author.try_collision_safe_cuff_spacing(body, 0, 1, 22.0)
assert result["nativeWorldSpaceCollisionFree"] is True, result
assert result["selectedMmPerSleeve"] == 22.0, result
# Upper sleeve vertices fade smoothly back to the unchanged shoulder, so
# only the low cuff band receives the full requested 22-mm displacement.
for obj, positions in ((left, left_before), (right, right_before)):
    for vertex, original in zip(obj.data.vertices, positions):
        delta = author.candidate_sleeve_inboard_mm(obj.name, original[2], 22.0) / 1000.0
        assert abs(vertex.co.x - (original[0] + delta)) < 1e-6
        assert abs(vertex.co.y - original[1]) < 1e-6
        assert abs(vertex.co.z - original[2]) < 1e-6
assert tuple(tuple(vertex.co) for vertex in body.data.vertices) == source_before
assert result["productionApproved"] is False and result["photographicPoseApproved"] is False

original = {
    obj.name: tuple(tuple(vertex.co) for vertex in obj.data.vertices)
    for obj in (left, right)
}
actual_contact = author.source_fit_collision_pairs
actual_repair = author.repair_body_intersections


def unavoidable_body_contact(first, second):
    if first is body:
        return 1
    return 0


def ineffective_contact_repair(_body, sleeve, _passes):
    for vertex in sleeve.data.vertices:
        vertex.co.y += .001
        vertex.co.z += .002
    sleeve.data.update()
    bpy.context.view_layer.update()
    return {
        "contactPairsByPass": [1, 1],
        "maxVertexCorrectionMm": 2.236,
        "remainingContactPairs": 1,
    }


try:
    author.source_fit_collision_pairs = unavoidable_body_contact
    author.repair_body_intersections = ineffective_contact_repair
    rejected = author.try_collision_safe_cuff_spacing(body, 0, 1, 22.0)
finally:
    author.source_fit_collision_pairs = actual_contact
    author.repair_body_intersections = actual_repair

assert rejected["nativeWorldSpaceCollisionFree"] is False, rejected
assert rejected["selectedMmPerSleeve"] == 0, rejected
assert len(rejected["trials"]) == 23, rejected
for obj in (left, right):
    assert tuple(tuple(vertex.co) for vertex in obj.data.vertices) == original[obj.name], (
        "Sleeve rollback did not restore all XYZ coordinates"
    )
assert tuple(tuple(vertex.co) for vertex in body.data.vertices) == source_before
print("LINEN_EARTH_NATIVE_CUFF_SPACING_REPAIR: PASS")
