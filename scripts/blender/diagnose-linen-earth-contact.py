# Run with Blender 4.5.14 on an authored candidate .blend, never a production asset.
# blender --background candidate.blend --python-exit-code 1 --python \
#   scripts/blender/diagnose-linen-earth-contact.py -- --output contact-diagnostics.json
"""World-space diagnostics ONLY: cannot certify fit, signed interior, or production."""
from __future__ import annotations

import argparse
from collections import Counter
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils.bvhtree import BVHTree

IDENTITY = "linen-earth-studio-model-v1"
COLLECTION = "LinenEarthExport"
GARMENTS = (
    "ShirtTorsoFabric",
    "ShirtSleeveLFabric",
    "ShirtSleeveRFabric",
    "TrouserWaistFabric",
    "TrouserLegLFabric",
    "TrouserLegRFabric",
)
BVH_EPSILON_M = 0.0005
NEAR_CONTACT_MM = 7.0


def evaluated_world_geometry(obj):
    """Capture real evaluated triangles; release temporary Blender mesh in every case."""
    if obj is None or obj.type != "MESH":
        raise RuntimeError("Expected real evaluated MESH object.")
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        matrix = evaluated.matrix_world
        points = [matrix @ vertex.co for vertex in mesh.vertices]
        faces = [tuple(triangle.vertices) for triangle in mesh.loop_triangles]
        if not points or not faces:
            raise RuntimeError(f"{obj.name} has no evaluated surface triangles.")
        if any(not all(math.isfinite(v) for v in point) for point in points):
            raise RuntimeError(f"{obj.name} contains nonfinite world-space vertices.")
        for triangle in faces:
            a, b, c = (points[index] for index in triangle)
            if not math.isfinite((b - a).cross(c - a).length_squared):
                raise RuntimeError(f"{obj.name} contains nonfinite world-space triangles.")
        return points, faces
    finally:
        evaluated.to_mesh_clear()


def surface_topology(points, faces):
    """Measure cut edges and actual zero-area triangles, never pretend seams are sewn."""
    occurrences = Counter()
    collapsed = 0
    for a, b, c in faces:
        for u, v in ((a, b), (b, c), (c, a)):
            occurrences[(min(u, v), max(u, v))] += 1
        # Distinct vertex indices can still be geometrically collinear.
        cross_area_sq = (points[b] - points[a]).cross(points[c] - points[a]).length_squared
        if not math.isfinite(cross_area_sq) or cross_area_sq <= 1e-20:
            collapsed += 1
    return {
        "boundaryEdges": sum(n == 1 for n in occurrences.values()),
        "nonManifoldEdges": sum(n > 2 for n in occurrences.values()),
        "collapsedTriangles": collapsed,
    }



def overlap_height_bands(body_points, garment_points, garment_triangles, overlaps):
    """Locate actual overlapping garment triangles in 8 body-relative Z bands.

    These are BVH *triangle pair* counts, not independent penetration volumes.
    Relative body height makes the diagnostic invariant to world translation.
    """
    low = min(point.z for point in body_points)
    high = max(point.z for point in body_points)
    height = high - low
    if not math.isfinite(height) or height <= 1e-6:
        raise RuntimeError("Real body height is invalid for collision localization.")
    counts = [0] * 8
    for _body_index, garment_index in overlaps:
        if not isinstance(garment_index, int) or not 0 <= garment_index < len(garment_triangles):
            raise RuntimeError("BVH contact referenced an invalid garment triangle.")
        corners = garment_triangles[garment_index]
        centroid_z = sum(garment_points[index].z for index in corners) / 3.0
        if not math.isfinite(centroid_z):
            raise RuntimeError("Nonfinite garment contact region.")
        band = max(0, min(7, math.floor(8 * (centroid_z - low) / height)))
        counts[band] += 1
    return counts


def polygon_world_bvh(obj):
    """Independent same-parameter polygon BVH as the production contact gate."""
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    try:
        points = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
        polygons = [tuple(face.vertices) for face in mesh.polygons]
        if not points or not polygons:
            raise RuntimeError("Cannot verify contact-stage count without real polygons.")
        if any(not all(math.isfinite(v) for v in p) for p in points):
            raise RuntimeError("Nonfinite polygon contact-stage vertices.")
        tree = BVHTree.FromPolygons(points, polygons, all_triangles=False, epsilon=BVH_EPSILON_M)
        if tree is None:
            raise RuntimeError("Failed to evaluate actual polygon contact-stage BVH.")
        return tree
    finally:
        evaluated.to_mesh_clear()


def verified_modifier_stages(obj, body_polygon_tree):
    """Reject missing, reordered or unverified authoring contact evidence."""
    raw = obj.get("linen_earth_body_contact_stages_json")
    if not isinstance(raw, str):
        raise RuntimeError("Garment has no real modifier-stage body contact evidence.")
    try:
        stages = json.loads(raw)
    except (ValueError, TypeError) as error:
        raise RuntimeError("Invalid garment modifier-stage evidence JSON.") from error
    expected = ("selectedBodyShell", "afterSmoothing", "afterBodyClearance", "afterClothThickness")
    if not isinstance(stages, list) or len(stages) != len(expected):
        raise RuntimeError("Incomplete real contact-stage measurements.")
    for stage, label in zip(stages, expected):
        if (not isinstance(stage, dict) or stage.get("stage") != label
            or type(stage.get("bodyIntersectionPairs")) is not int
            or stage["bodyIntersectionPairs"] < 0):
            raise RuntimeError("Invalid or out-of-order real contact-stage measurement.")
    final_measured = len(body_polygon_tree.overlap(polygon_world_bvh(obj)))
    if stages[-1]["bodyIntersectionPairs"] != final_measured:
        raise RuntimeError("Stale modifier-stage evidence no longer matches actual final cloth.")
    return stages


def verified_solidify_variants(obj, stages):
    """Prevent variant data from becoming fictitious or stale fit evidence."""
    raw = obj.get("linen_earth_solidify_variant_contacts_json")
    if not isinstance(raw, str):
        raise RuntimeError("Missing original-mesh solidify comparison evidence.")
    try:
        evidence = json.loads(raw)
    except (ValueError, TypeError) as error:
        raise RuntimeError("Malformed solidify comparison evidence.") from error
    if not isinstance(evidence, dict) or type(evidence.get("baselineAfterBodyClearance")) is not int:
        raise RuntimeError("Invalid real clearance baseline in solidify comparison.")
    if evidence["baselineAfterBodyClearance"] != stages[2]["bodyIntersectionPairs"]:
        raise RuntimeError("Solidify baseline disagrees with independently verified clearance stage.")
    items = evidence.get("variants")
    expected = (
        ("outwardNoRim", 1.0, False, False),
        ("outwardWithRim", 1.0, True, False),
        ("inwardNoRim", -1.0, False, False),
        ("inwardWithRim", -1.0, True, False),
        ("recalculatedOutwardWithRim", 1.0, True, True),
        ("recalculatedInwardWithRim", -1.0, True, True),
    )
    if not isinstance(items, list) or len(items) != len(expected):
        raise RuntimeError("Incomplete six-variant real Blender solidify and face-normal comparison.")
    for item, (label, offset, rim, recalculate) in zip(items, expected):
        if (not isinstance(item, dict) or item.get("variant") != label
                or type(item.get("offset")) not in (float, int) or item["offset"] != offset
                or type(item.get("rim")) is not bool or item["rim"] != rim
                or type(item.get("recalculatedNormals")) is not bool
                or item["recalculatedNormals"] != recalculate
                or type(item.get("bodyIntersectionPairs")) is not int
                or item["bodyIntersectionPairs"] < 0):
            raise RuntimeError("Inconsistent measured Blender solidify variant.")
    if items[1]["bodyIntersectionPairs"] != stages[3]["bodyIntersectionPairs"]:
        raise RuntimeError("Expected current outward-with-rim cloth comparison disagrees with actual output.")
    return evidence


def verified_shrinkwrap_modes(obj, stages):
    """Fail closed on missing or mislabeled live-geometry trial data."""
    raw = obj.get("linen_earth_shrinkwrap_modes_json")
    if not isinstance(raw, str):
        raise RuntimeError("Real shrinkwrap mode trial measurements missing.")
    try:
        report = json.loads(raw)
    except (ValueError, TypeError) as error:
        raise RuntimeError("Invalid real shrinkwrap mode trial JSON.") from error
    if not isinstance(report, dict) or type(report.get("beforeWrap")) is not int:
        raise RuntimeError("Invalid shrinkwrap baseline.")
    if report["beforeWrap"] != stages[1]["bodyIntersectionPairs"]:
        raise RuntimeError("Shrinkwrap trial baseline does not match actual smoothed shell.")
    trials = report.get("trialModes")
    modes = ("OUTSIDE_SURFACE", "ABOVE_SURFACE", "ON_SURFACE")
    if not isinstance(trials, list) or len(trials) != len(modes):
        raise RuntimeError("Missing an actual Blender shrinkwrap comparison mode.")
    for item, mode in zip(trials, modes):
        if not isinstance(item, dict) or item.get("mode") != mode:
            raise RuntimeError("Wrong/out-of-order shrinkwrap trial.")
        if type(item.get("clearanceMm")) not in (int, float) or item["clearanceMm"] != 7.0:
            raise RuntimeError("Shrinkwrap comparison cannot change locked 7mm clearance.")
        for key in ("bodyPairsAfterWrap", "bodyPairsAfterClothThickness"):
            if type(item.get(key)) is not int or item[key] < 0:
                raise RuntimeError("Unmeasured shrinkwrap trial contact pairs.")
    current = trials[0]
    if (current["bodyPairsAfterWrap"] != stages[2]["bodyIntersectionPairs"]
        or current["bodyPairsAfterClothThickness"] != stages[3]["bodyIntersectionPairs"]):
        raise RuntimeError("Real candidate's original shrinkwrap recipe disagrees with trial.")
    return report


def diagnose(body_geometry, garment_geometry):
    """Normals may be reversed; a negative normal projection is NOT an inside test."""
    body_points, body_faces = body_geometry
    points, faces = garment_geometry
    body_tree = BVHTree.FromPolygons(
        body_points, body_faces, all_triangles=True, epsilon=BVH_EPSILON_M
    )
    garment_tree = BVHTree.FromPolygons(
        points, faces, all_triangles=True, epsilon=BVH_EPSILON_M
    )
    if body_tree is None or garment_tree is None:
        raise RuntimeError("World-space body/garment BVH construction failed.")
    signed = []
    separations = []
    for point in points:
        location, normal, face_index, distance = body_tree.find_nearest(point)
        if location is None or normal is None or face_index is None or distance is None:
            raise RuntimeError("A real garment vertex could not be projected onto body.")
        projection_mm = (point - location).dot(normal) * 1000.0
        distance_mm = distance * 1000.0
        if not math.isfinite(projection_mm) or not math.isfinite(distance_mm):
            raise RuntimeError("Nonfinite body contact measurement.")
        signed.append(projection_mm)
        separations.append(distance_mm)
    topology = surface_topology(points, faces)
    overlaps = body_tree.overlap(garment_tree)
    height_bands = overlap_height_bands(body_points, points, faces, overlaps)
    if sum(height_bands) != len(overlaps):
        raise RuntimeError("Body collision histogram failed to account for every pair.")
    return {
        "bodyGarmentIntersectingTrianglePairs": len(overlaps),
        "contactPairsByBodyHeightOctile": height_bands,
        "evaluatedVertices": len(points),
        "evaluatedTriangles": len(faces),
        "minimumNearestBodyDistanceMm": round(min(separations), 3),
        "maximumNearestBodyDistanceMm": round(max(separations), 3),
        "negativeBodyNormalProjectionCount": sum(d < -1e-5 for d in signed),
        "positiveBodyNormalProjectionCount": sum(d > 1e-5 for d in signed),
        "verticesWithin7MmOfBody": sum(d < NEAR_CONTACT_MM for d in separations),
        "minimumBodyNormalProjectionMm": round(min(signed), 3),
        "maximumBodyNormalProjectionMm": round(max(signed), 3),
        **topology,
    }


def diagnostic_report(scene):
    if (str(scene.get("linen_earth_model_identity_id", "")) != IDENTITY
            or scene.get("linen_earth_model_identity_locked") is not True):
        raise RuntimeError("Original studio model identity lock is missing.")
    body = bpy.data.objects.get("Body")
    collection = bpy.data.collections.get(COLLECTION)
    if body is None or body.type != "MESH" or collection is None:
        raise RuntimeError("Source body or exact candidate export collection is missing.")
    source = evaluated_world_geometry(body)
    source_polygon_tree = polygon_world_bvh(body)
    records = {}
    for name in GARMENTS:
        obj = collection.objects.get(name)
        if obj is None:
            raise RuntimeError(f"Missing real garment panel: {name}")
        records[name] = diagnose(source, evaluated_world_geometry(obj))
        stages = verified_modifier_stages(obj, source_polygon_tree)
        records[name]["actualModifierContactStages"] = stages
        records[name]["realSolidifyVariantComparisons"] = verified_solidify_variants(obj, stages)
        records[name]["realShrinkwrapModeComparisons"] = verified_shrinkwrap_modes(obj, stages)
    return {
        "version": "titan-actual-contact-diagnostics-v1",
        "modelIdentityId": IDENTITY,
        "candidateOnly": True,
        "productionApproved": False,
        "physicalFitApproved": False,
        "signedProjectionIsInteriorTest": False,
        "contactHistogramDescription": "Eight low-to-high 12.5%-of-body-height bands; triangle-pair counts, not penetration volumes.",
        "modifierStageMethod": "World-space evaluated polygon BVH with 0.5mm epsilon, independently verified against final garment; not a production clearance approval.",
        "solidifyExperimentMethod": "Disposable actual Blender SOLIDIFY trials including six variants with +/-normal offsets, rim-on/off and BMesh recalculated face normals. Candidate geometry is unchanged, not approved.",
        "shrinkwrapExperimentMethod": "Unsaved world-space native Blender NEAREST_SURFACEPOINT clones at fixed 7mm clearance, with unchanged final 1.6mm cloth thickness; no mode selected or approved.",
        "explanation": (
            "World-space BVH triangle overlap counts are candidate defects; "
            "nearest-body normal projections are diagnostic only because body normals "
            "may be reversed or winding may vary. No production signoff."
        ),
        "panels": records,
    }


def main():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    options = parser.parse_args(argv)
    bpy.context.view_layer.update()
    report = diagnostic_report(bpy.context.scene)
    output = Path(options.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print("TITAN_REAL_CONTACT_DIAGNOSTICS_RECORDED: candidate-only, productionApproved=false")
    for name, metrics in report["panels"].items():
        print(f"{name}: {metrics['bodyGarmentIntersectingTrianglePairs']} body intersection pairs, "
              f"{metrics['negativeBodyNormalProjectionCount']} negative normal projections; "
              f"height octiles={metrics['contactPairsByBodyHeightOctile']}; "
              f"authoring stages={metrics['actualModifierContactStages']}; "
              f"solidify variants={metrics['realSolidifyVariantComparisons']['variants']}; "
              f"shrinkwrap modes={metrics['realShrinkwrapModeComparisons']['trialModes']}")


if __name__ == "__main__":
    main()
