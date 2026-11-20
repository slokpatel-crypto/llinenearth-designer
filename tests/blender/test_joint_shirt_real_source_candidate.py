"""Native CC0 sewn-shirt research guard on a real, SAVED source candidate.

Never counts an experimental polygon join as production-ready or tailor proof.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy

root=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location(
    "titan_real_preflight",root/"scripts/blender/preflight-linen-earth-officewear.py"
)
assert spec and spec.loader
preflight=importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)
argv=sys.argv
argv=argv[argv.index("--")+1:] if "--" in argv else []
parser=argparse.ArgumentParser()
parser.add_argument("--report",type=Path,required=True)
options=parser.parse_args(argv)
evidence=json.loads(options.report.read_text())
assert bpy.data.filepath.endswith("titan-single-solidify-sewn-shirt-research.blend")
scene=bpy.context.scene
assert scene.get("linen_earth_model_identity_id")=="linen-earth-studio-model-v1"
assert scene.get("linen_earth_model_identity_locked") is True
assert scene.get("linen_earth_model_reference_image")=="/designer/studio-tucked.webp"
assert scene.get("linen_earth_research_single_solidify_shirt") is True
assert scene.get("linen_earth_production_approved") is False
assert scene.get("linen_earth_asset_status")=="RESEARCH-only-joint-shirt-solidify-unapproved"
assert bpy.data.objects.get("TITAN_RESEARCH_SOURCE_SHIRT_JOINT") is None
assert evidence["sourceBodySha256"] and len(evidence["sourceBodySha256"])==64
assert evidence["productionApproved"] is False
assert evidence["tailorApproved"] is False
assert evidence["watertightShirtConstructionApproved"] is False
assert evidence["photographicMatchApproved"] is False
assert evidence["measuredFabricDrapeApproved"] is False
assert evidence["singleNativeSolidify"] is True
assert set(evidence["originalTrouserMeshesPreservedSha256"])=={"TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric"}
assert all(len(v)==64 for v in evidence["originalTrouserMeshesPreservedSha256"].values())
names=("ShirtTorsoFabric","ShirtSleeveLFabric","ShirtSleeveRFabric",
       "TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric")
for name in names:
    obj=bpy.data.objects.get(name)
    assert obj and obj.type=="MESH" and len(obj.data.polygons)>4,name
    assert obj.data.uv_layers.active is not None,name
    assert obj.data.materials and obj.data.materials[0].name==name,name
    for vertex in obj.data.vertices:
        assert all(math.isfinite(float(n)) for n in vertex.co),name
for name in names[:3]:
    obj=bpy.data.objects[name]
    assert obj.get("candidateOnly") is True,name
    assert obj.get("productionApproved") is False,name
    assert obj.get("sewnSeamVerified") is False,name
    assert obj.get("measuredFabricDrapeApproved") is False,name
    assert obj.get("linen_earth_research_joint_solidify") is True,name

for left,right in (
    ("ShirtTorsoFabric","ShirtSleeveLFabric"),
    ("ShirtTorsoFabric","ShirtSleeveRFabric"),
    ("ShirtSleeveLFabric","ShirtSleeveRFabric"),
):
    key=left+"::"+right
    count=preflight.intersection_pair_count(bpy.data.objects[left],bpy.data.objects[right])
    assert type(count) is int and count>=0,(key,count)
    assert count==evidence["realBVHShirtPanelContacts"][key],(key,count,evidence)
print("TITAN_NATIVE_REAL_CC0_SEWN_SOURCE_SINGLE_SOLIDIFY_RESEARCH_UNAPPROVED",json.dumps(
    evidence["realBVHShirtPanelContacts"]
))
