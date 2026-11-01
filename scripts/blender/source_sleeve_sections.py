"""Measured-from-source sleeve sections and orthogonal local section frames.

This is a deterministic geometry experiment on a *generic scanned body*;
cross-section radii and local tangents come from immutable 3D source vertices.
An experimental positive cloth gap is NOT measured tailoring ease, fabric
behaviour, photographic identity or production approval.
"""
from __future__ import annotations

import math


def _vec(a,b):
    return tuple(x-y for x,y in zip(a,b))


def _dot(a,b):
    return sum(x*y for x,y in zip(a,b))


def _cross(a,b):
    return (a[1]*b[2]-a[2]*b[1],
            a[2]*b[0]-a[0]*b[2],
            a[0]*b[1]-a[1]*b[0])


def _unit(v):
    length=math.sqrt(_dot(v,v))
    if not math.isfinite(length) or length<1e-5:
        raise ValueError("Degenerate source arm cross-section frame")
    return tuple(value/length for value in v)


def build_source_sleeve_sections(body_vertices, scan_receipt, *,
                                  clearance_mm=4.0,
                                  slice_half_band_m=.022):
    if not isinstance(scan_receipt,dict):
        raise ValueError("Actual source arm section evidence required")
    side=scan_receipt.get("side")
    if side not in ("left_sleeve","right_sleeve") or not scan_receipt.get("sourceBasedArmPose"):
        raise ValueError("No verified source-scanned arm centreline")
    root=scan_receipt.get("rootCenterM")
    path=scan_receipt.get("centerline")
    if (not isinstance(root,(list,tuple)) or len(root)!=3 or
        not isinstance(path,(list,tuple)) or len(path)!=5):
        raise ValueError("Missing source arm root or five sections")
    for p in [root,*path]:
        if (not isinstance(p,(tuple,list)) or len(p)!=3 or
            any(type(x) not in (int,float) or not math.isfinite(x) for x in p)):
            raise ValueError("Invalid source arm coordinate")
    if (not isinstance(body_vertices,(tuple,list)) or len(body_vertices)<50 or
        any(not isinstance(p,(list,tuple)) or len(p)!=3 or
            any(type(x) not in (int,float) or not math.isfinite(x) for x in p)
            for p in body_vertices)):
        raise ValueError("Complete finite original source body required")
    if type(clearance_mm) not in (int,float) or not math.isfinite(clearance_mm) or not 2<=clearance_mm<=6:
        raise ValueError("Exploratory fabric gap cannot become unbounded")
    if type(slice_half_band_m) not in (int,float) or not .014<=slice_half_band_m<=.03:
        raise ValueError("Inconsistent source slice band")

    sign=-1 if side=="left_sleeve" else 1
    extended=[tuple(root)]+[tuple(p) for p in path]
    if any(sign*p[0]<.205 for p in extended[1:]):
        raise ValueError("Source path crosses torso instead of arm")
    sections=[]
    for i,center in enumerate(path):
        before=extended[i]
        after=extended[i+1] if i==4 else extended[i+2]
        tangent=_unit(_vec(after,before))
        # Front world +Y projected into actual arm-section plane.
        front=_unit(tuple(float(axis==1)-_dot(tangent,(0.,1.,0.))*tangent[axis]
                          for axis in range(3)))
        lateral=_unit(_cross(tangent,front))
        candidates=[
            p for p in body_vertices
            if abs(p[2]-center[2])<=slice_half_band_m
            and sign*p[0]>.205
            and abs(p[0]-center[0])<=.125
            and abs(p[1]-center[1])<=.155
        ]
        if len(candidates)<12:
            raise ValueError(f"Insufficient scanned cross-section around {side} ring {i+1}")
        radial=[]
        for p in candidates:
            v=_vec(p,center)
            radial.append(math.hypot(_dot(v,front),_dot(v,lateral)))
        radial.sort()
        measured=radial[round(.95*(len(radial)-1))]
        if not math.isfinite(measured) or not .020<=measured<=.145:
            raise ValueError("Source radial extent implausible or contaminated by torso")
        radius=measured+clearance_mm/1000
        sections.append({
            "centerM":tuple(center),
            "tangent":tangent,
            "basisFront":front,
            "basisSide":lateral,
            "radiusM":radius,
            "bodySurface95RadiusM":measured,
            "realScanVertexCount":len(candidates),
            "sourceMeasured":True,
            "clothGapMmExperimentalOnly":clearance_mm,
            "photographicPoseVerified":False,
        })
    return sections
