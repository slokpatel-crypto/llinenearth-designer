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



def metric_tangent_chart_uv(points_xyz):
    """Local metric face chart for geometry crossing a cylindrical-axis seam.

    The UV distances use orthonormal surface tangent axes in METRES, avoiding
    near-axis angular singularities and compressed XZ planar fallback. This
    intentionally creates a separate unapproved chart island: joining its
    stripes/grain to surrounding tubular faces requires actual seam authoring
    and review. It never certifies supplier scale, grain or production.
    """
    if len(points_xyz) < 3:
        raise ValueError("Metric tangent chart requires at least three vertices")
    values = []
    for p in points_xyz:
        if len(p) != 3:
            raise ValueError("Metric tangent chart needs XYZ coordinates")
        values.extend(p)
    if any(isinstance(v, (bool, str, bytes)) or not isinstance(v, (int, float))
           or not math.isfinite(v) for v in values):
        raise ValueError("Metric tangent chart needs finite mesh coordinates")
    # Newell's polygon normal accommodates source quads and avoids choosing
    # the first three almost-collinear vertices.
    nx = ny = nz = 0.0
    for a, b in zip(points_xyz, points_xyz[1:] + points_xyz[:1]):
        nx += (a[1] - b[1]) * (a[2] + b[2])
        ny += (a[2] - b[2]) * (a[0] + b[0])
        nz += (a[0] - b[0]) * (a[1] + b[1])
    length = math.sqrt(nx*nx + ny*ny + nz*nz)
    if length < 1e-10:
        raise ValueError("Metric tangent chart rejects degenerate source face")
    normal = (nx/length, ny/length, nz/length)
    # Keep grain V aligned with garment vertical wherever geometrically
    # possible. Horizontal cap faces have no meaningful vertical tangent;
    # there choose the face's longest physical edge and retain review flag.
    up_projection = (-normal[0]*normal[2], -normal[1]*normal[2],
                     1-normal[2]*normal[2])
    v_norm = math.sqrt(sum(t*t for t in up_projection))
    if v_norm < 1e-5:
        edges = [tuple(b[k]-a[k] for k in range(3))
                 for a, b in zip(points_xyz, points_xyz[1:] + points_xyz[:1])]
        chosen = max(edges, key=lambda edge: sum(t*t for t in edge))
        v_norm = math.sqrt(sum(t*t for t in chosen))
        if v_norm < 1e-10:
            raise ValueError("Metric tangent chart has no nonzero edge")
        v_axis = tuple(t/v_norm for t in chosen)
    else:
        v_axis = tuple(t/v_norm for t in up_projection)
    # u = v cross n produces a true orthogonal unit tangent basis; no scale
    # normalization by panel dimensions or silently inferred fabric repeat.
    u_axis = (v_axis[1]*normal[2]-v_axis[2]*normal[1],
              v_axis[2]*normal[0]-v_axis[0]*normal[2],
              v_axis[0]*normal[1]-v_axis[1]*normal[0])
    origin = points_xyz[0]
    return [
        (sum((p[k]-origin[k])*u_axis[k] for k in range(3)),
         sum((p[k]-origin[k])*v_axis[k] for k in range(3)))
        for p in points_xyz
    ]



def audit_shared_uv_edges(faces, *, tolerance_m=1e-5, sample_limit=12):
    """Audit UV continuity across ACTUALLY shared source-mesh polygon edges.

    Faces are ordered polygons of (vertex_id, (u, v)) corners. Coordinates are
    mesh metres; a local face chart starting at the origin is not stitched.
    Intentionally cut seams still need separate approval and fabric evidence.
    """
    from collections import defaultdict

    if (isinstance(tolerance_m, (str, bytes, bool))
            or not isinstance(tolerance_m, (float, int))
            or not math.isfinite(tolerance_m) or tolerance_m <= 0):
        raise ValueError("UV seam tolerance must be finite and positive")
    if isinstance(sample_limit, bool) or not isinstance(sample_limit, int) or sample_limit < 0:
        raise ValueError("UV seam sample limit must be a nonnegative integer")
    edges = defaultdict(list)
    polygon_count = 0
    for face_index, face in enumerate(faces):
        polygon_count += 1
        if len(face) < 3:
            raise ValueError("UV seam audit requires polygon faces of >=3 corners")
        corners = []
        for corner in face:
            if len(corner) != 2:
                raise ValueError("Each UV face corner needs a vertex id and UV pair")
            vertex, uv = corner
            if isinstance(vertex, bool) or not isinstance(vertex, int) or vertex < 0:
                raise ValueError("UV seam audit requires nonnegative integer vertex ids")
            if len(uv) != 2 or any(
                isinstance(n, (str, bytes, bool)) or not isinstance(n, (float, int))
                or not math.isfinite(n) for n in uv
            ):
                raise ValueError("UV seam audit requires finite metre UVs")
            corners.append((vertex, (float(uv[0]), float(uv[1]))))
        if len({vertex for vertex, _ in corners}) != len(corners):
            raise ValueError("UV seam audit rejects repeated polygon corner vertices")
        for a, b in zip(corners, corners[1:] + corners[:1]):
            vertex_a, uv_a = a
            vertex_b, uv_b = b
            key = (min(vertex_a, vertex_b), max(vertex_a, vertex_b))
            # Compare shared edges by SOURCE vertex, not by opposite loop order.
            edges[key].append((face_index, {vertex_a: uv_a, vertex_b: uv_b}))

    if not polygon_count:
        raise ValueError("UV seam audit cannot certify an empty mesh")
    shared = nonmanifold = boundary = unapproved = 0
    max_jump_m = 0.0
    sample = []
    for edge, entries in edges.items():
        if len(entries) == 1:
            boundary += 1
        elif len(entries) > 2:
            nonmanifold += 1
        else:
            shared += 1
            first, second = entries
            jump_m = max(
                math.dist(first[1][vertex], second[1][vertex]) for vertex in edge
            )
            max_jump_m = max(max_jump_m, jump_m)
            if jump_m > tolerance_m:
                unapproved += 1
                if len(sample) < sample_limit:
                    sample.append({
                        "sourceEdgeVertices": list(edge),
                        "sourcePolygonIndices": [first[0], second[0]],
                        "maxUvEndpointJumpMm": round(jump_m * 1000, 5),
                    })
    return {
        "polygonCount": polygon_count,
        "sharedInteriorEdges": shared,
        "boundaryEdges": boundary,
        "nonManifoldEdges": nonmanifold,
        "unapprovedInteriorUvSeams": unapproved,
        "maxInteriorUvJumpMm": round(max_jump_m * 1000, 5),
        "sampleUnapprovedSeams": sample,
        "topologicalUvContinuityPass": unapproved == 0 and nonmanifold == 0,
        "supplierRepeatVerified": False,
        "supplierGrainVerified": False,
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
