"""Actual raised front-placket surface topology on the authored shirt panels.

This modifies and labels existing front-body quadrilaterals rather than
floating a second ribbon over cloth, preserving connected manifold seam edges.
It is a *closed* band placket, not a cut button opening, buttonhole, or
tailor-approved placket; fabric thickness, cloth grain and measures unknown.
The front convention is -Y, and ring source indexing is explicitly 64 wide.
"""
from __future__ import annotations

from collections import Counter
import math

from authored_shirt_panels import N, PROFILE, _edge, _mesh_edges, _winding_and_islands, boundary_loops


def add_raised_front_placket(source, *, projection_mm=4.0,
                             first_ring=4, last_ring=11):
    if not isinstance(source,dict) or not all(
        isinstance(source.get(key),list) for key in ("vertices","faces","roles")
    ):
        raise ValueError("Complete authored shirt mesh is required")
    if type(projection_mm) not in (int,float) or not math.isfinite(projection_mm) or not 1<=projection_mm<=6:
        raise ValueError("Unmeasured placket relief must remain in the candidate 1-6 mm envelope")
    if (type(first_ring) is not int or type(last_ring) is not int
        or first_ring<3 or last_ring>len(PROFILE)-1
        or last_ring-first_ring<5):
        raise ValueError("Invalid placket vertical panel extent")
    if len(source["vertices"])<N*len(PROFILE):
        raise ValueError("Original shirt body ring vertices missing")

    vertices=[tuple(v) for v in source["vertices"]]
    faces=[tuple(face) for face in source["faces"]]
    roles=list(source["roles"])
    if len(roles)!=len(faces):
        raise ValueError("Original face region labels mismatched")

    left_col=N*3//4-1
    ridge_col=N*3//4
    right_col=N*3//4+1
    left=[]
    right=[]
    ridge=[]
    changed=[]
    for ring in range(first_ring,last_ring+1):
        idx=ring*N+ridge_col
        x,y,z=vertices[idx]
        if y>=0:
            raise ValueError("Source front center is not facing -Y")
        w=min(1.0,(ring-first_ring+1)/2.0,(last_ring-ring+1)/2.0)
        vertices[idx]=(x,y-w*projection_mm/1000.0,z)
        changed.append(idx)
    patch_count=0
    for fi,face in enumerate(faces):
        if len(face)!=4:
            continue
        # The original axial quads include exactly j47 and j48, ring4..10.
        for row in range(first_ring,last_ring):
            for col in (left_col,ridge_col):
                desired=(row*N+col,row*N+col+1,
                         (row+1)*N+col+1,(row+1)*N+col)
                if face==desired:
                    if roles[fi] not in ("front","yoke"):
                        raise ValueError("Front band crosses sleeve or back surface")
                    roles[fi]="placket"
                    patch_count+=1
    expected=2*(last_ring-first_ring)
    if patch_count!=expected:
        raise ValueError(
            f"Expected {expected} real source front quads, found {patch_count}; no disconnected overlay"
        )
    for row in range(first_ring,last_ring):
        left.append(_edge(row*N+left_col,(row+1)*N+left_col))
        right.append(_edge(row*N+right_col,(row+1)*N+right_col))
        ridge.append(_edge(row*N+ridge_col,(row+1)*N+ridge_col))
    mesh_edges=_mesh_edges(faces)
    for side,edges in (("left",left),("right",right)):
        for edge in edges:
            owners=mesh_edges.get(edge,[])
            if len(owners)!=2:
                raise ValueError("Placket border not sewn to main source surface")
            adj={roles[item[0]] for item in owners}
            if "placket" not in adj or len(adj)!=2 or not (adj-{"placket"})<= {"front","yoke"}:
                raise ValueError(f"Unattached placket {side} seam")
    for edge in ridge:
        owners=mesh_edges.get(edge,[])
        if len(owners)!=2 or any(roles[item[0]]!="placket" for item in owners):
            raise ValueError("Raised centre placket ridge does not have joined source faces")

    original_topology=source.get("topology")
    if not isinstance(original_topology,dict):
        raise ValueError("Missing original authored topology provenance")
    topology=_winding_and_islands(faces)
    openings=boundary_loops(faces)
    if (topology["connectedComponents"]!=1 or topology["windingErrors"]
        or topology["nonmanifoldEdges"] or len(openings)!=4):
        raise ValueError("Placket changed the actual source garment topology")
    topology.update({
        "frontPlacketIntegratedPanel":True,
        "frontPlacketNotOpenButtonClosure":True,
        "frontPlacketDimensionsMeasured":False,
        "frontPlacketProjectionMmExperimentalOnly":projection_mm,
        "frontPlacketQuadrilateralFaceCount":patch_count,
        "frontPlacketBorderEdgeCounts":{"left":len(left),"right":len(right)},
        "frontPlacketRidgeEdgeCount":len(ridge),
        "panelFaceCounts":dict(Counter(roles)),
        "vertexCount":len(vertices),
        "polygonCount":len(faces),
        "boundaryLoopsAfterSleeves":len(openings),
    })
    return {
        **source,
        "vertices":vertices,
        "faces":faces,
        "roles":roles,
        "placketSeamEdges":{"left":left,"right":right},
        "placketRidgeEdges":ridge,
        "placketMovedSourceVertexIds":changed,
        "topology":{**original_topology,**topology},
    }
