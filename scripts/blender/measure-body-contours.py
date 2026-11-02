"""Measured world-space body cross-sections for garment source diagnostics.

Separate disconnected horizontal silhouette contours (central torso vs arms).
Do not use the union width of all scan intersections as a torso measurement.
This is observational only; never deforms the source model or relaxes QA gates.
"""
from __future__ import annotations

from collections import defaultdict
import math

import bpy


def measured_plane_components(obj, z_world, quantization_m=0.0001):
    if (
        obj is None or obj.type != "MESH" or
        not isinstance(z_world, (int, float)) or not math.isfinite(z_world) or
        not 0 < quantization_m <= 0.001
    ):
        raise ValueError("Valid mesh, finite horizontal guide and sub-mm quantization are required.")
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    links = defaultdict(set)
    nodes = {}
    try:
        mesh.calc_loop_triangles()
        matrix = evaluated.matrix_world
        world = [matrix @ vertex.co for vertex in mesh.vertices]
        eps = 1e-9
        for tri in mesh.loop_triangles:
            corners = [world[index] for index in tri.vertices]
            if any(not all(math.isfinite(v) for v in point) for point in corners):
                raise ValueError("Nonfinite source body mesh cannot establish garment contour.")
            crossings = []
            for i, j in ((0, 1), (1, 2), (2, 0)):
                a, b = corners[i], corners[j]
                da, db = a.z-z_world, b.z-z_world
                if abs(da)<=eps and abs(db)<=eps:
                    # Coplanar face has no unique crossing segment.
                    continue
                if abs(da)<=eps:
                    crossing = (a.x,a.y)
                elif abs(db)<=eps:
                    crossing = (b.x,b.y)
                elif da*db<0:
                    t=da/(da-db)
                    crossing=(a.x+t*(b.x-a.x),a.y+t*(b.y-a.y))
                else:
                    continue
                key=(round(crossing[0]/quantization_m),round(crossing[1]/quantization_m))
                nodes.setdefault(key,crossing)
                if key not in crossings:
                    crossings.append(key)
            if len(crossings)==2 and crossings[0]!=crossings[1]:
                left,right=crossings
                links[left].add(right)
                links[right].add(left)
        seen=set()
        components=[]
        for first in links:
            if first in seen:
                continue
            pending=[first]
            seen.add(first)
            found=[]
            edges=0
            while pending:
                node=pending.pop()
                found.append(nodes[node])
                edges+=len(links[node])
                for other in links[node]:
                    if other not in seen:
                        seen.add(other)
                        pending.append(other)
            if len(found)<3:
                continue
            xs=[xy[0] for xy in found]
            ys=[xy[1] for xy in found]
            width=max(xs)-min(xs)
            if width<=0.001:
                continue
            components.append({
                "minX":min(xs), "maxX":max(xs),
                "centerX":(min(xs)+max(xs))*0.5,
                "centerY":sum(ys)/len(ys),
                "widthMm":round(width*1000,2),
                "segmentCount":edges//2,
            })
        return sorted(components,key=lambda value:value["segmentCount"],reverse=True)
    finally:
        evaluated.to_mesh_clear()


def central_torso_component(components, source_center_x):
    if not components or not math.isfinite(source_center_x):
        raise RuntimeError("No finite measured source body contour for photographic fit.")
    intersecting=[
        component for component in components
        if component["minX"]<=source_center_x<=component["maxX"]
    ]
    if not intersecting:
        raise RuntimeError("No source body contour spans the central torso line.")
    # Prefer the principal central loop, not a tiny interior detail.
    return max(intersecting,key=lambda c:(c["segmentCount"],c["widthMm"]))
