"""Native, original-CC0 combined garment contract regression.

Checks actual six Blender material meshes and exact 15-pair collision evidence.
Research candidate is NEVER approved for a customer viewer.
"""
import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy

root=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location(
    "titan_original_cc0_mesh",root/"scripts/blender/research-sewn-shirt-from-source.py"
)
assert spec and spec.loader
research=importlib.util.module_from_spec(spec)
spec.loader.exec_module(research)
argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
parser=argparse.ArgumentParser()
parser.add_argument("--report",type=Path,required=True)
result=json.loads(parser.parse_args(argv).report.read_text())
scene=bpy.context.scene
assert bpy.data.filepath.endswith("titan-single-solidify-both-garments-research.blend")
assert scene.get("linen_earth_model_identity_id")=="linen-earth-studio-model-v1"
assert scene.get("linen_earth_model_reference_image")=="/designer/studio-tucked.webp"
assert scene.get("linen_earth_model_identity_locked") is True
assert scene.get("linen_earth_research_single_solidify_shirt") is True
assert scene.get("linen_earth_research_single_solidify_trousers") is True
assert scene.get("linen_earth_production_approved") is False
assert result["modelIdentityId"]=="linen-earth-studio-model-v1"
assert result["referenceImage"]=="/designer/studio-tucked.webp"
assert result["productionApproved"] is False
assert result["tailorApproved"] is False
assert result["realisticTrouserConstructionApproved"] is False
assert 3<=result["originalBodyClearanceMm"]<=18
assert 0<=result["researchExtraTrouserClearanceMm"]<=9
assert result["researchCombinedTrouserClearanceMm"]<=18
assert result["researchClearanceMode"]=="waist-only"
assert result["researchWaistBlend"]["weightedVertices"]>=result["researchWaistBlend"]["fullyWeightedVertices"]>8
assert result["researchWaistBlend"]["blendBandMm"]==45.0
assert abs(result["researchCombinedTrouserClearanceMm"]-(
    result["originalBodyClearanceMm"]+result["researchExtraTrouserClearanceMm"]))<0.001
assert research.fingerprint(bpy.data.objects["Body"])==result["sourceBodySha256"]
assert result["sourceBodySha256"]=="db195b223b23c1f501fc24cc20d20456d9c4d6cd6e63d2204b489b133f39df76"
assert all(research.fingerprint(bpy.data.objects[name])==sha
           for name,sha in result["shirtMeshSha256Preserved"].items())
assert set(result["trouserMaterialPanels"])==set(research.TROUSER_PANELS)
assert set(result["originalBodySourceSeamVertices"])=={"waistLegL","waistLegR","legLeg"}
assert all(x>=3 for x in result["originalBodySourceSeamVertices"].values())
assert len(result["nativeGarmentPairTriangleContacts"])==15
names=research.PANELS+research.TROUSER_PANELS
for name in names:
    obj=bpy.data.objects.get(name)
    assert obj and obj.type=="MESH" and len(obj.data.polygons)>4,name
    assert obj.data.uv_layers.active is not None,name
    assert obj.data.materials and obj.data.materials[0].name==name,name
    assert obj.get("candidateOnly") is True,name
    assert obj.get("productionApproved") is False,name
    assert obj.get("linen_earth_research_joint_solidify") is True,name
    for vert in obj.data.vertices:
        assert all(math.isfinite(float(value)) for value in vert.co),name
for i,left in enumerate(names):
    for right in names[i+1:]:
        key=f"{left}::{right}"
        real=research.preflight.intersection_pair_count(bpy.data.objects[left],bpy.data.objects[right])
        assert type(real) is int and real>=0,key
        assert real==result["nativeGarmentPairTriangleContacts"][key],key
assert bpy.data.objects.get("TITAN_RESEARCH_SOURCE_SHIRT_JOINT") is None
assert bpy.data.objects.get("TITAN_RESEARCH_SOURCE_TROUSERS_JOINT") is None
print("TITAN_NATIVE_ORIGINAL_CC0_SIX_PANEL_CLOSED_SOURCE_JOIN_RESEARCH_ONLY",
      json.dumps(result["nativeGarmentPairTriangleContacts"]))
