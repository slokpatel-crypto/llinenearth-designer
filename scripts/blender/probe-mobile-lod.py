"""Diagnostic-only mobile LOD experiment on the six REAL authored garment shells.

NEVER overwrites the source production/body objects or certifies fit. Makes
temporary Blender Decimate COLLAPSE copies, measures triangles/locked guides,
and probes actual body BVH face-centre, edge and vertex intersections. The
result is evidence for a future independently preflighted mobile GLB, NOT a
production-ready mesh or a way to waive mobile/perimeter gates.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0,str(Path(__file__).resolve().parent))
from section_geometry import triangle_section_x_span
from surface_coverage import penetrating_surface_samples

GARMENTS=(
    "ShirtTorsoFabric","ShirtSleeveLFabric","ShirtSleeveRFabric",
    "TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric",
)
BODY="Body"
EXPECTED_ID="linen-earth-studio-model-v1"


def args():
    argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",required=True)
    parser.add_argument("--ratio",type=float,default=0.21)
    parsed=parser.parse_args(argv)
    if not math.isfinite(parsed.ratio) or not .12<=parsed.ratio<=.34:
        raise ValueError("Mobile diagnostic decimation ratio must be in [0.12, 0.34].")
    return parsed


def world_geometry(obj):
    deps=bpy.context.evaluated_depsgraph_get()
    evaluated=obj.evaluated_get(deps)
    mesh=evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        points=[tuple(evaluated.matrix_world @ vertex.co) for vertex in mesh.vertices]
        faces=[tuple(polygon.vertices) for polygon in mesh.polygons if len(polygon.vertices)>=3]
        tris=[tuple(tri.vertices) for tri in mesh.loop_triangles]
        return points,faces,tris
    finally:
        evaluated.to_mesh_clear()


def centre_z(name):
    obj=bpy.data.objects.get(name)
    if obj is None or obj.type!="CURVE":
        raise RuntimeError("Missing locked identity guide "+name)
    zs=[
        (obj.matrix_world @ Vector(point.co[:3])).z
        for spline in obj.data.splines for point in spline.points
    ]
    if not zs:
        raise RuntimeError("Empty locked identity guide "+name)
    return sum(zs)/len(zs)


def protected_sections():
    return {
        "ShirtTorsoFabric":[centre_z("LE_GUIDE_SHIRT_SHOULDER"),
                             centre_z("LE_GUIDE_SHIRT_WAIST")],
        "TrouserWaistFabric":[centre_z("LE_GUIDE_TROUSER_WAIST")],
        "ShirtSleeveLFabric":[centre_z("LE_GUIDE_LEFT_HAND_CENTER_H")+.055],
        "ShirtSleeveRFabric":[centre_z("LE_GUIDE_RIGHT_HAND_CENTER_H")+.055],
        "TrouserLegLFabric":[centre_z("LE_GUIDE_LEFT_HEM")],
        "TrouserLegRFabric":[centre_z("LE_GUIDE_RIGHT_HEM")],
    }


def section_span(points,triangles,z):
    return triangle_section_x_span(
        ((points[triangle[0]],points[triangle[1]],points[triangle[2]])
         for triangle in triangles),z,
    )


def physical_body_probe(body_bvh, points, faces):
    def penetrating(xyz):
        point=Vector(xyz)
        nearest=body_bvh.find_nearest(point)
        if nearest is None or nearest[0] is None:
            raise RuntimeError("Real-body BVH distance unavailable during mobile LOD.")
        if (point-nearest[0]).length<=0.0015:
            return False
        direction=Vector((1.0,.371,.117)).normalized()
        origin=point+direction*.00001
        count=0
        for _ in range(64):
            result=body_bvh.ray_cast(origin,direction)
            if result[0] is None or result[3] is None:
                break
            count+=1
            origin=result[0]+direction*.00001
        return count%2==1

    vertex_stride=max(1,len(points)//600)
    vertex_hits=sum(1 for p in points[::vertex_stride][:600] if penetrating(p))
    face_stride=max(1,len(faces)//600)
    sampled_faces=faces[::face_stride][:600]
    surfaces=penetrating_surface_samples(
        points,sampled_faces,penetrating,max_hits=32,
    )
    return {
        "sampledVertexCount":len(points[::vertex_stride][:600]),
        "sampledFaceCount":len(sampled_faces),
        "deepVertexHits":vertex_hits,
        "deepFaceOrEdgeHits":len(surfaces),
        "sampleContactPositionsMm":[
            {"location":hit["location"],"xyz":[round(v*1000,2) for v in hit["point"]]}
            for hit in surfaces[:8]
        ],
    }


def main():
    cfg=args()
    output=Path(cfg.output).expanduser().resolve()
    output.parent.mkdir(parents=True,exist_ok=True)
    if (str(bpy.context.scene.get("linen_earth_model_identity_id",""))!=EXPECTED_ID
            or not bool(bpy.context.scene.get("linen_earth_model_identity_locked",False))):
        raise RuntimeError("Mobile LOD experiment requires the exact locked studio model.")
    body=bpy.data.objects.get(BODY)
    if body is None or body.type!="MESH":
        raise RuntimeError("Cannot run mobile LOD without locked real-body mesh.")
    body_xyz,body_faces,_=world_geometry(body)
    tree=BVHTree.FromPolygons(
        [Vector(p) for p in body_xyz],body_faces,all_triangles=False,epsilon=0.0,
    )
    guides=protected_sections()
    probe_results={}
    target_tris=0
    target_verts=0
    source_tris=0
    temporary_objects=[]
    try:
        for name in GARMENTS:
            original=bpy.data.objects.get(name)
            if original is None or original.type!="MESH":
                raise RuntimeError("Missing authored real cloth panel "+name)
            before=(len(original.data.vertices),len(original.data.polygons))
            source_points,_,source_triangles=world_geometry(original)
            source_tris+=len(source_triangles)
            copy=original.copy()
            copy.data=original.data.copy()
            bpy.context.scene.collection.objects.link(copy)
            copy.name="LE_UNAPPROVED_MOBILE_LOD_PROBE__"+name
            temporary_objects.append(copy)
            modifier=copy.modifiers.new("LE_EXPERIMENTAL_LOD","DECIMATE")
            modifier.decimate_type="COLLAPSE"
            modifier.ratio=cfg.ratio
            modifier.use_collapse_triangulate=True
            bpy.ops.object.select_all(action="DESELECT")
            copy.select_set(True)
            bpy.context.view_layer.objects.active=copy
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            points,faces,tris=world_geometry(copy)
            target_tris+=len(tris)
            target_verts+=len(points)
            deltas=[]
            for z in guides[name]:
                original_span=section_span(source_points,source_triangles,z)
                candidate_span=section_span(points,tris,z)
                if not original_span or not candidate_span:
                    raise RuntimeError("LOD lost exact tailoring identity plane for "+name)
                delta_mm=max(abs(candidate_span[i]-original_span[i]) for i in (0,1))*1000
                deltas.append(round(delta_mm,3))
            intersections=physical_body_probe(tree,points,faces)
            probe_results[name]={
                "sourceTriangles":len(source_triangles),
                "candidateTriangles":len(tris),
                "candidateVertices":len(points),
                "lockedSectionMaxBoundaryShiftMm":max(deltas,default=0),
                "protectedSectionSampleShiftsMm":deltas,
                "measuredRealBody":intersections,
                "sampledSkinPass":intersections["deepVertexHits"]==0 and
                                  intersections["deepFaceOrEdgeHits"]==0,
                "sourceMeshUnchanged":before==(
                    len(original.data.vertices),len(original.data.polygons)),
            }
            print("Linen Earth mobile LOD PROBE "+name+" "+
                  json.dumps(probe_results[name],sort_keys=True),flush=True)
    finally:
        for copy in temporary_objects:
            mesh=copy.data
            bpy.data.objects.remove(copy,do_unlink=True)
            if mesh.users==0:
                bpy.data.meshes.remove(mesh)

    guide_pass=all(
        row["lockedSectionMaxBoundaryShiftMm"]<=2.0 and row["sourceMeshUnchanged"]
        for row in probe_results.values()
    )
    contact_pass=all(row["sampledSkinPass"] for row in probe_results.values())
    budget_pass=target_tris<=220000 and target_verts<=280000
    report={
        "gate":"linen-earth-mobile-lod-diagnostic-v1",
        "diagnosticOnly":True,
        "eligibleForProduction":False,
        "realBodyUnmodified":True,
        "lockedIdentityId":EXPECTED_ID,
        "decimateMethod":"Blender 4.2 COLLAPSE - experimental copies only",
        "ratio":cfg.ratio,
        "sourceTriangles":source_tris,
        "candidateTriangles":target_tris,
        "candidateVertices":target_verts,
        "mobileTriangleBudget":220000,
        "mobileVertexBudget":280000,
        "sampledBVHPass":contact_pass,
        "lockedSectionPass":guide_pass,
        "polygonBudgetPass":budget_pass,
        "investigateFurther":contact_pass and guide_pass and budget_pass,
        "requiredNext":"Full independent low-poly BVH preflight, 360-degree fit, UV repeat, measured textile panels, and owner/tailor signoff.",
        "panels":probe_results,
    }
    output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
    print("Linen Earth mobile LOD candidate diagnostic: "+
          json.dumps({k:v for k,v in report.items() if k!="panels"},sort_keys=True),flush=True)


if __name__=="__main__":
    try:
        main()
    except Exception as exc:
        print("Linen Earth mobile LOD diagnostic failed: "+str(exc),file=sys.stderr)
        raise SystemExit(1)
