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

# The source-body mock rejects any candidate above 11.5 mm per sleeve.
# This produces a genuine coarse BVH bracket (12 unsafe, 11 safe). A finer
# candidate at 11.75 mm is rejected after intentionally disturbing Y/Z;
# the 11.5-mm independently tested pass must leave NO rejected XYZ behind.
coarse_start = {
    obj.name: tuple(tuple(vertex.co) for vertex in obj.data.vertices)
    for obj in (left, right)
}
def contact_bracket(first, second):
    if first is not body:
        return 0
    origin = coarse_start[second.name][0]
    vertex = second.data.vertices[0]
    effect = abs(author.candidate_sleeve_inboard_mm(second.name, origin[2], 1.0))
    movement_mm = abs(vertex.co.x - origin[0]) * 1000 / effect
    return 1 if movement_mm > 11.5001 else 0

def perturb_failed_sleeve(_body, obj, _passes):
    for vertex in obj.data.vertices:
        vertex.co.y += .004
        vertex.co.z += .003
    obj.data.update()
    bpy.context.view_layer.update()
    return {
        "contactPairsByPass": [1],
        "maxVertexCorrectionMm": 5.0,
        "remainingContactPairs": 1,
    }

try:
    author.source_fit_collision_pairs = contact_bracket
    author.repair_body_intersections = perturb_failed_sleeve
    refined = author.try_collision_safe_cuff_spacing(body, 0, 1, 22.0)
finally:
    author.source_fit_collision_pairs = actual_contact
    author.repair_body_intersections = actual_repair
assert refined["nativeWorldSpaceCollisionFree"] is True, refined
assert refined["selectedMmPerSleeve"] == 11.5, refined
assert refined["submillimetreContactRefinementAttempted"] is True, refined
assert any(t["requestedCuffInboardMmPerSleeve"] == 11.75 for t in refined["trials"])
for obj in (left, right):
    for vertex, origin in zip(obj.data.vertices, coarse_start[obj.name]):
        expected = author.candidate_sleeve_inboard_mm(obj.name, origin[2], 11.5) / 1000
        assert abs(vertex.co.x - (origin[0] + expected)) < 1e-6
        assert abs(vertex.co.y - origin[1]) < 1e-6, "Rejected fine trial leaked Y"
        assert abs(vertex.co.z - origin[2]) < 1e-6, "Rejected fine trial leaked Z"
assert tuple(tuple(vertex.co) for vertex in body.data.vertices) == source_before


# A second independent source-locked experiment reduces ONLY the outside
# half of the cuff rather than moving the entire arm-width shell through skin.
# This separate tiny Blender fixture proves restoration, not real-world fit.
bpy.data.objects.remove(left, do_unlink=True)
bpy.data.objects.remove(right, do_unlink=True)
left = cube("ShirtSleeveLFabric", (-.32, 0, .56), (.12, .05, .08))
right = cube("ShirtSleeveRFabric", (.32, 0, .56), (.12, .05, .08))
outer_before = {
    obj.name: tuple(tuple(vertex.co) for vertex in obj.data.vertices)
    for obj in (left, right)
}
outer_contour_pass = author.try_collision_safe_outer_cuff_taper(
    body, 0.0, 1.0, 30.0
)
assert outer_contour_pass["nativeWorldSpaceCollisionFree"] is True, outer_contour_pass
assert outer_contour_pass["selectedMmPerSleeve"] == 30.0, outer_contour_pass
for obj in (left, right):
    coords = outer_before[obj.name]
    x_values = [p[0] for p in coords]
    outer_x = min(x_values) if obj is left else max(x_values)
    inner_x = max(x_values) if obj is left else min(x_values)
    for vertex, original_xyz in zip(obj.data.vertices, coords):
        if abs(original_xyz[0] - inner_x) < 1e-6:
            assert abs(vertex.co.x - original_xyz[0]) < 1e-7, (
                "Body-facing sleeve cloth must not move"
            )
        if abs(original_xyz[0] - outer_x) < 1e-6:
            sign = 1 if obj is left else -1
            assert abs(vertex.co.x - (original_xyz[0] + sign * .03)) < 1e-6
        assert abs(vertex.co.y - original_xyz[1]) < 1e-7
        assert abs(vertex.co.z - original_xyz[2]) < 1e-7
assert tuple(tuple(vertex.co) for vertex in body.data.vertices) == source_before
assert outer_contour_pass["productionApproved"] is False

# A real native intersection test is compulsory for EACH candidate. If every
# nonzero contour intersects the source, the 0-mm rollback must preserve
# all XYZ, and cannot claim newly approved sleeve spacing.
bpy.data.objects.remove(left, do_unlink=True)
bpy.data.objects.remove(right, do_unlink=True)
left = cube("ShirtSleeveLFabric", (-.32, 0, .56), (.12, .05, .08))
right = cube("ShirtSleeveRFabric", (.32, 0, .56), (.12, .05, .08))
rejected_source = {
    obj.name: tuple(tuple(vertex.co) for vertex in obj.data.vertices)
    for obj in (left, right)
}
def fake_source_contact(first, second):
    if first is body and second in (left, right):
        original_positions = rejected_source[second.name]
        return 1 if any(abs(vertex.co.x - point[0]) > 1e-8
                        for vertex, point in zip(second.data.vertices, original_positions)) else 0
    return 0

try:
    author.source_fit_collision_pairs = fake_source_contact
    outer_rejected = author.try_collision_safe_outer_cuff_taper(body, 0, 1, 30)
finally:
    author.source_fit_collision_pairs = actual_contact
assert outer_rejected["selectedMmPerSleeve"] == 0, outer_rejected
assert outer_rejected["productionApproved"] is False
assert len(outer_rejected["trials"]) >= 2
assert all(not trial["nativeWorldSpaceCollisionFree"]
           for trial in outer_rejected["trials"] if trial["requestedOuterContourMmPerSleeve"] > 0)
for obj in (left, right):
    assert tuple(tuple(vertex.co) for vertex in obj.data.vertices) == rejected_source[obj.name]
assert tuple(tuple(vertex.co) for vertex in body.data.vertices) == source_before

print("LINEN_EARTH_NATIVE_CUFF_SPACING_REPAIR: PASS")
