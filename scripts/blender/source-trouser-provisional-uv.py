"""Deterministic *provisional* UV survey of the REAL source trouser faces.

Converts the original 2,650 source-face topology to a common cylindrical
display coordinate, without mutating original meshes. This is NOT geometric
unwrapping, measured textile repeat, manufacturing scale or tailor approval.
Quantifies actual display distortion and discontinuity instead.
"""
from __future__ import annotations

from collections import defaultdict
import math


def study_original_source_trouser_uv(points, faces, source_cut_edges):
    """Return (UV per original face loop, fail-closed physical provenance report)."""
    if len(faces) != 2650 or not points or len(source_cut_edges) != 8:
        raise ValueError("UV survey must use exactly the actual original source topology.")
    xyz = []
    for p in points:
        v = tuple(float(c) for c in p)
        if len(v) != 3 or not all(math.isfinite(a) for a in v):
            raise ValueError("Actual original trouser source vertex is not finite 3D.")
        xyz.append(v)
    cx = (min(p[0] for p in xyz) + max(p[0] for p in xyz)) / 2.0
    cy = (min(p[1] for p in xyz) + max(p[1] for p in xyz)) / 2.0
    zmin = min(p[2] for p in xyz)
    radius = sum(math.hypot(p[0] - cx, p[1] - cy) for p in xyz) / len(xyz)
    if not math.isfinite(radius) or radius <= 0.001:
        raise ValueError("Original source leg cannot support deterministic cylinder UV survey.")
    angles = [math.atan2(y - cy, x - cx) for x, y, _z in xyz]
    uv_faces = []
    edge_owners = defaultdict(list)
    max_edge_error = 0.0
    sum_squared_error = 0.0
    measured_edges = 0
    collapsed_display_faces = 0
    max_area_ratio = 0.0
    min_area_ratio = math.inf
    expected_loops = 0
    for face_id, original_face in enumerate(faces):
        face = tuple(int(i) for i in original_face)
        if (len(face) < 3 or len(set(face)) != len(face)
                or min(face) < 0 or max(face) >= len(xyz)):
            raise ValueError("An original trouser face has invalid actual source indices.")
        anchor = angles[face[0]]
        uv = []
        for i in face:
            unwrapped = angles[i]
            while unwrapped - anchor > math.pi:
                unwrapped -= 2.0 * math.pi
            while unwrapped - anchor < -math.pi:
                unwrapped += 2.0 * math.pi
            uv.append((radius * unwrapped, xyz[i][2] - zmin))
        uv_faces.append(uv)
        expected_loops += len(face)
        area_2d = 0.0
        area_3d = 0.0
        for j in range(1, len(face) - 1):
            a, b, c = (xyz[face[k]] for k in (0, j, j + 1))
            ab = tuple(b[k] - a[k] for k in range(3))
            ac = tuple(c[k] - a[k] for k in range(3))
            cross = (
                ab[1]*ac[2] - ab[2]*ac[1],
                ab[2]*ac[0] - ab[0]*ac[2],
                ab[0]*ac[1] - ab[1]*ac[0],
            )
            area_3d += math.sqrt(sum(value*value for value in cross)) / 2.0
            p, q, r = (uv[k] for k in (0, j, j + 1))
            area_2d += abs(
                (q[0]-p[0]) * (r[1]-p[1]) -
                (q[1]-p[1]) * (r[0]-p[0])
            ) / 2.0
        if not math.isfinite(area_3d) or area_3d <= 1e-12:
            raise ValueError("Original real source face has no finite positive surface area.")
        ratio = area_2d / area_3d
        if not math.isfinite(ratio) or ratio < 0:
            raise ValueError("Source display UV face has no finite area ratio.")
        if area_2d <= 1e-12:
            collapsed_display_faces += 1
        min_area_ratio = min(min_area_ratio, ratio)
        max_area_ratio = max(max_area_ratio, ratio)
        for j in range(len(face)):
            a, b = face[j], face[(j + 1) % len(face)]
            ua, ub = uv[j], uv[(j + 1) % len(face)]
            edge = (min(a, b), max(a, b))
            owner_points = (ua, ub) if (a, b) == edge else (ub, ua)
            edge_owners[edge].append((face_id, owner_points))
            length_3d = math.dist(xyz[a], xyz[b])
            length_uv = math.dist(ua, ub)
            error_mm = abs(length_3d - length_uv) * 1000.0
            if not math.isfinite(error_mm):
                raise ValueError("Real source UV stretch evidence is nonfinite.")
            max_edge_error = max(max_edge_error, error_mm)
            sum_squared_error += error_mm * error_mm
            measured_edges += 1
    if any(len(owners) > 2 for owners in edge_owners.values()):
        raise ValueError("Provisional original source UV has nonmanifold edges.")
    shared_edges = 0
    continuous_shared_edges = 0
    discontinuous_edges = 0
    max_uv_seam_gap_mm = 0.0
    for owners in edge_owners.values():
        if len(owners) != 2:
            continue
        shared_edges += 1
        (_, (a0, b0)), (_, (a1, b1)) = owners
        worst = max(math.dist(a0, a1), math.dist(b0, b1)) * 1000.0
        if not math.isfinite(worst):
            raise ValueError("Source UV chart seam distance is not finite.")
        max_uv_seam_gap_mm = max(max_uv_seam_gap_mm, worst)
        if worst <= 0.001:
            continuous_shared_edges += 1
        else:
            discontinuous_edges += 1

    unique_cuts = {tuple(sorted(edge)) for edge in source_cut_edges}
    if len(unique_cuts) != 8 or any(
        len(edge) != 2 or edge[0] == edge[1] or edge not in edge_owners
        or len(edge_owners[edge]) != 1 for edge in unique_cuts
    ):
        raise ValueError("Actual original unmatched cut edge cannot be claimed as UV source.")
    cut_rows = []
    for edge in sorted(unique_cuts):
        face_id, (u0, u1) = edge_owners[edge][0]
        uv_length_mm = math.dist(u0, u1) * 1000.0
        real_length_mm = math.dist(xyz[edge[0]], xyz[edge[1]]) * 1000.0
        cut_rows.append({
            "originalSourceCutEdgeIndices": list(edge),
            "actualOriginalOwningFace": face_id,
            "realOriginalSourceEdgeLengthMm": round(real_length_mm, 5),
            "provisionalUVEdgeLengthMm": round(uv_length_mm, 5),
            "geometricDisplayEdgeLengthErrorMm": round(abs(real_length_mm - uv_length_mm), 5),
            "physicalFabricScaleApproved": False,
        })
    return {
        "face_uv_loops": uv_faces,
        "report": {
            "researchOnly": True,
            "actualOriginalSourceFaceCount": len(faces),
            "actualOriginalSourceVertexCount": len(xyz),
            "provisionalUvLoopCount": expected_loops,
            "uniqueSourceEdgeCount": len(edge_owners),
            "openSourceEdgeCount": sum(len(a) == 1 for a in edge_owners.values()),
            "originalCutEdgeCount": len(cut_rows),
            "actualOriginalCutEdgeUvEvidence": cut_rows,
            "sharedOriginalSourceEdgeCount": shared_edges,
            "displayUvContinuousSharedEdges": continuous_shared_edges,
            "displayUvDiscontinuousSharedEdges": discontinuous_edges,
            "maxDisplayUvSeamGapMm": round(max_uv_seam_gap_mm, 5),
            "provisionalUvCollapsedFaceCount": collapsed_display_faces,
            "minimumDisplayUvToOriginalFaceAreaRatio": round(min_area_ratio, 8),
            "maximumDisplayUvToOriginalFaceAreaRatio": round(max_area_ratio, 8),
            "maximumDisplayUvEdgeStretchErrorMm": round(max_edge_error, 5),
            "rmsDisplayUvEdgeStretchErrorMm": round(
                math.sqrt(sum_squared_error / measured_edges), 5
            ),
            "displayProjection": "shared original-scanned-source cylindrical geometry; not garment unwrap",
            "displayCoordinatesIn": "Blender metre-derived units, not certified fabric calibration",
            "projectionRadiusGeometryMetres": round(radius, 7),
            "originalSourcePanelUVApproved": False,
            "sourceToBridgeUVContinuityVerified": False,
            "textureGrainDirectionVerified": False,
            "fabricGsmOrCompositionVerified": False,
            "measuredSupplierFabricRepeatMm": None,
            "physicalTextileScaleVerified": False,
            "sewnGarmentApproved": False,
            "productionApproved": False,
        },
    }
