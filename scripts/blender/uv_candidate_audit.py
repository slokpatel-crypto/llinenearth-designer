"""Candidate-only UV topology diagnostics; no supplier repeat is inferred.

Evaluate UV triangle area against 3D surface area. A pass means a finite,
noncollapsed candidate map, NOT physically calibrated textile scale.
"""
from __future__ import annotations

import math


def audit_uv_triangles(triangles, *, min_uv_area=1e-12, min_surface_area_m2=1e-12):
    """Triangles: iterable of (three XYZ triples, three UV pairs). Fail closed."""
    if not (math.isfinite(min_uv_area) and min_uv_area > 0
            and math.isfinite(min_surface_area_m2) and min_surface_area_m2 > 0):
        raise ValueError("Area thresholds must be finite and positive")
    total = collapsed = degenerate = 0
    densities = []
    for xyz, uv in triangles:
        if len(xyz) != 3 or len(uv) != 3 or any(len(v) != 3 for v in xyz) or any(len(v) != 2 for v in uv):
            raise ValueError("Expected three XYZ and three UV points per triangle")
        flat = [float(v) for point in (*xyz, *uv) for v in point]
        if not all(math.isfinite(v) for v in flat):
            raise ValueError("UV audit cannot accept nonfinite coordinates")
        total += 1
        a, b, c = xyz
        ab = [b[i] - a[i] for i in range(3)]
        ac = [c[i] - a[i] for i in range(3)]
        cross = (ab[1]*ac[2] - ab[2]*ac[1], ab[2]*ac[0] - ab[0]*ac[2], ab[0]*ac[1] - ab[1]*ac[0])
        surface_area = 0.5 * math.sqrt(sum(v*v for v in cross))
        if surface_area <= min_surface_area_m2:
            degenerate += 1
            continue
        u0, u1, u2 = uv
        uv_area = 0.5 * abs((u1[0]-u0[0])*(u2[1]-u0[1]) - (u2[0]-u0[0])*(u1[1]-u0[1]))
        if uv_area <= min_uv_area:
            collapsed += 1
            continue
        densities.append(uv_area / surface_area)
    if not total:
        raise ValueError("No evaluated UV triangles; candidate must fail closed")
    densities.sort()
    median = densities[len(densities)//2] if densities else None
    return {
        "triangleCount": total,
        "collapsedUvTriangles": collapsed,
        "degenerateSurfaceTriangles": degenerate,
        "noncollapsedTriangleCount": len(densities),
        "medianUvAreaPerSquareMetre": median,
        "candidateUvTopologyPass": collapsed == 0 and degenerate == 0,
        "physicalFabricRepeatVerified": False,
        "supplierGrainVerified": False,
        "productionApproved": False,
    }
