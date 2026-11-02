# Never use this research mesh for production clothing.
"""Triangulate measured unmatched original crotch cut edges in an isolated Blender scene.

The original six authored garment objects are never modified. This is an
unsaved, non-export source-surface bridge trial, not sewn cloth or fit approval.
"""
from __future__ import annotations

import argparse
from collections import Counter
import itertools
import json
import math
from pathlib import Path
import runpy
import sys

import bpy
from mathutils.bvhtree import BVHTree

IDENTITY = "linen-earth-studio-model-v1"
LEGS = ("TrouserLegLFabric", "TrouserLegRFabric")
STAGE = "selectedBodyShell"
RESEARCH = "TITAN_CrotchStageResearch"
EXPORT = "LinenEarthExport"
MAX_UNMATCHED_MM = 80.0


def midpoint(geom, edge):
    a, b = edge
    return (geom["points"][a] + geom["points"][b]) / 2.0


def seam_connector_faces(vertices, left_edge, right_edge):
    l0, l1 = left_edge
    r0, r1 = right_edge
    # Pair the physically nearer endpoints; integer edge orientation is not a seam direction.
    direct = (vertices[l0] - vertices[r0]).length + (vertices[l1] - vertices[r1]).length
    reverse = (vertices[l0] - vertices[r1]).length + (vertices[l1] - vertices[r0]).length
    if reverse < direct:
        r0, r1 = r1, r0
    path = [l0, l1, r1, r0]
    polygon = []
    for i in path:
        if not polygon or polygon[-1] != i:
            polygon.append(i)
    if len(polygon) > 1 and polygon[0] == polygon[-1]:
        polygon.pop()
    if len(set(polygon)) != len(polygon) or len(polygon) not in (3, 4):
        raise RuntimeError("Unmatched cut-edge endpoints cannot form a nondegenerate bridge.")
    if len(polygon) == 3:
        faces = [tuple(polygon)]
    else:
        a, b, c, d = polygon
        candidates = [[(a, b, c), (a, c, d)], [(a, b, d), (b, c, d)]]
        def smallest_area(tris):
            return min((vertices[y]-vertices[x]).cross(vertices[z]-vertices[x]).length * 0.5
                       for x,y,z in tris)
        faces = max(candidates, key=smallest_area)
    if any((vertices[b]-vertices[a]).cross(vertices[c]-vertices[a]).length <= 2e-12
           for a,b,c in faces):
        raise RuntimeError("Measured unmatched seam endpoints would generate a zero-area triangle.")
    return faces, max(direct, reverse) * 500.0


def build_pairs(left, right, unpaired_left, unpaired_right):
    if len(unpaired_left) != 4 or len(unpaired_right) != 4:
        raise RuntimeError("Actual source currently needs exactly four unmatched cut edges per leg.")
    # Match the four remaining source segments by minimum *measured midpoint* gap.
    # This is an exploratory link only; the original source wound seam is not invented.
    all_choices = []
    for perm in itertools.permutations(range(len(unpaired_right))):
        gaps = [
            (midpoint(left, a) - midpoint(right, unpaired_right[j])).length * 1000.0
            for a,j in zip(unpaired_left,perm)
        ]
        all_choices.append((sum(gaps), max(gaps),perm,gaps))
    _,max_gap,choice,gaps = min(all_choices, key=lambda row:(row[0],row[1],row[2]))
    if max_gap>MAX_UNMATCHED_MM or not all(math.isfinite(d) for d in gaps):
        raise RuntimeError("Original unpaired source edges are too distant for this bounded bridge trial.")
    return list(zip(unpaired_left, [unpaired_right[j] for j in choice], gaps))


def main():
    argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output",required=True,type=Path)
    args=parser.parse_args(argv)
    scene=bpy.context.scene
    if (scene.get("linen_earth_model_identity_id") != IDENTITY
            or scene.get("linen_earth_model_identity_locked") is not True
            or scene.get("linen_earth_research_crotch_stages_emitted") is not True):
        raise RuntimeError("Original identity-locked Blender stage capture required; no invented cutting points.")
    research=bpy.data.collections.get(RESEARCH)
    export=bpy.data.collections.get(EXPORT)
    body=bpy.data.objects.get("Body")
    if research is None or export is None or body is None or len(research.objects)!=8:
        raise RuntimeError("Need actual eight captured stages and the original locked body/garments.")

    geom_ops=runpy.run_path(str(Path(__file__).with_name("diagnose-linen-earth-crotch.py")))
    seam_ops=runpy.run_path(str(Path(__file__).with_name("prototype-crotch-source-seam-weld.py")))
    geom=geom_ops["world_geometry"]
    body_geom=geom(body)
    center_x=(min(v.x for v in body_geom["points"])+max(v.x for v in body_geom["points"]))/2
    source_geoms=[]
    for name in LEGS:
        original=export.objects.get(name)
        stage=research.objects.get(f"TITAN_RESEARCH_{STAGE}_{name}")
        if (original is None or stage is None or stage.type != "MESH"
                or stage.get("candidateOnly") is not True
                or stage.get("productionApproved") is not False
                or stage.get("sourceStage") != STAGE):
            raise RuntimeError("Cannot prototype without exact unapproved source cut-stage provenance.")
        source_geoms.append(geom(stage))
    left,right=source_geoms
    l_all,l_inner=seam_ops["original_inner_cut_edges"](left,center_x)
    r_all,r_inner=seam_ops["original_inner_cut_edges"](right,center_x)
    if len(l_inner)!=14 or len(r_inner)!=14:
        raise RuntimeError("Native original inner seam topology has changed.")
    weld,dists=seam_ops["reciprocal_real_vertex_matches"](left,right,l_inner,r_inner)
    initial=seam_ops["make_research_only_mesh"](left,right,weld)
    if len(weld)!=11 or initial["closedBoundaryEdges"]!=20:
        raise RuntimeError("Original source partial weld evidence changed; fail closed.")

    left_count=len(left["points"])
    right_mapping={}
    next_idx=left_count
    for ri in range(len(right["points"])):
        if ri in weld:
            right_mapping[ri]=weld[ri]
        else:
            right_mapping[ri]=next_idx
            next_idx+=1
    source_left_edges={tuple(sorted(edge)) for edge in l_inner}
    source_right_edges={tuple(sorted((right_mapping[a],right_mapping[b]))) for a,b in r_inner}
    combined_open,_=seam_ops["edge_topology"]([
        *left["polygons"],*(tuple(right_mapping[i] for i in face) for face in right["polygons"])
    ])
    open_set=set(combined_open)
    l_remaining=[edge for edge in sorted(source_left_edges) if edge in open_set]
    r_remaining_mapped=[edge for edge in sorted(source_right_edges) if edge in open_set]
    if len(l_remaining)!=4 or len(r_remaining_mapped)!=4:
        raise RuntimeError("Exactly four unmatched original seam edges per side were not found.")
    inverse_right={right_mapping[i]:i for i in range(len(right["points"])) if i not in weld}
    # Matching distances use the actual right-source positions after mapping, including welded vertices.
    merged_verts=[v.copy() for v in left["points"]]
    merged_verts += [right["points"][i].copy() for i in range(len(right["points"])) if i not in weld]
    merged_geom={"points":merged_verts}
    pairings=build_pairs(merged_geom,merged_geom,l_remaining,r_remaining_mapped)

    bridge_faces=[]
    per_pair=[]
    for a,b,gap in pairings:
        faces,_=seam_connector_faces(merged_verts,a,b)
        bridge_faces.extend(faces)
        per_pair.append({"leftEdge":list(a),"rightEdge":list(b),
                         "measuredMidpointGapMm":round(gap,4),"bridgeTriangles":len(faces)})
    # Create a NEW object in research, not the original six-panel production export.
    base_faces=[tuple(f) for f in left["polygons"]]
    base_faces += [tuple(right_mapping[i] for i in face) for face in right["polygons"]]
    all_faces=base_faces+bridge_faces
    after_open, owners=seam_ops["edge_topology"](all_faces)
    if any(n>2 for n in owners.values()):
        raise RuntimeError("Bridge created nonmanifold source shell.")
    if len(after_open)>=initial["afterWeldOpenEdges"]:
        raise RuntimeError("Bridging did not actually reduce original seam open boundaries.")
    mesh=bpy.data.meshes.new("TITAN_RESEARCH_CrotchUnmatchedBridgeMesh")
    mesh.from_pydata(merged_verts,[],all_faces)
    mesh.update(calc_edges=True)
    if len(mesh.polygons)!=len(all_faces):
        raise RuntimeError("Blender dropped actual bridge faces.")
    degenerate=sum(not math.isfinite(p.area) or p.area <=1e-12 for p in mesh.polygons)
    if degenerate:
        raise RuntimeError("Unmatched seam research bridge contains degenerate polygons.")
    name="TITAN_RESEARCH_CrotchUnmatchedBridgeOnly"
    if bpy.data.objects.get(name) is not None:
        raise RuntimeError("Cannot overwrite prior research bridge.")
    obj=bpy.data.objects.new(name,mesh)
    obj.hide_render=True
    obj["candidateOnly"]=True
    obj["productionApproved"]=False
    obj["sewnGarmentApproved"]=False
    research.objects.link(obj)
    if export.objects.get(name) is not None:
        raise RuntimeError("Experimental bridge contaminated production garment export.")

    # Independent genuine body-BVH contact count for *new bridge surface only*.
    body_tree=geom_ops["real_tree"](body_geom)
    bridge_mesh=bpy.data.meshes.new("TITAN_RESEARCH_BridgeFacesOnlyMesh")
    bridge_mesh.from_pydata(merged_verts,[],bridge_faces)
    bridge_mesh.update(calc_edges=True)
    bridge_obj=bpy.data.objects.new("TITAN_RESEARCH_BridgeFacesOnly",bridge_mesh)
    bridge_obj.hide_render=True
    research.objects.link(bridge_obj)
    bridge_geom=geom(bridge_obj)
    bridge_body_pairs=len(body_tree.overlap(geom_ops["real_tree"](bridge_geom)))
    # These may legitimately be nonzero: always report, NEVER suppress as accepted fit.
    report={
      "version":"titan-actual-unmatched-crotch-source-bridge-research-v1",
      "modelIdentityId":IDENTITY,
      "candidateOnly":True,"productionApproved":False,"physicalFitApproved":False,
      "changesProductionGeometry":False,"sewnGarmentApproved":False,
      "metricCaveat":"Greedy minimum-total midpoint source-edge pairing at <=80mm, not tailor-approved seam, thickness or UV; actual bridge/body BVH contacts disqualify unconditional fit approval.",
      "partialWeldJoinedEdges":10,
      "unmatchedCutEdgesBefore":{"left":len(l_remaining),"right":len(r_remaining_mapped)},
      "trialAddedBridgeTriangles":len(bridge_faces),
      "trialSegments":per_pair,
      "bridgeToOriginalBodyBVHPairs":bridge_body_pairs,
      "openSourceBoundaryEdgesBeforeBridge":initial["afterWeldOpenEdges"],
      "openSourceBoundaryEdgesAfterBridge":len(after_open),
      "actualReductionOpenEdges":initial["afterWeldOpenEdges"]-len(after_open),
      "degenerateFaces":degenerate,
      "nonManifoldEdges":sum(n>2 for n in owners.values()),
      "finalClothQAApproved":False,
    }
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2,allow_nan=False)+"\n",encoding="utf-8")
    print("TITAN_ORIGINAL_FOUR_CROTCH_EDGES_BRIDGED_RESEARCH_ONLY",json.dumps(report,allow_nan=False))


if __name__=="__main__":
    main()
