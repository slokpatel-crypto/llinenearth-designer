"""Real Blender regression: collision BVHs must share world coordinates.

Run with blender --background --factory-startup --python tests/blender/test_world_collision_bvh.py
The imported scan can have a non-zero source object origin while the authored
garment is world-space; local BVH comparisons are not admissible fit evidence.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

source = Path(__file__).resolve().parents[2] / "scripts/blender/preflight-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("linen_earth_preflight", source)
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)

bpy.ops.mesh.primitive_cube_add(size=1, location=(-4.0, 0.0, 0.0))
body = bpy.context.object
body.name = "TEST_SCAN_WITH_OFFSET_ORIGIN"
# Same geometry in world space, but the native scan's vertices stay offset
# from its translated object origin.
for vertex in body.data.vertices:
    vertex.co.x += 4.0
# Direct data mutation is NOT guaranteed to update the evaluated dependency
# graph. The old fixture could report a false-negative world-space BVH hit.
body.data.update()
bpy.context.view_layer.update()

# Offset Y and Z as well as X: coincident top/side faces yield BVH
# coplanarity ambiguities, not a reliable genuine triangle crossing fixture.
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.35, 0.1, 0.15))
garment = bpy.context.object
garment.name = "TEST_GARMENT_WORLD_SPACE"

hits = preflight.intersection_pair_count(body, garment)
assert hits is not None and hits > 0, (
    "Real mesh overlap was missed because source/garment BVHs used different local frames: "
    + repr(hits)
)
garment.location.x = 3.0
bpy.context.view_layer.update()
false_hits = preflight.intersection_pair_count(body, garment)
assert false_hits == 0, (
    "World-separated meshes were incorrectly recorded as colliding: " + repr(false_hits)
)
garment.location.x = 0.35
garment.scale.x = 0.8
bpy.context.view_layer.update()
scaled_hits = preflight.intersection_pair_count(body, garment)
assert scaled_hits > 0, "Evaluated object scale must be reflected in world contact evidence"

print(f"LENEN_EARTH_WORLD_SPACE_COLLISION_TEST_PASSED hits={hits}, separated={false_hits}, scaled={scaled_hits}")

# An empty mesh has no BVH and must remain unmeasured, never zero-contact.
empty_mesh = bpy.data.meshes.new('TEST_EMPTY_CONTACT_MESH')
empty_object = bpy.data.objects.new('TEST_EMPTY_CONTACT_OBJECT', empty_mesh)
bpy.context.scene.collection.objects.link(empty_object)
bpy.context.view_layer.update()
assert preflight.intersection_pair_count(body, empty_object) is None, (
    'An empty evaluated mesh must not be reported as collision-free'
)
assert preflight.intersection_pair_count(body, None) is None
print('LINEN_EARTH_UNMEASURED_CONTACT_REMAINS_UNKNOWN_PASSED')

# Independent real evaluated Blender geometry: the thirteen extra panel-pair
# checks must expose an actual crossing at a proposed armhole join, rather
# than silently treating a named sewn attachment as approved.
panels = {}
for index, name in enumerate(preflight.CONTACT_PANELS):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(8.0 + 10.0 * index, 0.0, 0.0))
    panels[name] = bpy.context.object
panels["ShirtSleeveLFabric"].location = (8.35, 0.10, 0.15)
bpy.context.view_layer.update()

panel_evidence, panel_reasons = preflight.review_panel_contacts(
    panels, preflight.intersection_pair_count,
)
armhole = panel_evidence["ShirtTorsoFabric__ShirtSleeveLFabric"]
assert armhole["intersectionTrianglePairs"] is not None
assert armhole["intersectionTrianglePairs"] > 0
assert armhole["relationship"] == "proposed_sewn_join_unverified"
assert armhole["sewnConstructionApproved"] is False
assert any("ShirtTorsoFabric/ShirtSleeveLFabric" in reason for reason in panel_reasons)
assert len(panel_evidence) == 13

# Do not turn a missing counterpart into an all-clear when source geometry
# was absent, e.g. if a Blender collection filter silently skipped a panel.
panels["ShirtSleeveLFabric"] = None
missing_evidence, missing_reasons = preflight.review_panel_contacts(
    panels, preflight.intersection_pair_count,
)
assert missing_evidence["ShirtTorsoFabric__ShirtSleeveLFabric"]["status"] == "unmeasured"
assert any("Unmeasured garment panel" in reason for reason in missing_reasons)
print("LINEN_EARTH_NATIVE_ALL_PANEL_CONTACT_GATE_PASSED")

