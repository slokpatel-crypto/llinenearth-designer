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



def summarise_vertical_uv_zones(samples, z_min, z_max):
    """Localize garment-axis stretch in three physical-height regions.

    Input rows are real evaluated triangle UV derivative measurements with
    centroidZ from the actual mesh. These are diagnostic-only, never supplier
    repeat or cloth-drape approval. Do not auto-select better-looking samples.
    """
    if (not all(math.isfinite(z) for z in (z_min,z_max))
            or z_max<=z_min):
        raise ValueError("Garment world-space vertical bounds must be finite and increasing.")
    zones={"lower":[],"middle":[],"upper":[]}
    span=z_max-z_min
    for row in samples:
        if row is None:
            continue
        height=row.get("centroidZ")
        if not isinstance(height,(float,int)) or not math.isfinite(height):
            raise ValueError("UV zone samples require finite world-height centroids.")
        relative=(height-z_min)/span
        if relative < -0.0001 or relative > 1.0001:
            raise ValueError("UV sample lies outside measured garment height bounds.")
        zone="lower" if relative < 1/3 else "middle" if relative < 2/3 else "upper"
        zones[zone].append(row)
    return {
        "kind":"evaluated_mesh_local_uv_geometry_unapproved",
        "zones":{name:summarise_uv_fabric_axes(rows)
                 for name,rows in zones.items()},
        "supplierRepeatVerified":False,
    }


def vertical_uv_zone_drift(source,candidate,tolerance_pct=8):
    """Keep bad vertical local UV drift visible even when global medians pass."""
    if source.get("kind")!="evaluated_mesh_local_uv_geometry_unapproved" or candidate.get("kind")!="evaluated_mesh_local_uv_geometry_unapproved":
        raise ValueError("Zone comparison must use real evaluated geometry observations.")
    drift={}
    for zone in ("lower","middle","upper"):
        drift[zone]=axis_drift_against_authored(
            source["zones"][zone],candidate["zones"][zone],tolerance_pct)
    return {
        "zones":drift,
        "anyZoneNeedsInvestigation":any(row["needsDetailedFabricRepeatInvestigation"] for row in drift.values()),
        "supplierRepeatVerified":False,
    }


def paired_spatial_uv_drift(source_samples,candidate_samples,max_distance_mm=70):
    """Compare true source/candidate UV derivatives at nearby WORLD positions.

    Mesh decimation changes triangle tessellation: independent 600-triangle
    medians can show drift only from sampling different garment locations.
    This diagnostic pairs actual sampled triangle centroids in metres, then
    measures U/V drift and unpaired coverage. Nearest centroids can cross folds,
    so even passing metrics CANNOT certify woven fabric or 3D drape.
    """
    if not isinstance(max_distance_mm,(float,int)) or not math.isfinite(max_distance_mm) or not 0<max_distance_mm<=150:
        raise ValueError("Finite maximum pairing distance must be within (0,150] mm.")
    source=[row for row in source_samples if row and row.get("centroidXYZ")]
    candidate=[row for row in candidate_samples if row and row.get("centroidXYZ")]
    def valid(row):
        p=row.get("centroidXYZ")
        return (isinstance(p,(list,tuple)) and len(p)==3
                and all(isinstance(z,(float,int)) and math.isfinite(z) for z in p)
                and all(isinstance(row.get(k),(int,float)) and math.isfinite(row[k]) and row[k]>0
                        for k in ("uMm","vMm")))
    if any(not valid(row) for row in source+candidate):
        raise ValueError("Spatial UV matching requires finite real centroids and axis metrics.")
    distances=[]
    paired=[]
    max_distance_sq=(max_distance_mm/1000)**2
    for src in source:
        nearest=min(candidate,key=lambda dst:sum(
            (src["centroidXYZ"][i]-dst["centroidXYZ"][i])**2 for i in range(3)
        ),default=None)
        if nearest is None:
            continue
        distance_sq=sum((src["centroidXYZ"][i]-nearest["centroidXYZ"][i])**2 for i in range(3))
        if distance_sq>max_distance_sq:
            continue
        distances.append(math.sqrt(distance_sq)*1000)
        paired.append({
            "uErrorPct":abs(nearest["uMm"]/src["uMm"]-1)*100,
            "vErrorPct":abs(nearest["vMm"]/src["vMm"]-1)*100,
            "worldAreaMm2":src.get("worldAreaMm2",0),
        })
    count=len(paired)
    coverage=count/len(source) if source else 0
    median_u=_quantile([row["uErrorPct"] for row in paired],.5)
    median_v=_quantile([row["vErrorPct"] for row in paired],.5)
    weighted_u=_area_weighted_quantile(paired,"uErrorPct",.5)
    weighted_v=_area_weighted_quantile(paired,"vErrorPct",.5)
    values=(median_u,median_v,weighted_u,weighted_v)
    return {
        "method":"spatially_paired_evaluated_triangle_centroids_diagnostic",
        "sourceSampleCount":len(source),
        "candidateSampleCount":len(candidate),
        "matchedSourceCount":count,
        "matchedSourcePct":round(coverage*100,3),
        "matchingDistanceLimitMm":max_distance_mm,
        "medianMatchDistanceMm":_quantile(distances,.5),
        "medianUErrorPct":median_u,
        "medianVErrorPct":median_v,
        "areaWeightedMedianUErrorPct":weighted_u,
        "areaWeightedMedianVErrorPct":weighted_v,
        "needsDetailedFabricRepeatInvestigation":coverage<.85 or
            any(v is None or v>8 for v in values),
        "verifiedPhysicalRepeatWithinTolerance":False,
    }
