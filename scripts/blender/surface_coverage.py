"""Pure geometry safeguards for collision-fitting sparse garment shells.

This module is Blender-independent so its measurements can be regression tested
without a native Blender installation. Units are metres throughout.
"""

from __future__ import annotations
import math


def vertical_subdivision_cuts(span_m, max_vertical_step_m=0.055, max_cuts=8):
    """Number of interior vertices required along a long garment edge.

    A six-ring trouser/shirt shell can cross a curved calf or chest between its
    ring vertices even when every original vertex is outside the locked body.
    """
    if (
        isinstance(span_m, bool) or not isinstance(span_m, (int, float))
        or not math.isfinite(span_m) or span_m < 0
        or isinstance(max_vertical_step_m, bool)
        or not isinstance(max_vertical_step_m, (int, float))
        or not math.isfinite(max_vertical_step_m) or max_vertical_step_m <= 0
        or isinstance(max_cuts, bool) or not isinstance(max_cuts, int)
        or not 1 <= max_cuts <= 32
    ):
        raise ValueError("Garment surface refinement needs finite physical edge lengths and positive limits.")
    required = max(0, math.ceil(span_m / max_vertical_step_m) - 1)
    if required > max_cuts:
        raise ValueError("Garment shell has a span too long for bounded collision refinement.")
    return required


def penetrating_surface_samples(vertices, faces, inside, max_hits=32):
    """Return actual non-vertex penetration probes, capped for diagnostics.

    Checks each face centroid and each unique edge midpoint. A shell can have
    all its vertices outside the body but still intersect the torso between
    sparse garment rings. Do not certify coverage from vertices alone.
    """
    if not callable(inside) or not isinstance(max_hits, int) or not 1 <= max_hits <= 1024:
        raise ValueError("Collision sample predicate and diagnostic cap are required.")
    points = list(vertices)
    for point in points:
        if len(point) != 3 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in point):
            raise ValueError("Collision samples require finite 3D vertices.")
    hits = []
    seen_edges = set()
    for face_index, face in enumerate(faces):
        indices = tuple(face)
        if len(indices) < 3 or any(not isinstance(i, int) or i < 0 or i >= len(points) for i in indices):
            raise ValueError("Collision samples require valid polygon indices.")
        centre = tuple(sum(points[i][axis] for i in indices) / len(indices) for axis in range(3))
        if inside(centre):
            hits.append({"face": face_index, "location": "centroid", "point": centre})
            if len(hits) >= max_hits:
                return hits
        for a, b in zip(indices, indices[1:] + indices[:1]):
            edge = tuple(sorted((a, b)))
            if edge in seen_edges:
                continue
            seen_edges.add(edge)
            midpoint = tuple((points[a][axis] + points[b][axis]) / 2 for axis in range(3))
            if inside(midpoint):
                hits.append({"face": face_index, "location": "edge-midpoint", "point": midpoint})
                if len(hits) >= max_hits:
                    return hits
    return hits
