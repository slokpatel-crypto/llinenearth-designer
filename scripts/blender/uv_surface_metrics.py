"""Geometry-to-UV density observations for the UNAPPROVED mobile garment LOD.

These calculations quantify UV interpolation stretch on rendered triangles.
They do NOT validate supplier repeat_mm, textile grain, drape, or studio parity.
No Blender dependency: deterministic numerical fixtures can test the formula.
"""
import math


def triangle_world_mm_per_uv_unit(points, uvs):
    """Return sqrt(world triangle area / UV triangle area) in mm per UV unit.

    A physical (nondegenerate) triangle with collapsed UVs returns infinity
    instead of silently accepting a lost fabric repeat. A degenerate world
    triangle is not an informative sample and returns None.
    """
    if len(points) != 3 or len(uvs) != 3:
        raise ValueError("A triangle requires three world and three UV points.")
    if any(len(p) != 3 for p in points) or any(len(uv) != 2 for uv in uvs):
        raise ValueError("Triangle coordinate dimensions do not match.")
    if not all(math.isfinite(v) for p in (*points, *uvs) for v in p):
        raise ValueError("UV measurement requires finite coordinates.")

    p0,p1,p2=points
    a=[p1[i]-p0[i] for i in range(3)]
    b=[p2[i]-p0[i] for i in range(3)]
    cross=(
        a[1]*b[2]-a[2]*b[1],
        a[2]*b[0]-a[0]*b[2],
        a[0]*b[1]-a[1]*b[0],
    )
    twice_area_world=math.sqrt(sum(v*v for v in cross))
    if twice_area_world<=1e-14:
        return None
    uv0,uv1,uv2=uvs
    twice_area_uv=abs(
        (uv1[0]-uv0[0])*(uv2[1]-uv0[1])-
        (uv2[0]-uv0[0])*(uv1[1]-uv0[1])
    )
    if twice_area_uv<=1e-14:
        return math.inf
    return math.sqrt(twice_area_world/twice_area_uv)*1000


def uv_density_summary(samples):
    """Report only measured geometry, never a physical textile certification."""
    vals=list(samples)
    valid=sorted(v for v in vals if v is not None and math.isfinite(v) and v>0)
    invalid=sum(v is not None and not math.isfinite(v) for v in vals)
    if any(v is not None and (math.isnan(v) or v<=0) for v in vals):
        raise ValueError("Invalid density sample.")
    def pick(fraction):
        return round(valid[min(len(valid)-1,int(fraction*(len(valid)-1)))],4) if valid else None
    return {
        "sampledTriangles":len(vals),
        "validUvTriangles":len(valid),
        "collapsedUvTriangles":invalid,
        "degenerateWorldTriangles":sum(v is None for v in vals),
        "p10WorldMmPerUvUnit":pick(0.10),
        "medianWorldMmPerUvUnit":pick(0.50),
        "p90WorldMmPerUvUnit":pick(0.90),
        "supplierPhysicalRepeatVerified":False,
    }
