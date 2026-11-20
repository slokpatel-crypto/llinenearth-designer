#!/usr/bin/env python3
"""RESEARCH ONLY: one real pinned CC0 trouser surface and one Solidify.

Uses the same original body and locked photo guides as the unapproved shirt
experiment, with an explicit polygon-owner break at mid-thigh/seat. The
original two legs and waistband remain the exact material-slot contract.
This is NOT a tailored crotch, approved real cloth or production GLB.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/blender"))
import importlib.util
spec=importlib.util.spec_from_file_location(
    "titan_same_cc0_joint",ROOT/"scripts/blender/research-sewn-shirt-from-source.py")
assert spec and spec.loader
shared=importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)

def args():
    argv=sys.argv
    argv=argv[argv.index("--")+1:] if "--" in argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",required=True,type=Path)
    parser.add_argument("--report",required=True,type=Path)
    parser.add_argument("--experimental-trouser-extra-clearance-mm",type=float,default=3.0,
                        help="RESEARCH ONLY: bounded extra radial clearance for a joined trouser source; not a fit approval")
    return parser.parse_args(argv)

def selected_source_faces(body,center,min_z,height,waist_top):
    z=lambda scale:min_z+scale*height
    mid=z(0.500)
    faces=[[],[],[]]
    for polygon in body.data.polygons:
        point=body.matrix_world @ polygon.center
        if mid <= point.z <= waist_top and abs(point.x-center) <= 0.245:
            faces[0].append(polygon)
        elif z(0.055) <= point.z < mid:
            if point.x < center:
                faces[1].append(polygon)
            else:
                faces[2].append(polygon)
    if any(len(panel)<4 for panel in faces):
        raise RuntimeError("Original CC0 lower-body topology lacks all three trouser regions")
    vertices=[{int(v) for poly in panel for v in poly.vertices} for panel in faces]
    seams={
        "waistLegL":len(vertices[0]&vertices[1]),
        "waistLegR":len(vertices[0]&vertices[2]),
        "legLeg":len(vertices[1]&vertices[2]),
    }
    if any(n<3 for n in seams.values()):
        raise RuntimeError("Original CC0 trouser source cannot form a connected seam: "+str(seams))
    return faces,seams,mid

def main():
    o=args()
    scene=bpy.context.scene
    src=Path(bpy.data.filepath).resolve()
    target=o.output.expanduser().resolve()
    if not src.is_file() or src.suffix.lower()!=".blend" or target==src or target.suffix.lower()!=".blend":
        raise RuntimeError("Source and output must be different real saved .blend scenes")
    if (scene.get("linen_earth_model_identity_locked") is not True
        or scene.get("linen_earth_model_identity_id")!="linen-earth-studio-model-v1"
        or scene.get("linen_earth_model_reference_image")!="/designer/studio-tucked.webp"
        or scene.get("linen_earth_research_single_solidify_shirt") is not True
        or scene.get("linen_earth_production_approved") is not False):
        raise RuntimeError("Only unchanged same-identity pinned CC0 shirt research scene may proceed")
    body=bpy.data.objects.get("Body")
    if body is None or body.type!="MESH":
        raise RuntimeError("Missing original unchanged scanned body")
    body_sha=shared.fingerprint(body)
    shirt_hashes={name:shared.fingerprint(bpy.data.objects[name]) for name in shared.PANELS}
    bbox=[body.matrix_world@Vector(v) for v in body.bound_box]
    center=(min(v.x for v in bbox)+max(v.x for v in bbox))/2
    zmin=min(v.z for v in bbox)
    height=max(v.z for v in bbox)-zmin
    if abs(height-1.727)>0.020:
        raise RuntimeError("Original pinned body height changed")
    top=scene.get("linen_earth_trouser_waist_authored_top_z_m")
    clearance=scene.get("linen_earth_garment_clearance_mm")
    thickness=scene.get("linen_earth_garment_thickness_mm")
    if not all(type(value) in (float,int) and math.isfinite(value) for value in (top,clearance,thickness)):
        raise RuntimeError("No physical original-body waist/cloth authoring data")
    if not zmin+height*0.58 < top < zmin+height*0.73:
        raise RuntimeError("Pinned photographic trouser guide/top is inconsistent")
    if not 3<=clearance<=18 or not 0.6<=thickness<=4:
        raise RuntimeError("Original validated cloth clearance/thickness bounds exceeded")
    extra=float(o.experimental_trouser_extra_clearance_mm)
    if not math.isfinite(extra) or not 0<=extra<=9 or clearance+extra>18:
        raise RuntimeError("Joined-trouser research clearance is outside original 0-9mm / 18mm limits")
    regions,source_seams,cut_z=selected_source_faces(body,center,zmin,height,top)
    combined,_,collection=shared.build_joint(
        body,regions,shared.TROUSER_PANELS,"TROUSERS"
    )
    shared.apply(combined,"CORRECTIVE_SMOOTH","LE_RESEARCH_TROUSERS_SMOOTH",
                 lambda mod:(setattr(mod,"factor",0.22),setattr(mod,"iterations",3)))
    shared.apply(combined,"SHRINKWRAP","LE_RESEARCH_TROUSERS_CLEARANCE",
                 lambda mod:(setattr(mod,"target",body),setattr(mod,"wrap_method","NEAREST_SURFACEPOINT"),
                             setattr(mod,"wrap_mode","OUTSIDE_SURFACE"),setattr(mod,"offset",(clearance+extra)/1000.0)))
    shared.apply(combined,"SOLIDIFY","LE_RESEARCH_TROUSERS_ONE_THICKNESS",
                 lambda mod:(setattr(mod,"thickness",thickness/1000.0),
                             setattr(mod,"offset",1.0),setattr(mod,"use_rim",True)))
    panel_counts=shared.split_to_source_panel_objects(
        combined,regions,src,shared.TROUSER_PANELS
    )
    bpy.data.objects.remove(combined,do_unlink=True)
    if collection.objects:
        raise RuntimeError("Research-only joined trouser mesh was left in scene")
    if shared.fingerprint(body)!=body_sha:
        raise RuntimeError("Original source body changed during trouser construction")
    if any(shared.fingerprint(bpy.data.objects[name])!=old for name,old in shirt_hashes.items()):
        raise RuntimeError("Already-tested continuous shirt panels were changed by trouser construction")
    all_panels=shared.PANELS+shared.TROUSER_PANELS
    contact={}
    for i,left in enumerate(all_panels):
        for right in all_panels[i+1:]:
            number=shared.preflight.intersection_pair_count(bpy.data.objects[left],bpy.data.objects[right])
            if type(number) is not int or number<0:
                raise RuntimeError("Native garment overlap matrix lacks original CC0 geometry")
            contact[f"{left}::{right}"]=number
    if len(contact)!=15:
        raise RuntimeError("Complete 15-panel-contact matrix required for trouser candidate")
    scene["linen_earth_asset_status"]="RESEARCH-only-single-thickness-shirt-and-trousers-not-approved"
    scene["linen_earth_research_single_solidify_trousers"]=True
    scene["linen_earth_production_approved"]=False
    result={
        "version":"titan-cc0-shirt-and-trousers-continuous-mesh-research-v1",
        "modelIdentityId":"linen-earth-studio-model-v1",
        "referenceImage":"/designer/studio-tucked.webp",
        "sourceBodySha256":body_sha,
        "shirtMeshSha256Preserved":shirt_hashes,
        "sourceBlend":src.name,
        "sourceCutZMm":round(cut_z*1000,3),
        "originalBodyClearanceMm":clearance,
        "researchExtraTrouserClearanceMm":extra,
        "researchCombinedTrouserClearanceMm":round(clearance+extra,3),
        "originalBodySourceSeamVertices":source_seams,
        "productionApproved":False,
        "tailorApproved":False,
        "photographicMatchApproved":False,
        "fabricDrapeApproved":False,
        "realisticTrouserConstructionApproved":False,
        "trouserMaterialPanels":panel_counts,
        "nativeGarmentPairTriangleContacts":contact,
        "caveat":"single native Solidify experiment, not fitted trousers or sewn waistband/crotch",
    }
    target.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(target))
    o.report.parent.mkdir(parents=True,exist_ok=True)
    o.report.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print("TITAN_CC0_UNIFIED_TROUSERS_RESEARCH_NOT_APPROVED",json.dumps(result))


if __name__=="__main__":
    try:
        main()
    except Exception as exc:
        print("TITAN CC0 original-trouser seam research failed: "+str(exc),file=sys.stderr)
        raise SystemExit(1)
