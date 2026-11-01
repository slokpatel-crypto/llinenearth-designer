"""Exact face partition by source scan vertical band for native contact QA.

Classify EVERY original shirt polygon once, preserving original face indices.
The experimental height bands are spatial diagnostic labels, not physical
measured waist positions, sewing allowances, or claim of source-photo parity.
"""
from __future__ import annotations
import math
from collections import defaultdict

WATCH_REGIONS={"back","left_sleeve","right_sleeve"}


def source_height_band(z):
    if type(z) not in (int,float) or not math.isfinite(z):
        raise ValueError("Missing finite source face height")
    if z<1.12:
        return "hem"
    if z<1.25:
        return "waist"
    if z<1.36:
        return "underarm"
    return "shoulder"


def group_actual_source_faces_by_height(vertices,faces,roles):
    if not isinstance(vertices,(list,tuple)) or not isinstance(faces,(list,tuple)) or not faces:
        raise ValueError("Actual full source geometry required")
    if not isinstance(roles,(list,tuple)) or len(roles)!=len(faces):
        raise ValueError("Actual source face classification missing")
    groups=defaultdict(list)
    for i,(face,role) in enumerate(zip(faces,roles)):
        if not isinstance(role,str) or not role:
            raise ValueError("Source garment role missing")
        if (not isinstance(face,(tuple,list)) or len(face)<3 or
            any(type(k) is not int or k<0 or k>=len(vertices) for k in face)):
            raise ValueError("Missing source polygon face vertices")
        positions=[vertices[k] for k in face]
        if any(not isinstance(p,(tuple,list)) or len(p)!=3 or
               any(type(v) not in (int,float) or not math.isfinite(v) for v in p)
               for p in positions):
            raise ValueError("Nonfinite world source mesh vertex")
        if role in WATCH_REGIONS:
            z=sum(p[2] for p in positions)/len(positions)
            name=f"{role}@{source_height_band(z)}"
        else:
            name=role
        groups[name].append(i)
    result=dict(sorted(groups.items()))
    flat=[i for group in result.values() for i in group]
    if sorted(flat)!=list(range(len(faces))):
        raise ValueError("Source spatial group omitted or duplicated original face")
    return result
