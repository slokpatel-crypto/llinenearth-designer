"""Blender-free UV warp/weft geometry measurement on actual mesh triangles.

A world-area/UV-area scalar cannot detect a stretched pinstripe compensated
by an equally compressed check axis. Measure both UV partial derivatives and
shear. This is NOT measured textile repeat, drape, weaving or owner approval.
"""
import math


def uv_fabric_axes_mm(points, uvs):
    """Return mm per U, mm per V, and normalized shear; None for zero world area.

    UV degeneracy is never a valid cloth mapping: return infinite lengths.
    """
    if len(points)!=3 or len(uvs)!=3 or any(len(p)!=3 for p in points) or any(len(u)!=2 for u in uvs):
        raise ValueError("3 world 3D and 3 UV 2D coordinates required.")
    if not all(math.isfinite(x) for point in (*points,*uvs) for x in point):
        raise ValueError("UV coordinates must be finite.")
    a=tuple(points[1][i]-points[0][i] for i in range(3))
    b=tuple(points[2][i]-points[0][i] for i in range(3))
    cross=(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
    twice_area=math.sqrt(sum(x*x for x in cross))
    if twice_area<=1e-14:
        return None
    u1,v1=(uvs[1][i]-uvs[0][i] for i in range(2))
    u2,v2=(uvs[2][i]-uvs[0][i] for i in range(2))
    determinant=u1*v2-u2*v1
    if abs(determinant)<=1e-14:
        return {"uMm":math.inf,"vMm":math.inf,"shearCosine":math.inf}
    du=tuple((a[i]*v2-b[i]*v1)/determinant for i in range(3))
    dv=tuple((b[i]*u1-a[i]*u2)/determinant for i in range(3))
    lu=math.sqrt(sum(x*x for x in du))
    lv=math.sqrt(sum(x*x for x in dv))
    if lu<=1e-14 or lv<=1e-14:
        return {"uMm":math.inf,"vMm":math.inf,"shearCosine":math.inf}
    dot=sum(du[i]*dv[i] for i in range(3))
    return {"uMm":lu*1000,"vMm":lv*1000,"shearCosine":dot/(lu*lv),
            "worldAreaMm2":twice_area*500000}


def _quantile(numbers,fraction):
    ordered=sorted(numbers)
    return round(ordered[min(len(ordered)-1,int((len(ordered)-1)*fraction))],4) if ordered else None


def _area_weighted_quantile(rows,field,fraction):
    # A source mesh may contain 10x more triangles on a shirt shoulder than
    # its flat waist, while the 0.21 mobile mesh redistributes that sampling.
    # A triangle-count median would report a *different* repeat merely from
    # tessellation density. Weight by actual rendered world area as a second,
    # separately labelled diagnostic; do NOT claim local distortion is gone.
    samples=sorted((row[field],row["worldAreaMm2"]) for row in rows
                   if row.get("worldAreaMm2",0)>0 and math.isfinite(row["worldAreaMm2"]))
    total=sum(area for _,area in samples)
    if total<=0:return None
    cumulative=0
    for value,area in samples:
        cumulative+=area
        if cumulative>=fraction*total:return round(value,4)
    return round(samples[-1][0],4)


def summarise_uv_fabric_axes(triangles):
    """Report only area geometry; a 2D motif still requires measured real repeat."""
    all_samples=list(triangles)
    finite=[row for row in all_samples if row is not None
            and all(math.isfinite(row[key]) and row[key]>0 for key in ("uMm","vMm"))
            and math.isfinite(row["shearCosine"])]
    collapsed=len([row for row in all_samples if row is not None and row not in finite])
    return {
        "sampledTriangles":len(all_samples),
        "validTriangles":len(finite),
        "collapsedUvTriangles":collapsed,
        "degenerateWorldTriangles":sum(row is None for row in all_samples),
        "medianUmmPerUvUnit":_quantile([row["uMm"] for row in finite],.5),
        "medianVmmPerUvUnit":_quantile([row["vMm"] for row in finite],.5),
        "areaWeightedMedianUmmPerUvUnit":_area_weighted_quantile(finite,"uMm",.5),
        "areaWeightedMedianVmmPerUvUnit":_area_weighted_quantile(finite,"vMm",.5),
        "p90AbsShearCosine":_quantile([abs(row["shearCosine"]) for row in finite],.9),
        "verifiedPhysicalTextileRepeat":False,
    }


def axis_drift_against_authored(source,candidate,tolerance_pct=8):
    """Diagnostic relative scale change only; never auto-approve physical cloth."""
    if not math.isfinite(tolerance_pct) or tolerance_pct<0:
        raise ValueError("Finite tolerance required")
    drift={}
    for axis,field in (("u","medianUmmPerUvUnit"),("v","medianVmmPerUvUnit")):
        original=source.get(field)
        changed=candidate.get(field)
        drift[axis]=round(abs(changed/original-1)*100,3) if (
            isinstance(original,(int,float)) and original>0 and math.isfinite(original)
            and isinstance(changed,(int,float)) and changed>0 and math.isfinite(changed)
        ) else None
    weighted={}
    for axis,field in (("u","areaWeightedMedianUmmPerUvUnit"),("v","areaWeightedMedianVmmPerUvUnit")):
        original=source.get(field)
        changed=candidate.get(field)
        weighted[axis]=round(abs(changed/original-1)*100,3) if (
            isinstance(original,(int,float)) and original>0 and math.isfinite(original)
            and isinstance(changed,(int,float)) and changed>0 and math.isfinite(changed)
        ) else None
    collapsed=int(source.get("collapsedUvTriangles",0))+int(candidate.get("collapsedUvTriangles",0))
    investigate=collapsed>0 or any(percent is None or percent>tolerance_pct for percent in
        (*drift.values(),*weighted.values()))
    return {
        "uAxisMedianDriftPct":drift["u"],"vAxisMedianDriftPct":drift["v"],
        "uAxisAreaWeightedDriftPct":weighted["u"],"vAxisAreaWeightedDriftPct":weighted["v"],
        "sourceOrCandidateCollapsedUvTriangles":collapsed,
        "maxDiagnosticRelativeDriftPct":tolerance_pct,
        "needsDetailedFabricRepeatInvestigation":investigate,
        "verifiedPhysicalRepeatWithinTolerance":False,
    }
