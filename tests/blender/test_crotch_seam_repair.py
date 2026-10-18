"""Native regression for source-locked seam repair and XYZ rollback.

Run in Blender via --python-exit-code 1. Synthetic cubes validate evaluated
BVH separation; mocked persistent contacts test that no trial can silently
retain a damaging Y/Z body-contact correction. Not model/fit approval.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

source = Path(__file__).resolve().parents[2] / "scripts/blender/author-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("le_source_seam_author", source)
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


# The original source body is untouched, even for a successful garment-only
# gap relief. The two synthetics share real intersecting 3D shell surfaces.
body = cube("TEST_UNMODIFIED_SOURCE", (1, 0, .47), (.1, .1, .1))
left = cube("TrouserLegLFabric", (-.005, 0, .47), (.02, .04, .06))
right = cube("TrouserLegRFabric", (.005, .007, .465), (.02, .04, .06))
body_before = tuple(tuple(vertex.co) for vertex in body.data.vertices)
assert author.source_fit_collision_pairs(left, right) > 0, "Bad fixture: legs must collide"
result = author.trial_inner_crotch_seam_relief(body, 0, 1, 0)
assert result["nativeWorldSpaceCollisionFree"] is True, result
assert result["selectedPeakSeamReliefMm"] > 0
assert author.source_fit_collision_pairs(left, right) == 0
assert author.source_fit_collision_pairs(body, left) == 0
assert author.source_fit_collision_pairs(body, right) == 0
assert tuple(tuple(vertex.co) for vertex in body.data.vertices) == body_before
assert result["productionApproved"] is False

# Force a regression to persistently report body contact. During each trial
# simulate legitimate bounded body-normal repair that changes ALL coordinates,
# not only X. The rollback must restore original XYZ even after all bounded falloff trials.
original = {
    obj.name: tuple(tuple(vertex.co) for vertex in obj.data.vertices)
    for obj in (left, right)
}
physical_pairs = author.source_fit_collision_pairs
physical_repair = author.repair_body_intersections


def stubborn_contacts(one, two):
    return 0 if one is left and two is right else 1


def bounded_but_ineffective_repair(_body, garment, _passes):
    for vertex in garment.data.vertices:
        vertex.co.y += .002
        vertex.co.z += .001
    garment.data.update()
    bpy.context.view_layer.update()
    return {
        "contactPairsByPass": [1, 1],
        "maxVertexCorrectionMm": 2.236,
        "remainingContactPairs": 1,
    }


try:
    author.source_fit_collision_pairs = stubborn_contacts
    author.repair_body_intersections = bounded_but_ineffective_repair
    rejected = author.trial_inner_crotch_seam_relief(body, 0, 1, 0)
finally:
    author.source_fit_collision_pairs = physical_pairs
    author.repair_body_intersections = physical_repair

assert rejected["nativeWorldSpaceCollisionFree"] is False, rejected
assert rejected["selectedPeakSeamReliefMm"] == 0
assert len(rejected["trials"]) == 14
assert all(trial["boundedBodyContactCorrections"] for trial in rejected["trials"])
for obj in (left, right):
    assert tuple(tuple(vertex.co) for vertex in obj.data.vertices) == original[obj.name], (
        "Rejected garment seam trial retained a Y/Z correction: " + obj.name
    )
assert tuple(tuple(vertex.co) for vertex in body.data.vertices) == body_before
# Test the separate leg-gap coarse-to-fine transition with a deterministic
# simulated collision boundary on ACTUAL Blender mesh transforms. This checks
# that a failed fine trial never remains on the garment and the locked source
# body remains byte-for-byte unchanged; source-scene BVH is tested separately.
sample_index = next(i for i, vertex in enumerate(left.data.vertices)
                    if abs(author.candidate_leg_inboard_mm(
                        left.name, vertex.co.z, 1.0)) > .01)
start_x = left.data.vertices[sample_index].co.x
unit_factor = author.candidate_leg_inboard_mm(
    left.name, left.data.vertices[sample_index].co.z, 1.0)


def bounded_simulated_contact(one, two):
    if one is left and two is right:
        actual_mm = (left.data.vertices[sample_index].co.x-start_x)*1000/unit_factor
        return 1 if actual_mm > 3.2 else 0
    return 0


try:
    author.source_fit_collision_pairs = bounded_simulated_contact
    refined = author.restore_collision_free_leg_gap(
        body, 0.0, 1.0, 3.5, applied_mm=0.0
    )
finally:
    author.source_fit_collision_pairs = physical_pairs
assert refined["nativeWorldSpaceCollisionFree"] is True, refined
assert refined["coarseSafeMmPerLeg"] == 3.0, refined
assert refined["selectedMmPerLeg"] == 3.125, refined
assert refined["fineProbesRequested"] == [3.375, 3.25, 3.125]
assert refined["trials"][-1]["candidateInboardMmPerLeg"] == 3.125
assert refined["trials"][-1]["legToLegIntersectionPairs"] == 0
assert tuple(tuple(vertex.co) for vertex in body.data.vertices) == body_before
assert refined["tailorFitApproved"] is False
assert refined["productionApproved"] is False

print("LINEN_EARTH_NATIVE_CROTCH_SEAM_CONTACT_REPAIR: PASS")
