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
torso = cube("ShirtTorsoFabric", (1.5, 0, .64), (.1, .1, .1))
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

# A trial can be skin-clear but cross the fitted shirt torso. Model the
# existing sewn-armhole contact as two baseline pairs and reject only the
# additional pair caused by excessive sleeve translation.
torso_before = tuple(tuple(vertex.co) for vertex in torso.data.vertices)
contact_start = {
    obj.name: tuple(tuple(vertex.co) for vertex in obj.data.vertices)
    for obj in (left, right)
}


def torso_contact_growth(first, second):
    if first is torso and second in (left, right):
        origin = contact_start[second.name][0]
        current = second.data.vertices[0].co
        movement_mm = abs(current.x - origin[0]) * 1000
        return 2 + (1 if movement_mm > 10.0001 else 0)
    return 0


try:
    author.source_fit_collision_pairs = torso_contact_growth
    torso_safe = author.try_collision_safe_cuff_spacing(body, 0, 1, 22)
finally:
    author.source_fit_collision_pairs = actual_contact

assert torso_safe["selectedMmPerSleeve"] == 10.0, torso_safe
assert torso_safe["nativeWorldSpaceCollisionFree"] is True, torso_safe
assert torso_safe["trials"][0]["shirtTorsoPairsAtOriginal"] == [2, 2]
assert torso_safe["trials"][0]["shirtTorsoPairsAfterRepair"] == [3, 3]
assert torso_safe["trials"][0]["shirtTorsoContactNotWorsened"] is False
assert torso_safe["trials"][0]["boundedShirtTorsoContactCorrections"] == {}, (
    "Preexisting sewn-armhole contact must never trigger a whole-seam repair"
)
# Fine probes after the selected safe 10-mm trial are rejected; the final
# trial list entry is not the retained geometry. Trust only the independently
# rechecked selected-geometry receipt, never the last attempted probe.
assert torso_safe["trials"][-1]["shirtTorsoContactNotWorsened"] is False
assert torso_safe["shirtTorsoPairsAtSelected"] == [2, 2]
assert torso_safe["shirtTorsoContactNotWorsened"] is True
assert tuple(tuple(vertex.co) for vertex in torso.data.vertices) == torso_before
assert tuple(tuple(vertex.co) for vertex in body.data.vertices) == source_before
for obj in (left, right):
    for vertex, origin in zip(obj.data.vertices, contact_start[obj.name]):
        delta = author.candidate_sleeve_inboard_mm(obj.name, origin[2], 10.0) / 1000
        assert abs(vertex.co.x - (origin[0] + delta)) < 1e-6
        assert abs(vertex.co.y - origin[1]) < 1e-6
        assert abs(vertex.co.z - origin[2]) < 1e-6

# A bounded garment-only torso-normal repair can rescue a larger cuff
# correction, but only after independently rechecking skin and both sleeves.
# The mock intentionally simulates a new torso contact resolved by a 3-mm
# Y relief; no physical tailoring approval is inferred.
relief_start = {
    obj.name: tuple(tuple(vertex.co) for vertex in obj.data.vertices)
    for obj in (left, right)
}


def torso_contact_relieved(first, second):
    if first is torso and second in (left, right):
        origin = relief_start[second.name][0]
        current = second.data.vertices[0].co
        shift_mm = abs(current.x - origin[0]) * 1000
        if shift_mm > 10.0001 and abs(current.y - origin[1]) < .002:
            return 1
    return 0


def bounded_torso_repair(target, sleeve, passes):
    assert target is torso and passes == 3
    for vertex in sleeve.data.vertices:
        vertex.co.y += .003
    sleeve.data.update()
    bpy.context.view_layer.update()
    return {
        "contactPairsByPass": [1, 0],
        "maxVertexCorrectionMm": 3.0,
        "remainingContactPairs": 0,
    }


try:
    author.source_fit_collision_pairs = torso_contact_relieved
    author.repair_body_intersections = bounded_torso_repair
    relieved = author.try_collision_safe_cuff_spacing(body, 0, 1, 22)
finally:
    author.source_fit_collision_pairs = actual_contact
    author.repair_body_intersections = actual_repair
assert relieved["selectedMmPerSleeve"] == 22.0, relieved
assert relieved["nativeWorldSpaceCollisionFree"] is True, relieved
assert relieved["shirtTorsoPairsAtSelected"] == [0, 0]
assert relieved["trials"][0]["shirtTorsoPairsAfterBodyRepair"] == [1, 1]
assert relieved["trials"][0]["shirtTorsoPairsAfterRepair"] == [0, 0]
assert len(relieved["trials"][0]["boundedShirtTorsoContactCorrections"]) == 2
for obj in (left, right):
    for vertex, origin in zip(obj.data.vertices, relief_start[obj.name]):
        expected = author.candidate_sleeve_inboard_mm(obj.name, origin[2], 22) / 1000
        assert abs(vertex.co.x - (origin[0] + expected)) < 1e-6
        assert abs(vertex.co.y - (origin[1] + .003)) < 1e-6
        assert abs(vertex.co.z - origin[2]) < 1e-6
assert tuple(tuple(vertex.co) for vertex in body.data.vertices) == source_before
assert tuple(tuple(vertex.co) for vertex in torso.data.vertices) == torso_before

# Time-of-check/time-of-use drift: the accepted candidate is safe during
# the trial but becomes unsafe at the final independent BVH recheck. The
# author must fail AND restore all source garment XYZ, not strand a rejected
# silhouette in the Blender scene.
unstable_start = {
    obj.name: tuple(tuple(vertex.co) for vertex in obj.data.vertices)
    for obj in (left, right)
}
left_body_checks = [0]


def late_source_contact(first, second):
    if first is body and second is left:
        left_body_checks[0] += 1
        return 1 if left_body_checks[0] >= 3 else 0
    return 0


try:
    author.source_fit_collision_pairs = late_source_contact
    try:
        author.try_collision_safe_cuff_spacing(body, 0, 1, 22)
    except RuntimeError as error:
        assert "final contact recheck" in str(error)
    else:
        raise AssertionError("Late unsafe sleeve contact passed final acceptance")
finally:
    author.source_fit_collision_pairs = actual_contact
for obj in (left, right):
    assert tuple(tuple(vertex.co) for vertex in obj.data.vertices) == unstable_start[obj.name]
assert tuple(tuple(vertex.co) for vertex in body.data.vertices) == source_before
assert tuple(tuple(vertex.co) for vertex in torso.data.vertices) == torso_before

# A native repair exception after a partial Y mutation must restore the
# entire original XYZ source snapshot; exceptions are not a license to
# strand an unreviewed garment state.
exception_start = {
    obj.name: tuple(tuple(vertex.co) for vertex in obj.data.vertices)
    for obj in (left, right)
}


def forced_body_contact(first, second):
    return 1 if first is body and second in (left, right) else 0


def broken_native_repair(_body, sleeve, _passes):
    sleeve.data.vertices[0].co.y += .007
    sleeve.data.update()
    bpy.context.view_layer.update()
    raise RuntimeError("simulated BVH repair exception")


try:
    author.source_fit_collision_pairs = forced_body_contact
    author.repair_body_intersections = broken_native_repair
    try:
        author.try_collision_safe_cuff_spacing(body, 0, 1, 22)
    except RuntimeError as error:
        assert "simulated BVH repair exception" in str(error)
    else:
        raise AssertionError("A failing native repair was silently accepted")
finally:
    author.source_fit_collision_pairs = actual_contact
    author.repair_body_intersections = actual_repair
for obj in (left, right):
    assert tuple(tuple(vertex.co) for vertex in obj.data.vertices) == exception_start[obj.name]
assert tuple(tuple(vertex.co) for vertex in body.data.vertices) == source_before

# Missing torso must not be silently treated as zero contact.
bpy.data.objects.remove(torso, do_unlink=True)
try:
    author.try_collision_safe_cuff_spacing(body, 0, 1, 5)
except RuntimeError as error:
    assert "shirt torso" in str(error).lower()
else:
    raise AssertionError("Missing fitted torso bypassed native cuff contact gate")

print("LINEN_EARTH_NATIVE_CUFF_SPACING_REPAIR: PASS")
