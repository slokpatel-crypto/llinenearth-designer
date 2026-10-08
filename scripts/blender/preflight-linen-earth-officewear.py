# Run inside Blender 4.2+:
# blender --background your-scene.blend --python scripts/blender/preflight-linen-earth-officewear.py
#
# This is a geometry/scene QA gate only. It does not modify the asset.

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from section_geometry import triangle_section_x_span
from surface_coverage import penetrating_surface_samples

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

        edge_use = {}
        for polygon in mesh.polygons:
            for edge_key in polygon.edge_keys:
                edge_use[edge_key] = edge_use.get(edge_key, 0) + 1
        boundary_edges = sum(1 for count in edge_use.values() if count == 1)
        non_manifold_edges = sum(1 for count in edge_use.values() if count != 2)

        adjacency = [[] for _ in range(vertices)]
        for edge in mesh.edges:
            left, right = edge.vertices
            adjacency[left].append(right)
            adjacency[right].append(left)
        visited = bytearray(vertices)
        components = 0
        for start in range(vertices):
            if visited[start] or not adjacency[start]:
                continue
            components += 1
            stack = [start]
            visited[start] = 1
            while stack:
                current = stack.pop()
                for neighbor in adjacency[current]:
                    if not visited[neighbor]:
                        visited[neighbor] = 1
                        stack.append(neighbor)

        return {
            "vertices": vertices,
            "polygons": polygons,
            "triangles": triangles,
            "degenerateFaces": degenerate,
            "degenerateRatio": (degenerate / polygons) if polygons else 1.0,
            "uvLayers": uv_layers,
            "activeUv": uv_name,
            "connectedComponents": components,
            "boundaryEdges": boundary_edges,
            "nonManifoldEdges": non_manifold_edges,
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


def point_inside_closed_bvh(tree, point, epsilon=1e-5, max_hits=64):
    # Odd/even ray parity is more robust than nearest-normal sign on concave
    # anatomy (armpits/crotch/seat), where the closest triangle normal can face
    # away from an otherwise exterior garment point.
    direction = Vector((1.0, 0.371, 0.117)).normalized()
    origin = point + direction * epsilon
    hits = 0
    for _ in range(max_hits):
        result = tree.ray_cast(origin, direction)
        location = result[0] if result else None
        distance = result[3] if result and len(result) > 3 else None
        if location is None or distance is None:
            break
        hits += 1
        origin = location + direction * epsilon
    return (hits % 2) == 1


def signed_clearance_stats_mm(source, target, z_center=None, band=0.06, max_samples=600):
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
        penetration = []
        penetration_tolerance_mm = 0.8
        for point in candidates[::stride][:max_samples]:
            nearest = target_tree.find_nearest(point)
            if nearest is None or nearest[0] is None:
                continue
            distance_mm = (point - nearest[0]).length * 1000.0
            distances.append(distance_mm)
            if distance_mm > penetration_tolerance_mm and point_inside_closed_bvh(target_tree, point):
                penetration.append(distance_mm)
        if not distances:
            return None
        # Vertex-only parity cannot certify a panel stretched between sparse
        # construction rings. Probe REAL triangle centres and edge midpoints:
        # a trouser calf/torso can protrude through a face with every vertex
        # outside. Bound native BVH work to 600 deterministic mesh triangles.
        mesh.calc_loop_triangles()
        stride_faces=max(1, math.ceil(len(mesh.loop_triangles) / max_samples))
        sampled_faces=[
            tuple(face.vertices) for face in mesh.loop_triangles[::stride_faces][:max_samples]
        ]
        face_vertices=[matrix @ vertex.co for vertex in mesh.vertices]
        def deep_body_surface(point):
            world=Vector(point)
            if not point_inside_closed_bvh(target_tree,world):
                return False
            nearest=target_tree.find_nearest(world)
            return nearest is not None and nearest[0] is not None and (world-nearest[0]).length > 0.0015
        surface_hits=penetrating_surface_samples(
            [(p.x,p.y,p.z) for p in face_vertices],
            sampled_faces, deep_body_surface, max_hits=32
        )
        distances.sort()
        penetration.sort()
        p05 = distances[min(len(distances) - 1, int(round((len(distances) - 1) * 0.05)))]
        return {
            "minSigned": round(distances[0], 2),
            "p05Signed": round(p05, 2),
            "medianSigned": round(distances[len(distances) // 2], 2),
            "penetrationSamples": len(penetration),
            "maxPenetrationMm": round(penetration[-1], 2) if penetration else 0.0,
            "samples": len(distances),
            "insideMethod": "odd-even-bvh-ray-parity",
            "sampledSurfaceFaces": len(sampled_faces),
            "deepSurfacePenetrationSamples": len(surface_hits),
            "deepSurfaceSamplesCapped": len(surface_hits) >= 32,
            "deepSurfaceLocations": [
                {"face":hit["face"],"location":hit["location"],
                 "xyzMm":[round(v*1000,1) for v in hit["point"]]}
                for hit in surface_hits[:8]
            ],
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


def main(json_output=None):
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
            matrix = evaluated.matrix_world
            if obj.name in GARMENT_OBJECTS:
                # Exact cross-section works even between sparse tailoring rings.
                mesh.calc_loop_triangles()
                points = [matrix @ vertex.co for vertex in mesh.vertices]
                triangles = (
                    tuple((points[index].x, points[index].y, points[index].z) for index in face.vertices)
                    for face in mesh.loop_triangles
                )
                return triangle_section_x_span(triangles, z_world)
            xs = []
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

    def side_center_x_at_z(obj, z_world, side, band=0.055, inner_x=0.16):
        if obj is None or z_world is None or obj.type != "MESH":
            return None
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            matrix = evaluated.matrix_world
            xs = []
            for vertex in mesh.vertices:
                point = matrix @ vertex.co
                if abs(point.z - z_world) > band:
                    continue
                if side < 0 and point.x <= -inner_x:
                    xs.append(point.x)
                elif side > 0 and point.x >= inner_x:
                    xs.append(point.x)
            if len(xs) < 4:
                return None
            xs.sort()
            return xs[len(xs) // 2] * 1000.0
        finally:
            evaluated.to_mesh_clear()

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
            reasons.append(f"Could not sample {key} from garment geometry for identity-fit QA.")
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
            reasons.append(f"Could not sample {key} for garment centerline QA.")
        elif abs(measured) > tolerance:
            reasons.append(f"{key} is {measured:.1f} mm from model center; allowed offset is ±{tolerance:.1f} mm.")

    left_hand_z = guide_center_z("LE_GUIDE_LEFT_HAND_CENTER_H")
    right_hand_z = guide_center_z("LE_GUIDE_RIGHT_HAND_CENTER_H")
    # The cuff physically ends 55 mm ABOVE the bare-hand guide. Sampling the
    # hand plane yields None with exact triangle/plane intersection, even when
    # the authored sleeve is valid. Keep the production gate at the cloth hem.
    left_cuff_z = left_hand_z + 0.055 if left_hand_z is not None else None
    right_cuff_z = right_hand_z + 0.055 if right_hand_z is not None else None
    left_sleeve_center = center_x_at_z(bpy.data.objects.get("ShirtSleeveLFabric"), left_cuff_z, 0.018)
    right_sleeve_center = center_x_at_z(bpy.data.objects.get("ShirtSleeveRFabric"), right_cuff_z, 0.018)
    left_sleeve_width = width_at_z(bpy.data.objects.get("ShirtSleeveLFabric"), left_cuff_z, 0.018)
    right_sleeve_width = width_at_z(bpy.data.objects.get("ShirtSleeveRFabric"), right_cuff_z, 0.018)
    sleeve_spacing = abs(right_sleeve_center - left_sleeve_center) if left_sleeve_center is not None and right_sleeve_center is not None else None
    cuff_width_asymmetry = abs(left_sleeve_width - right_sleeve_width) if left_sleeve_width is not None and right_sleeve_width is not None else None
    identity_measurements["sleeveCenterSpacingMm"] = round(sleeve_spacing, 2) if sleeve_spacing is not None else None
    identity_measurements["cuffWidthAsymmetryMm"] = round(cuff_width_asymmetry, 2) if cuff_width_asymmetry is not None else None
    if sleeve_spacing is None:
        reasons.append("Could not sample sleeve-center spacing near the locked hand guides.")
    else:
        target_hand_spacing = EXPECTED_IDENTITY_TARGETS_MM["handCenterSpacing"]
        if abs(sleeve_spacing - target_hand_spacing) > 36.0:
            reasons.append(
                f"Sleeve-center spacing near the cuffs is {sleeve_spacing:.1f} mm; "
                f"locked hand-center target is {target_hand_spacing:.1f} mm ± 36.0 mm."
            )
    if cuff_width_asymmetry is None:
        reasons.append("Could not calculate left/right cuff-zone width symmetry.")
    elif cuff_width_asymmetry > 14.0:
        reasons.append(
            f"Left/right cuff-zone width asymmetry is {cuff_width_asymmetry:.1f} mm; "
            "allowed difference is 14.0 mm."
        )

    outer_arm_z = guide_center_z("LE_GUIDE_OUTER_ARM_SILHOUETTE")
    left_arm_span = x_span_at_z(bpy.data.objects.get("ShirtSleeveLFabric"), outer_arm_z, 0.045)
    right_arm_span = x_span_at_z(bpy.data.objects.get("ShirtSleeveRFabric"), outer_arm_z, 0.045)
    outer_arm_silhouette = (
        (right_arm_span[1] - left_arm_span[0]) * 1000.0
        if left_arm_span is not None and right_arm_span is not None
        else None
    )
    identity_measurements["outerArmSilhouetteMm"] = round(outer_arm_silhouette, 2) if outer_arm_silhouette is not None else None
    if outer_arm_silhouette is None:
        reasons.append("Could not sample garment outer-arm silhouette at the locked guide.")
    else:
        target_outer_arm = EXPECTED_IDENTITY_TARGETS_MM["outerArmSilhouette"]
        if abs(outer_arm_silhouette - target_outer_arm) > 36.0:
            reasons.append(
                f"Garment outer-arm silhouette is {outer_arm_silhouette:.1f} mm; "
                f"locked model target is {target_outer_arm:.1f} mm ± 36.0 mm."
            )

    body_left_hand_center = side_center_x_at_z(body, left_hand_z, -1)
    body_right_hand_center = side_center_x_at_z(body, right_hand_z, 1)
    body_hand_spacing = (
        abs(body_right_hand_center - body_left_hand_center)
        if body_left_hand_center is not None and body_right_hand_center is not None
        else None
    )
    identity_measurements["bodyHandCenterSpacingMm"] = round(body_hand_spacing, 2) if body_hand_spacing is not None else None
    if body_hand_spacing is None:
        warnings.append("Could not sample the realistic body's hand-center stance.")
    else:
        target_hand_spacing = EXPECTED_IDENTITY_TARGETS_MM["handCenterSpacing"]
        if abs(body_hand_spacing - target_hand_spacing) > 30.0:
            reasons.append(
                f"Realistic body hand-center spacing is {body_hand_spacing:.1f} mm; "
                f"locked model target is {target_hand_spacing:.1f} mm ± 30.0 mm."
            )

    left_hem = identity_measurements.get("leftHemWidthMm")
    right_hem = identity_measurements.get("rightHemWidthMm")
    hem_asymmetry = abs(left_hem - right_hem) if left_hem is not None and right_hem is not None else None
    identity_measurements["hemWidthAsymmetryMm"] = round(hem_asymmetry, 2) if hem_asymmetry is not None else None
    if hem_asymmetry is None:
        reasons.append("Could not calculate left/right trouser hem symmetry.")
    elif hem_asymmetry > 10.0:
        reasons.append(f"Trouser hem width asymmetry is {hem_asymmetry:.1f} mm; allowed difference is 10.0 mm.")

    left_leg_z = guide_center_z("LE_GUIDE_LEFT_LEG_CENTER_H")
    right_leg_z = guide_center_z("LE_GUIDE_RIGHT_LEG_CENTER_H")
    left_leg_center = center_x_at_z(bpy.data.objects.get("TrouserLegLFabric"), left_leg_z, 0.030)
    right_leg_center = center_x_at_z(bpy.data.objects.get("TrouserLegRFabric"), right_leg_z, 0.030)
    leg_spacing = abs(right_leg_center - left_leg_center) if left_leg_center is not None and right_leg_center is not None else None
    identity_measurements["legCenterSpacingMm"] = round(leg_spacing, 2) if leg_spacing is not None else None
    if leg_spacing is None:
        reasons.append("Could not sample trouser leg-center spacing from production geometry.")
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
        if stats["connectedComponents"] != 1:
            reasons.append(
                f"{name} is split into {stats['connectedComponents']} disconnected mesh components; "
                "production garment panels must be continuous rather than fragmented body-surface crops."
            )
        if stats["boundaryEdges"] != 0 or stats["nonManifoldEdges"] != 0:
            reasons.append(
                f"{name} has {stats['boundaryEdges']} open boundary edges and "
                f"{stats['nonManifoldEdges']} non-manifold edges after cloth thickness; "
                "close the garment shell before production export."
            )
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
            ("bodyShirtTorso", bpy.data.objects.get("ShirtTorsoFabric")),
            ("bodySleeveL", bpy.data.objects.get("ShirtSleeveLFabric")),
            ("bodySleeveR", bpy.data.objects.get("ShirtSleeveRFabric")),
            ("bodyTrouserWaist", bpy.data.objects.get("TrouserWaistFabric")),
            ("bodyTrouserLegL", bpy.data.objects.get("TrouserLegLFabric")),
            ("bodyTrouserLegR", bpy.data.objects.get("TrouserLegRFabric")),
        )
        for key, garment_obj in boundary_pairs:
            stats = signed_clearance_stats_mm(garment_obj, body)
            boundary_clearance_mm[key + "Signed"] = stats
            if stats is None:
                boundary_intersections[key] = None
                reasons.append(f"Could not evaluate signed penetration QA for {key}.")
                continue
            count = int(stats["penetrationSamples"])
            boundary_intersections[key] = count
            allowed_samples = max(2, int(math.ceil(stats["samples"] * 0.01)))
            if count > allowed_samples or stats["maxPenetrationMm"] > 1.5:
                reasons.append(
                    f"{key} has {count}/{stats['samples']} sampled garment vertices inside the body "
                    f"(max {stats['maxPenetrationMm']:.1f} mm); production garment/body boundaries must stay outside."
                )
            surface_count = int(stats.get("deepSurfacePenetrationSamples",0))
            if surface_count:
                reasons.append(
                    f"{key} has {surface_count} independently sampled cloth face/edge points "
                    f"over 1.5 mm inside the locked human body "
                    f"({stats['sampledSurfaceFaces']} sampled faces); "
                    "repair real panel geometry, never certify a surface from vertices alone."
                )

        upper_torso_z = body.matrix_world.translation.z + object_height(body) * 0.82
        waist_z = guide_center_z("LE_GUIDE_SHIRT_WAIST")
        cuff_z = left_cuff_z
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
            reasons.append("Could not measure trouser inner-leg gap at the locked stance guide.")
        elif trouser_gap_mm < 6.0:
            reasons.append(
                f"Trouser inner-leg gap is {trouser_gap_mm:.1f} mm; "
                "production stance needs at least 6.0 mm to avoid fused leg silhouettes."
            )

        # Measure the ACTUAL overlapping tucked-hem/waistband band: 35 mm
        # below the trouser waist. A former +/-75 mm sample included the upper
        # shirt *above* the waistband, where cloth separation is unrelated to
        # tuck fit and artificially inflated the median by tens of millimetres.
        # Keep the strict 0.8..18 mm clearance limits on the real junction.
        tuck_stats = nearest_distance_stats_mm(
            bpy.data.objects.get("ShirtTorsoFabric"),
            bpy.data.objects.get("TrouserWaistFabric"),
            trouser_waist_z - 0.0175,
            0.020,
            400,
        )
        boundary_clearance_mm["shirtTrouserTuck"] = tuck_stats
        boundary_intersections["shirtTrouserTuck"] = 0 if tuck_stats is not None else None
        if tuck_stats is None:
            warnings.append("Could not evaluate tucked shirt/trouser junction clearance.")
        elif tuck_stats["median"] < 0.8:
            reasons.append(
                f"Tucked shirt/trouser median separation is only {tuck_stats['median']:.1f} mm; "
                "separate the layers to avoid z-fighting and fused geometry."
            )
        elif tuck_stats["median"] > 18.0:
            reasons.append(
                f"Tucked shirt/trouser median separation is {tuck_stats['median']:.1f} mm; "
                "tighten the waist layering so the tuck reads as one tailored junction."
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
    payload = json.dumps(report, indent=2)
    print(payload)
    if json_output:
        output = Path(json_output).expanduser().resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(payload + "\n", encoding="utf-8")
    if reasons:
        raise SystemExit(1)
    return report


def cli_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-output")
    return parser.parse_args(argv)


if __name__ == "__main__":
    options = cli_args()
    main(options.json_output)
