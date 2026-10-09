"""Geometry-only UV charts for physically flat garment terminal caps.

Blender's default x/z projection is valid for upright shirt/trouser walls but
COLLAPSES an actual horizontal collar/end-cap triangle: all its vertices share
world height z, so UV-v becomes constant despite positive 3D area. Map only
these true horizontal top/bottom cap polygons in x/y instead. This preserves
all six original vertical cloth charts and does not certify pattern repeat.
"""
import math


def terminal_cap_uses_flat_uv(vertices, normal, lower_z, upper_z,
                              normal_threshold=.75, terminal_band_m=.012):
    if not vertices or any(len(v)!=3 for v in vertices) or len(normal)!=3:
        raise ValueError("Need actual 3D polygon and 3D normal.")
    if not all(math.isfinite(value) for v in (*vertices,normal) for value in v):
        raise ValueError("Nonfinite cap coordinates.")
    if abs(normal[2])<normal_threshold:
        return False
    heights=[v[2] for v in vertices]
    # Reject steep near-collar cloth walls and cap-like interior topology.
    if max(heights)-min(heights)>terminal_band_m:
        return False
    return (all(abs(v-upper_z)<=terminal_band_m for v in heights)
            or all(abs(v-lower_z)<=terminal_band_m for v in heights))


def fabric_planar_uv(vertex, mins, spans, use_horizontal_cap=False):
    if len(vertex)!=3 or len(mins)!=3 or len(spans)!=3:
        raise ValueError("3D coordinates required")
    if not all(math.isfinite(value) for obj in (vertex,mins,spans) for value in obj):
        raise ValueError("Nonfinite geometry coordinates")
    if any(value<=0 for value in spans):
        raise ValueError("Nonpositive UV chart extent")
    # Upright fabric projects x/z; true 3D horizontal surface x/y.
    u=(vertex[0]-mins[0])/spans[0]
    v=(vertex[1]-mins[1])/spans[1] if use_horizontal_cap else (vertex[2]-mins[2])/spans[2]
    return (u,v)
