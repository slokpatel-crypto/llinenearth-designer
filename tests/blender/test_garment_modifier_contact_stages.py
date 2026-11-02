"""Native Blender evidence: contact-stage counts use actual world-space modifiers."""
from __future__ import annotations
import importlib.util
import json
from pathlib import Path

import bpy

source = Path(__file__).resolve().parents[2] / "scripts/blender/author-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("titan_author_stages", source)
assert spec is not None and spec.loader is not None
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(0, 0, 0))
body = bpy.context.object
body.name = "Body"
# Two actual triangulated surfaces intersect through non-coplanar triangles.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.8, location=(1.2, 0, 0))
shell = bpy.context.object
shell.name = "ShellCandidate"
bpy.context.view_layer.update()
body_tree = author.actual_world_bvh(body)
before = author.actual_contact_pairs(body_tree, shell)
assert before > 0, before
shell.location.x += 5
bpy.context.view_layer.update()
assert author.actual_contact_pairs(body_tree, shell) == 0
shell.location.x -= 5
bpy.context.view_layer.update()

# Run real modifiers; no synthetic injected count values or bypassing Blender.
author.fit_shell(shell, body, 0.007, 0.0016, body_tree)
stages = json.loads(shell["linen_earth_body_contact_stages_json"])
assert [item["stage"] for item in stages] == [
    "selectedBodyShell", "afterSmoothing", "afterBodyClearance", "afterClothThickness"
], stages
assert all(type(item["bodyIntersectionPairs"]) is int and item["bodyIntersectionPairs"] >= 0
           for item in stages), stages
assert stages[-1]["bodyIntersectionPairs"] == author.actual_contact_pairs(body_tree, shell)
assert stages[0]["bodyIntersectionPairs"] == before

comparison = json.loads(shell["linen_earth_solidify_variant_contacts_json"])
assert comparison["baselineAfterBodyClearance"] == stages[2]["bodyIntersectionPairs"]
assert [item["variant"] for item in comparison["variants"]] == [
    "outwardNoRim", "outwardWithRim", "inwardNoRim", "inwardWithRim",
    "recalculatedOutwardWithRim", "recalculatedInwardWithRim",
], comparison
assert [item["rim"] for item in comparison["variants"]] == [False, True, False, True, True, True]
assert [item["recalculatedNormals"] for item in comparison["variants"]] == [False, False, False, False, True, True]
assert all(type(item["sourceClothFaceCount"]) is int and item["sourceClothFaceCount"] > 0
           for item in comparison["variants"])
assert all(item["reversedClothFaceCount"] is None for item in comparison["variants"][:4])
assert all(type(item["reversedClothFaceCount"]) is int and
           0 <= item["reversedClothFaceCount"] <= item["sourceClothFaceCount"]
           for item in comparison["variants"][4:])
assert [item["offset"] for item in comparison["variants"]] == [1.0, 1.0, -1.0, -1.0, 1.0, -1.0]
assert all(type(item["bodyIntersectionPairs"]) is int and item["bodyIntersectionPairs"] >= 0
           for item in comparison["variants"])
assert comparison["variants"][1]["bodyIntersectionPairs"] == stages[-1]["bodyIntersectionPairs"]
assert not any(obj.name.startswith("LE_UNSAVED_CONTACT_VARIANT_") for obj in bpy.data.objects), (
    "A disposable solidification probe was left in the authored candidate scene"
)

shrink_modes = json.loads(shell["linen_earth_shrinkwrap_modes_json"])
assert shrink_modes["beforeWrap"] == stages[1]["bodyIntersectionPairs"]
assert [t["mode"] for t in shrink_modes["trialModes"]] == [
    "OUTSIDE_SURFACE", "ABOVE_SURFACE", "ON_SURFACE",
], shrink_modes
assert all(t["clearanceMm"] == 7.0 for t in shrink_modes["trialModes"])
assert all(
    type(t["bodyPairsAfterWrap"]) is int and type(t["bodyPairsAfterClothThickness"]) is int
    and t["bodyPairsAfterWrap"] >= 0 and t["bodyPairsAfterClothThickness"] >= 0
    for t in shrink_modes["trialModes"]
), shrink_modes
assert shrink_modes["trialModes"][0]["bodyPairsAfterWrap"] == stages[2]["bodyIntersectionPairs"]
assert shrink_modes["trialModes"][0]["bodyPairsAfterClothThickness"] == stages[3]["bodyIntersectionPairs"]
assert not any(o.name.startswith("LE_UNSAVED_SHRINKWRAP_TRIAL_") for o in bpy.data.objects), (
    "A disposable shrinkwrap comparison modified the final Blender scene"
)

refinement = json.loads(shell["linen_earth_surface_refinement_trials_json"])
assert [trial["simpleSubdivisionLevel"] for trial in refinement] == [0, 1]
assert refinement[0]["preWrapVertices"] == refinement[0]["sourceVertices"]
assert refinement[1]["sourceVertices"] == refinement[0]["sourceVertices"]
assert refinement[1]["preWrapVertices"] > refinement[1]["sourceVertices"]
assert all(trial["clearanceMm"] == 7.0 and trial["clothThicknessMm"] == 1.6
           for trial in refinement)
assert refinement[0]["bodyPairsAfterWrap"] == stages[2]["bodyIntersectionPairs"]
assert refinement[0]["bodyPairsAfterClothThickness"] == stages[3]["bodyIntersectionPairs"]
assert all(type(trial["bodyPairsAfterWrap"]) is int and
           type(trial["bodyPairsAfterClothThickness"]) is int and
           trial["bodyPairsAfterWrap"] >= 0 and
           trial["bodyPairsAfterClothThickness"] >= 0
           for trial in refinement)
assert not any(obj.name.startswith("LE_UNSAVED_REFINEMENT_TRIAL_") for obj in bpy.data.objects), (
    "A disposable refined garment leaked into the production Blender scene"
)


# Fail closed on empty evaluated surfaces instead of fabricating a zero count.
empty = bpy.data.objects.new("EmptyPanel", bpy.data.meshes.new("EmptyMesh"))
bpy.context.scene.collection.objects.link(empty)
try:
    author.actual_contact_pairs(body_tree, empty)
except RuntimeError as error:
    assert "No actual surface" in str(error)
else:
    raise AssertionError("Empty panel incorrectly passed the stage-contact measurement")

print("TITAN_REAL_GARMENT_MODIFIER_CONTACT_STAGES_PASSED")
