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
# not only X. The rollback must restore original XYZ even after five attempts.
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
assert len(rejected["trials"]) == 5
assert all(trial["boundedBodyContactCorrections"] for trial in rejected["trials"])
for obj in (left, right):
    assert tuple(tuple(vertex.co) for vertex in obj.data.vertices) == original[obj.name], (
        "Rejected garment seam trial retained a Y/Z correction: " + obj.name
    )
assert tuple(tuple(vertex.co) for vertex in body.data.vertices) == body_before
print("LINEN_EARTH_NATIVE_CROTCH_SEAM_CONTACT_REPAIR: PASS")
