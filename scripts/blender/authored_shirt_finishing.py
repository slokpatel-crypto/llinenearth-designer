"""Join explicit collar and sleeve cuff panels to an authored shirt source mesh.

Built from ACTUAL open boundary rings, never guess by nearest neighbor.
Mesh topology/visual construction experiments only; no manufacturer pattern,
measured neck/arm dimensions, original photo parity, sleeve pose, supplier
fabric or tailored sewing approval implied.
"""
from __future__ import annotations
import math

from authored_shirt_panels import boundary_loops, _winding_and_islands, _edge


def _mean(points):
    return tuple(sum(p[k] for p in points)/len(points) for k in range(3))


def add_collar_and_cuffs(source, *, collar_height_mm=30.0,
                         cuff_length_mm=42.0):
    if (not isinstance(source,dict) or
        any(not isinstance(source.get(k),list)
            for k in ("vertices","faces","roles"))):
        raise ValueError("Complete source shirt geometry is required")
    for n,v,low,high in (
        ("collar height",collar_height_mm,18.0,45.0),
        ("cuff length",cuff_length_mm,25.0,65.0),
    ):
        if not isinstance(v,(float,int)) or not math.isfinite(v) or not low<=v<=high:
            raise ValueError(f"Unmeasured {n} outside candidate limit")

    vertices=[tuple(p) for p in source["vertices"]]
    faces=[tuple(f) for f in source["faces"]]
    roles=list(source["roles"])
    if len(roles)!=len(faces):
        raise ValueError("Mismatched face role evidence")

    loops=boundary_loops(faces)
    if len(loops)!=4:
        raise ValueError("Unfinished shirt must have exactly neck/hem/two cuff openings")
    recognized={}
    for loop in loops:
        coords=[vertices[index] for index in loop]
        center=_mean(coords)
        if len(loop)==64 and center[2]>1.45:
            key="collar"
        elif len(loop)==64 and center[2]<1.12:
            key="hem"
        elif len(loop)>=20 and center[0]<-.10:
            key="left_cuff"
        elif len(loop)>=20 and center[0]>.10:
            key="right_cuff"
        else:
            raise ValueError("Cannot classify genuine shirt boundary loop")
        if key in recognized:
            raise ValueError("Ambiguous or duplicate pattern opening")
        recognized[key]=loop
    if set(recognized)!={"collar","hem","left_cuff","right_cuff"}:
        raise ValueError("No complete set of garment openings")

    root_seams=source.get("armholeSeamEdges")
    if not isinstance(root_seams,dict):
        raise ValueError("Original joined armhole seam evidence missing")

    trim_receipts={}
    def extend_ring(loop,role,project):
        previous=list(loop)
        rings=[]
        for band in range(1,3):
            nxt=[]
            for vertex_id in loop:
                xyz=project(vertices[vertex_id],band/2)
                if any(not math.isfinite(x) for x in xyz):
                    raise ValueError("Nonfinite constructed trim position")
                nxt.append(len(vertices))
                vertices.append(tuple(xyz))
            for i in range(len(previous)):
                j=(i+1)%len(previous)
                # The old open boundary uses previous[i] -> previous[j].
                # New panel MUST traverse it in the reverse direction.
                faces.append((previous[j],previous[i],nxt[i],nxt[j]))
                roles.append(role)
            previous=nxt
            rings.append(nxt)
        trim_receipts[role]={
            "rootLoopLength":len(loop),
            "newRingVertexCount":sum(map(len,rings)),
            "newPanelFaceCount":2*len(loop),
            "rootSharedSourceEdges":[_edge(loop[i],loop[(i+1)%len(loop)])
                                     for i in range(len(loop))],
        }

    collar=recognized["collar"]
    collar_centre=_mean([vertices[v] for v in collar])
    def collar_project(point,t):
        # A restrained standing band rises from true neckline seam, flares
        # gently but not at physically calibrated fabric thickness.
        outward=1 + .07*t
        return (
            collar_centre[0]+(point[0]-collar_centre[0])*outward,
            collar_centre[1]+(point[1]-collar_centre[1])*outward,
            point[2]+t*collar_height_mm/1000,
        )
    extend_ring(collar,"collar",collar_project)

    for key in ("left_cuff","right_cuff"):
        loop=recognized[key]
        center=_mean([vertices[v] for v in loop])
        roots=root_seams.get("left_sleeve" if key=="left_cuff" else "right_sleeve")
        if not roots:
            raise ValueError("Corresponding authored armhole seam missing")
        vertex_ids={v for e in roots for v in e}
        if not vertex_ids or max(vertex_ids)>=len(vertices):
            raise ValueError("Invalid root sleeve seam indices")
        armhole_centre=_mean([vertices[v] for v in sorted(vertex_ids)])
        d=tuple(center[k]-armhole_centre[k] for k in range(3))
        length=math.sqrt(sum(x*x for x in d))
        if length<.12:
            raise ValueError("Cannot determine sleeved arm axis from authored topology")
        direction=tuple(x/length for x in d)
        def cuff_project(point,t, center=center, direction=direction):
            return tuple(
                center[k]+(point[k]-center[k])*(1-.025*t)
                +t*(cuff_length_mm/1000)*direction[k]
                for k in range(3)
            )
        extend_ring(loop,key,cuff_project)

    topology=_winding_and_islands(faces)
    end_loops=boundary_loops(faces)
    topology.update({
        "vertexCount":len(vertices),
        "polygonCount":len(faces),
        "boundaryLoopsAfterSleeves":len(end_loops),
        "boundaryLoopVertexCounts":sorted(len(x) for x in end_loops),
        "collarAndCuffTopologyAuthored":True,
        "trimFaceCounts":{key:val["newPanelFaceCount"]
                          for key,val in trim_receipts.items()},
        "trimSeamEdgeCounts":{key:val["rootLoopLength"]
                             for key,val in trim_receipts.items()},
        "shirtPatternMeasured":False,
        "supplierAndTailorVerified":False,
    })
    # A subset of properties sufficient for a genuine manifold seam receipt,
    # NOT a sewn-production or fabric scale approval.
    if (topology["connectedComponents"]!=1 or topology["nonmanifoldEdges"] or
        topology["windingErrors"] or len(end_loops)!=4):
        raise ValueError("Collar/cuffs distorted the original manifold topology")

    return {
        **source,
        "vertices":vertices,
        "faces":faces,
        "roles":roles,
        "trimRootSeams":{
            key:val["rootSharedSourceEdges"] for key,val in trim_receipts.items()
        },
        "topology":{
            **source["topology"],
            **topology,
        },
    }
