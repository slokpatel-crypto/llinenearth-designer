# Run on a real Blender-authored candidate .blend. Never modifies the source.
"""World-space garment-contact footprint evidence (not actual penetration volume)."""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils.bvhtree import BVHTree

IDENTITY = "linen-earth-studio-model-v1"
EPSILON = 0.0005


def measured_surface(obj):
    """Evaluated world-space polygons plus per-polygon real triangulated area."""
    if obj is None or obj.type != "MESH":
        raise RuntimeError("Real mesh is missing from waist contact evidence.")
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        coords = [evaluated.matrix_world @ point.co for point in mesh.vertices]
        polygons = [tuple(face.vertices) for face in mesh.polygons]
        if not coords or not polygons or not mesh.loop_triangles:
            raise RuntimeError("Real garment mesh is empty or has no polygon surfaces.")
        areas = [0.0] * len(polygons)
        for triangle in mesh.loop_triangles:
            a, b, c = (coords[i] for i in triangle.vertices)
            area = 0.5 * (b - a).cross(c - a).length
            if not math.isfinite(area):
                raise RuntimeError("Nonfinite native Blender polygon area.")
            areas[triangle.polygon_index] += area
        if sum(areas) <= 0 or any(area < 0 or not math.isfinite(area) for area in areas):
            raise RuntimeError("Cannot measure real surface contact area.")
        tree = BVHTree.FromPolygons(coords, polygons, all_triangles=False, epsilon=EPSILON)
        if tree is None:
            raise RuntimeError("Real mesh polygon BVH construction failed.")
        return tree, areas
    finally:
        evaluated.to_mesh_clear()


def footprint(left, right):
    left_tree, left_areas = measured_surface(left)
    right_tree, right_areas = measured_surface(right)
    overlap = left_tree.overlap(right_tree)
    l_faces = {left_index for left_index, _ in overlap}
    r_faces = {right_index for _, right_index in overlap}
    l_area = sum(left_areas[index] for index in l_faces)
    r_area = sum(right_areas[index] for index in r_faces)
    return {
        "polygonContactPairs": len(overlap),
        "contactingLeftFaces": len(l_faces),
        "contactingRightFaces": len(r_faces),
        "leftFaceCount": len(left_areas),
        "rightFaceCount": len(right_areas),
        "contactingLeftFaceAreaMm2": round(l_area * 1e6, 3),
        "contactingRightFaceAreaMm2": round(r_area * 1e6, 3),
        "wholeLeftSurfaceAreaMm2": round(sum(left_areas) * 1e6, 3),
        "wholeRightSurfaceAreaMm2": round(sum(right_areas) * 1e6, 3),
        "contactingLeftFaceFraction": round(l_area / sum(left_areas), 6),
        "contactingRightFaceFraction": round(r_area / sum(right_areas), 6),
    }


def main():
    cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(cli)
    scene = bpy.context.scene
    if scene.get("linen_earth_model_identity_id") != IDENTITY or scene.get("linen_earth_model_identity_locked") is not True:
        raise RuntimeError("Locked photographed-model identity must remain unchanged.")
    level = scene.get("linen_earth_trouser_waist_refinement_level")
    if type(level) is not int or level not in (0, 1):
        raise RuntimeError("Missing measured original-vs-refined waist candidate provenance.")
    col = bpy.data.collections.get("LinenEarthExport")
    if col is None:
        raise RuntimeError("Candidate garment collection is missing.")
    shirt = col.objects.get("ShirtTorsoFabric")
    waist = col.objects.get("TrouserWaistFabric")
    body = bpy.data.objects.get("Body")
    report = {
        "version": "titan-waist-contact-footprint-v1",
        "modelIdentityId": IDENTITY,
        "waistRefinementLevel": level,
        "candidateOnly": True,
        "productionApproved": False,
        "contactAreaInterpretation": (
            "Sum of faces participating in a BVH contact; NOT the true "
            "intersection area or penetration volume. Compare with caution "
            "across tessellations."
        ),
        "bodyVsWaist": footprint(body, waist),
        "shirtVsWaist": footprint(shirt, waist),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print("TITAN_REAL_CONTACT_FOOTPRINT_RECORDED " + json.dumps({
        "level": level,
        "bodyWaistPairs": report["bodyVsWaist"]["polygonContactPairs"],
        "shirtWaistPairs": report["shirtVsWaist"]["polygonContactPairs"],
        "shirtContactAreaMm2": report["shirtVsWaist"]["contactingLeftFaceAreaMm2"],
        "waistContactAreaMm2": report["shirtVsWaist"]["contactingRightFaceAreaMm2"],
    }))


if __name__ == "__main__":
    main()
