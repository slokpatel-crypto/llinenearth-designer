"""Run with actual Blender: no synthetic pair counts, no production artifacts."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy
from mathutils import Vector

source = Path(__file__).resolve().parents[2] / "scripts/blender/diagnose-linen-earth-crotch.py"
spec = importlib.util.spec_from_file_location("titan_crotch_cross_section", source)
assert spec is not None and spec.loader is not None
diagnosis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnosis)

# A deterministic perpendicular triangle pair crosses along a 1m segment.
# This proves the new metric measures actual surface intersection geometry,
# rather than relabelling epsilon-expanded BVH candidates.
left_fixture = {
    "points": [Vector((-1, -1, 0)), Vector((1, -1, 0)), Vector((0, 1, 0))],
    "triangles": [[(0, 1, 2)]],
}
right_fixture = {
    "points": [Vector((0, -1, -1)), Vector((0, 1, -1)), Vector((0, 0, 1))],
    "triangles": [[(0, 1, 2)]],
}
known = diagnosis.intersection_segment_lengths_mm(left_fixture, right_fixture, [(0, 0)])
assert len(known) == 1 and abs(known[0] - 1000.0) < 1e-6, known
known_segments = diagnosis.intersection_segment_witnesses(
    left_fixture, right_fixture, [(0, 0)]
)
assert len(known_segments) == 1, known_segments
assert known_segments[0]["leftPolygonIndex"] == 0
assert known_segments[0]["rightPolygonIndex"] == 0
assert abs(known_segments[0]["lengthMm"] - 1000.0) < 1e-6
assert known_segments[0]["midpoint"].length < 1e-8
known_pairs, known_witness = diagnosis.geometric_intersection_witness(
    {**left_fixture, "polygons": [(0, 1, 2)]},
    {**right_fixture, "polygons": [(0, 1, 2)]},
)
assert known_pairs == [(0, 0)], known_pairs
assert known_witness["crossingPolygonPairs"] == 1, known_witness
assert known_witness["crossingSegmentLengthMm"]["sumPolygonPairProxy"] == 1000.0

# An epsilon candidate that only touches at one point has no crossing segment.
touch_fixture = {
    "points": [Vector((0, 0, 0)), Vector((0, 1, 1)), Vector((0, -1, 1))],
    "triangles": [[(0, 1, 2)]],
}
assert diagnosis.intersection_segment_lengths_mm(left_fixture, touch_fixture, [(0, 0)]) == []

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.25)
body = bpy.context.object
body.name = "Body"
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.75, location=(-0.36, 0.0, 0.15))
left = bpy.context.object
left.name = "TrouserLegLFabric"
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.75, location=(0.36, 0.0, 0.15))
right = bpy.context.object
right.name = "TrouserLegRFabric"
bpy.context.view_layer.update()

initial_left = [tuple(v.co) for v in left.data.vertices]
initial_right = [tuple(v.co) for v in right.data.vertices]
first = diagnosis.analyze(body, left, right)
assert first["legLegPolygonContactPairs"] > 0, first
crossing = first["geometricIntersectionWitness"]
assert crossing["bvhCandidatePairs"] == first["legLegPolygonContactPairs"]
assert 0 < crossing["crossingPolygonPairs"] <= crossing["bvhCandidatePairs"]
assert crossing["crossingSegmentLengthMm"]["count"] == crossing["crossingPolygonPairs"]
assert crossing["crossingSegmentLengthMm"]["maximum"] > 0
assert crossing["crossingSegmentLengthMm"]["sumPolygonPairProxy"] >= crossing["crossingSegmentLengthMm"]["maximum"]
assert sum(first["contactPairsByBodyHeightOctile"]) == first["legLegPolygonContactPairs"]
assert first["contactingLeftLegFaceCount"] > 0 and first["contactingRightLegFaceCount"] > 0
assert 0 < first["contactFractionLeftLeg"] <= 1
assert 0 < first["contactFractionRightLeg"] <= 1
assert len(first["actualContactZCrossSections"]) == 5
assert first["bodyDistanceAtContactVerticesMm"]["count"] > 0
assert first["worldContactBoundsMm"]["z"][0] <= first["worldContactBoundsMm"]["z"][1]
assert first["leftLegOpenEdges"]["allOpenBoundaryEdges"] == 0, "Closed ico sphere must have no open edges"
assert first["rightLegOpenEdges"]["allOpenBoundaryEdges"] == 0

# The same native fixture must distinguish a true spatially separated pair
# instead of deriving overlap counts from labels or fixed thresholds.
right.location.x += 5.0
bpy.context.view_layer.update()
apart = diagnosis.analyze(body, left, right)
assert apart["legLegPolygonContactPairs"] == 0
assert apart["geometricIntersectionWitness"]["bvhCandidatePairs"] == 0
assert apart["geometricIntersectionWitness"]["crossingPolygonPairs"] == 0
assert apart["geometricIntersectionWitness"]["crossingSegmentLengthMm"] is None
assert apart["contactingLeftLegFaceAreaMm2"] == 0
assert apart["contactingRightLegFaceAreaMm2"] == 0
assert apart["actualContactZCrossSections"] == []
assert apart["worldContactBoundsMm"] is None
assert apart["bodyDistanceAtContactVerticesMm"] is None
assert all(count == 0 for count in apart["contactPairsByBodyHeightOctile"])
assert [tuple(v.co) for v in left.data.vertices] == initial_left
assert [tuple(v.co) for v in right.data.vertices] == initial_right

# Fail closed on a missing native mesh, never supply a "safe zero" estimate.
try:
    diagnosis.analyze(body, left, None)
except RuntimeError as err:
    assert "genuine Blender mesh" in str(err)
else:
    raise AssertionError("Missing real garment incorrectly got an approved zero")

print("TITAN_REAL_CROTCH_CROSS_SECTION_NATIVE_GEOMETRY_PASSED")
