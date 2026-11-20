"""Native Blender regression for all 15 garment-to-garment collision boundaries.

The two historical boundaries have their own fixed policies (leg/leg = 0,
tucked shirt/waist <=120). Every other pair must be physically measured and
must not be silently excused as an armhole or a sewn seam.
These are synthetic *adversarial* meshes, not a source-body fit claim.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

source = Path(__file__).resolve().parents[2] / "scripts/blender/preflight-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("titan_all_contacts", source)
assert spec is not None and spec.loader is not None
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)

pairs = preflight.unchecked_garment_pairs()
assert len(pairs) == 13, pairs
assert len(set(frozenset(pair) for pair in pairs)) == 13
assert all(left != right for left, right in pairs)
assert ("ShirtSleeveLFabric", "TrouserLegLFabric") in pairs
assert ("ShirtTorsoFabric", "ShirtSleeveLFabric") in pairs
assert frozenset(("ShirtTorsoFabric", "TrouserWaistFabric")) not in [frozenset(p) for p in pairs]
assert frozenset(("TrouserLegLFabric", "TrouserLegRFabric")) not in [frozenset(p) for p in pairs]

objects = {}
for index, name in enumerate(preflight.GARMENT_OBJECTS):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(4.0 * index, 0.0, 0.0))
    obj = bpy.context.object
    obj.name = name
    objects[name] = obj
bpy.context.view_layer.update()

clean, failures = preflight.unchecked_garment_contact_report(objects)
assert len(clean) == 13 and not failures, (clean, failures)
assert all(count == 0 for count in clean.values()), clean

# Formerly unexamined crossing of left sleeve and left trouser leg:
# offset all axes so BVH detects a genuine non-coplanar triangle crossing.
sleeve = objects["ShirtSleeveLFabric"]
sleeve.location = (objects["TrouserLegLFabric"].location.x + 0.35, 0.12, 0.18)
bpy.context.view_layer.update()
measured, reasons = preflight.unchecked_garment_contact_report(objects)
key = "ShirtSleeveLFabric::TrouserLegLFabric"
assert measured[key] is not None and measured[key] > 0, measured
assert any(key in reason and "unreviewed" in reason for reason in reasons), reasons

# A shoulder/armhole crossing cannot be presumed to be a validated seam.
sleeve.location = (objects["ShirtTorsoFabric"].location.x + 0.35, 0.12, 0.18)
bpy.context.view_layer.update()
measured, reasons = preflight.unchecked_garment_contact_report(objects)
key = "ShirtTorsoFabric::ShirtSleeveLFabric"
assert measured[key] is not None and measured[key] > 0, measured
assert any(key in reason for reason in reasons), reasons

# Missing evaluated panels must never be converted to zero-contact evidence.
without_right_leg = dict(objects)
without_right_leg.pop("TrouserLegRFabric")
measured, reasons = preflight.unchecked_garment_contact_report(without_right_leg)
assert any(count is None for count in measured.values())
assert any("missing geometry is not evidence" in reason for reason in reasons), reasons

print("TITAN_NATIVE_ALL_GARMENT_PAIRS_FAIL_CLOSED_PASSED")
