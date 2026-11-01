"""Isolated real-mesh shirt shoulder reconstruction experiment.

Build one joined torso + left/right sleeve cloth surface from ORIGINAL source
scan polygon adjacency BEFORE applying a single clearance, cloth thickness and
source-boundary seam marks. No separate intersecting torso/sleeve shells.
Do not mutate body or 6 baseline garment objects; output a distinct .blend.

This first geometry step is NOT a sewn garment: neckline, collars, cuffs,
placket, actual armhole tailoring, verified pose, UV scale and drape remain
unverified, and source-body resegmentation alone cannot earn production status.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from connected_shirt_source import REGIONS, classify_shirt_face, analyze_labelled_faces
import importlib.util

CANDIDATE_NAME="LE_CONNECTED_SHIRT_SHOULDER_UNVERIFIED"
BASELINE_SHIRT=("ShirtTorsoFabric","ShirtSleeveLFabric","ShirtSleeveRFabric")
TROUSERS=("TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric")


def original_body_hash(body):
    h=hashlib.sha256()
    for vert in body.data.vertices:
        world=body.matrix_world @ vert.co
        h.update(struct.pack("<ddd",float(world.x),float(world.y),float(world.z)))
    return h.hexdigest()


def source_panel_faces(body):
    bounds=[body.matrix_world @ Vector(p) for p in body.bound_box]
    min_z=min(p.z for p in bounds)
    height=max(p.z for p in bounds)-min_z
    center_x=(min(p.x for p in bounds)+max(p.x for p in bounds))/2
    vertices=[tuple(body.matrix_world @ v.co) for v in body.data.vertices]
    selected=[]
    labels=[]
    original_ids=[]
    for polygon in body.data.polygons:
        center=body.matrix_world @ polygon.center
        label=classify_shirt_face(tuple(center),center_x,min_z,height)
        if label is not None:
            selected.append(tuple(int(v) for v in polygon.vertices))
            labels.append(label)
            original_ids.append(polygon.index)
    return vertices,selected,labels,original_ids


def make_candidate(source_xyz,faces,labels,topology):
    indices=sorted({v for face in faces for v in face})
    remap={v:i for i,v in enumerate(indices)}
    mesh=bpy.data.meshes.new("LE_Connected_Shirt_Source_Pattern_UNVERIFIED")
    mesh.from_pydata(
        [source_xyz[i] for i in indices],
        [],
        [tuple(remap[v] for v in face) for face in faces]
    )
    mesh.update(calc_edges=True)
    obj=bpy.data.objects.new(CANDIDATE_NAME,mesh)
    col=bpy.data.collections.get("LE_3D_UNAPPROVED_CANDIDATES")
    if col is None:
        col=bpy.data.collections.new("LE_3D_UNAPPROVED_CANDIDATES")
        bpy.context.scene.collection.children.link(col)
    col.objects.link(obj)
    materials=(
        ("LE_DRAFT_TORSO_NOT_FABRIC",(0.27,0.12,0.13)),
        ("LE_DRAFT_LEFT_SLEEVE_NOT_FABRIC",(0.26,0.12,0.13)),
        ("LE_DRAFT_RIGHT_SLEEVE_NOT_FABRIC",(0.26,0.12,0.13)),
    )
    for name,color in materials:
        mat=bpy.data.materials.get(name) or bpy.data.materials.new(name)
        mat.diffuse_color=(*color,1.0)
        mat.use_nodes=True
        bsdf=mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value=(*color,1.0)
            bsdf.inputs["Roughness"].default_value=0.9
        mesh.materials.append(mat)
    for polygon,label in zip(mesh.polygons,labels):
        polygon.material_index=REGIONS.index(label)
        polygon.use_smooth=True
    source_seam_edges={
        tuple(sorted((remap[a],remap[b])))
        for (a,b),_,_ in topology["sourceSeamEdges"]
    }
    marked=0
    for edge in mesh.edges:
        if tuple(sorted(edge.vertices)) in source_seam_edges:
            edge.use_seam=True
            marked+=1
    if marked != len(source_seam_edges):
        raise RuntimeError("Source edge seams lost during garment vertex remapping")
    obj["linen_earth_source_shoulder_edges"]=marked
    obj["linen_earth_sewn_construction_approved"]=False
    obj["linen_earth_uv_measured"]=False
    obj["linen_earth_body_source_face_reconstruction_only"]=True
    return obj


def modifier_apply(obj,mod):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)


def native_intersection(left,right):
    # True independent world-space evaluated-mesh BVH, from existing preflight.
    script=Path(__file__).resolve().parents[1]/"preflight-linen-earth-officewear.py"
    spec=importlib.util.spec_from_file_location("le_independent_preflight_for_candidate",script)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.intersection_pair_count(left,right)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",required=True)
    parser.add_argument("--report",required=True)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:])
    source=Path(bpy.data.filepath).resolve()
    output=Path(args.output).resolve()
    report_file=Path(args.report).resolve()
    if not source.exists() or source.suffix!=".blend" or source==output:
        raise RuntimeError("Source .blend must be loaded and output must be a different file")
    if bpy.context.scene.get("linen_earth_model_identity_id")!="linen-earth-studio-model-v1":
        raise RuntimeError("Wrong locked source model contract")
    if not bpy.context.scene.get("linen_earth_model_identity_locked"):
        raise RuntimeError("Source model identity is not locked")
    if bpy.data.objects.get(CANDIDATE_NAME):
        raise RuntimeError("Source contains experiment already; no overwrite/repetition")
    body=bpy.data.objects.get("Body")
    if body is None or body.type!="MESH":
        raise RuntimeError("Original source Body not loaded")
    if any(bpy.data.objects.get(n) is None for n in BASELINE_SHIRT+TROUSERS):
        raise RuntimeError("Six unmodified baseline garment meshes required for comparison")
    before=original_body_hash(body)
    source_xyz,faces,labels,original_face_ids=source_panel_faces(body)
    topo=analyze_labelled_faces(faces,labels)
    candidate=make_candidate(source_xyz,faces,labels,topo)
    # One connected, source-index-welded garment is deformed as ONE mesh,
    # unlike old unconnected independently solidified shoulder shells.
    shrink=candidate.modifiers.new("LE_DRAFT_SINGLE_SOURCE_CLEARANCE","SHRINKWRAP")
    shrink.target=body
    shrink.wrap_method="NEAREST_SURFACEPOINT"
    shrink.wrap_mode="OUTSIDE_SURFACE"
    shrink.offset=0.007 # explicit exploratory geometry, NOT measured fabric ease
    modifier_apply(candidate,shrink)
    body_contact_pre_thickness=native_intersection(body,candidate)
    solid=candidate.modifiers.new("LE_DRAFT_SINGLE_SHIRT_THICKNESS","SOLIDIFY")
    solid.thickness=0.0016
    solid.offset=1
    solid.use_rim=True
    modifier_apply(candidate,solid)
    bpy.context.view_layer.update()
    body_contact=native_intersection(body,candidate)
    trouser_contacts={n:native_intersection(candidate,bpy.data.objects[n]) for n in TROUSERS}
    body_after=original_body_hash(body)
    if before!=body_after:
        raise RuntimeError("Original body geometry changed; reject experiment")
    for objname in BASELINE_SHIRT:
        bpy.data.objects[objname].hide_render=True
    candidate.hide_render=False
    # This separate preview scene cannot be confused with the approved asset.
    scene=bpy.context.scene
    scene["linen_earth_production_approved"]=False
    scene["linen_earth_photo_parity_verified"]=False
    scene["linen_earth_candidate_shirt_construction"]="source_index_welded_shoulder_unverified"
    scene["linen_earth_candidate_shirt_sewn_approved"]=False
    scene["linen_earth_candidate_shirt_uv_scale_measured"]=False
    scene["linen_earth_candidate_shirt_real_fabric_verified"]=False
    actual_prototype_gate=(
        topo["connectedComponents"]==1
        and topo["sourceNonmanifoldEdges"]==0
        and topo["sharedEdgeWindingErrors"]==0
        and topo["sourceSeamRegionPairs"].get("left_sleeve/torso",0)>0
        and topo["sourceSeamRegionPairs"].get("right_sleeve/torso",0)>0
        and body_contact==0
    )
    report={
        "experiment":"source-index-welded-shirt-shoulder-v1",
        "referenceModelId":"linen-earth-studio-model-v1",
        "sourceSceneSha256":hashlib.sha256(source.read_bytes()).hexdigest(),
        "bodyOriginalVertexSha256":before,
        "bodyAfterVertexSha256":body_after,
        "bodyUnchanged":True,
        "selectedOriginalSourcePolygonCount":len(original_face_ids),
        "selectedOriginalSourcePolygonIndicesSha256":hashlib.sha256(
            json.dumps(original_face_ids,separators=(",",":")).encode()
        ).hexdigest(),
        "sourceTopology":{k:v for k,v in topo.items() if k!="sourceSeamEdges"},
        "sourceSeamsMarked":candidate.get("linen_earth_source_shoulder_edges",0),
        "bodyCandidateContactPairsBeforeThickness":body_contact_pre_thickness,
        "bodyCandidateContactPairsAfterThickness":body_contact,
        "trouserCandidateContactPairs":trouser_contacts,
        "clearanceMmExperimentOnly":7.0,
        "thicknessMmExperimentOnly":1.6,
        "candidateGeometryTopologicalGate":actual_prototype_gate,
        "photoParityApproved":False,
        "completeGarmentSewnPattern":False,
        "collarPlacketCuffsAuthored":False,
        "supplierFabricAndUVMetricApproved":False,
        "productionReady":False,
    }
    # Always record real failures; never reinterpret the built-in 3D gate.
    report_file.parent.mkdir(parents=True,exist_ok=True)
    report_file.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    print("LENIN_EARTH_SOURCE_CONNECTED_SHOULDER_CANDIDATE="+json.dumps(report,sort_keys=True))
    print("No production approval: source scan topological candidate, not a sewn pattern.")


if __name__=="__main__":
    main()
