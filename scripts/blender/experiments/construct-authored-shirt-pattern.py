"""Build a NEW authored, unmeasured shirt with real front/back/yoke/armholes.

Standalone native Blender experiment against unchanged existing authored
scene. Writes unique .blend/report. Does not promote, export, alter body,
claim fit, or replace Designer's photo/model.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import math
import struct
import sys
from pathlib import Path

import bpy

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from authored_shirt_panels import make_shirt_mesh, ROLE_NAMES

MODEL_ID="linen-earth-studio-model-v1"
NAME="LE_AUTHORED_SHIRT_PATTERN_UNMEASURED"
GARMENTS=("ShirtTorsoFabric","ShirtSleeveLFabric","ShirtSleeveRFabric",
          "TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric")


def mesh_sha(obj):
    h=hashlib.sha256()
    for v in obj.data.vertices:
        p=obj.matrix_world @ v.co
        h.update(struct.pack("<ddd",float(p.x),float(p.y),float(p.z)))
    for face in obj.data.polygons:
        h.update(struct.pack("<I",len(face.vertices)))
        for index in face.vertices:
            h.update(struct.pack("<I",index))
    return h.hexdigest()


def native_intersection(a,b):
    path=Path(__file__).resolve().parents[1]/"preflight-linen-earth-officewear.py"
    spec=importlib.util.spec_from_file_location("linen_native_panel_contact_check",path)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.intersection_pair_count(a,b)


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--output",required=True)
    ap.add_argument("--report",required=True)
    ap.add_argument("--upper-ease-mm",type=float,default=0.0)
    ap.add_argument("--cuff-radius-mm",type=float,default=68.0)
    args=ap.parse_args(sys.argv[sys.argv.index("--")+1:])
    source=Path(bpy.data.filepath).resolve()
    out=Path(args.output).resolve()
    receipt=Path(args.report).resolve()
    scene=bpy.context.scene
    if source==out or not source.is_file() or source.suffix!=".blend":
        raise RuntimeError("Use an actual source .blend with separate output")
    if (scene.get("linen_earth_model_identity_id")!=MODEL_ID or
        scene.get("linen_earth_model_reference_image")!="/designer/studio-tucked.webp" or
        not scene.get("linen_earth_model_identity_locked")):
        raise RuntimeError("Original model photo/identity contract must be preserved")
    body=bpy.data.objects.get("Body")
    if body is None or body.type!="MESH" or bpy.data.objects.get(NAME) is not None:
        raise RuntimeError("Missing original body or existing candidate would be overwritten")
    if any(bpy.data.objects.get(g) is None for g in GARMENTS):
        raise RuntimeError("All six baseline garments required for comparison")

    original_hashes={"Body":mesh_sha(body)}
    original_hashes.update({g:mesh_sha(bpy.data.objects[g]) for g in GARMENTS})
    source_data=make_shirt_mesh(
        upper_ease_mm=args.upper_ease_mm,
        cuff_radius_mm=args.cuff_radius_mm,
    )
    t=source_data["topology"]
    if (t["connectedComponents"]!=1 or t["nonmanifoldEdges"] or
        t["windingErrors"] or t["boundaryLoopsAfterSleeves"]!=4 or
        any(t["panelFaceCounts"].get(r,0)==0 for r in ROLE_NAMES)):
        raise RuntimeError("Proposed 2D shirt panel sewing topology is invalid")

    mesh=bpy.data.meshes.new("LE_GENUINE_PATTERN_FACES_UNMEASURED")
    mesh.from_pydata(source_data["vertices"],[],source_data["faces"])
    mesh.update(calc_edges=True)
    obj=bpy.data.objects.new(NAME,mesh)
    collection=bpy.data.collections.get("LE_3D_UNAPPROVED_PATTERN_CANDIDATES")
    if collection is None:
        collection=bpy.data.collections.new("LE_3D_UNAPPROVED_PATTERN_CANDIDATES")
        scene.collection.children.link(collection)
    collection.objects.link(obj)

    colors={
        "front":(0.28,0.063,0.082),
        "back":(0.24,0.05,0.072),
        "yoke":(0.37,0.08,0.105),
        "left_sleeve":(0.26,0.054,0.085),
        "right_sleeve":(0.26,0.054,0.085),
    }
    for role in ROLE_NAMES:
        mat=bpy.data.materials.new("LE_PATTERN_UNVERIFIED_"+role.upper())
        mat.diffuse_color=(*colors[role],1)
        mat.use_nodes=True
        bsdf=mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value=(*colors[role],1)
            bsdf.inputs["Roughness"].default_value=.89
        mesh.materials.append(mat)
    for face,role in zip(mesh.polygons,source_data["roles"]):
        face.material_index=ROLE_NAMES.index(role)
        face.use_smooth=True

    seam_set=set(edge for edges in source_data["armholeSeamEdges"].values() for edge in edges)
    marked=0
    for edge in mesh.edges:
        if tuple(sorted(edge.vertices)) in seam_set:
            edge.use_seam=True
            marked+=1
    if marked!=len(seam_set):
        raise RuntimeError("Model has lost authored armhole seam edges")
    # Deliberately no metric UV authoring or supplier grain claims.
    # A nominal coordinate guess cannot certify stripe spacing.
    obj["linen_earth_real_shirt_panels"]=json.dumps(list(ROLE_NAMES))
    obj["linen_earth_authored_armhole_seams_unapproved"]=marked
    obj["linen_earth_photo_parity_approved"]=False
    obj["linen_earth_supplier_grain_measured"]=False
    obj["linen_earth_pattern_measurements_measured"]=False
    obj["linen_earth_tailor_approved"]=False
    scene["linen_earth_production_approved"]=False
    scene["linen_earth_photo_parity_verified"]=False
    scene["linen_earth_candidate_sewn_topology_only"]=True

    bpy.context.view_layer.update()
    body_pairs=native_intersection(body,obj)
    trouser_pairs={g:native_intersection(obj,bpy.data.objects[g])
                   for g in GARMENTS if g.startswith("Trouser")}
    baseline_after={"Body":mesh_sha(body)}
    baseline_after.update({g:mesh_sha(bpy.data.objects[g]) for g in GARMENTS})
    if baseline_after!=original_hashes:
        raise RuntimeError("Original source body/garments were modified")

    for name in GARMENTS[:3]:
        bpy.data.objects[name].hide_render=True
    visual_grounded=False
    # 3D topology can be one manifold and STILL collide with model/garments.
    plausible_trial=(
        t["connectedComponents"]==1 and
        t["windingErrors"]==0 and
        t["nonmanifoldEdges"]==0 and
        body_pairs==0 and
        all(value==0 for value in trouser_pairs.values())
    )
    report={
        "method":"authored_front_back_yoke_with_genuine_open_armholes_and_sleeve_sweep_v1",
        "status":"CANDIDATE_NOT_APPROVED",
        "sourceBlendSha256":hashlib.sha256(source.read_bytes()).hexdigest(),
        "sourceModelIdentity":MODEL_ID,
        "experimentalUpperChestEaseMm":args.upper_ease_mm,
        "experimentalSleeveCuffRadiusMm":args.cuff_radius_mm,
        "sourceBodyAndSixBaselineHashes":original_hashes,
        "bodyAndBaselineGarmentsUnchanged":True,
        "topology":t,
        "actualArmholeSeamEdgesMarked":marked,
        "bodyClothIntersectingTrianglePairs":body_pairs,
        "clothTrouserIntersectingTrianglePairs":trouser_pairs,
        "candidateGeometricGate":plausible_trial,
        "garmentDesignDimensionsMeasured":False,
        "originalModelPhotoParityReviewed":False,
        "supplierTextureRepeatGsmGrainVerified":False,
        "tailorFittingApproved":False,
        "allProductionGatesPassed":False,
        "candidateOnly":True,
    }
    receipt.parent.mkdir(parents=True,exist_ok=True)
    receipt.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    out.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out))
    print("TITAN_AUTHORED_SHIRT_PANEL_CANDIDATE="+json.dumps(report,sort_keys=True))


if __name__=="__main__":
    main()
