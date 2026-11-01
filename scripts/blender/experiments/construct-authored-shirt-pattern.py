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
from authored_shirt_finishing import add_collar_and_cuffs
from authored_shirt_placket import add_raised_front_placket
from shirt_region_contact import summarize_native_region_contacts
from source_arm_centerline import sample_scanned_arm_path
from source_sleeve_sections import build_source_sleeve_sections
from shirt_spatial_contact import group_actual_source_faces_by_height
from back_waist_source_trial import construct_back_waist_trial

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


def independent_body_contacts_by_region(body, waist, source, full_body, full_waist):
    """Split actual source polygons, measure identical-world BVH per role.

    Temporary inspection objects are destroyed before the source is saved.
    No guessed contacts or changes to original model/baseline garment assets.
    """
    roles=sorted(set(source["roles"]))
    face_counts={}
    body_counts={}
    waist_counts={}
    for role in roles:
        region_faces=[tuple(face) for face,r in zip(source["faces"],source["roles"]) if r==role]
        face_counts[role]=len(region_faces)
        if not region_faces:
            raise RuntimeError("No source faces for region "+role)
        mesh=bpy.data.meshes.new("LE_TEMP_NATIVE_REGION_"+role)
        fragment=None
        try:
            mesh.from_pydata(source["vertices"],[],region_faces)
            mesh.update(calc_edges=True)
            fragment=bpy.data.objects.new("LE_TEMP_MEASURE_"+role,mesh)
            bpy.context.scene.collection.objects.link(fragment)
            bpy.context.view_layer.update()
            count=native_intersection(body,fragment)
            waist_count=native_intersection(waist,fragment)
            if count is None or waist_count is None:
                raise RuntimeError("Missing independent real Blender BVH for "+role)
            body_counts[role]=count
            waist_counts[role]=waist_count
        finally:
            if fragment is not None:
                bpy.data.objects.remove(fragment,do_unlink=True)
            if mesh.name in bpy.data.meshes:
                bpy.data.meshes.remove(mesh,do_unlink=True)
    body_summary=summarize_native_region_contacts(body_counts,full_body,face_counts)
    waist_summary=summarize_native_region_contacts(waist_counts,full_waist,face_counts)
    if body_summary["regionFaceCoverageCount"] != len(source["faces"]):
        raise RuntimeError("Native garment region evidence is missing faces")
    return {"body":body_summary,"trouserWaist":waist_summary}


def independent_body_waist_height_bands(body,waist,source,full_body,full_waist):
    """Measure every real source face exactly once in physical-height groups."""
    groups=group_actual_source_faces_by_height(
        source["vertices"],source["faces"],source["roles"]
    )
    face_counts={}
    body_counts={}
    waist_counts={}
    for name,face_ids in groups.items():
        face_counts[name]=len(face_ids)
        mesh=bpy.data.meshes.new("LE_TEMP_SOURCE_HEIGHT_"+name)
        obj=None
        try:
            mesh.from_pydata(
                source["vertices"],[],
                [tuple(source["faces"][i]) for i in face_ids]
            )
            mesh.update(calc_edges=True)
            obj=bpy.data.objects.new("LE_TEMP_CONTACT_"+name,mesh)
            bpy.context.scene.collection.objects.link(obj)
            bpy.context.view_layer.update()
            body_pairs=native_intersection(body,obj)
            waist_pairs=native_intersection(waist,obj)
            if body_pairs is None or waist_pairs is None:
                raise RuntimeError("Missing native spatial BVH for "+name)
            body_counts[name]=body_pairs
            waist_counts[name]=waist_pairs
        finally:
            if obj is not None:
                bpy.data.objects.remove(obj,do_unlink=True)
            if mesh.name in bpy.data.meshes:
                bpy.data.meshes.remove(mesh,do_unlink=True)
    body_summary=summarize_native_region_contacts(
        body_counts,full_body,face_counts
    )
    waist_summary=summarize_native_region_contacts(
        waist_counts,full_waist,face_counts
    )
    if (not body_summary["regionMeasureAgreement"] or
        not waist_summary["regionMeasureAgreement"] or
        body_summary["regionFaceCoverageCount"]!=len(source["faces"])):
        raise RuntimeError("Source spatial body/waist face partition is incomplete")
    return {"body":body_summary,"trouserWaist":waist_summary}


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--output",required=True)
    ap.add_argument("--report",required=True)
    ap.add_argument("--upper-ease-mm",type=float,default=0.0)
    ap.add_argument("--cuff-radius-mm",type=float,default=68.0)
    ap.add_argument("--with-finishing",action="store_true")
    ap.add_argument("--with-placket",action="store_true")
    ap.add_argument("--source-scan-sleeves",action="store_true")
    ap.add_argument("--source-scan-sleeve-sections",action="store_true")
    ap.add_argument("--placket-relief-mm",type=float,default=4.0)
    ap.add_argument("--back-waist-contour",choices=("inside","outside"))
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
    if args.source_scan_sleeve_sections and not args.source_scan_sleeves:
        raise RuntimeError("Source-section fit requires real scanned arm observations")
    scanned_arm_pose=None
    arm_centerlines=None
    measured_sections=None
    if args.source_scan_sleeves:
        baseline_pattern=make_shirt_mesh(
            upper_ease_mm=args.upper_ease_mm,
            cuff_radius_mm=args.cuff_radius_mm,
        )
        body_xyz=[tuple(body.matrix_world @ vert.co) for vert in body.data.vertices]
        xs=[p[0] for p in body_xyz]
        centre_x=(min(xs)+max(xs))/2
        scanned_arm_pose={}
        arm_centerlines={}
        if args.source_scan_sleeve_sections:
            measured_sections={}
        for sleeve in ("left_sleeve","right_sleeve"):
            # The unsewn source armhole's *actual welded ring* determines
            # the root. The downstream path is measured on immutable scan.
            seam_vertices=sorted({vid for edge in baseline_pattern["armholeSeamEdges"][sleeve]
                                  for vid in edge})
            points=[baseline_pattern["vertices"][vid] for vid in seam_vertices]
            root=tuple(sum(p[axis] for p in points)/len(points) for axis in range(3))
            arm_observation=sample_scanned_arm_path(
                body_xyz,sleeve,root,center_x=centre_x,wrist_z=.985
            )
            scanned_arm_pose[sleeve]=arm_observation
            arm_centerlines[sleeve]=arm_observation["centerline"]
            if measured_sections is not None:
                measured_sections[sleeve]=build_source_sleeve_sections(
                    body_xyz,arm_observation,clearance_mm=4.0
                )
    source_data=make_shirt_mesh(
        upper_ease_mm=args.upper_ease_mm,
        cuff_radius_mm=args.cuff_radius_mm,
        source_arm_centerlines=(None if measured_sections is not None else arm_centerlines),
        source_arm_sections=measured_sections,
    )
    if args.with_placket:
        source_data=add_raised_front_placket(source_data,projection_mm=args.placket_relief_mm)
    if args.with_finishing:
        source_data=add_collar_and_cuffs(source_data)
    if args.back_waist_contour:
        waist=bpy.data.objects["TrouserWaistFabric"]
        world_waist_vertices=[tuple(waist.matrix_world @ v.co) for v in waist.data.vertices]
        source_data=construct_back_waist_trial(
            source_data,world_waist_vertices,side=args.back_waist_contour,
            clearance_mm=3,max_panel_shift_mm=24,
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

    all_roles=tuple(ROLE_NAMES)+(("placket",) if args.with_placket else ())+(("collar","left_cuff","right_cuff") if args.with_finishing else ())
    colors={
        "front":(0.28,0.063,0.082),
        "back":(0.24,0.05,0.072),
        "yoke":(0.37,0.08,0.105),
        "left_sleeve":(0.26,0.054,0.085),
        "right_sleeve":(0.26,0.054,0.085),
        "collar":(0.40,0.10,0.12),
        "left_cuff":(0.40,0.10,0.12),
        "right_cuff":(0.40,0.10,0.12),
        "placket":(0.45,0.075,0.11),
    }
    for role in all_roles:
        mat=bpy.data.materials.new("LE_PATTERN_UNVERIFIED_"+role.upper())
        mat.diffuse_color=(*colors[role],1)
        mat.use_nodes=True
        bsdf=mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value=(*colors[role],1)
            bsdf.inputs["Roughness"].default_value=.89
        mesh.materials.append(mat)
    for face,role in zip(mesh.polygons,source_data["roles"]):
        face.material_index=all_roles.index(role)
        face.use_smooth=True

    seam_set=set(edge for edges in source_data["armholeSeamEdges"].values() for edge in edges)
    if args.with_finishing:
        seam_set.update(edge for edges in source_data["trimRootSeams"].values() for edge in edges)
    if args.with_placket:
        seam_set.update(edge for edges in source_data["placketSeamEdges"].values() for edge in edges)
    marked=0
    for edge in mesh.edges:
        if tuple(sorted(edge.vertices)) in seam_set:
            edge.use_seam=True
            marked+=1
    if marked!=len(seam_set):
        raise RuntimeError("Model has lost authored armhole seam edges")
    # Deliberately no metric UV authoring or supplier grain claims.
    # A nominal coordinate guess cannot certify stripe spacing.
    obj["linen_earth_real_shirt_panels"]=json.dumps(list(all_roles))
    obj["linen_earth_authored_unverified_seam_edges"]=marked
    obj["linen_earth_placket_not_actual_button_closure"]=bool(args.with_placket)
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
    if body_pairs is None or any(value is None for value in trouser_pairs.values()):
        raise RuntimeError("Real world-space BVH observations missing")
    region_contacts=independent_body_contacts_by_region(
        body,bpy.data.objects["TrouserWaistFabric"],source_data,
        body_pairs,trouser_pairs["TrouserWaistFabric"]
    )
    height_contacts=independent_body_waist_height_bands(
        body,bpy.data.objects["TrouserWaistFabric"],source_data,
        body_pairs,trouser_pairs["TrouserWaistFabric"]
    )
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
        region_contacts["body"]["regionMeasureAgreement"] and
        region_contacts["trouserWaist"]["regionMeasureAgreement"] and
        height_contacts["body"]["regionMeasureAgreement"] and
        height_contacts["trouserWaist"]["regionMeasureAgreement"] and
        all(value==0 for value in trouser_pairs.values())
    )
    report={
        "method":"authored_front_back_yoke_with_genuine_open_armholes_and_sleeve_sweep_v1",
        "status":"CANDIDATE_NOT_APPROVED",
        "sourceBlendSha256":hashlib.sha256(source.read_bytes()).hexdigest(),
        "sourceModelIdentity":MODEL_ID,
        "experimentalUpperChestEaseMm":args.upper_ease_mm,
        "collarAndCuffTopologyAdded":args.with_finishing,
        "integratedRaisedPlacketAdded":args.with_placket,
        "backWaistSourceContourTrial":args.back_waist_contour,
        "backWaistSourceObservations":source_data.get("backWaistMeasuredSourceObservations"),
        "backWaistSourceMedianHeightM":source_data.get("backWaistSourceHeightMedianM"),
        "genericBodyScanArmCenterlinesUsed":args.source_scan_sleeves,
        "sourceScannedArmPathEvidence":scanned_arm_pose,
        "sourceArmTrueSectionFrameAndRadiusEvidence":measured_sections,
        "sourceScanSleeveCrossSectionsApplied":args.source_scan_sleeve_sections,
        "canonicalPhotoBodyPoseVerified":False,
        "experimentalPlacketReliefMm":args.placket_relief_mm,
        "fullButtonOpeningAndButtonholesVerified":False,
        "experimentalSleeveCuffRadiusMm":args.cuff_radius_mm,
        "sourceBodyAndSixBaselineHashes":original_hashes,
        "bodyAndBaselineGarmentsUnchanged":True,
        "topology":t,
        "actualArmholeSeamEdgesMarked":marked,
        "bodyClothIntersectingTrianglePairs":body_pairs,
        "independentNativeBodyWaistContactPartitions":region_contacts,
        "nativeSourceHeightBodyWaistContactPartitions":height_contacts,
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
