"""Candidate-only UV topology diagnostics; no supplier repeat is inferred.

Evaluate UV triangle area against 3D surface area. A pass means a finite,
noncollapsed candidate map, NOT physically calibrated textile scale.
"""
from __future__ import annotations

import math


def metric_planar_uv(point_xyz, *, origin_x, origin_z):
    """Return geometry-only X/Z UV in mesh metres, not per-panel 0..1.

    Not a calibration for grain, real fabric repeat, curved cylinders or hems.
    """
    if len(point_xyz) != 3:
        raise ValueError("Expected one 3D garment vertex")
    if any(isinstance(value, (str, bytes, bool)) or not isinstance(value, (int, float))
           or not math.isfinite(value)
           for value in (*point_xyz, origin_x, origin_z)):
        raise ValueError("Metric UV projection needs finite numeric coordinates")
    return (point_xyz[0] - origin_x, point_xyz[2] - origin_z)


def cylindrical_metric_face_uv(points_xyz, *, center_xy, radius_m, origin_z):
    """Geometry-estimated circumferential U / vertical V for ONE mesh face.

    Unwrap +/-pi at the face seam using per-loop UVs. The reference radius is
    obtained from the authored shell geometry, NOT supplier fabric dimensions.
    A face spanning over half a revolution is ambiguous and must fail closed.
    """
    if len(points_xyz) < 3 or len(center_xy) != 2:
        raise ValueError("Expected at least three XYZ vertices and XY centre")
    values = [*center_xy, radius_m, origin_z]
    for point in points_xyz:
        if len(point) != 3:
            raise ValueError("Cylindrical UV requires full 3D vertex coordinates")
        values.extend(point)
    if any(isinstance(v, (str, bytes, bool)) or not isinstance(v, (int, float))
           or not math.isfinite(v) for v in values):
        raise ValueError("Cylindrical UV requires finite numeric metric coordinates")
    if radius_m <= 1e-5:
        raise ValueError("Degenerate cylindrical UV geometry radius")

    cx, cy = center_xy
    angles = [math.atan2(point[1] - cy, point[0] - cx) for point in points_xyz]
    initial_angle = angles[0]
    unwrapped = [initial_angle] + [
        initial_angle + math.atan2(math.sin(a - initial_angle),
                                   math.cos(a - initial_angle))
        for a in angles[1:]
    ]
    if max(unwrapped) - min(unwrapped) >= math.pi:
        raise ValueError("Candidate UV polygon crosses an ambiguous half-cylinder seam")
    return [(radius_m * angle, point[2] - origin_z)
            for angle, point in zip(unwrapped, points_xyz)]



def cylindrical_ambiguous_face_diagnostic(points_xyz, *, center_xy):
    """Describe rejected UV face geometry without inventing a cloth seam.

    The result describes real mesh-space XYZ bounds and the estimated
    cylindrical angle span. It is not an unwrap, grain alignment, supplier
    measurement, photo certificate or reason to bypass a failed preflight.
    """
    if len(points_xyz) < 3 or len(center_xy) != 2:
        raise ValueError("Ambiguous face receipt requires >=3 XYZ vertices and XY centre")
    values = [*center_xy]
    for p in points_xyz:
        if len(p) != 3:
            raise ValueError("Ambiguous face receipt requires 3D coordinates")
        values.extend(p)
    if any(isinstance(v, (str, bytes, bool)) or not isinstance(v, (int, float))
           or not math.isfinite(v) for v in values):
        raise ValueError("Ambiguous face receipt requires finite metric coordinates")
    cx, cy = center_xy
    angles = [math.atan2(p[1] - cy, p[0] - cx) for p in points_xyz]
    initial = angles[0]
    unwrapped = [initial] + [
        initial + math.atan2(math.sin(a - initial), math.cos(a - initial))
        for a in angles[1:]
    ]
    return {
        "vertexCount": len(points_xyz),
        "angularSpanDegrees": round(math.degrees(max(unwrapped) - min(unwrapped)), 2),
        "xRangeMetres": [round(min(p[0] for p in points_xyz), 5),
                         round(max(p[0] for p in points_xyz), 5)],
        "yRangeMetres": [round(min(p[1] for p in points_xyz), 5),
                         round(max(p[1] for p in points_xyz), 5)],
        "zRangeMetres": [round(min(p[2] for p in points_xyz), 5),
                         round(max(p[2] for p in points_xyz), 5)],
        "supplierRepeatVerified": False,
        "fabricGrainVerified": False,
        "productionApproved": False,
    }


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
    # Relative area-scale variance can flag inconsistent pattern density even
    # without supplier repeat measurements. Do not treat it as calibrated mm.
    relative_deviation = (
        sorted(abs(value - median) / median for value in densities)
        if median and median > 0 else []
    )
    p95_deviation = (
        relative_deviation[min(len(relative_deviation)-1, math.ceil(.95 * len(relative_deviation))-1)]
        if relative_deviation else None
    )
    return {
        "triangleCount": total,
        "collapsedUvTriangles": collapsed,
        "degenerateSurfaceTriangles": degenerate,
        "noncollapsedTriangleCount": len(densities),
        "medianUvAreaPerSquareMetre": median,
        "p95RelativeUvDensityDeviation": p95_deviation,
        "candidateUvTopologyPass": collapsed == 0 and degenerate == 0,
        "physicalFabricRepeatVerified": False,
        "supplierGrainVerified": False,
        "productionApproved": False,
    }
