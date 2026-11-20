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
        "experimental": data["experimentalDisjointArmholes"],
    }))


if __name__ == "__main__":
    main()
