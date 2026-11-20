"""Blender-native CC0 source-face ownership and true garment contact evidence.

Run on each ORIGINAL-body candidate scene; compare default and explicitly
experimental authoring separately. The research partition can leave armhole
gaps and DOES NOT prove a finished sewn joint or photographic fit.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import statistics
import sys
from pathlib import Path

import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
source = root / "scripts/blender/preflight-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("titan_preflight_armhole_research", source)
assert spec is not None and spec.loader is not None
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)


def args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--expect-mode", choices=("baseline", "disjoint"), required=True)
    return parser.parse_args(argv)


def actual_guide_z(name):
    guides = bpy.data.collections.get("LinenEarthIdentityGuides")
    guide = guides.objects.get(name) if guides else None
    if guide is None or guide.type != "CURVE":
        raise RuntimeError(f"Original photographic guide missing: {name}")
    points = [guide.matrix_world @ Vector(p.co[:3]) for s in guide.data.splines for p in s.points]
    if len(points) < 2 or not all(math.isfinite(p.z) for p in points):
        raise RuntimeError(f"Unmeasurable locked photographic guide: {name}")
    return sum(p.z for p in points) / len(points)


def physical_body_fingerprint(body):
    data = [
        [round(float(c), 9) for c in (body.matrix_world @ vertex.co)]
        for vertex in body.data.vertices
    ]
    faces = [list(poly.vertices) for poly in body.data.polygons]
    return hashlib.sha256(json.dumps([data, faces], separators=(",", ":")).encode()).hexdigest()



def source_cut_edge_keys(mesh, polygon_ids):
    """Edges used by one selected source face (not a sewn boundary claim)."""
    incidence = {}
    for face_id in polygon_ids:
        polygon = mesh.polygons[face_id]
        vertices = tuple(int(i) for i in polygon.vertices)
        if len(vertices) < 3:
            raise RuntimeError("Selected CC0 source polygon has fewer than three vertices")
        for index, first in enumerate(vertices):
            second = vertices[(index + 1) % len(vertices)]
            if first == second:
                raise RuntimeError("Degenerate cut-edge topology in original source")
            key = tuple(sorted((first, second)))
            incidence[key] = incidence.get(key, 0) + 1
    if any(count > 2 for count in incidence.values()):
        raise RuntimeError("Nonmanifold original CC0 source face selection")
    return {key for key, count in incidence.items() if count == 1}


def actual_armhole_edge_metrics(body, torso_faces, sleeve_faces, side, cx, zmin, height):
    """Original topology + measured source edge separation at sleeve/torso cut.

    This is BEFORE shrinkwrap/solidify. A zero source edge distance never
    proves the evaluated garment cloth has a watertight sewn seam.
    """
    if side not in ("L", "R"):
        raise RuntimeError("Invalid real armhole side")
    mesh = body.data
    torso_edges = source_cut_edge_keys(mesh, torso_faces)
    sleeve_edges = source_cut_edge_keys(mesh, sleeve_faces)
    world_points = {
        vertex.index: body.matrix_world @ vertex.co for vertex in mesh.vertices
    }
    for point in world_points.values():
        if not all(math.isfinite(float(axis)) for axis in point):
            raise RuntimeError("Nonfinite original source vertex")

    cut_z_low = zmin + 0.500 * height
    cut_z_high = zmin + 0.875 * height
    # The source selectors cut at |x| = 245mm. The search window is derived
    # from their original 90mm duplicated band (245mm - 155mm), not an
    # invented tailor seam allowance or fabric measurement.
    near_x = 0.245
    half_window = 0.090
    def select_interface_edges(edges):
        result = {}
        for edge in edges:
            mid = (world_points[edge[0]] + world_points[edge[1]]) * 0.5
            lateral = mid.x - cx
            side_ok = lateral < 0 if side == "L" else lateral > 0
            if (side_ok and cut_z_low <= mid.z <= cut_z_high
                    and abs(abs(lateral) - near_x) <= half_window):
                result[edge] = mid
        return result

    torso_near = select_interface_edges(torso_edges)
    sleeve_near = select_interface_edges(sleeve_edges)
    if not torso_near or not sleeve_near:
        raise RuntimeError("No true source cut edges in original armhole search band")

    all_nearest = []
    for point in torso_near.values():
        distance = min((point - other).length for other in sleeve_near.values())
        if not math.isfinite(distance):
            raise RuntimeError("Invalid original armhole edge proximity")
        all_nearest.append(distance * 1000.0)
    all_nearest.sort()
    p90 = all_nearest[max(0, math.ceil(0.9 * len(all_nearest)) - 1)]
    shared = torso_near.keys() & sleeve_near.keys()
    return {
        "sourceTorsoCutEdges": len(torso_edges),
        "sourceSleeveCutEdges": len(sleeve_edges),
        "nearInterfaceTorsoEdges": len(torso_near),
        "nearInterfaceSleeveEdges": len(sleeve_near),
        "identicalSourceInterfaceEdges": len(shared),
        "torsoToNearestSleeveCutMidpointMm": {
            "min": round(all_nearest[0], 3),
            "median": round(statistics.median(all_nearest), 3),
            "p90": round(p90, 3),
            "max": round(all_nearest[-1], 3),
        },
        "torsoCutMidpointsWithin5mm": sum(v <= 5 for v in all_nearest),
        "sewnSeamApproved": False,
        "clothGapClosedVerified": False,
        "seamMetricScope": "original body-source cut edges before modifiers; not a cloth fit result",
    }

def report(expect):
    scene = bpy.context.scene
    if (scene.get("linen_earth_model_identity_id") != "linen-earth-studio-model-v1"
        or scene.get("linen_earth_model_reference_image") != "/designer/studio-tucked.webp"
        or scene.get("linen_earth_model_identity_locked") is not True):
        raise RuntimeError("Actual locked source model identity required for this test")
    is_trial = scene.get("linen_earth_research_disjoint_armholes") is True
    if is_trial != (expect == "disjoint"):
        raise RuntimeError("Experimental source ownership flag does not match actual scene")
    body = bpy.data.objects.get("Body")
    if body is None or body.type != "MESH" or len(body.data.polygons) <= 0:
        raise RuntimeError("Actual pinned source body geometry missing")
    vertices = [body.matrix_world @ Vector(corner) for corner in body.bound_box]
    zmin = min(p.z for p in vertices)
    height = max(p.z for p in vertices) - zmin
    cx = (min(p.x for p in vertices) + max(p.x for p in vertices)) / 2
    if abs(height - 1.727) > 0.020:
        raise RuntimeError("A non-original physical body height was supplied")
    shz = actual_guide_z("LE_GUIDE_SHIRT_WAIST")
    trz = actual_guide_z("LE_GUIDE_TROUSER_WAIST")
    hem = min(shz, trz) - 0.030
    z = lambda fraction: zmin + height * fraction
    torso_faces = set()
    left_faces = set()
    right_faces = set()
    sleeve_root = 0.245 if is_trial else 0.155
    for polygon in body.data.polygons:
        point = body.matrix_world @ polygon.center
        if hem <= point.z <= z(0.895) and abs(point.x-cx) <= 0.245:
            torso_faces.add(polygon.index)
        if z(0.500) <= point.z <= z(0.875):
            if point.x - cx < -sleeve_root:
                left_faces.add(polygon.index)
            if point.x - cx > sleeve_root:
                right_faces.add(polygon.index)
    torso_overlap_left = len(torso_faces & left_faces)
    torso_overlap_right = len(torso_faces & right_faces)
    if is_trial and (torso_overlap_left or torso_overlap_right):
        raise RuntimeError("Experimental source partitions share original body faces")
    if not all(len(v) >= 4 for v in (torso_faces, left_faces, right_faces)):
        raise RuntimeError("Experiment left one of the actual garments empty")

    armhole_edges = {
        "L": actual_armhole_edge_metrics(body, torso_faces, left_faces, "L", cx, zmin, height),
        "R": actual_armhole_edge_metrics(body, torso_faces, right_faces, "R", cx, zmin, height),
    }

    contact = {}
    for left, right in [
        ("ShirtTorsoFabric", "ShirtSleeveLFabric"),
        ("ShirtTorsoFabric", "ShirtSleeveRFabric"),
        ("ShirtSleeveLFabric", "TrouserLegLFabric"),
        ("ShirtSleeveRFabric", "TrouserLegRFabric"),
        ("ShirtSleeveLFabric", "ShirtSleeveRFabric"),
    ]:
        count = preflight.intersection_pair_count(
            bpy.data.objects.get(left), bpy.data.objects.get(right)
        )
        if type(count) is not int or count < 0:
            raise RuntimeError(f"Actual evaluated world BVH contact unknown for {left}::{right}")
        contact[f"{left}::{right}"] = count
    return {
        "version": "titan-cc0-original-face-ownership-trial-v1",
        "modelIdentityId": "linen-earth-studio-model-v1",
        "referenceImage": "/designer/studio-tucked.webp",
        "candidateOnly": True,
        "productionApproved": False,
        "measuredFabricDrapeApproved": False,
        "tailorApproved": False,
        "armholeSeamsApproved": False,
        "sourceBodySha256": physical_body_fingerprint(body),
        "sourceFaceSelection": {
            "torso": len(torso_faces),
            "sleeveL": len(left_faces),
            "sleeveR": len(right_faces),
            "duplicatedOriginalTorsoSleeveFacesL": torso_overlap_left,
            "duplicatedOriginalTorsoSleeveFacesR": torso_overlap_right,
        },
        "garmentContactPairs": contact,
        "originalSourceArmholeCutEdges": armhole_edges,
        "experimentalDisjointArmholes": is_trial,
        "caveat": "Actual world BVH contacts and selected source face ownership, not sewn armhole fit",
    }


def main():
    options = args()
    source = Path(bpy.data.filepath)
    if not source.is_file() or source.suffix.lower() != ".blend":
        raise RuntimeError("Run on actual saved pinned-CC0 source candidate .blend")
    data = report(options.expect_mode)
    options.output.parent.mkdir(parents=True, exist_ok=True)
    options.output.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print("TITAN_EXPERIMENTAL_SOURCE_ARMHOLE_FACE_OWNERSHIP_MEASURED_NOT_APPROVED", json.dumps({
        "sourceBodySha256": data["sourceBodySha256"],
        "faceOwnership": data["sourceFaceSelection"],
        "realBVH": data["garmentContactPairs"],
        "originalSourceArmholeCutEdges": data["originalSourceArmholeCutEdges"],
        "experimental": data["experimentalDisjointArmholes"],
    }))


if __name__ == "__main__":
    main()
