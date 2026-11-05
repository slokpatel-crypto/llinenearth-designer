"""Bounded original-source UV triangle-interior overlap evidence: RESEARCH ONLY.

This examines genuine 2D research face UV loops. It does NOT alter source
geometry, synthesize a textile pattern, estimate cloth size, or approve
fabric grain, continuous UV stitching, collision, tailoring or export.
A capped search reports a LOWER BOUND and must never claim overlap absence.
"""
from __future__ import annotations

from collections import defaultdict
import math


def _cross(a, b, c):
    return ((b[0] - a[0]) * (c[1] - a[1])
            - (b[1] - a[1]) * (c[0] - a[0]))


def _intersection_area(a, b):
    """Positive area shared by two oriented 2D metric triangles, in m^2."""
    polygon = list(a)
    for i in range(3):
        x, y = b[i], b[(i + 1) % 3]
        if not polygon:
            break
        clipped = []
        for k in range(len(polygon)):
            current = polygon[k]
            previous = polygon[k - 1]
            curr_cross = _cross(x, y, current)
            prev_cross = _cross(x, y, previous)
            current_inside = curr_cross >= -1e-12
            previous_inside = prev_cross >= -1e-12
            if current_inside != previous_inside:
                denominator = prev_cross - curr_cross
                if abs(denominator) <= 1e-20:
                    raise ValueError("Original UV overlap clipping is numerically ambiguous.")
                fraction = prev_cross / denominator
                clipped.append((
                    previous[0] + (current[0] - previous[0]) * fraction,
                    previous[1] + (current[1] - previous[1]) * fraction,
                ))
            if current_inside:
                clipped.append(current)
        polygon = clipped
    if len(polygon) < 3:
        return 0.0
    area = abs(sum(
        polygon[i][0] * polygon[(i + 1) % len(polygon)][1]
        - polygon[(i + 1) % len(polygon)][0] * polygon[i][1]
        for i in range(len(polygon))
    )) / 2.0
    if not math.isfinite(area):
        raise ValueError("Native research UV overlap contains nonfinite area.")
    return area


def audit_original_source_uv_triangle_overlaps(
        original_faces, face_uv_loops, max_pair_tests=100000):
    """Observe strict interior intersections without fabric/manufacturing claims.

    The broadphase is a deterministic 100mm UV grid. Stops at a validated
    narrowphase budget; any observed pair count is then a lower bound only.
    """
    if len(original_faces) != 2650 or len(face_uv_loops) != 2650:
        raise ValueError("Require all 2650 original trouser-source UV quads.")
    if type(max_pair_tests) is not int or not 1 <= max_pair_tests <= 250000:
        raise ValueError("Bounded original source overlap search requires 1..250000 tests.")

    cell = 0.1  # numerical broadphase only, NOT textile repeat or seam allowance
    buckets = defaultdict(list)
    triangles = []
    seen_pairs = set()
    overlapping = 0
    overlap_witnesses = []
    overlapped_faces = set()
    tested_pairs = 0
    broadphase_candidates = 0
    sampled_area_mm2 = 0.0
    largest_mm2 = 0.0
    truncated = False

    for face_id, (face, raw_uv) in enumerate(zip(original_faces, face_uv_loops)):
        face = tuple(face)
        if (len(face) != 4 or len(set(face)) != 4
                or any(type(index) is not int or index < 0 for index in face)):
            raise ValueError("Invalid genuine original-source face indices for UV audit.")
        row = []
        if len(raw_uv) != 4:
            raise ValueError("Original source UV face does not have four loops.")
        for p in raw_uv:
            if (len(p) != 2 or any(
                isinstance(x, bool) or not isinstance(x, (float, int))
                or not math.isfinite(x) for x in p
            )):
                raise ValueError("Missing, fabricated or nonfinite original-source UV point.")
            row.append((float(p[0]), float(p[1])))
        for triangle_id, corners in enumerate(((0, 1, 2), (0, 2, 3))):
            tri = tuple(row[i] for i in corners)
            signed_area = _cross(*tri)
            if not math.isfinite(signed_area) or signed_area <= 1e-14:
                raise ValueError("Original source UV triangle is inverted or degenerate.")
            lowx = min(p[0] for p in tri)
            highx = max(p[0] for p in tri)
            lowy = min(p[1] for p in tri)
            highy = max(p[1] for p in tri)
            ix0, ix1 = math.floor(lowx / cell), math.floor(highx / cell)
            iy0, iy1 = math.floor(lowy / cell), math.floor(highy / cell)
            if (ix1 - ix0 + 1) * (iy1 - iy0 + 1) > 4096:
                raise ValueError("Original-source UV triangle span exceeds safe grid budget.")
            triangle_number = len(triangles)
            triangles.append((face_id, triangle_id, tri, (lowx, highx, lowy, highy)))
            possible = set()
            for ix in range(ix0, ix1 + 1):
                for iy in range(iy0, iy1 + 1):
                    possible.update(buckets[(ix, iy)])
            for previous_id in sorted(possible):
                previous_face, _, previous_tri, old_bounds = triangles[previous_id]
                if previous_face == face_id:
                    continue
                key = (previous_id, triangle_number)
                if key in seen_pairs:
                    continue
                seen_pairs.add(key)
                if (highx <= old_bounds[0] or lowx >= old_bounds[1]
                        or highy <= old_bounds[2] or lowy >= old_bounds[3]):
                    continue
                if tested_pairs == max_pair_tests:
                    truncated = True
                    break
                tested_pairs += 1
                broadphase_candidates += 1
                area = _intersection_area(previous_tri, tri)
                if area > 1e-12:
                    area_mm2 = area * 1e6
                    overlapping += 1
                    overlapped_faces.add(tuple(sorted((previous_face, face_id))))
                    sampled_area_mm2 += area_mm2
                    if area_mm2 > largest_mm2:
                        largest_mm2 = area_mm2
                    if len(overlap_witnesses) < 12:
                        overlap_witnesses.append({
                            "originalSourceFaceIds": [previous_face, face_id],
                            "sourceFaceTriangleIds": [
                                triangles[previous_id][1], triangle_id,
                            ],
                            "actualUvInteriorOverlapAreaMm2": round(area_mm2, 7),
                        })
            if truncated:
                break
            for ix in range(ix0, ix1 + 1):
                for iy in range(iy0, iy1 + 1):
                    buckets[(ix, iy)].append(triangle_number)
        if truncated:
            break

    if not truncated and len(triangles) != 5300:
        raise ValueError("Research UV overlap scan did not consume 5300 source triangles.")
    return {
        "researchOnly": True,
        "expectedOriginalSourceQuadCount": 2650,
        "expectedTriangleCount": 5300,
        "actualTrianglesInspected": len(triangles),
        "narrowphaseTrianglePairCheckCap": max_pair_tests,
        "narrowphaseTrianglePairsChecked": tested_pairs,
        "observedInteriorOverlapTrianglePairsLowerBound": overlapping,
        "observedDistinctSourceFacePairsLowerBound": len(overlapped_faces),
        "observedTriangleOverlapAreaSumLowerBoundMm2": round(sampled_area_mm2, 5),
        "largestObservedTriangleInteriorOverlapAreaMm2": round(largest_mm2, 5),
        "firstSourceFaceTriangleOverlapWitnesses": overlap_witnesses,
        "auditTruncated": truncated,
        "canClaimNoInteriorOverlapInThisUvLayout": not truncated and overlapping == 0,
        "originalProductionSourceUvApproved": False,
        "completeGarmentUvOverlapFreeApproved": False,
        "realTailorCuttingApproved": False,
        "physicalSourceFitApproved": False,
        "physicalFabricRepeatVerified": False,
        "productionApproved": False,
        "metricCaveat": (
            "Only 2D original-source UV triangle interiors are tested; "
            "overlap area sum can double count many stacked triangles. "
            "A capped search reports LOWER BOUNDS, never zero-overlap proof. "
            "No sewn closure, fabric grain, textile repeat or fit signoff."
        ),
    }
