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
], comparison
assert [item["rim"] for item in comparison["variants"]] == [False, True, False, True]
assert [item["offset"] for item in comparison["variants"]] == [1.0, 1.0, -1.0, -1.0]
assert all(type(item["bodyIntersectionPairs"]) is int and item["bodyIntersectionPairs"] >= 0
           for item in comparison["variants"])
assert comparison["variants"][1]["bodyIntersectionPairs"] == stages[-1]["bodyIntersectionPairs"]
assert not any(obj.name.startswith("LE_UNSAVED_CONTACT_VARIANT_") for obj in bpy.data.objects), (
    "A disposable solidification probe was left in the authored candidate scene"
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
