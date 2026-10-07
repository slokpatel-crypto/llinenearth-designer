# Run inside Blender 4.2+:
# blender --background your-scene.blend --python scripts/blender/preflight-linen-earth-officewear.py
#
# This is a geometry/scene QA gate only. It does not modify the asset.

from __future__ import annotations

import json
import math
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

EXPORT_COLLECTION = "LinenEarthExport"
REFERENCE_BODY = "Body"
TARGET_HEIGHT_M = 1.727
HEIGHT_TOLERANCE_M = 0.020
MAX_TOTAL_TRIANGLES = 220_000
MAX_TOTAL_VERTICES = 280_000
MAX_DEGENERATE_FACE_RATIO = 0.001
TRANSFORM_TOLERANCE = 1e-4
MODEL_IDENTITY_ID = "linen-earth-studio-model-v1"
MODEL_REFERENCE_IMAGE = "/designer/studio-tucked.webp"
IDENTITY_GUIDE_COLLECTION = "LinenEarthIdentityGuides"
EXPECTED_IDENTITY_TARGETS_MM = {
    "height": 1727,
    "shoulderSeamWidth": 388,
    "outerArmSilhouette": 574,
    "shirtWaistWidth": 294,
    "trouserWaistWidth": 344,
    "handCenterSpacing": 500,
    "legCenterSpacing": 210,
    "hemWidth": 64,
}

GARMENT_OBJECTS = (
    "ShirtTorsoFabric",
    "ShirtSleeveLFabric",
    "ShirtSleeveRFabric",
    "TrouserWaistFabric",
    "TrouserLegLFabric",
    "TrouserLegRFabric",
)


def world_bounds(obj):
    return [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]


def object_height(obj):
    points = world_bounds(obj)
    return max(point.z for point in points) - min(point.z for point in points)


def close(a, b, tolerance=TRANSFORM_TOLERANCE):
    return abs(float(a) - float(b)) <= tolerance


def transform_ready(obj):
    scale_ok = all(close(value, 1.0) for value in obj.scale)
    rotation_ok = all(close(value, 0.0) for value in obj.rotation_euler)
    return scale_ok and rotation_ok


def evaluated_mesh_stats(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        vertices = len(mesh.vertices)
        polygons = len(mesh.polygons)
        triangles = len(mesh.loop_triangles)
        degenerate = sum(1 for polygon in mesh.polygons if not math.isfinite(polygon.area) or polygon.area <= 1e-10)
        uv_layers = len(mesh.uv_layers)
        uv_name = mesh.uv_layers.active.name if mesh.uv_layers.active else None
        return {
            "vertices": vertices,
            "polygons": polygons,
            "triangles": triangles,
            "degenerateFaces": degenerate,
            "degenerateRatio": (degenerate / polygons) if polygons else 1.0,
            "uvLayers": uv_layers,
            "activeUv": uv_name,
        }
    finally:
        evaluated.to_mesh_clear()


def material_slot_names(obj):
    return [slot.material.name if slot.material else "" for slot in obj.material_slots]


def world_bvh(obj, epsilon=0.0):
    if obj is None or obj.type != "MESH":
        return None
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        matrix = evaluated.matrix_world
        vertices = [matrix @ vertex.co for vertex in mesh.vertices]
        polygons = [tuple(polygon.vertices) for polygon in mesh.polygons if len(polygon.vertices) >= 3]
        if not vertices or not polygons:
            return None
        return BVHTree.FromPolygons(vertices, polygons, all_triangles=False, epsilon=epsilon)
    finally:
        evaluated.to_mesh_clear()


def intersection_pair_count(left, right):
    if left is None or right is None or left.type != "MESH" or right.type != "MESH":
        return None
    left_tree = world_bvh(left, epsilon=0.0005)
    right_tree = world_bvh(right, epsilon=0.0005)
    if left_tree is None or right_tree is None:
        return None
    return len(left_tree.overlap(right_tree))


def nearest_distance_stats_mm(source, target, z_center=None, band=0.06, max_samples=240):
    if source is None or target is None or source.type != "MESH" or target.type != "MESH":
        return None
    target_tree = world_bvh(target, epsilon=0.0)
    if target_tree is None:
        return None
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = source.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        matrix = evaluated.matrix_world
        candidates = []
        for vertex in mesh.vertices:
            point = matrix @ vertex.co
            if z_center is not None and abs(point.z - z_center) > band:
                continue
            candidates.append(point)
        if not candidates:
            return None
        stride = max(1, len(candidates) // max_samples)
        distances = []
        for point in candidates[::stride][:max_samples]:
            nearest = target_tree.find_nearest(point)
            if nearest is None or nearest[0] is None:
                continue
            distances.append((point - nearest[0]).length * 1000.0)
        if not distances:
            return None
        distances.sort()
        median = distances[len(distances) // 2]
        p95 = distances[min(len(distances) - 1, int(round((len(distances) - 1) * 0.95)))]
        return {
            "min": round(distances[0], 2),
            "median": round(median, 2),
            "p95": round(p95, 2),
            "samples": len(distances),
        }
    finally:
        evaluated.to_mesh_clear()


def guide_world_points(obj):
    if obj is None or obj.type != "CURVE":
        return []
    points = []
    for spline in obj.data.splines:
        for point in spline.points:
            local = Vector(point.co[:3])
            points.append(obj.matrix_world @ local)
    return points


def guide_length_mm(obj):
    points = guide_world_points(obj)
    if len(points) < 2:
        return None
    return (points[-1] - points[0]).length * 1000.0


def guide_center(obj):
    points = guide_world_points(obj)
    if not points:
        return None
    return sum(points, Vector((0.0, 0.0, 0.0))) / len(points)


def main():
    reasons = []
    warnings = []
    objects = {}
    collection = bpy.data.collections.get(EXPORT_COLLECTION)
    body = bpy.data.objects.get(REFERENCE_BODY)
    identity_id = str(bpy.context.scene.get("linen_earth_model_identity_id", "")).strip()
    identity_reference = str(bpy.context.scene.get("linen_earth_model_reference_image", "")).strip()
    identity_locked = bool(bpy.context.scene.get("linen_earth_model_identity_locked", False))
    identity_targets_raw = str(bpy.context.scene.get("linen_earth_identity_targets_json", "")).strip()
    try:
        identity_targets = json.loads(identity_targets_raw) if identity_targets_raw else None
    except json.JSONDecodeError:
        identity_targets = None
    identity_guides = bpy.data.collections.get(IDENTITY_GUIDE_COLLECTION)
    if identity_id != MODEL_IDENTITY_ID:
        reasons.append(f"Model identity is {identity_id or 'missing'}; expected {MODEL_IDENTITY_ID}.")
    if identity_reference != MODEL_REFERENCE_IMAGE:
        reasons.append("Model identity reference does not point to the exact Real Model Designer studio image.")
    if not identity_locked:
        reasons.append("Model identity lock is not enabled in the Blender scene.")
    if identity_targets != EXPECTED_IDENTITY_TARGETS_MM:
        reasons.append("Scene identity physical targets do not match the Linen Earth shared model contract.")
    if identity_guides is None:
        reasons.append(f"Missing identity guide collection: {IDENTITY_GUIDE_COLLECTION}.")
    else:
        required_guides = {
            "LE_GUIDE_SHIRT_SHOULDER",
            "LE_GUIDE_SHIRT_WAIST",
            "LE_GUIDE_TROUSER_WAIST",
            "LE_GUIDE_LEFT_HEM",
            "LE_GUIDE_RIGHT_HEM",
            "LE_GUIDE_OUTER_ARM_SILHOUETTE",
            "LE_GUIDE_LEFT_HAND_CENTER_H",
            "LE_GUIDE_LEFT_HAND_CENTER_V",
            "LE_GUIDE_RIGHT_HAND_CENTER_H",
            "LE_GUIDE_RIGHT_HAND_CENTER_V",
            "LE_GUIDE_LEFT_LEG_CENTER_H",
            "LE_GUIDE_LEFT_LEG_CENTER_V",
            "LE_GUIDE_RIGHT_LEG_CENTER_H",
            "LE_GUIDE_RIGHT_LEG_CENTER_V",
            "LE_GUIDE_HEIGHT",
        }
        guide_names = {obj.name for obj in identity_guides.objects}
        missing_guides = sorted(required_guides - guide_names)
        if missing_guides:
            reasons.append("Missing identity silhouette guides: " + ", ".join(missing_guides))

    guide_measurements = {}
    if identity_guides is not None:
        width_guides = {
            "LE_GUIDE_SHIRT_SHOULDER": ("shoulderSeamWidth", 2.0),
            "LE_GUIDE_SHIRT_WAIST": ("shirtWaistWidth", 2.0),
            "LE_GUIDE_TROUSER_WAIST": ("trouserWaistWidth", 2.0),
            "LE_GUIDE_LEFT_HEM": ("hemWidth", 2.0),
            "LE_GUIDE_RIGHT_HEM": ("hemWidth", 2.0),
            "LE_GUIDE_OUTER_ARM_SILHOUETTE": ("outerArmSilhouette", 3.0),
            "LE_GUIDE_HEIGHT": ("height", 3.0),
        }
        for guide_name, (target_key, tolerance_mm) in width_guides.items():
            guide = identity_guides.objects.get(guide_name)
            measured = guide_length_mm(guide)
            guide_measurements[guide_name] = round(measured, 2) if measured is not None else None
            target = EXPECTED_IDENTITY_TARGETS_MM[target_key]
            if measured is None:
                reasons.append(f"Identity guide {guide_name} cannot be measured.")
            elif abs(measured - target) > tolerance_mm:
                reasons.append(
                    f"Identity guide {guide_name} measures {measured:.1f} mm; "
                    f"expected {target:.1f} mm ± {tolerance_mm:.1f} mm."
                )
            if guide is not None and not bool(guide.get("linen_earth_identity_guide", False)):
                reasons.append(f"Identity guide {guide_name} is missing the canonical guide tag.")
            if guide is not None and not guide.hide_render:
                reasons.append(f"Identity guide {guide_name} must remain non-rendering.")

        marker_pairs = (
            ("handCenterSpacing", "LE_GUIDE_LEFT_HAND_CENTER_H", "LE_GUIDE_RIGHT_HAND_CENTER_H", 3.0),
            ("legCenterSpacing", "LE_GUIDE_LEFT_LEG_CENTER_H", "LE_GUIDE_RIGHT_LEG_CENTER_H", 3.0),
        )
        for target_key, left_name, right_name, tolerance_mm in marker_pairs:
            left_center = guide_center(identity_guides.objects.get(left_name))
            right_center = guide_center(identity_guides.objects.get(right_name))
            measured = None if left_center is None or right_center is None else abs(right_center.x - left_center.x) * 1000.0
            guide_measurements[target_key] = round(measured, 2) if measured is not None else None
            target = EXPECTED_IDENTITY_TARGETS_MM[target_key]
            if measured is None:
                reasons.append(f"Identity marker pair for {target_key} cannot be measured.")
            elif abs(measured - target) > tolerance_mm:
                reasons.append(
                    f"Identity marker spacing {target_key} measures {measured:.1f} mm; "
                    f"expected {target:.1f} mm ± {tolerance_mm:.1f} mm."
                )

    if collection is None:
        reasons.append(f"Missing export collection: {EXPORT_COLLECTION}.")
        export_names = set()
    else:
        export_names = {obj.name for obj in collection.all_objects}

    if body is None or body.type != "MESH":
        reasons.append(f"Missing reference body mesh: {REFERENCE_BODY}.")
        body_height = None
    else:
        body_height = object_height(body)
        if not math.isfinite(body_height) or body_height <= 0:
            reasons.append("Reference body height could not be measured.")
        elif abs(body_height - TARGET_HEIGHT_M) > HEIGHT_TOLERANCE_M:
            reasons.append(
                f"Body height is {body_height:.4f} m; expected {TARGET_HEIGHT_M:.3f} m ± {HEIGHT_TOLERANCE_M:.3f} m."
            )
        if not transform_ready(body):
            warnings.append(
                "Body rotation/scale are not fully applied. Apply transforms before final garment measurements."
            )

    total_triangles = 0
    total_vertices = 0
    identity_measurements = {}

    # Coarse production-fit gate against the exact photographed model silhouette.
    # Tailor review remains authoritative for ease and drape.
    def x_span_at_z(obj, z_world, band=0.018):
        if obj is None or z_world is None or obj.type != "MESH":
            return None
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            xs = []
            matrix = evaluated.matrix_world
            for vertex in mesh.vertices:
                point = matrix @ vertex.co
                if abs(point.z - z_world) <= band:
                    xs.append(point.x)
            return (min(xs), max(xs)) if len(xs) >= 4 else None
        finally:
            evaluated.to_mesh_clear()

    def width_at_z(obj, z_world, band=0.018):
        span = x_span_at_z(obj, z_world, band)
        return (span[1] - span[0]) * 1000.0 if span else None

    def center_x_at_z(obj, z_world, band=0.018):
        span = x_span_at_z(obj, z_world, band)
        return ((span[0] + span[1]) * 0.5) * 1000.0 if span else None

    def guide_center_z(name):
        if identity_guides is None:
            return None
        guide = identity_guides.objects.get(name)
        if guide is None:
            return None
        points = [guide.matrix_world @ Vector(point.co[:3]) for spline in guide.data.splines for point in spline.points]
        if not points:
            return None
        return sum(point.z for point in points) / len(points)

    silhouette_samples = (
        ("shirtShoulderWidthMm", "ShirtTorsoFabric", "LE_GUIDE_SHIRT_SHOULDER", EXPECTED_IDENTITY_TARGETS_MM["shoulderSeamWidth"], 42.0, 0.018),
        ("shirtWaistWidthMm", "ShirtTorsoFabric", "LE_GUIDE_SHIRT_WAIST", EXPECTED_IDENTITY_TARGETS_MM["shirtWaistWidth"], 38.0, 0.018),
        ("trouserWaistWidthMm", "TrouserWaistFabric", "LE_GUIDE_TROUSER_WAIST", EXPECTED_IDENTITY_TARGETS_MM["trouserWaistWidth"], 38.0, 0.018),
        ("leftHemWidthMm", "TrouserLegLFabric", "LE_GUIDE_LEFT_HEM", EXPECTED_IDENTITY_TARGETS_MM["hemWidth"], 28.0, 0.028),
        ("rightHemWidthMm", "TrouserLegRFabric", "LE_GUIDE_RIGHT_HEM", EXPECTED_IDENTITY_TARGETS_MM["hemWidth"], 28.0, 0.028),
    )
    for key, object_name, guide_name, target, tolerance, band in silhouette_samples:
        sample_object = bpy.data.objects.get(object_name)
        sample_z = guide_center_z(guide_name)
        measured = width_at_z(sample_object, sample_z, band) if sample_object and sample_z is not None else None
        identity_measurements[key] = round(measured, 2) if measured is not None else None
        if sample_object and measured is None:
            warnings.append(f"Could not sample {key} from garment geometry for identity-fit QA.")
        elif measured is not None and abs(measured - target) > tolerance:
            reasons.append(
                f"{key} is {measured:.1f} mm; locked model target is {target:.1f} mm ± {tolerance:.1f} mm."
            )

    # Centerline/symmetry checks catch a production mesh that matches width targets
    # but drifts sideways or breaks the locked officewear stance.
    shirt_waist_z = guide_center_z("LE_GUIDE_SHIRT_WAIST")
    trouser_waist_z = guide_center_z("LE_GUIDE_TROUSER_WAIST")
    shirt_center = center_x_at_z(bpy.data.objects.get("ShirtTorsoFabric"), shirt_waist_z, 0.018)
    trouser_center = center_x_at_z(bpy.data.objects.get("TrouserWaistFabric"), trouser_waist_z, 0.018)
    identity_measurements["shirtCenterOffsetMm"] = round(shirt_center, 2) if shirt_center is not None else None
    identity_measurements["trouserCenterOffsetMm"] = round(trouser_center, 2) if trouser_center is not None else None
    for key, measured, tolerance in (
        ("shirtCenterOffsetMm", shirt_center, 18.0),
        ("trouserCenterOffsetMm", trouser_center, 18.0),
    ):
        if measured is None:
            warnings.append(f"Could not sample {key} for garment centerline QA.")
        elif abs(measured) > tolerance:
            reasons.append(f"{key} is {measured:.1f} mm from model center; allowed offset is ±{tolerance:.1f} mm.")

    left_hand_z = guide_center_z("LE_GUIDE_LEFT_HAND_CENTER_H")
    right_hand_z = guide_center_z("LE_GUIDE_RIGHT_HAND_CENTER_H")
    left_sleeve_center = center_x_at_z(bpy.data.objects.get("ShirtSleeveLFabric"), left_hand_z, 0.060)
    right_sleeve_center = center_x_at_z(bpy.data.objects.get("ShirtSleeveRFabric"), right_hand_z, 0.060)
    left_sleeve_width = width_at_z(bpy.data.objects.get("ShirtSleeveLFabric"), left_hand_z, 0.060)
    right_sleeve_width = width_at_z(bpy.data.objects.get("ShirtSleeveRFabric"), right_hand_z, 0.060)
    sleeve_spacing = abs(right_sleeve_center - left_sleeve_center) if left_sleeve_center is not None and right_sleeve_center is not None else None
    cuff_width_asymmetry = abs(left_sleeve_width - right_sleeve_width) if left_sleeve_width is not None and right_sleeve_width is not None else None
    identity_measurements["sleeveCenterSpacingMm"] = round(sleeve_spacing, 2) if sleeve_spacing is not None else None
    identity_measurements["cuffWidthAsymmetryMm"] = round(cuff_width_asymmetry, 2) if cuff_width_asymmetry is not None else None
    if sleeve_spacing is None:
        warnings.append("Could not sample sleeve-center spacing near the locked hand guides.")
    else:
        target_hand_spacing = EXPECTED_IDENTITY_TARGETS_MM["handCenterSpacing"]
        if abs(sleeve_spacing - target_hand_spacing) > 36.0:
            reasons.append(
                f"Sleeve-center spacing near the cuffs is {sleeve_spacing:.1f} mm; "
                f"locked hand-center target is {target_hand_spacing:.1f} mm ± 36.0 mm."
            )
    if cuff_width_asymmetry is None:
        warnings.append("Could not calculate left/right cuff-zone width symmetry.")
    elif cuff_width_asymmetry > 14.0:
        reasons.append(
            f"Left/right cuff-zone width asymmetry is {cuff_width_asymmetry:.1f} mm; "
            "allowed difference is 14.0 mm."
        )

    left_hem = identity_measurements.get("leftHemWidthMm")
    right_hem = identity_measurements.get("rightHemWidthMm")
    hem_asymmetry = abs(left_hem - right_hem) if left_hem is not None and right_hem is not None else None
    identity_measurements["hemWidthAsymmetryMm"] = round(hem_asymmetry, 2) if hem_asymmetry is not None else None
    if hem_asymmetry is None:
        warnings.append("Could not calculate left/right trouser hem symmetry.")
    elif hem_asymmetry > 10.0:
        reasons.append(f"Trouser hem width asymmetry is {hem_asymmetry:.1f} mm; allowed difference is 10.0 mm.")

    left_leg_z = guide_center_z("LE_GUIDE_LEFT_LEG_CENTER_H")
    right_leg_z = guide_center_z("LE_GUIDE_RIGHT_LEG_CENTER_H")
    left_leg_center = center_x_at_z(bpy.data.objects.get("TrouserLegLFabric"), left_leg_z, 0.030)
    right_leg_center = center_x_at_z(bpy.data.objects.get("TrouserLegRFabric"), right_leg_z, 0.030)
    leg_spacing = abs(right_leg_center - left_leg_center) if left_leg_center is not None and right_leg_center is not None else None
    identity_measurements["legCenterSpacingMm"] = round(leg_spacing, 2) if leg_spacing is not None else None
    if leg_spacing is None:
        warnings.append("Could not sample trouser leg-center spacing from production geometry.")
    else:
        target_leg_spacing = EXPECTED_IDENTITY_TARGETS_MM["legCenterSpacing"]
        if abs(leg_spacing - target_leg_spacing) > 24.0:
            reasons.append(
                f"Garment leg-center spacing is {leg_spacing:.1f} mm; "
                f"locked model target is {target_leg_spacing:.1f} mm ± 24.0 mm."
            )

    for name in GARMENT_OBJECTS:
        obj = bpy.data.objects.get(name)
        entry = {
            "present": bool(obj),
            "inExportCollection": name in export_names,
        }
        if obj is None:
            reasons.append(f"Missing garment object: {name}.")
            objects[name] = entry
            continue
        if obj.type != "MESH":
            reasons.append(f"{name} must be a MESH object.")
            objects[name] = entry
            continue
        if name not in export_names:
            reasons.append(f"{name} is not in {EXPORT_COLLECTION}.")

        stats = evaluated_mesh_stats(obj)
        entry.update(stats)
        entry["transformApplied"] = transform_ready(obj)
        entry["materials"] = material_slot_names(obj)
        total_triangles += stats["triangles"]
        total_vertices += stats["vertices"]

        if stats["vertices"] <= 0 or stats["polygons"] <= 0 or stats["triangles"] <= 0:
            reasons.append(f"{name} has empty or non-renderable geometry.")
        if stats["uvLayers"] <= 0 or not stats["activeUv"]:
            reasons.append(f"{name} needs an active UV map.")
        if stats["degenerateRatio"] > MAX_DEGENERATE_FACE_RATIO:
            reasons.append(
                f"{name} has too many zero-area/degenerate faces: "
                f"{stats['degenerateFaces']} of {stats['polygons']}."
            )
        if not entry["transformApplied"]:
            reasons.append(
                f"{name} has unapplied rotation/scale. Apply transforms before measuring panels or exporting."
            )

        nonempty_materials = [value for value in entry["materials"] if value]
        if nonempty_materials and name not in nonempty_materials:
            warnings.append(
                f"{name} does not yet carry its canonical material slot name; exporter will replace it."
            )

    if total_triangles > MAX_TOTAL_TRIANGLES:
        reasons.append(
            f"Garment geometry has {total_triangles:,} evaluated triangles; advisory mobile budget is {MAX_TOTAL_TRIANGLES:,}."
        )
    if total_vertices > MAX_TOTAL_VERTICES:
        reasons.append(
            f"Garment geometry has {total_vertices:,} evaluated vertices; advisory mobile budget is {MAX_TOTAL_VERTICES:,}."
        )

    boundary_intersections = {}
    boundary_clearance_mm = {}
    if body is not None:
        boundary_pairs = (
            ("bodyShirtTorso", body, bpy.data.objects.get("ShirtTorsoFabric"), 0),
            ("bodySleeveL", body, bpy.data.objects.get("ShirtSleeveLFabric"), 0),
            ("bodySleeveR", body, bpy.data.objects.get("ShirtSleeveRFabric"), 0),
            ("bodyTrouserWaist", body, bpy.data.objects.get("TrouserWaistFabric"), 0),
            ("bodyTrouserLegL", body, bpy.data.objects.get("TrouserLegLFabric"), 0),
            ("bodyTrouserLegR", body, bpy.data.objects.get("TrouserLegRFabric"), 0),
        )
        for key, left_obj, right_obj, allowed_pairs in boundary_pairs:
            count = intersection_pair_count(left_obj, right_obj)
            boundary_intersections[key] = count
            if count is None:
                warnings.append(f"Could not evaluate intersection QA for {key}.")
            elif count > allowed_pairs:
                reasons.append(
                    f"{key} has {count} intersecting triangle pairs; production garment/body boundaries must be clean."
                )

        upper_torso_z = body.matrix_world.translation.z + object_height(body) * 0.82
        waist_z = guide_center_z("LE_GUIDE_SHIRT_WAIST")
        cuff_z = guide_center_z("LE_GUIDE_LEFT_HAND_CENTER_H")
        fit_clearance_specs = (
            ("upperTorsoBody", "ShirtTorsoFabric", upper_torso_z, 0.055, 2.0, 32.0),
            ("shirtWaistBody", "ShirtTorsoFabric", waist_z, 0.050, 2.0, 28.0),
            ("leftCuffBody", "ShirtSleeveLFabric", cuff_z, 0.070, 1.5, 32.0),
            ("rightCuffBody", "ShirtSleeveRFabric", cuff_z, 0.070, 1.5, 32.0),
            ("trouserWaistBody", "TrouserWaistFabric", trouser_waist_z, 0.050, 2.0, 32.0),
        )
        for key, object_name, z_center, band, minimum_mm, maximum_mm in fit_clearance_specs:
            stats = nearest_distance_stats_mm(bpy.data.objects.get(object_name), body, z_center, band)
            boundary_clearance_mm[key] = stats
            if stats is None:
                warnings.append(f"Could not measure {key} garment/body clearance.")
                continue
            if stats["median"] < minimum_mm:
                reasons.append(
                    f"{key} median clearance is {stats['median']:.1f} mm; "
                    f"minimum production fit clearance is {minimum_mm:.1f} mm."
                )
            if stats["median"] > maximum_mm:
                reasons.append(
                    f"{key} median clearance is {stats['median']:.1f} mm; "
                    f"maximum production fit clearance is {maximum_mm:.1f} mm."
                )

        left_leg_span = x_span_at_z(bpy.data.objects.get("TrouserLegLFabric"), left_leg_z, 0.035)
        right_leg_span = x_span_at_z(bpy.data.objects.get("TrouserLegRFabric"), right_leg_z, 0.035)
        trouser_gap_mm = (right_leg_span[0] - left_leg_span[1]) * 1000.0 if left_leg_span and right_leg_span else None
        boundary_clearance_mm["trouserInnerGap"] = round(trouser_gap_mm, 2) if trouser_gap_mm is not None else None
        if trouser_gap_mm is None:
            warnings.append("Could not measure trouser inner-leg gap at the locked stance guide.")
        elif trouser_gap_mm < 6.0:
            reasons.append(
                f"Trouser inner-leg gap is {trouser_gap_mm:.1f} mm; "
                "production stance needs at least 6.0 mm to avoid fused leg silhouettes."
            )

        tuck_overlap = intersection_pair_count(
            bpy.data.objects.get("ShirtTorsoFabric"),
            bpy.data.objects.get("TrouserWaistFabric"),
        )
        boundary_intersections["shirtTrouserTuck"] = tuck_overlap
        if tuck_overlap is None:
            warnings.append("Could not evaluate tucked shirt/trouser overlap.")
        elif tuck_overlap > 120:
            reasons.append(
                f"Tucked shirt/trouser junction has {tuck_overlap} intersecting triangle pairs; "
                "clean the waist overlap before production export."
            )

    report = {
        "gate": "linen-earth-officewear-scene-preflight-v1",
        "ready": len(reasons) == 0,
        "referenceBody": REFERENCE_BODY,
        "modelIdentity": {
            "id": identity_id,
            "referenceImage": identity_reference,
            "locked": identity_locked,
            "expectedId": MODEL_IDENTITY_ID,
            "physicalTargetsMm": identity_targets,
            "guideCollection": IDENTITY_GUIDE_COLLECTION,
        },
        "bodyHeightMm": round(body_height * 1000, 2) if body_height else None,
        "identityGuideMeasurementsMm": guide_measurements,
        "identityFitMeasurementsMm": identity_measurements,
        "boundaryIntersections": boundary_intersections,
        "boundaryClearanceMm": boundary_clearance_mm,
        "requiredGarmentObjects": list(GARMENT_OBJECTS),
        "objects": objects,
        "totals": {
            "triangles": total_triangles,
            "vertices": total_vertices,
            "triangleBudget": MAX_TOTAL_TRIANGLES,
            "vertexBudget": MAX_TOTAL_VERTICES,
        },
        "warnings": warnings,
        "reasons": reasons,
    }
    print(json.dumps(report, indent=2))
    if reasons:
        raise SystemExit(1)
    return report


if __name__ == "__main__":
    main()
