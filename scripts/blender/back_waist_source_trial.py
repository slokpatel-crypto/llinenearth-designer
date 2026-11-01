"""Conservative back shirt / actual trouser waistband surface registration.

The waistband source is sampled without mutation, but the generic photographed
model identity and physical sewing fit remain UNVERIFIED. This experiment
changes only lower BACK shirt ring vertices; it keeps all sleeves, armhole,
front placket, collar and cuff geometry byte-for-byte unchanged.
"""
from __future__ import annotations

import math
from collections import Counter
from statistics import median

from authored_shirt_panels import N, PROFILE, _winding_and_islands, boundary_loops


def _vec3(value):
    return (isinstance(value,(tuple,list)) and len(value)==3 and
            all(type(a) in (float,int) and math.isfinite(a) for a in value))


def construct_back_waist_trial(source, waistband_vertices, *,
                              side="inside", clearance_mm=3.0,
                              max_panel_shift_mm=24.0):
    if side not in ("inside","outside"):
        raise ValueError("Only two explicitly separate physical source trials")
    if (type(clearance_mm) not in (float,int) or not 2<=clearance_mm<=6 or
        type(max_panel_shift_mm) not in (float,int) or not 10<=max_panel_shift_mm<=26 or
        not math.isfinite(clearance_mm) or not math.isfinite(max_panel_shift_mm)):
        raise ValueError("Source waist-seam trial bounds are not measured tailoring allowances")
    if not isinstance(source,dict) or any(
        not isinstance(source.get(key),list)
        for key in ("vertices","faces","roles")
    ):
        raise ValueError("Full authored shirt mesh required")
    vertices=[tuple(v) for v in source["vertices"]]
    faces=list(source["faces"])
    roles=list(source["roles"])
    if len(vertices)<N*len(PROFILE) or len(faces)!=len(roles):
        raise ValueError("Incomplete source shirt or face labels")
    if any(not _vec3(v) for v in vertices):
        raise ValueError("Nonfinite authored shirt")
    if not isinstance(waistband_vertices,(tuple,list)) or len(waistband_vertices)<40:
        raise ValueError("Actual source trouser waistband mesh missing")
    if any(not _vec3(v) for v in waistband_vertices):
        raise ValueError("Actual source trouser mesh is not finite")

    # Real waistband mesh world-space posterior contour, no invented x/y/z.
    posterior=[tuple(v) for v in waistband_vertices
               if v[1]>.045 and abs(v[0])<.30 and .84<v[2]<1.23]
    if len(posterior)<24:
        raise ValueError("No sufficiently sampled true posterior trouser waistband")
    observed_median_z=median(p[2] for p in posterior)
    posterior=[p for p in posterior if abs(p[2]-observed_median_z)<.105]
    if len(posterior)<24:
        raise ValueError("No reliable source waistband height band")
    target_offsets={}
    observations=[]
    # These 3 lower actual back rings are the complete target. row 3 is fixed.
    # Side seam and front panels untouched. Ring changes blend back to zero
    # by row 3 to preserve the entire upper torso/armhole and sleeve mesh.
    for j in range(4,29):
        x0,y0,z0=vertices[j]
        if y0<.02:
            raise ValueError("Target vertex is not on the source back")
        candidates=[v for v in posterior if abs(v[0]-x0)<.065]
        if len(candidates)<4:
            raise ValueError("Source waistband does not resolve back-contour x coordinate")
        source_y=median(v[1] for v in candidates)
        # On a real tucked shirt, trial "inside" means toward the wearer
        # relative to the waist face; "outside" tests the competing hypothesis.
        target_y=source_y + (clearance_mm/1000.0)*(
            -1 if side=="inside" else 1
        )
        shift=max(-max_panel_shift_mm/1000.0,
                  min(max_panel_shift_mm/1000.0,target_y-y0))
        if not math.isfinite(shift):
            raise ValueError("Invalid source-contour adjustment")
        target_offsets[j]=shift
        observations.append({
            "backRingColumn":j,
            "originalBackYMetres":round(y0,7),
            "actualWaistSourceMedianYMetres":round(source_y,7),
            "sourceWaistVertexSamples":len(candidates),
            "posteriorContourDeltaM":round(shift,7),
        })
    modified=[]
    for row,weight in enumerate((1.0, .80, .35)):
        for j,shift in target_offsets.items():
            # Taper to zero at body side seams, never change the closed ring
            # waist centreline orientation or any sleeve/collar face index.
            edge_taper=min(1.0,(j-3)/5.0,(29-j)/5.0)
            idx=row*N+j
            x,y,z=vertices[idx]
            vertices[idx]=(x,y+shift*weight*edge_taper,z)
            modified.append(idx)

    check=_winding_and_islands(faces)
    loops=boundary_loops(faces)
    if (check["connectedComponents"]!=1 or check["windingErrors"]!=0
        or check["nonmanifoldEdges"]!=0 or len(loops)!=4):
        raise ValueError("Waist adjustment invalidated sewn garment topology")
    before=source.get("topology",{})
    after=dict(before)
    after.update(check)
    after.update({
        "backWaistSourceContourTrial":side,
        "backWaistSourceMeshReferenced":True,
        "backWaistShiftMaxMmExperimentalOnly":max_panel_shift_mm,
        "backWaistSeamGapMmExperimentalOnly":clearance_mm,
        "backWaistAuthoritativeFitApproved":False,
        "vertexCount":len(vertices),
        "polygonCount":len(faces),
        "boundaryLoopsAfterSleeves":len(loops),
        "panelFaceCounts":dict(Counter(roles)),
    })
    return {
        **source,
        "vertices":vertices,
        "faces":faces,
        "roles":roles,
        "topology":after,
        "backWaistModifiedOriginalVertexIds":modified,
        "backWaistMeasuredSourceObservations":observations,
        "backWaistSourceHeightMedianM":observed_median_z,
    }
