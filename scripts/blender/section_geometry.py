"""Pure world-space mesh cross-sections for Blender garment identity QA.

A horizontal section must be measured through mesh triangles, not approximated
by nearby vertices: sparse tailoring rings often have no vertices at the guide.
"""


def triangle_section_x_span(triangles, plane_z, epsilon=1e-8):
    """Return (min_x, max_x) where world-space triangles intersect z=plane_z.

    Input triangles contain three (x, y, z) points in metres. Missing or
    degenerate intersections return None, never an invented zero-width pass.
    """
    import math

    if not isinstance(plane_z, (int, float)) or not math.isfinite(plane_z):
        return None
    xs = []
    for triangle in triangles:
        points = tuple(triangle)
        if len(points) != 3:
            continue
        if not all(
            len(point) >= 3 and all(math.isfinite(value) for value in point[:3])
            for point in points
        ):
            continue
        for point in points:
            if abs(point[2] - plane_z) <= epsilon:
                xs.append(point[0])
        for first, second in ((0, 1), (1, 2), (2, 0)):
            a, b = points[first], points[second]
            dz = b[2] - a[2]
            if abs(dz) <= epsilon:
                continue
            t = (plane_z - a[2]) / dz
            if epsilon < t < 1.0 - epsilon:
                xs.append(a[0] + t * (b[0] - a[0]))
    if len(xs) < 2:
        return None
    lo, hi = min(xs), max(xs)
    return (lo, hi) if hi - lo > epsilon else None
