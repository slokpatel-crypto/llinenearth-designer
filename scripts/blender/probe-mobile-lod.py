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
    deep_vertices=[p for p in points[::vertex_stride][:600] if penetrating(p)]
    vertex_hits=len(deep_vertices)
    # Use EXACT rendered triangles, not the unsplit original quad face.
    # This matches independent preflight's ceil-stride 600-triangle sweep.
    face_stride=max(1,math.ceil(len(faces)/600))
    sampled_faces=faces[::face_stride][:600]
    surfaces=penetrating_surface_samples(
        points,sampled_faces,penetrating,max_hits=32,
    )
    return {
        "sampledVertexCount":len(points[::vertex_stride][:600]),
        "sampledFaceCount":len(sampled_faces),
        "deepVertexHits":vertex_hits,
        "sampleDeepVertexPositionsMm":[
            [round(value*1000,2) for value in point]
            for point in deep_vertices[:24]
        ],
        "deepFaceOrEdgeHits":len(surfaces),
        "contactTriangles":[
            {"vertices":list(sampled_faces[hit["face"]]),
             "point":list(hit["point"]),"location":hit["location"]}
            for hit in surfaces
        ],
        "sampleContactPositionsMm":[
            {"location":hit["location"],"xyz":[round(v*1000,2) for v in hit["point"]]}
            for hit in surfaces[:8]
        ],
    }



def candidate_point_inside_locked_body(body_bvh, point):
    """Independent parity check on the SAME immutable real body BVH."""
    direction=Vector((1.0,.371,.117)).normalized()
    origin=Vector(point)+direction*.00001
    count=0
    for _ in range(64):
        hit=body_bvh.ray_cast(origin,direction)
        if hit[0] is None or hit[3] is None:
            break
        count+=1
        origin=hit[0]+direction*.00001
    return count%2==1


def fit_candidate_mobile_contacts(copy, body_bvh, guides, *,
                                  max_shift_m=0.012, max_passes=6):
    """Diagnostic-only bounded cloth-vertex repairs on the disposable LOD.

    A naive collapse can create 1..8 cloth/skin triangle crossings while all
    original high-resolution triangles were exterior. Move only the collapsed
    garment's existing vertices, NEVER Body, original panels, UV data or
    locked tailoring-guide vertices. Every local edit is independently checked
    against the real body; zero deep contacts + guide widths are necessary
    but NOT sufficient for production. Return RED if not physically repaired.
    """
    if not (0<max_shift_m<=0.012 and isinstance(max_passes,int)
            and not isinstance(max_passes,bool) and 1<=max_passes<=6):
        raise RuntimeError("Mobile cloth repair must stay inside strict 12mm/6-pass bounds.")
    matrix=copy.matrix_world
    inverse=matrix.inverted()
    mesh=copy.data
    original_points=[matrix @ vertex.co for vertex in mesh.vertices]
    original_topology=(len(mesh.vertices),len(mesh.polygons))
    history=[]
    for iteration in range(max_passes+1):
        points,faces,tris=world_geometry(copy)
        contact=physical_body_probe(body_bvh,points,tris)
        report={
            "pass":iteration,"sampledTriangles":contact["sampledFaceCount"],
            "deepFaceOrEdgeHits":contact["deepFaceOrEdgeHits"],
            "deepVertexHits":contact["deepVertexHits"],
        }
        history.append(report)
        if contact["deepFaceOrEdgeHits"]==0 and contact["deepVertexHits"]==0:
            return {
                "succeeded":True,"passes":iteration,
                "maxLocalVertexShiftMm":round(max(
                    ((matrix @ v.co)-original_points[i]).length*1000
                    for i,v in enumerate(mesh.vertices)
                ),2),
                "sourceGeometryUntouched":True,"history":history,
            }
        if iteration>=max_passes:
            break
        proposals={}
        unresolved=[]
        for contact_triangle in contact["contactTriangles"]:
            point=Vector(contact_triangle["point"])
            nearest=body_bvh.find_nearest(point)
            if nearest is None or nearest[0] is None or nearest[1] is None:
                break
            surface,normal=nearest[0],nearest[1].normalized()
            candidates=[]
            for direction in (normal,-normal):
                destination=surface+direction*.003
                delta=destination-point
                if (delta.length<=max_shift_m and
                        not candidate_point_inside_locked_body(body_bvh,destination)):
                    candidates.append((delta.length,delta))
            # Concave thigh/crotch and underarm skin can have a misleading
            # NEAREST surface normal: native probe 37881607915 could not
            # repair one real right sleeve + left trouser-leg hit at 12mm.
            # Sample actual exterior along bounded WORLD-space directions,
            # rather than increasing the limit or accepting intersections.
            # Search contact-relative X/Y/Z and diagonals, no new vertices,
            # preserve user identity and independently verify every result.
            axes=[
                Vector((sx,sy,sz)).normalized()
                for sx,sy,sz in (
                    (1,0,0),(-1,0,0),(0,1,0),(0,-1,0),
                    (0,0,1),(0,0,-1),
                    (1,1,0),(1,-1,0),(-1,1,0),(-1,-1,0),
                    (1,0,1),(1,0,-1),(-1,0,1),(-1,0,-1),
                    (0,1,1),(0,1,-1),(0,-1,1),(0,-1,-1),
                )
            ]
            for distance in (.003,.005,.007,.009,.011,max_shift_m):
                for direction in axes:
                    destination=point+direction*distance
                    if candidate_point_inside_locked_body(body_bvh,destination):
                        continue
                    measure=body_bvh.find_nearest(destination)
                    if measure is None or measure[0] is None:
                        continue
                    if (destination-measure[0]).length<.002:
                        continue
                    candidates.append((distance,destination-point))
                if candidates:
                    break
            if not candidates:
                unresolved.append({
                    "xyzMm":[round(v*1000,2) for v in point],
                    "nearestBodyDepthMm":round((point-surface).length*1000,2),
                    "reason":"No real exterior displacement in 12mm X/Y/Z+tangent search.",
                })
                continue
            shift=min(candidates,key=lambda row:row[0])[1]
            for index in contact_triangle["vertices"]:
                if index>=len(mesh.vertices):
                    raise RuntimeError("Decimated face used nonexistent source vertex.")
                proposals.setdefault(index,[]).append(shift)
        if unresolved:
            history[-1]["unresolvedContactSamples"]=unresolved[:8]
        if not proposals:
            history[-1]["reason"]="No safe measured exterior patch fits 12mm in body-normal or multi-axis directions."
            break
        changed=0
        for index,shifts in proposals.items():
            vertex=mesh.vertices[index]
            current=matrix @ vertex.co
            if any(abs(current.z-z)<.002 for z in guides):
                continue
            weights=[max(shift.length,.001)**2 for shift in shifts]
            correction=sum((delta*w for delta,w in zip(shifts,weights)),
                           Vector((0,0,0)))/sum(weights)
            candidate=current+correction
            # Preserve a HARD source-space distance cap even after 6 passes.
            total=candidate-original_points[index]
            if total.length>max_shift_m:
                candidate=original_points[index]+total.normalized()*max_shift_m
            if (candidate-current).length<1e-8:
                continue
            vertex.co=inverse @ candidate
            changed+=1
        mesh.update(calc_edges=True)
        if (len(mesh.vertices),len(mesh.polygons))!=original_topology:
            raise RuntimeError("Temporary mobile repair changed collapsed mesh topology.")
        history[-1]["locallyMovedClothVertices"]=changed
        if not changed:
            break
    return {
        "succeeded":False,"passes":len(history)-1,
        "maxLocalVertexShiftMm":round(max(
            ((matrix @ v.co)-original_points[i]).length*1000
            for i,v in enumerate(mesh.vertices)
        ),2),
        "sourceGeometryUntouched":True,"history":history,
    }



def measured_skin_contact_anchors(probe):
    """Use actual failed low-poly skin contacts, never invented body coordinates."""
    points=[Vector(item["point"]) for item in probe["contactTriangles"]]
    points.extend(Vector(tuple(v/1000 for v in point))
                  for point in probe["sampleDeepVertexPositionsMm"])
    return points


def skin_protection_weight(distance_m):
    """Smoothly retain real source cloth geometry around measured LOD collisions."""
    if not math.isfinite(distance_m) or distance_m<0:
        raise ValueError("Contact distance must be finite and nonnegative.")
    if distance_m<=0.055:
        return 1.0
    if distance_m>=0.115:
        return 0.0
    linear=(0.115-distance_m)/0.060
    return linear*linear*(3-2*linear)


def adaptive_skin_guard_trial(original, body_bvh, baseline_probe, ratio, name, temporary_objects):
    """Fresh, disposable decimation protecting SOURCE cloth near real BVH hits.

    The first unweighted LOD can shortcut a curved sleeve or thigh and slice
    through skin by >30mm. A 12mm post-collapse vertex nudge cannot safely
    undo that. Preserve the original cloth's curvature *during* edge collapse
    instead; never touch the mannequin or production garment, and only accept
    an independently re-probed diagnostic improvement.
    """
    baseline_hits=baseline_probe["deepFaceOrEdgeHits"]+baseline_probe["deepVertexHits"]
    if baseline_hits==0:
        return None, {"attempted":False,"reason":"Unweighted LOD has no sampled skin contacts."}
    anchors=measured_skin_contact_anchors(baseline_probe)
    if not anchors:
        return None, {"attempted":False,"reason":"No measured BVH contact coordinates."}
    trial=original.copy()
    trial.data=original.data.copy()
    bpy.context.scene.collection.objects.link(trial)
    trial.name="LE_UNAPPROVED_SKIN_GUARDED__"+name
    temporary_objects.append(trial)
    group=trial.vertex_groups.new(name="LE_DiagnosticSkinGuard")
    protected=0
    world=trial.matrix_world
    for vertex in trial.data.vertices:
        point=world @ vertex.co
        weight=skin_protection_weight(min((point-anchor).length for anchor in anchors))
        if weight>=0.03:
            group.add([vertex.index],weight,"REPLACE")
            protected+=1
    if protected==0:
        return None, {"attempted":True,"protectedVertices":0,
                      "reason":"No authored source cloth lies near measured contacts."}
    modifier=trial.modifiers.new("LE_SKIN_AWARE_DIAGNOSTIC_LOD","DECIMATE")
    modifier.decimate_type="COLLAPSE"
    modifier.ratio=ratio
    modifier.use_collapse_triangulate=True
    modifier.vertex_group=group.name
    # Invert group so low-risk regions collapse first. This is a 4.2-supported
    # vertex-group influence, not a hidden exemption from BVH or budget gates.
    modifier.invert_vertex_group=True
    modifier.vertex_group_factor=40.0
    bpy.ops.object.select_all(action="DESELECT")
    trial.select_set(True)
    bpy.context.view_layer.objects.active=trial
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    if not trial.data.uv_layers:
        raise RuntimeError("Skin-guarded candidate lost source fabric grain UV.")
    points,_,triangles=world_geometry(trial)
    probe=physical_body_probe(body_bvh,points,triangles)
    trial_hits=probe["deepFaceOrEdgeHits"]+probe["deepVertexHits"]
    return trial, {
        "attempted":True,
        "sourceMeasuredContactAnchors":len(anchors),
        "protectedSourceVertices":protected,
        "sourceVertexCount":len(original.data.vertices),
        "unweightedDeepContacts":baseline_hits,
        "guardedDeepContacts":trial_hits,
        "guardedTriangles":len(triangles),
        "improved":trial_hits<baseline_hits,
        "keptForFurtherProbe":trial_hits<baseline_hits,
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
            before_points=[tuple(vertex.co) for vertex in original.data.vertices]
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
            if not copy.data.uv_layers or not original.data.uv_layers:
                raise RuntimeError("Mobile cloth candidate must retain actual source fabric UV grain.")
            initial_points,_,initial_triangles=world_geometry(copy)
            baseline_probe=physical_body_probe(tree,initial_points,initial_triangles)
            trial,skin_guard=adaptive_skin_guard_trial(
                original,tree,baseline_probe,cfg.ratio,name,temporary_objects,
            )
            if trial is not None and skin_guard["keptForFurtherProbe"]:
                # A contact improvement alone does NOT certify skin clearance,
                # construction-guide fidelity, actual UV scale or mobile budget.
                copy=trial
            repair=fit_candidate_mobile_contacts(copy,tree,guides[name])
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
            intersections=physical_body_probe(tree,points,tris)
            probe_results[name]={
                "sourceTriangles":len(source_triangles),
                "candidateTriangles":len(tris),
                "candidateVertices":len(points),
                "lockedSectionMaxBoundaryShiftMm":max(deltas,default=0),
                "protectedSectionSampleShiftsMm":deltas,
                "measuredRealBody":intersections,
                "unweightedBeforeRepair":{
                    "triangles":len(initial_triangles),
                    "deepVertexHits":baseline_probe["deepVertexHits"],
                    "deepFaceOrEdgeHits":baseline_probe["deepFaceOrEdgeHits"],
                },
                "sourceSkinAwareCollapse":skin_guard,
                "boundedContactRepair":repair,
                "sampledSkinPass":repair["succeeded"] and
                                  intersections["deepVertexHits"]==0 and
                                  intersections["deepFaceOrEdgeHits"]==0,
                "sourceMeshUnchanged":before==(
                    len(original.data.vertices),len(original.data.polygons)) and
                    before_points==[tuple(vertex.co) for vertex in original.data.vertices],
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
        "decimateMethod":"Blender 4.2 COLLAPSE + optional measured-contact source-vertex skin guards + capped 12mm real-body cloth fitting; diagnostic copies only",
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
