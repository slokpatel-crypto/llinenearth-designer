"""Run with actual Blender: no synthetic pair counts, no production artifacts."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

source = Path(__file__).resolve().parents[2] / "scripts/blender/diagnose-linen-earth-crotch.py"
spec = importlib.util.spec_from_file_location("titan_crotch_cross_section", source)
assert spec is not None and spec.loader is not None
diagnosis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnosis)

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
