"""Native Blender regression for physical candidate leg-gap rollback.

Run via --python-exit-code 1 so assertion failures cannot silently pass.
Synthetic cloth cubes exercise real evaluated world-space BVHs; no source
model, photo identity, or tailor-approved fit is inferred.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

source = Path(__file__).resolve().parents[2] / "scripts/blender/author-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("le_source_gap_author", source)
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)


def cube(name, center, dimensions):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    # Real source garment shells have identity transforms and world-space vertices.
    # Apply the synthetic fixture's location too so the tested contract matches.
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.update()
    bpy.context.view_layer.update()
    return obj


body = cube("TEST_LOCKED_SOURCE_BODY", (1.0, 0.0, 0.35), (0.04, 0.04, 0.1))
left = cube("TrouserLegLFabric", (-0.009, 0.0, 0.35), (0.02, 0.04, 0.1))
# Deliberately avoid coplanar cube faces: BVH overlap requires real
# intersecting surfaces rather than ambiguous coincident rectangles.
right = cube("TrouserLegRFabric", (0.009, 0.006, 0.345), (0.02, 0.04, 0.1))
source_body_before = (tuple(tuple(v.co) for v in body.data.vertices),
                      tuple(body.matrix_world))

# At 3 mm/side the left/right cuboids penetrate by 2 mm. At <=1.5 mm/side
# they are separated. Do not move/replace the source body to fake a pass.
report = author.restore_collision_free_leg_gap(body, 0, 1.0, 3.0)
assert report["trials"][0]["legToLegIntersectionPairs"] > 0, report
assert 0 <= report["selectedMmPerLeg"] < 3.0, report
assert report["nativeWorldSpaceCollisionFree"] is True, report
assert author.source_fit_collision_pairs(left, right) == 0, report
assert author.source_fit_collision_pairs(body, left) == 0, report
assert author.source_fit_collision_pairs(body, right) == 0, report
assert source_body_before == (
    tuple(tuple(v.co) for v in body.data.vertices), tuple(body.matrix_world)
), "A cloth rollback must NEVER change the fixed Real Model Designer body."
assert report["productionApproved"] is False and report["tailorFitApproved"] is False
assert right["linen_earth_trouser_leg_inboard_candidate_mm"] == report["selectedMmPerLeg"]

print("LINEN_EARTH_NATIVE_LEG_GAP_ROLLBACK: PASS " +
      "selected=" + str(report["selectedMmPerLeg"]))
