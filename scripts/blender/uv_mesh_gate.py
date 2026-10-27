"""Blender-independent UV integrity metrics for the locked Linen Earth 3D preflight.

This negative geometry gate does not prove physical grain calibration, seam
approval, textile drape, or photographic parity. UV seams on shared mesh edges
are flagged rather than silently accepted.
"""

from __future__ import annotations

import math
from collections import defaultdict


def inspect_uv_polygons(polygons, *, tolerance=1e-5, minimum_area=1e-12):
    """Inspect faces of (mesh vertex index, (u, v)) loop records.

    Shared mesh edges must have matching UV coordinates at both endpoints.
    Geometrically coincident edges with distinct vertex IDs are not covered
    and still require native mesh/visual seam review.
    """
    if not math.isfinite(tolerance) or tolerance < 0:
        raise ValueError("UV continuity tolerance must be finite and nonnegative")
    if not math.isfinite(minimum_area) or minimum_area < 0:
        raise ValueError("Minimum UV area must be finite and nonnegative")

    edges = defaultdict(list)
    invalid_faces = 0
    nonfinite_faces = 0
    collapsed_faces = 0
    count = 0
    for face in polygons:
        count += 1
        if len(face) < 3:
            invalid_faces += 1
            continue
        try:
            indices = [record[0] for record in face]
            points = [tuple(record[1]) for record in face]
            indices_valid = all(type(index) is int and index >= 0 for index in indices)
            uv_shapes_valid = all(len(uv) == 2 and all(type(value) in (int, float) for value in uv) for uv in points)
        except (TypeError, ValueError, IndexError):
            invalid_faces += 1
            continue
        if not indices_valid or len(set(indices)) != len(indices) or not uv_shapes_valid:
            invalid_faces += 1
            continue
        if not all(math.isfinite(value) for uv in points for value in uv):
            nonfinite_faces += 1
            continue
        area_twice = sum(
            points[i][0] * points[(i + 1) % len(points)][1]
            - points[(i + 1) % len(points)][0] * points[i][1]
            for i in range(len(points))
        )
        if not math.isfinite(area_twice):
            nonfinite_faces += 1
            continue
        if abs(area_twice) <= 2 * minimum_area:
            collapsed_faces += 1
        for i, first in enumerate(indices):
            next_i = (i + 1) % len(indices)
            second = indices[next_i]
            key = (min(first, second), max(first, second))
            edge_uvs = (points[i], points[next_i]) if first < second else (points[next_i], points[i])
            edges[key].append(edge_uvs)

    shared = 0
    discontinuous = 0
    nonmanifold = 0
    max_delta = 0.0
    for uses in edges.values():
        if len(uses) < 2:
            continue
        shared += 1
        if len(uses) > 2:
            nonmanifold += 1
        baseline = uses[0]
        edge_delta = max(
            max(abs(a[k] - b[k]) for k in range(2))
            for current in uses[1:]
            for a, b in zip(baseline, current)
        )
        if not math.isfinite(edge_delta):
            nonfinite_faces += 1
        else:
            max_delta = max(max_delta, edge_delta)
            if edge_delta > tolerance:
                discontinuous += 1
    return {
        "faceCount": count,
        "invalidUvFaces": invalid_faces,
        "nonfiniteUvFaces": nonfinite_faces,
        "collapsedUvFaces": collapsed_faces,
        "sharedUvEdges": shared,
        "discontinuousSharedUvEdges": discontinuous,
        "nonmanifoldUvEdges": nonmanifold,
        "maxSharedUvDelta": round(max_delta, 8),
    }
