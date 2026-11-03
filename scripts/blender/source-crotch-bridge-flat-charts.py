"""True 3D-edge-length-preserving 2D unfold of six source bridge triangles.

The values are mathematical 2D triangle geometry in millimetres, NOT an
approved cloth pattern, supplier repeat, grain, UV for the original trouser
source, seam allowance or finished fit.
"""
import math


def _xy_cross(a, b, c):
    return ((b[0] - a[0]) * (c[1] - a[1])
            - (b[1] - a[1]) * (c[0] - a[0]))


def _distance_3d_mm(points, a, b):
    pa = tuple(float(v) for v in points[a])
    pb = tuple(float(v) for v in points[b])
    if (len(pa) != 3 or len(pb) != 3 or
            not all(math.isfinite(v) for v in pa + pb)):
        raise ValueError("No finite original 3D vertex for source flat-chart.")
    dist = math.dist(pa, pb) * 1000.0
    if not math.isfinite(dist) or dist <= 1e-6:
        raise ValueError("Real source cut/bridge edge is zero length.")
    return dist


def _circle_point(origin, other, dist_origin, dist_other, sign):
    dx, dy = other[0] - origin[0], other[1] - origin[1]
    base = math.hypot(dx, dy)
    if base <= 1e-6:
        raise ValueError("Connected original triangle shared edge collapsed.")
    x = (dist_origin ** 2 - dist_other ** 2 + base ** 2) / (2 * base)
    h2 = dist_origin ** 2 - x ** 2
    if h2 <= 1e-8:
        raise ValueError("Original real bridge triangle cannot unfold without zero area.")
    h = math.sqrt(h2) * sign
    return (origin[0] + x * dx / base - h * dy / base,
            origin[1] + x * dy / base + h * dx / base)


def flatten_original_bridge_charts(points, oriented_faces, actual_pairs):
    """One chart per actual original two-edge bridge (one or two triangles).

    Every face is physically 3D-indexed, every 2D triangle edge matches the
    actual Blender mesh Euclidean edge to <=0.001 mm. There are 4 charts and
    6 triangles. No connected original trouser-source UV claims are possible.
    """
    faces = [tuple(int(v) for v in f) for f in oriented_faces]
    if len(faces) != 6 or len(actual_pairs) != 4:
        raise ValueError("Expected exactly six original bridge triangles in four actual pairs.")
    if any(len(face) != 3 or len(set(face)) != 3
           or min(face) < 0 or max(face) >= len(points) for face in faces):
        raise ValueError("Original sewn research bridge has invalid face indices.")

    charts = []
    offset = 0
    for pair_index, pair in enumerate(actual_pairs):
        n_faces = pair["bridgeTriangles"]
        if n_faces not in (1, 2) or offset + n_faces > len(faces):
            raise ValueError("Genuine source segment no longer maps to 1-2 triangles.")
        indices = list(range(offset, offset + n_faces))
        span = faces[offset:offset + n_faces]
        offset += n_faces
        a, b, c = span[0]
        length_ab = _distance_3d_mm(points, a, b)
        length_ac = _distance_3d_mm(points, a, c)
        length_bc = _distance_3d_mm(points, b, c)
        xy = {
            a: (0.0, 0.0),
            b: (length_ab, 0.0),
            c: _circle_point((0.0, 0.0), (length_ab, 0.0),
                             length_ac, length_bc, +1),
        }
        if n_faces == 2:
            f1 = set(span[0])
            f2 = set(span[1])
            edge = sorted(f1.intersection(f2))
            novel = list(f2 - f1)
            if len(edge) != 2 or len(novel) != 1:
                raise ValueError("Actual original bridge pair does not share precisely one edge.")
            u, v = edge
            w = novel[0]
            old = next(vertex for vertex in span[0] if vertex not in edge)
            cross = _xy_cross(xy[u], xy[v], xy[old])
            if abs(cross) <= 1e-8:
                raise ValueError("Real original bridge triangles share a collinear seam.")
            xy[w] = _circle_point(
                xy[u], xy[v],
                _distance_3d_mm(points, u, w),
                _distance_3d_mm(points, v, w),
                -1 if cross > 0 else 1,
            )
        measured = []
        signed_areas = []
        for face_index, face in zip(indices, span):
            x, y, z = (xy[vertex] for vertex in face)
            area = _xy_cross(x, y, z) / 2.0
            if not math.isfinite(area) or abs(area) <= 1e-5:
                raise ValueError("Genuine source bridge has invalid UV unfold area.")
            signed_areas.append(area)
            for left, right in ((face[0], face[1]),
                                (face[1], face[2]),
                                (face[2], face[0])):
                flat_mm = math.dist(xy[left], xy[right])
                real_mm = _distance_3d_mm(points, left, right)
                mismatch_mm = abs(flat_mm - real_mm)
                if not math.isfinite(mismatch_mm) or mismatch_mm > 0.001:
                    raise ValueError("Real source triangle edge changed length in UV flattening.")
                measured.append(mismatch_mm)
        if n_faces == 2 and signed_areas[0] * signed_areas[1] <= 0:
            raise ValueError("Research bridge winding is not consistent with flat chart.")
        min_x = min(x for x, _ in xy.values())
        min_y = min(y for _, y in xy.values())
        output_xy = {
            str(vertex): [round(x - min_x, 6), round(y - min_y, 6)]
            for vertex, (x, y) in xy.items()
        }
        # The actual original two source edges must appear on the local strip.
        left, right = tuple(pair["leftEdge"]), tuple(pair["rightEdge"])
        if len(left) != 2 or len(right) != 2 or len(set(left + right)) < 3:
            raise ValueError("Original cut edge pair no longer has valid endpoints.")
        if not set(left + right).issubset(xy):
            raise ValueError("Original cut edge does not belong to geometric bridge flattening.")
        l_len = _distance_3d_mm(points, *left)
        r_len = _distance_3d_mm(points, *right)
        charts.append({
            "actualSourceSegmentIndex": pair_index,
            "actualBridgeFaceIndices": indices,
            "triangleCount": n_faces,
            "originalCutEdgeLeft": list(left),
            "originalCutEdgeRight": list(right),
            "originalCutEdgeLeftLengthMm": round(l_len, 5),
            "originalCutEdgeRightLengthMm": round(r_len, 5),
            "actualCutEdgeLengthMismatchMm": round(abs(l_len-r_len), 5),
            "flatChartLocalVertexCoordsMm": output_xy,
            "signedFlatTriangleAreasMm2": [round(x, 5) for x in signed_areas],
            "maxActualBridgeEdgeLengthErrorMm": round(max(measured), 8),
            "flattenedSurfaceAreaMm2": round(sum(abs(v) for v in signed_areas), 5),
            "flatChartWidthMm": round(max(x for x, y in output_xy.values()), 5),
            "flatChartHeightMm": round(max(y for x, y in output_xy.values()), 5),
            "sourceTrouserLegUVContinuityVerified": False,
            "supplierFabricRepeatVerified": False,
            "tailorSeamAllowanceApproved": False,
            "productionApproved": False,
        })
    if offset != len(faces) or sum(c["triangleCount"] for c in charts) != 6:
        raise ValueError("Did not unfold all six real research bridge triangles.")
    return {
        "researchOnly": True,
        "sourceGeometryCoordinateUnit": "Blender metres",
        "flattenedChartGeometryUnit": "mm from original Blender source triangle lengths",
        "chartCount": len(charts),
        "triangleCount": len(faces),
        "charts": charts,
        "flattenedBridgeHasEdgeLengthAccuracyToOneMicrometre": True,
        "originalSourceTrouserUVPresent": False,
        "originalSourceUVContinuityProven": False,
        "supplierFabricRepeatVerified": False,
        "measuredTextileScaleProven": False,
        "sewnGarmentApproved": False,
        "productionApproved": False,
        "metricCaveat": (
            "2D geometric triangle unfolding does not establish physical sewn "
            "cloth, required seam allowances, texture scale/repeat, original "
            "trouser-source UV charts, body clearance, panel grain or tailor fit."
        ),
    }
