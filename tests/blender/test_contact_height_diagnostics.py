"""Independent native regression for spatial contact evidence (candidate only).

Run with blender --background --factory-startup --python
tests/blender/test_contact_height_diagnostics.py
No source portrait, release approval or fabric material values are inferred.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

source = Path(__file__).resolve().parents[2] / "scripts/blender/author-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("le_source_candidate_author", source)
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)

bpy.ops.mesh.primitive_cube_add(size=1, location=(0.0, 0.0, 0.0))
body = bpy.context.object
body.name = "TEST_BODY"

bpy.ops.mesh.primitive_cube_add(size=1, location=(0.2, 0.1, 0.15))
cloth = bpy.context.object
cloth.name = "TEST_CLOTH"

# This synthetic intersection is a diagnostic fixture, NOT a body-fitting
# benchmark. A zero-pass call may inspect but may not mutate this geometry.
before = [tuple(vertex.co) for vertex in cloth.data.vertices]
report = author.repair_body_intersections(body, cloth, max_passes=0)
after = [tuple(vertex.co) for vertex in cloth.data.vertices]
assert before == after, "Diagnostic mode may not change mesh geometry"
assert report["remainingContactPairs"] > 0, report
assert report["remainingContactFaceCount"] > 0, report
assert report["remainingContactFaceCount"] <= report["remainingContactPairs"], report
assert sum(report["remainingContactHeightDeciles"].values()) == report["remainingContactFaceCount"], report
assert sum(report["remainingContactLateralZones"].values()) == report["remainingContactFaceCount"], report
assert 0 < len(report["remainingContactSampleWorldMetres"]) <= 12, report
assert report["maxVertexCorrectionMm"] == 0.0, report

cloth.location = (4.0, 0.0, 0.0)
bpy.context.view_layer.update()
clear = author.repair_body_intersections(body, cloth, max_passes=0)
assert clear["remainingContactPairs"] == 0, clear
assert clear["remainingContactFaceCount"] == 0, clear
assert not clear["remainingContactSampleWorldMetres"], clear
assert sum(clear["remainingContactHeightDeciles"].values()) == 0, clear

print("LINEN_EARTH_NATIVE_CONTACT_DISTRIBUTION: PASS")
