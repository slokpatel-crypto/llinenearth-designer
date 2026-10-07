# Run inside Blender 4.2+ after prepare-linen-earth-body.py:
# blender --background .cache/linen-earth/linen-earth-officewear-body-base.blend \
#   --python scripts/blender/author-linen-earth-officewear.py -- \
#   --output .cache/linen-earth/linen-earth-officewear-authored.blend
#
# This generates a reproducible six-piece officewear shell directly from the
# locked realistic body. It is a production CANDIDATE authoring helper, not a
# substitute for tailor/owner fit approval.

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

BODY_NAME = "Body"
EXPORT_COLLECTION = "LinenEarthExport"
MODEL_IDENTITY_ID = "linen-earth-studio-model-v1"
GARMENT_OBJECTS = (
    "ShirtTorsoFabric",
    "ShirtSleeveLFabric",
    "ShirtSleeveRFabric",
    "TrouserWaistFabric",
    "TrouserLegLFabric",
    "TrouserLegRFabric",
)

TAILOR_DETAIL_OBJECTS = (
    "LE_ShirtCollarBand",
    "LE_ShirtCollarWingL",
    "LE_ShirtCollarWingR",
    "LE_ShirtPlacket",
    "LE_ShirtCuffL",
    "LE_ShirtCuffR",
    "LE_TrouserWaistband",
)


def cli_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--body", default=BODY_NAME)
    parser.add_argument("--clearance-mm", type=float, default=7.0)
    parser.add_argument("--thickness-mm", type=float, default=1.6)
    return parser.parse_args(argv)


def world_bounds(obj):
    return [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]


def body_frame(body):
    points = world_bounds(body)
    min_x = min(point.x for point in points)
    max_x = max(point.x for point in points)
    min_z = min(point.z for point in points)
    max_z = max(point.z for point in points)
    return {
        "centerX": (min_x + max_x) * 0.5,
        "minZ": min_z,
        "height": max_z - min_z,
    }


def remove_existing(name):
    obj = bpy.data.objects.get(name)
    if obj is not None:
        bpy.data.objects.remove(obj, do_unlink=True)


def selected_shell(body, name, predicate):
    source_mesh = body.data
    matrix = body.matrix_world
    inverse = matrix.inverted()
    selected = []
    used = set()

    for polygon in source_mesh.polygons:
        world_center = matrix @ polygon.center
        if not predicate(world_center):
            continue
        indices = tuple(polygon.vertices)
        selected.append(indices)
        used.update(indices)

    if not selected:
        raise RuntimeError(f"No body surface polygons matched garment region: {name}")

    ordered = sorted(used)
    remap = {old: index for index, old in enumerate(ordered)}
    vertices = [matrix @ source_mesh.vertices[index].co for index in ordered]
    faces = [tuple(remap[index] for index in face) for face in selected]

    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)

    obj = bpy.data.objects.new(name, mesh)
    obj.matrix_world = inverse.inverted()
    # from_pydata vertices are already world-space, so keep object transform identity.
    obj.matrix_world.identity()

    collection = bpy.data.collections.get(EXPORT_COLLECTION)
    if collection is None:
        collection = bpy.data.collections.new(EXPORT_COLLECTION)
        bpy.context.scene.collection.children.link(collection)
    collection.objects.link(obj)

    material = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    material.use_nodes = True
    mesh.materials.append(material)

    for polygon in mesh.polygons:
        polygon.use_smooth = True

    return obj


def apply_modifier(obj, modifier):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    finally:
        obj.select_set(False)


def body_world_bvh(body):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = body.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        matrix = evaluated.matrix_world
        vertices = [matrix @ vertex.co for vertex in mesh.vertices]
        polygons = [tuple(polygon.vertices) for polygon in mesh.polygons]
        return BVHTree.FromPolygons(vertices, polygons, all_triangles=False, epsilon=0.0)
    finally:
        evaluated.to_mesh_clear()


def body_normal_orientation(body, max_samples=160):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = body.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        if not mesh.polygons:
            return 1.0
        points = world_bounds(body)
        center = sum(points, Vector()) / max(1, len(points))
        matrix = evaluated.matrix_world
        normal_matrix = matrix.to_3x3().inverted().transposed()
        polygons = list(mesh.polygons)
        stride = max(1, len(polygons) // max_samples)
        scores = []
        for polygon in polygons[::stride][:max_samples]:
            point = matrix @ polygon.center
            normal = normal_matrix @ polygon.normal
            if normal.length <= 1e-8:
                continue
            normal.normalize()
            scores.append((point-center).dot(normal))
        if not scores:
            return 1.0
        scores.sort()
        return 1.0 if scores[len(scores)//2] >= 0 else -1.0
    finally:
        evaluated.to_mesh_clear()


def repair_outside_body(obj, body, minimum_clearance_m=0.0025, passes=2):
    tree = body_world_bvh(body)
    orientation = body_normal_orientation(body)
    matrix = obj.matrix_world
    inverse = matrix.inverted()
    moved_total = 0
    max_correction = 0.0
    for _ in range(max(1, passes)):
        moved = 0
        for vertex in obj.data.vertices:
            point = matrix @ vertex.co
            nearest = tree.find_nearest(point)
            if nearest is None or nearest[0] is None or nearest[1] is None:
                continue
            location, normal = nearest[0], nearest[1]
            if normal.length <= 1e-8:
                continue
            outward = normal.normalized() * orientation
            signed = (point-location).dot(outward)
            if signed >= minimum_clearance_m:
                continue
            corrected = location + outward*minimum_clearance_m
            correction = (corrected-point).length
            vertex.co = inverse @ corrected
            moved += 1
            moved_total += 1
            max_correction = max(max_correction, correction)
        obj.data.update()
        if moved == 0:
            break
    return {
        "movedVertices": moved_total,
        "maxCorrectionMm": round(max_correction*1000.0, 2),
        "minimumClearanceMm": round(minimum_clearance_m*1000.0, 2),
    }


def smooth_open_boundaries(obj, iterations=5, factor=0.42):
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    try:
        boundary = {vertex for edge in bm.edges if edge.is_boundary for vertex in edge.verts}
        if not boundary:
            return
        for _ in range(iterations):
            updates = {}
            for vertex in boundary:
                neighbors = [
                    edge.other_vert(vertex)
                    for edge in vertex.link_edges
                    if edge.other_vert(vertex) in boundary
                ]
                if len(neighbors) < 2:
                    neighbors = [edge.other_vert(vertex) for edge in vertex.link_edges]
                if not neighbors:
                    continue
                average = sum((neighbor.co for neighbor in neighbors), Vector()) / len(neighbors)
                updates[vertex] = vertex.co.lerp(average, factor)
            for vertex, position in updates.items():
                vertex.co = position
        bm.to_mesh(mesh)
        mesh.update()
    finally:
        bm.free()


def fit_shell(obj, body, clearance_m, thickness_m):
    shrink = obj.modifiers.new("LE_BODY_CLEARANCE", "SHRINKWRAP")
    shrink.target = body
    shrink.wrap_method = "NEAREST_SURFACEPOINT"
    shrink.wrap_mode = "OUTSIDE_SURFACE"
    shrink.offset = clearance_m
    apply_modifier(obj, shrink)

    smooth = obj.modifiers.new("LE_GARMENT_SMOOTH", "CORRECTIVE_SMOOTH")
    smooth.factor = 0.22
    smooth.iterations = 3
    apply_modifier(obj, smooth)

    solid = obj.modifiers.new("LE_CLOTH_THICKNESS", "SOLIDIFY")
    solid.thickness = thickness_m
    solid.offset = 1.0
    solid.use_rim = True
    apply_modifier(obj, solid)


def guide_center_z(name):
    obj = bpy.data.objects.get(name)
    if obj is None or obj.type != "CURVE":
        return None
    points = []
    for spline in obj.data.splines:
        for point in spline.points:
            points.append(obj.matrix_world @ Vector(point.co[:3]))
    if not points:
        return None
    return sum(point.z for point in points) / len(points)


def x_span_at_z(obj, z_world, band=0.025):
    matrix = obj.matrix_world
    xs = []
    for vertex in obj.data.vertices:
        point = matrix @ vertex.co
        if abs(point.z - z_world) <= band:
            xs.append(point.x)
    if len(xs) < 4:
        return None
    return min(xs), max(xs)


def width_at_z(obj, z_world, band=0.025):
    span = x_span_at_z(obj, z_world, band)
    return (span[1] - span[0]) if span else None


def center_x_at_z(obj, z_world, band=0.040):
    span = x_span_at_z(obj, z_world, band)
    return ((span[0] + span[1]) * 0.5) if span else None


def interpolate_profile(z, anchors):
    ordered = sorted(anchors, key=lambda item: item[0])
    if z <= ordered[0][0]:
        return ordered[0][1]
    if z >= ordered[-1][0]:
        return ordered[-1][1]
    for (z0, value0), (z1, value1) in zip(ordered, ordered[1:]):
        if z0 <= z <= z1:
            t = (z - z0) / max(z1 - z0, 1e-6)
            t = t * t * (3.0 - 2.0 * t)
            return value0 + (value1 - value0) * t
    return ordered[-1][1]


def scale_x_profile(obj, center_x, anchors):
    matrix = obj.matrix_world
    inverse = matrix.inverted()
    for vertex in obj.data.vertices:
        point = matrix @ vertex.co
        factor = interpolate_profile(point.z, anchors)
        point.x = center_x + (point.x - center_x) * factor
        vertex.co = inverse @ point
    obj.data.update()


def shift_x_profile(obj, anchors):
    matrix = obj.matrix_world
    inverse = matrix.inverted()
    for vertex in obj.data.vertices:
        point = matrix @ vertex.co
        point.x += interpolate_profile(point.z, anchors)
        vertex.co = inverse @ point
    obj.data.update()


def shape_officewear_to_identity(authored, body, targets):
    frame = body_frame(body)
    center_x = frame["centerX"]
    shoulder_z = guide_center_z("LE_GUIDE_SHIRT_SHOULDER")
    shirt_waist_z = guide_center_z("LE_GUIDE_SHIRT_WAIST")
    trouser_waist_z = guide_center_z("LE_GUIDE_TROUSER_WAIST")
    left_hem_z = guide_center_z("LE_GUIDE_LEFT_HEM")
    right_hem_z = guide_center_z("LE_GUIDE_RIGHT_HEM")
    left_hand_z = guide_center_z("LE_GUIDE_LEFT_HAND_CENTER_H")
    right_hand_z = guide_center_z("LE_GUIDE_RIGHT_HAND_CENTER_H")
    required = (shoulder_z, shirt_waist_z, trouser_waist_z, left_hem_z, right_hem_z, left_hand_z, right_hand_z)
    if any(value is None for value in required):
        raise RuntimeError("Identity guides are incomplete; cannot fit the production garment candidate.")

    shirt = authored["ShirtTorsoFabric"]
    shoulder_width = width_at_z(shirt, shoulder_z, 0.018)
    waist_width = width_at_z(shirt, shirt_waist_z, 0.025)
    if not shoulder_width or not waist_width:
        raise RuntimeError("Could not measure shirt shell at locked shoulder/waist guides.")
    shoulder_factor = (float(targets["shoulderSeamWidth"]) / 1000.0) / shoulder_width
    waist_factor = (float(targets["shirtWaistWidth"]) / 1000.0) / waist_width
    scale_x_profile(
        shirt,
        center_x,
        [
            (shirt_waist_z - 0.16, waist_factor),
            (shirt_waist_z, waist_factor),
            (shoulder_z, shoulder_factor),
            (shoulder_z + 0.07, shoulder_factor),
        ],
    )
    # Re-measure at the same narrow guide band used by production preflight.
    # Shoulder anatomy slopes quickly, so a wider sampling band can otherwise
    # make the authoring pass believe the seam width is correct while the exact
    # locked shoulder plane is still too narrow.
    corrected_shoulder = width_at_z(shirt, shoulder_z, 0.018)
    if not corrected_shoulder:
        raise RuntimeError("Could not re-measure shirt shoulder after identity fitting.")
    shoulder_correction = (float(targets["shoulderSeamWidth"]) / 1000.0) / corrected_shoulder
    scale_x_profile(
        shirt,
        center_x,
        [
            (shoulder_z - 0.11, 1.0),
            (shoulder_z - 0.035, shoulder_correction),
            (shoulder_z + 0.07, shoulder_correction),
        ],
    )

    trouser_waist = authored["TrouserWaistFabric"]
    trouser_width = width_at_z(trouser_waist, trouser_waist_z, 0.040)
    if not trouser_width:
        raise RuntimeError("Could not measure trouser waist shell at the locked waist guide.")
    trouser_factor = (float(targets["trouserWaistWidth"]) / 1000.0) / trouser_width
    scale_x_profile(
        trouser_waist,
        center_x,
        [(trouser_waist_z - 0.18, trouser_factor), (trouser_waist_z + 0.08, trouser_factor)],
    )

    target_hem = float(targets["hemWidth"]) / 1000.0
    leg_center_half = float(targets["legCenterSpacing"]) / 2000.0
    for name, hem_z, leg_center in (
        ("TrouserLegLFabric", left_hem_z, -leg_center_half),
        ("TrouserLegRFabric", right_hem_z, leg_center_half),
    ):
        leg = authored[name]
        current_hem = width_at_z(leg, hem_z, 0.040)
        if not current_hem:
            raise RuntimeError(f"Could not measure {name} at the locked hem guide.")
        hem_factor = target_hem / current_hem
        scale_x_profile(
            leg,
            leg_center,
            [
                (hem_z - 0.03, hem_factor),
                (hem_z + 0.10, hem_factor),
                (trouser_waist_z - 0.28, 1.0),
                (trouser_waist_z - 0.10, 1.0),
            ],
        )

    target_hand_half = float(targets["handCenterSpacing"]) / 2000.0
    for name, hand_z, target_center in (
        ("ShirtSleeveLFabric", left_hand_z, -target_hand_half),
        ("ShirtSleeveRFabric", right_hand_z, target_hand_half),
    ):
        sleeve = authored[name]
        current_center = center_x_at_z(sleeve, hand_z, 0.070)
        if current_center is None:
            raise RuntimeError(f"Could not measure {name} at the locked cuff/hand guide.")
        delta = target_center - current_center
        shift_x_profile(
            sleeve,
            [(hand_z - 0.16, delta), (hand_z, delta), (shoulder_z - 0.05, 0.0), (shoulder_z + 0.05, 0.0)],
        )

    return {
        "shirtShoulderScale": round(shoulder_factor, 5),
        "shirtShoulderCorrection": round(shoulder_correction, 5),
        "shirtWaistScale": round(waist_factor, 5),
        "trouserWaistScale": round(trouser_factor, 5),
        "targetHemWidthMm": round(target_hem * 1000.0, 2),
        "targetHandCenterSpacingMm": round(target_hand_half * 2000.0, 2),
    }


def assign_shared_material(obj, material_name):
    material = bpy.data.materials.get(material_name)
    if material is None:
        material = bpy.data.materials.new(name=material_name)
        material.use_nodes = True
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0
    return material


def front_y_at_z(body, z_world, band=0.035, x_half=0.10):
    matrix = body.matrix_world
    ys = []
    for vertex in body.data.vertices:
        point = matrix @ vertex.co
        if abs(point.z - z_world) <= band and abs(point.x) <= x_half:
            ys.append(point.y)
    if not ys:
        points = world_bounds(body)
        return min(point.y for point in points)
    return min(ys)


def create_box_detail(name, location, dimensions, material_name, rotation=(0.0, 0.0, 0.0)):
    remove_existing(name)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new("LE_DETAIL_BEVEL", "BEVEL")
    bevel.width = min(dimensions) * 0.22
    bevel.segments = 2
    apply_modifier(obj, bevel)
    assign_shared_material(obj, material_name)
    collection = bpy.data.collections.get(EXPORT_COLLECTION)
    if collection is not None and collection.objects.get(obj.name) is None:
        collection.objects.link(obj)
    planar_grain_uv(obj)
    obj["linen_earth_base_tailoring_detail"] = True
    return obj


def create_button_detail(name, location):
    remove_existing(name)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24,
        radius=0.0062,
        depth=0.0045,
        location=location,
        rotation=(math.radians(90.0), 0.0, 0.0),
    )
    obj = bpy.context.object
    obj.name = name
    material = bpy.data.materials.get("LE_BUTTON_MATERIAL") or bpy.data.materials.new(name="LE_BUTTON_MATERIAL")
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled is not None:
        principled.inputs["Base Color"].default_value = (0.11, 0.085, 0.065, 1.0)
        principled.inputs["Roughness"].default_value = 0.36
        if "Metallic" in principled.inputs:
            principled.inputs["Metallic"].default_value = 0.08
    obj.data.materials.append(material)
    collection = bpy.data.collections.get(EXPORT_COLLECTION)
    if collection is not None and collection.objects.get(obj.name) is None:
        collection.objects.link(obj)
    obj["linen_earth_base_tailoring_detail"] = True
    return obj


def author_base_tailoring_details(body, frame, shirt_clearance_m, trouser_clearance_m, thickness_m):
    for name in (*TAILOR_DETAIL_OBJECTS, *[f"LE_ShirtButton{i}" for i in range(1, 6)]):
        remove_existing(name)

    center_x = frame["centerX"]
    min_z = frame["minZ"]
    height = frame["height"]
    shoulder_z = guide_center_z("LE_GUIDE_SHIRT_SHOULDER") or min_z + height * 0.84
    shirt_waist_z = guide_center_z("LE_GUIDE_SHIRT_WAIST") or min_z + height * 0.65
    trouser_waist_z = guide_center_z("LE_GUIDE_TROUSER_WAIST") or min_z + height * 0.62
    hand_z = guide_center_z("LE_GUIDE_LEFT_HAND_CENTER_H") or min_z + height * 0.54

    details = []

    collar_band = selected_shell(
        body,
        "LE_ShirtCollarBand",
        lambda p: shoulder_z + 0.005 <= p.z <= shoulder_z + 0.072 and abs(p.x-center_x) <= 0.135,
    )
    smooth_open_boundaries(collar_band, iterations=6, factor=0.46)
    fit_shell(collar_band, body, shirt_clearance_m + 0.0045, max(0.0010, thickness_m * 0.8))
    assign_shared_material(collar_band, "ShirtTorsoFabric")
    planar_grain_uv(collar_band)
    collar_band["linen_earth_base_tailoring_detail"] = True
    details.append(collar_band)

    collar_front_y = front_y_at_z(body, shoulder_z + 0.035, 0.045, 0.12) - shirt_clearance_m - 0.010
    details.append(create_box_detail(
        "LE_ShirtCollarWingL",
        (center_x - 0.038, collar_front_y, shoulder_z + 0.030),
        (0.052, 0.011, 0.092),
        "ShirtTorsoFabric",
        rotation=(0.0, math.radians(-24.0), 0.0),
    ))
    details.append(create_box_detail(
        "LE_ShirtCollarWingR",
        (center_x + 0.038, collar_front_y, shoulder_z + 0.030),
        (0.052, 0.011, 0.092),
        "ShirtTorsoFabric",
        rotation=(0.0, math.radians(24.0), 0.0),
    ))

    placket_top = shoulder_z - 0.020
    placket_bottom = shirt_waist_z + 0.025
    placket_z = (placket_top + placket_bottom) * 0.5
    placket_front_y = front_y_at_z(body, placket_z, 0.10, 0.075) - shirt_clearance_m - 0.009
    details.append(create_box_detail(
        "LE_ShirtPlacket",
        (center_x, placket_front_y, placket_z),
        (0.026, 0.006, max(0.24, placket_top - placket_bottom)),
        "ShirtTorsoFabric",
    ))

    button_top = placket_top - 0.040
    button_bottom = placket_bottom + 0.045
    for index in range(5):
        t = index / 4.0
        z_value = button_top + (button_bottom - button_top) * t
        y_value = front_y_at_z(body, z_value, 0.045, 0.060) - shirt_clearance_m - 0.014
        details.append(create_button_detail(f"LE_ShirtButton{index+1}", (center_x, y_value, z_value)))

    for name, side in (("LE_ShirtCuffL", -1), ("LE_ShirtCuffR", 1)):
        cuff = selected_shell(
            body,
            name,
            lambda p, side=side: hand_z + 0.020 <= p.z <= hand_z + 0.088 and (p.x-center_x) * side >= 0.145,
        )
        smooth_open_boundaries(cuff, iterations=6, factor=0.48)
        fit_shell(cuff, body, shirt_clearance_m + 0.0040, max(0.0010, thickness_m * 0.9))
        assign_shared_material(cuff, "ShirtSleeveLFabric" if side < 0 else "ShirtSleeveRFabric")
        planar_grain_uv(cuff)
        cuff["linen_earth_base_tailoring_detail"] = True
        details.append(cuff)

    waistband = selected_shell(
        body,
        "LE_TrouserWaistband",
        lambda p: trouser_waist_z - 0.030 <= p.z <= trouser_waist_z + 0.030 and abs(p.x-center_x) <= 0.205,
    )
    smooth_open_boundaries(waistband, iterations=6, factor=0.46)
    fit_shell(waistband, body, trouser_clearance_m + 0.0035, max(0.0010, thickness_m * 0.9))
    assign_shared_material(waistband, "TrouserWaistFabric")
    planar_grain_uv(waistband)
    waistband["linen_earth_base_tailoring_detail"] = True
    details.append(waistband)

    return details


def planar_grain_uv(obj):
    mesh = obj.data
    if not mesh.uv_layers:
        uv_layer = mesh.uv_layers.new(name="UVMap")
    else:
        uv_layer = mesh.uv_layers.active
    xs = [vertex.co.x for vertex in mesh.vertices]
    zs = [vertex.co.z for vertex in mesh.vertices]
    min_x, max_x = min(xs), max(xs)
    min_z, max_z = min(zs), max(zs)
    span_x = max(max_x - min_x, 1e-6)
    span_z = max(max_z - min_z, 1e-6)
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
            u = (vertex.co.x - min_x) / span_x
            v = (vertex.co.z - min_z) / span_z
            uv_layer.data[loop_index].uv = (u, v)


def main():
    options = cli_args()
    body = bpy.data.objects.get(options.body)
    if body is None or body.type != "MESH":
        raise RuntimeError(f"Locked realistic body mesh not found: {options.body}")

    identity = str(bpy.context.scene.get("linen_earth_model_identity_id", "")).strip()
    locked = bool(bpy.context.scene.get("linen_earth_model_identity_locked", False))
    if identity != MODEL_IDENTITY_ID or not locked:
        raise RuntimeError("Garment authoring requires the locked Linen Earth Real Model Designer body.")

    frame = body_frame(body)
    center_x = frame["centerX"]
    min_z = frame["minZ"]
    height = frame["height"]
    if not math.isfinite(height) or abs(height - 1.727) > 0.02:
        raise RuntimeError(f"Body height is {height:.4f} m; expected the locked 1.727 m body.")

    z = lambda ratio: min_z + height * ratio
    shoulder_z = guide_center_z("LE_GUIDE_SHIRT_SHOULDER") or z(0.84)
    waist_z = guide_center_z("LE_GUIDE_SHIRT_WAIST") or z(0.65)
    arm_root = 0.150
    hip_half = 0.195

    def torso_half_at_height(z_value):
        if z_value <= waist_z:
            return 0.175
        if z_value >= shoulder_z:
            return 0.210
        t = (z_value - waist_z) / max(shoulder_z - waist_z, 1e-6)
        return 0.175 + (0.210 - 0.175) * t

    regions = {
        "ShirtTorsoFabric": lambda p: z(0.580) <= p.z <= z(0.905) and abs(p.x-center_x) <= torso_half_at_height(p.z),
        "ShirtSleeveLFabric": lambda p: z(0.480) <= p.z <= z(0.875) and p.x-center_x <= -arm_root,
        "ShirtSleeveRFabric": lambda p: z(0.480) <= p.z <= z(0.875) and p.x-center_x >= arm_root,
        "TrouserWaistFabric": lambda p: z(0.500) <= p.z <= z(0.675) and abs(p.x-center_x) <= hip_half,
        "TrouserLegLFabric": lambda p: z(0.055) <= p.z <= z(0.575) and p.x < center_x,
        "TrouserLegRFabric": lambda p: z(0.055) <= p.z <= z(0.575) and p.x >= center_x,
    }

    clearance_m = max(0.003, min(0.018, options.clearance_mm / 1000.0))
    shirt_clearance_m = max(0.003, clearance_m - 0.0015)
    trouser_clearance_m = min(0.018, clearance_m + 0.0025)
    thickness_m = max(0.0006, min(0.004, options.thickness_mm / 1000.0))

    for name in GARMENT_OBJECTS:
        remove_existing(name)

    targets_raw = str(bpy.context.scene.get("linen_earth_identity_targets_json", "")).strip()
    try:
        targets = json.loads(targets_raw)
    except json.JSONDecodeError as error:
        raise RuntimeError("Locked model identity targets are not valid JSON.") from error

    authored = {}
    for name, predicate in regions.items():
        obj = selected_shell(body, name, predicate)
        smooth_open_boundaries(obj)
        garment_clearance = shirt_clearance_m if name.startswith("Shirt") else trouser_clearance_m
        fit_shell(obj, body, garment_clearance, thickness_m)
        obj["linen_earth_auto_authored"] = True
        obj["linen_earth_fit_clearance_mm"] = round(garment_clearance * 1000.0, 3)
        obj["linen_earth_cloth_thickness_mm"] = round(thickness_m * 1000.0, 3)
        authored[name] = obj

    fit_profile = shape_officewear_to_identity(authored, body, targets)
    penetration_repairs = {}
    for name, obj in authored.items():
        repair_clearance = 0.0028 if name.startswith("Shirt") else 0.0032
        penetration_repairs[name] = repair_outside_body(obj, body, repair_clearance, passes=2)
        planar_grain_uv(obj)
    tailoring_details = author_base_tailoring_details(
        body,
        frame,
        shirt_clearance_m,
        trouser_clearance_m,
        thickness_m,
    )

    bpy.context.scene["linen_earth_asset_status"] = "auto-authored-production-candidate-needs-tailor-review"
    bpy.context.scene["linen_earth_garment_authoring_method"] = "locked-body-surface-shell-v1"
    bpy.context.scene["linen_earth_garment_clearance_mm"] = round(clearance_m * 1000.0, 3)
    bpy.context.scene["linen_earth_shirt_clearance_mm"] = round(shirt_clearance_m * 1000.0, 3)
    bpy.context.scene["linen_earth_trouser_clearance_mm"] = round(trouser_clearance_m * 1000.0, 3)
    bpy.context.scene["linen_earth_identity_fit_profile_json"] = json.dumps(fit_profile, sort_keys=True)
    bpy.context.scene["linen_earth_penetration_repair_json"] = json.dumps(penetration_repairs, sort_keys=True)
    bpy.context.scene["linen_earth_boundary_smoothing"] = "open-edge-laplacian-v1"
    bpy.context.scene["linen_earth_base_tailoring_details_json"] = json.dumps([obj.name for obj in tailoring_details])
    bpy.context.scene["linen_earth_garment_thickness_mm"] = round(thickness_m * 1000.0, 3)

    output = Path(options.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))

    print(f"Authored Linen Earth six-piece officewear candidate: {output}")
    print("Garment objects: " + ", ".join(obj.name for obj in authored.values()))
    print(f"Shirt/trouser clearances: {shirt_clearance_m*1000:.1f}/{trouser_clearance_m*1000:.1f} mm · cloth shell thickness: {thickness_m*1000:.1f} mm")
    print("Identity fit profile: " + json.dumps(fit_profile, sort_keys=True))
    print("Penetration repairs: " + json.dumps(penetration_repairs, sort_keys=True))
    print("Base tailoring details: " + ", ".join(obj.name for obj in tailoring_details))
    print("Status: candidate only; run Blender preflight and owner/tailor visual fit review before production export.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Linen Earth garment authoring failed: {error}", file=sys.stderr)
        raise SystemExit(1)
