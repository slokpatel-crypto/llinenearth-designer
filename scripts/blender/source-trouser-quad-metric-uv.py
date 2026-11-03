"""Research-only metric flattening of the actual 2,650 original trouser quads.

Preserve each source quad's *two triangle* edge lengths, with a distinct
unstitched UV island per original face. Never imply full-panel UV continuity,
measured linen repeat, physical cut length, textile grain or drape.
"""
from __future__ import annotations

from collections import defaultdict
import math


def _triangle_point(a, b, distance_a, distance_b, sign):
    edge = math.dist(a, b)
    if not math.isfinite(edge) or edge <= 1e-9:
        raise ValueError("Actual source-quad flattening has a collapsed edge.")
    x = (distance_a**2 - distance_b**2 + edge**2) / (2.0 * edge)
    h2 = distance_a**2 - x**2
    if not math.isfinite(h2) or h2 <= 1e-16:
        raise ValueError("Original source quad has a degenerate metric triangle.")
    h = math.sqrt(h2) * sign
    dx, dy = b[0]-a[0], b[1]-a[1]
    return (a[0]+x*dx/edge-h*dy/edge,
            a[1]+x*dy/edge+h*dx/edge)


def _cross(a, b, c):
    return ((b[0]-a[0])*(c[1]-a[1]) -
            (b[1]-a[1])*(c[0]-a[0]))


def _tri_area_3d(a, b, c):
    u=[b[i]-a[i] for i in range(3)]
    v=[c[i]-a[i] for i in range(3)]
    cross=(u[1]*v[2]-u[2]*v[1],
           u[2]*v[0]-u[0]*v[2],
           u[0]*v[1]-u[1]*v[0])
    return math.sqrt(sum(x*x for x in cross))/2.0


def unfold_original_trouser_source_quads(points, faces, original_cut_edges):
    """Create research 2D face islands that have no hidden edge-length error."""
    if len(faces) != 2650 or len(original_cut_edges) != 8 or not points:
        raise ValueError("Require real 2,650 original trouser faces and 8 source cut edges.")
    original=[tuple(float(v) for v in p) for p in points]
    if any(len(p)!=3 or not all(math.isfinite(x) for x in p) for p in original):
        raise ValueError("Actual source panel contains an unknown or invalid 3D point.")
    face_xy=[]
    edge_owners=defaultdict(list)
    max_face_w=0.0
    max_face_h=0.0
    max_edge_error_mm=0.0
    total_area_3d=0.0
    total_area_flat=0.0
    for face_id, raw_face in enumerate(faces):
        face=tuple(int(i) for i in raw_face)
        if (len(face) != 4 or len(set(face)) != 4
                or min(face)<0 or max(face)>=len(original)):
            raise ValueError("Actual trouser mesh must contain genuine four-vertex source quads.")
        a,b,c,d=(original[i] for i in face)
        ab=math.dist(a,b)
        ac=math.dist(a,c)
        bc=math.dist(b,c)
        ad=math.dist(a,d)
        cd=math.dist(c,d)
        xyz=[(0.0,0.0),(ab,0.0)]
        xyz.append(_triangle_point(xyz[0], xyz[1], ac, bc, +1))
        abc_cross=_cross(*xyz)
        if abc_cross<=1e-14:
            raise ValueError("Actual source quad first metric triangle is inverted.")
        sign=1 if _cross(xyz[0], xyz[2], xyz[1])<0 else -1
        xyz.append(_triangle_point(xyz[0],xyz[2],ad,cd,sign))
        if _cross(xyz[0],xyz[2],xyz[3])<=1e-14:
            raise ValueError("Actual source quad second metric triangle is inverted.")
        triangles_3d=_tri_area_3d(a,b,c)+_tri_area_3d(a,c,d)
        triangles_flat=(_cross(xyz[0],xyz[1],xyz[2])+
                        _cross(xyz[0],xyz[2],xyz[3]))/2.0
        if (not math.isfinite(triangles_3d) or triangles_3d<=1e-12
                or not math.isfinite(triangles_flat) or triangles_flat<=1e-12):
            raise ValueError("Original source quad has no finite metric area.")
        if abs(triangles_3d-triangles_flat)*1e6 > max(0.01,triangles_3d*1e6*1e-5):
            raise ValueError("Source quad triangle areas cannot be preserved.")
        for i,j in ((0,1),(1,2),(2,3),(3,0),(0,2)):
            real=math.dist(original[face[i]],original[face[j]])
            flat=math.dist(xyz[i],xyz[j])
            error=abs(real-flat)*1000.0
            if not math.isfinite(error) or error>0.001:
                raise ValueError("Source quad triangle length cannot be preserved to 0.001mm.")
            max_edge_error_mm=max(max_edge_error_mm,error)
        minx=min(x for x,_ in xyz)
        miny=min(y for _,y in xyz)
        positioned=[(x-minx,y-miny) for x,y in xyz]
        max_face_w=max(max_face_w,max(x for x,_ in positioned))
        max_face_h=max(max_face_h,max(y for _,y in positioned))
        face_xy.append(positioned)
        total_area_3d+=triangles_3d
        total_area_flat+=triangles_flat
    if max_face_w<=1e-9 or max_face_h<=1e-9:
        raise ValueError("Original quad charts have no measurable 2D extent.")
    uv_faces=[]
    # 53 * 50 = 2650 geometry-only islands; 5 mm is a display gap,
    # NEVER a cut seam allowance or material measurement.
    grid_columns=53
    for face_id,raw_face in enumerate(faces):
        face=tuple(int(i) for i in raw_face)
        xoffset=(face_id % grid_columns)*(max_face_w+0.005)
        yoffset=(face_id // grid_columns)*(max_face_h+0.005)
        row=[(u+xoffset,v+yoffset) for u,v in face_xy[face_id]]
        uv_faces.append(row)
        for i in range(4):
            a,b=face[i],face[(i+1)%4]
            canonical=(min(a,b),max(a,b))
            oriented=(row[i],row[(i+1)%4]) if (a,b)==canonical else (
                row[(i+1)%4],row[i])
            edge_owners[canonical].append(oriented)
    if any(len(owners)>2 for owners in edge_owners.values()):
        raise ValueError("Original source face atlas has nonmanifold edge ownership.")
    mismatch_edges=0
    max_chart_gap=0.0
    shared_edges=0
    for owners in edge_owners.values():
        if len(owners)!=2:
            continue
        shared_edges+=1
        gap=max(math.dist(owners[0][i],owners[1][i]) for i in (0,1))*1000.0
        if not math.isfinite(gap):
            raise ValueError("Original source UV stitching discontinuity is nonfinite.")
        max_chart_gap=max(max_chart_gap,gap)
        if gap>0.001:
            mismatch_edges+=1
    cuts={tuple(sorted(edge)) for edge in original_cut_edges}
    if len(cuts)!=8 or any(len(edge)!=2 or len(edge_owners.get(edge,[]))!=1
                          for edge in cuts):
        raise ValueError("Original source cut-edge boundary ownership is unverified.")
    return {
        "face_uv_loops":uv_faces,
        "report":{
            "researchOnly":True,
            "actualOriginalSourceQuadCount":len(faces),
            "originalSourceVertexCount":len(original),
            "actualOriginalSourceUvLoopCount":sum(len(r) for r in uv_faces),
            "originalSourceCutEdgeCount":len(cuts),
            "sourceOpenBoundaryEdgeCount":sum(len(v)==1 for v in edge_owners.values()),
            "sharedOriginalSourceEdgeCount":shared_edges,
            "unstitchedUvIslandCount":len(faces),
            "provisionalUvDiscontinuousSharedEdges":mismatch_edges,
            "provisionalUvContinuousSharedEdges":shared_edges-mismatch_edges,
            "maximumUnstitchedUvGapMm":round(max_chart_gap,5),
            "maximumActualQuadTriangleEdgeErrorMm":round(max_edge_error_mm,8),
            "trueOriginalSourceQuadTriangleAreaMm2":round(total_area_3d*1e6,4),
            "flattenedUnstitchedQuadTriangleAreaMm2":round(total_area_flat*1e6,4),
            "quadResearchDisplayGridColumns":grid_columns,
            "displayIslandGapMm":5.0,
            "physicalSeamAllowanceVerified":False,
            "flatChartsHaveConnectedGarmentUV":False,
            "realSourceToBridgeUVJoined":False,
            "physicalTextileGrainVerified":False,
            "supplierFabricRepeatMm":None,
            "sourceUVFromProduction":False,
            "productionApproved":False,
            "metricCaveat":(
                "Each real original source quad was unfolded as two exact "
                "metric triangles. Every face remains a DIFFERENT UV island. "
                "This is not a sewn continuous trouser UV unwrap, not the "
                "actual textile grain/repeat, and not a cutting pattern."
            ),
        },
    }
