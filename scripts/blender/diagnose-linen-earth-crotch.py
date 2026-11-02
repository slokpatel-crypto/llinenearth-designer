# Read-only native Blender cross-section evidence for rejected six-piece candidate.
"""Localize actual leg/leg collisions without moving, repairing or approving cloth."""
from __future__ import annotations

import argparse
from collections import Counter
import json
import math
from pathlib import Path
import statistics
import sys

import bpy
from mathutils.bvhtree import BVHTree

IDENTITY = "linen-earth-studio-model-v1"
EPSILON = 0.0005
COLLECTION = "LinenEarthExport"
LEFT = "TrouserLegLFabric"
RIGHT = "TrouserLegRFabric"


def world_geometry(obj):
    if obj is None or obj.type != "MESH":
        raise RuntimeError("Crotch diagnosis requires a genuine Blender mesh.")
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        points = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
        faces = [tuple(face.vertices) for face in mesh.polygons]
        if not points or not faces or not mesh.loop_triangles:
            raise RuntimeError("Cannot diagnose missing or empty native surface geometry.")
        if any(not all(math.isfinite(v) for v in p) for p in points):
            raise RuntimeError("A garment or body has nonfinite world coordinates.")
        areas = [0.0 for face in faces]
        for triangle in mesh.loop_triangles:
            a, b, c = [points[i] for i in triangle.vertices]
            value = (b - a).cross(c - a).length * 0.5
            if not math.isfinite(value):
                raise RuntimeError("Contacting face area cannot be measured.")
            areas[triangle.polygon_index] += value
        if min(areas) < 0 or sum(areas) <= 0:
            raise RuntimeError("Invalid physical surface area in real mesh.")
        return {"points": points, "polygons": faces, "areas": areas}
    finally:
        evaluated.to_mesh_clear()


def real_tree(geometry):
    tree = BVHTree.FromPolygons(
        geometry["points"], geometry["polygons"],
        all_triangles=False, epsilon=EPSILON,
    )
    if tree is None:
        raise RuntimeError("Unable to construct actual world-space polygon BVH.")
    return tree


def center(geometry, index):
    vertices = [geometry["points"][i] for i in geometry["polygons"][index]]
    return sum(vertices, vertices[0].copy() * 0) / len(vertices)


def plane_span(geometry, z):
    """Return x/y projections of actual evaluated polygon/plane intersections.

    An overlapping projection is NOT by itself proof of a 3D intersection.
    """
    xs, ys = [], []
    for face in geometry["polygons"]:
        for start, end in zip(face, face[1:] + face[:1]):
            a, b = geometry["points"][start], geometry["points"][end]
            dz = b.z - a.z
            if abs(dz) < 1e-9:
                if abs(a.z - z) <= 1e-9:
                    xs.extend((a.x, b.x))
                    ys.extend((a.y, b.y))
                continue
            weight = (z - a.z) / dz
            if -1e-8 <= weight <= 1 + 1e-8:
                weight = max(0.0, min(1.0, weight))
                xs.append(a.x + weight * (b.x - a.x))
                ys.append(a.y + weight * (b.y - a.y))
    if len(xs) < 2 or len(ys) < 2:
        return None
    return {
        "xMinMm": round(min(xs) * 1000, 3),
        "xMaxMm": round(max(xs) * 1000, 3),
        "yMinMm": round(min(ys) * 1000, 3),
        "yMaxMm": round(max(ys) * 1000, 3),
        "planeEdgeSamples": len(xs),
    }


def quantile(values, p):
    ordered = sorted(values)
    return ordered[round((len(ordered) - 1) * p)]


def cross_section(left, right, body, z):
    l, r, b = (plane_span(g, z) for g in (left, right, body))
    projected_overlap = None
    if l is not None and r is not None:
        projected_overlap = max(
            0.0, min(l["xMaxMm"], r["xMaxMm"]) - max(l["xMinMm"], r["xMinMm"])
        )
    return {
        "zMm": round(z * 1000, 3),
        "leftLeg": l, "rightLeg": r, "body": b,
        "projectedXOverlapMmNot3DCollision": (
            round(projected_overlap, 3) if projected_overlap is not None else None
        ),
    }


def edge_topology(geometry, contact_faces):
    edges = Counter()
    owners = {}
    for index, face in enumerate(geometry["polygons"]):
        for start, end in zip(face, face[1:] + face[:1]):
            key = tuple(sorted((start, end)))
            edges[key] += 1
            owners.setdefault(key, set()).add(index)
    open_edges = [key for key, n in edges.items() if n == 1]
    return {
        "allOpenBoundaryEdges": len(open_edges),
        "contactingOpenBoundaryEdges": sum(
            bool(owners[key] & contact_faces) for key in open_edges
        ),
        "nonManifoldEdges": sum(n > 2 for n in edges.values()),
    }


def analyze(body, left, right):
    source, l, r = world_geometry(body), world_geometry(left), world_geometry(right)
    pairs = real_tree(l).overlap(real_tree(r))
    left_indices = {a for a, _ in pairs}
    right_indices = {b for _, b in pairs}
    if any(a < 0 or a >= len(l["polygons"]) or b < 0 or b >= len(r["polygons"])
           for a, b in pairs):
        raise RuntimeError("Native BVH referenced invalid evaluated mesh faces.")
    contact_centers = [
        (center(l, a) + center(r, b)) / 2.0 for a, b in pairs
    ]
    source_low = min(p.z for p in source["points"])
    source_high = max(p.z for p in source["points"])
    source_height = source_high - source_low
    if not math.isfinite(source_height) or source_height <= 0.1:
        raise RuntimeError("Actual scan body has no plausible vertical height.")
    octiles = [0] * 8
    for point in contact_centers:
        band = max(0, min(7, math.floor((point.z - source_low) / source_height * 8)))
        octiles[band] += 1
    if sum(octiles) != len(pairs):
        raise RuntimeError("Crotch contact histogram lost measured BVH pairs.")
    body_tree = real_tree(source)
    body_separations = []
    for geom, indices in ((l, left_indices), (r, right_indices)):
        used = {i for face in indices for i in geom["polygons"][face]}
        for index in used:
            location, _normal, _face, distance = body_tree.find_nearest(geom["points"][index])
            if location is None or distance is None or not math.isfinite(distance):
                raise RuntimeError("Cannot measure true nearest body distance at crotch.")
            body_separations.append(distance * 1000)
    cross_sections = [
        cross_section(l, r, source, quantile([p.z for p in contact_centers], q))
        for q in (0.1, 0.25, 0.5, 0.75, 0.9)
    ] if contact_centers else []
    touching_left = sum(l["areas"][i] for i in left_indices)
    touching_right = sum(r["areas"][i] for i in right_indices)
    measured = {
        "legLegPolygonContactPairs": len(pairs),
        "contactPairsByBodyHeightOctile": octiles,
        "contactingLeftLegFaceCount": len(left_indices),
        "contactingRightLegFaceCount": len(right_indices),
        "contactingLeftLegFaceAreaMm2": round(touching_left * 1e6, 3),
        "contactingRightLegFaceAreaMm2": round(touching_right * 1e6, 3),
        "contactFractionLeftLeg": round(touching_left / sum(l["areas"]), 7),
        "contactFractionRightLeg": round(touching_right / sum(r["areas"]), 7),
        "leftLegOpenEdges": edge_topology(l, left_indices),
        "rightLegOpenEdges": edge_topology(r, right_indices),
        "bodyDistanceAtContactVerticesMm": ({
            "minimum": round(min(body_separations), 3),
            "median": round(statistics.median(body_separations), 3),
            "maximum": round(max(body_separations), 3),
            "count": len(body_separations),
        } if body_separations else None),
        "worldContactBoundsMm": ({
            axis: [round(min(getattr(p, axis) for p in contact_centers) * 1000, 3),
                   round(max(getattr(p, axis) for p in contact_centers) * 1000, 3)]
            for axis in ("x", "y", "z")
        } if contact_centers else None),
        "actualContactZCrossSections": cross_sections,
    }
    return measured


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    options = parser.parse_args(args)
    scene = bpy.context.scene
    if (scene.get("linen_earth_model_identity_id") != IDENTITY
            or scene.get("linen_earth_model_identity_locked") is not True):
        raise RuntimeError("Original photo identity was not locked in source.")
    export = bpy.data.collections.get(COLLECTION)
    if export is None:
        raise RuntimeError("Missing actual real candidate garment collection.")
    body = bpy.data.objects.get("Body")
    measurements = analyze(body, export.objects.get(LEFT), export.objects.get(RIGHT))
    report = {
        "version": "titan-real-crotch-cross-sections-v1",
        "modelIdentityId": IDENTITY,
        "candidateOnly": True,
        "productionApproved": False,
        "physicalFitApproved": False,
        "collisionMethod": "Real evaluated world-space polygon BVH (0.5mm epsilon); measured independent native geometry.",
        "crossSectionCaveat": "Plane x/y projections and participating face area are diagnostics, not true 3D penetration volume or fit approval.",
        "measurements": measurements,
    }
    options.output.parent.mkdir(parents=True, exist_ok=True)
    options.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print("TITAN_REAL_CROTCH_CROSS_SECTIONS_RECORDED " + json.dumps({
        "legLegContactPairs": measurements["legLegPolygonContactPairs"],
        "contactBodyOctiles": measurements["contactPairsByBodyHeightOctile"],
        "contactingLeftFaceAreaMm2": measurements["contactingLeftLegFaceAreaMm2"],
        "contactingRightFaceAreaMm2": measurements["contactingRightLegFaceAreaMm2"],
        "contactWorldBoundsMm": measurements["worldContactBoundsMm"],
    }))


if __name__ == "__main__":
    main()
