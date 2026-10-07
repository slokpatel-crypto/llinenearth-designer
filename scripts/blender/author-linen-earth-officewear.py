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
from mathutils import Vector

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
    min_y = min(point.y for point in points)
    max_y = max(point.y for point in points)
    min_z = min(point.z for point in points)
    max_z = max(point.z for point in points)
    return {
        "centerX": (min_x + max_x) * 0.5,
        "centerY": (min_y + max_y) * 0.5,
        "minZ": min_z,
        "height": max_z - min_z,
    }


def remove_existing(name):
    obj = bpy.data.objects.get(name)
    if obj is not None:
        bpy.data.objects.remove(obj, do_unlink=True)


def ensure_export_collection():
    collection = bpy.data.collections.get(EXPORT_COLLECTION)
    if collection is None:
        collection = bpy.data.collections.new(EXPORT_COLLECTION)
        bpy.context.scene.collection.children.link(collection)
    return collection


def build_ring_shell(name, rings, segments=48, neck_opening=None):
    if len(rings) < 2:
        raise RuntimeError(f"{name} requires at least two rings.")
    collection = ensure_export_collection()
    vertices = []
    faces = []
    for ring_index, ring in enumerate(rings):
        z_value, center_x, center_y, radius_x, radius_y = ring
        for segment in range(segments):
            angle = 2.0 * math.pi * segment / segments
            vertices.append((
                center_x + math.cos(angle) * radius_x,
                center_y + math.sin(angle) * radius_y,
                z_value,
            ))
        if ring_index:
            previous = (ring_index - 1) * segments
            current = ring_index * segments
            for segment in range(segments):
                nxt = (segment + 1) % segments
                faces.append((
                    previous + segment,
                    previous + nxt,
                    current + nxt,
                    current + segment,
                ))

    if neck_opening is not None:
        top_index = (len(rings) - 1) * segments
        z_value, center_x, center_y, neck_rx, neck_ry = neck_opening
        neck_start = len(vertices)
        for segment in range(segments):
            angle = 2.0 * math.pi * segment / segments
            vertices.append((
                center_x + math.cos(angle) * neck_rx,
                center_y + math.sin(angle) * neck_ry,
                z_value,
            ))
        for segment in range(segments):
            nxt = (segment + 1) % segments
            faces.append((
                top_index + segment,
                top_index + nxt,
                neck_start + nxt,
                neck_start + segment,
            ))

    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    material.use_nodes = True
    mesh.materials.append(material)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def body_depth_at_z(body, z_world, center_x, half_window, band=0.030, minimum=0.10):
    matrix = body.matrix_world
    ys = []
    for vertex in body.data.vertices:
        point = matrix @ vertex.co
        if abs(point.z - z_world) <= band and abs(point.x - center_x) <= half_window:
            ys.append(point.y)
    if len(ys) < 6:
        return minimum
    return max(minimum, (max(ys) - min(ys)) * 0.5)


def build_procedural_officewear(body, targets, shirt_clearance_m, trouser_clearance_m):
    frame = body_frame(body)
    cx = frame["centerX"]
    cy = frame["centerY"]
    shoulder_z = guide_center_z("LE_GUIDE_SHIRT_SHOULDER")
    shirt_waist_z = guide_center_z("LE_GUIDE_SHIRT_WAIST")
    trouser_waist_z = guide_center_z("LE_GUIDE_TROUSER_WAIST")
    left_hem_z = guide_center_z("LE_GUIDE_LEFT_HEM")
    right_hem_z = guide_center_z("LE_GUIDE_RIGHT_HEM")
    left_hand_z = guide_center_z("LE_GUIDE_LEFT_HAND_CENTER_H")
    right_hand_z = guide_center_z("LE_GUIDE_RIGHT_HAND_CENTER_H")
    if any(value is None for value in (shoulder_z, shirt_waist_z, trouser_waist_z, left_hem_z, right_hem_z, left_hand_z, right_hand_z)):
        raise RuntimeError("Locked identity guides are required for procedural officewear authoring.")

    shoulder_half = float(targets["shoulderSeamWidth"]) / 2000.0
    shirt_waist_half = float(targets["shirtWaistWidth"]) / 2000.0
    trouser_waist_half = float(targets["trouserWaistWidth"]) / 2000.0
    hand_half = float(targets["handCenterSpacing"]) / 2000.0
    leg_center_half = float(targets["legCenterSpacing"]) / 2000.0
    hem_half = float(targets["hemWidth"]) / 2000.0

    chest_z = shoulder_z - 0.150
    upper_waist_z = shirt_waist_z + 0.115
    shirt_hem_z = trouser_waist_z - 0.035
    shirt_depth_shoulder = body_depth_at_z(body, shoulder_z - 0.035, cx, 0.225, minimum=0.105) + shirt_clearance_m
    shirt_depth_chest = body_depth_at_z(body, chest_z, cx, 0.210, minimum=0.115) + shirt_clearance_m
    shirt_depth_waist = body_depth_at_z(body, shirt_waist_z, cx, 0.185, minimum=0.100) + shirt_clearance_m
    shirt_depth_hem = max(0.100, shirt_depth_waist - 0.004)

    shirt = build_ring_shell(
        "ShirtTorsoFabric",
        [
            (shirt_hem_z, cx, cy, shirt_waist_half + 0.006, shirt_depth_hem),
            (shirt_waist_z, cx, cy, shirt_waist_half, shirt_depth_waist),
            (upper_waist_z, cx, cy, shirt_waist_half + 0.012, shirt_depth_waist + 0.006),
            (chest_z, cx, cy, shoulder_half - 0.020, shirt_depth_chest),
            (shoulder_z - 0.045, cx, cy, shoulder_half - 0.006, shirt_depth_shoulder),
            (shoulder_z, cx, cy, shoulder_half, shirt_depth_shoulder * 0.96),
        ],
        segments=64,
        neck_opening=(shoulder_z, cx, cy - 0.006, 0.061, 0.054),
    )

    sleeve_top_z = shoulder_z - 0.018
    cuff_z = (left_hand_z + right_hand_z) * 0.5 + 0.055
    sleeve_length = max(0.42, sleeve_top_z - cuff_z)
    sleeve_top_center = shoulder_half + 0.030
    sleeve_top_radius = 0.068
    sleeve_elbow_radius = 0.052
    cuff_radius_x = 0.038
    cuff_radius_y = 0.032
    sleeves = {}
    for side, name in ((-1, "ShirtSleeveLFabric"), (1, "ShirtSleeveRFabric")):
        top_x = cx + side * sleeve_top_center
        cuff_x = cx + side * hand_half
        elbow_z = cuff_z + sleeve_length * 0.48
        elbow_x = top_x + (cuff_x - top_x) * 0.58
        sleeves[name] = build_ring_shell(
            name,
            [
                (sleeve_top_z, top_x, cy, sleeve_top_radius, sleeve_top_radius * 0.82),
                (sleeve_top_z - 0.105, top_x + side * 0.010, cy, 0.062, 0.050),
                (elbow_z, elbow_x, cy, sleeve_elbow_radius, 0.043),
                (cuff_z + 0.085, cuff_x, cy, 0.043, 0.035),
                (cuff_z, cuff_x, cy, cuff_radius_x, cuff_radius_y),
            ],
            segments=48,
        )

    seat_z = trouser_waist_z - 0.165
    upper_thigh_z = trouser_waist_z - 0.260
    trouser_depth_waist = body_depth_at_z(body, trouser_waist_z, cx, 0.205, minimum=0.115) + trouser_clearance_m
    trouser_depth_seat = body_depth_at_z(body, seat_z, cx, 0.220, minimum=0.135) + trouser_clearance_m
    trouser_waist = build_ring_shell(
        "TrouserWaistFabric",
        [
            (upper_thigh_z, cx, cy, trouser_waist_half + 0.026, trouser_depth_seat),
            (seat_z, cx, cy - 0.006, trouser_waist_half + 0.034, trouser_depth_seat + 0.006),
            (trouser_waist_z - 0.070, cx, cy, trouser_waist_half + 0.010, trouser_depth_waist + 0.004),
            (trouser_waist_z, cx, cy, trouser_waist_half, trouser_depth_waist),
        ],
        segments=64,
    )

    legs = {}
    for side, name, hem_z in (
        (-1, "TrouserLegLFabric", left_hem_z),
        (1, "TrouserLegRFabric", right_hem_z),
    ):
        thigh_center_x = cx + side * (leg_center_half - 0.012)
        lower_center_x = cx + side * leg_center_half
        knee_z = hem_z + (upper_thigh_z - hem_z) * 0.48
        calf_z = hem_z + (upper_thigh_z - hem_z) * 0.20
        legs[name] = build_ring_shell(
            name,
            [
                (upper_thigh_z + 0.050, thigh_center_x, cy - 0.002, 0.078, 0.082),
                (upper_thigh_z - 0.070, thigh_center_x, cy, 0.071, 0.075),
                (knee_z, lower_center_x, cy, 0.050, 0.052),
                (calf_z, lower_center_x, cy, 0.042, 0.045),
                (hem_z + 0.035, lower_center_x, cy, hem_half, 0.038),
                (hem_z, lower_center_x, cy, hem_half, 0.037),
            ],
            segments=48,
        )

    authored = {
        "ShirtTorsoFabric": shirt,
        **sleeves,
        "TrouserWaistFabric": trouser_waist,
        **legs,
    }
    return authored, {
        "method": "closed-tailoring-ring-shell-v2",
        "shirtShoulderWidthMm": round(shoulder_half * 2000.0, 2),
        "shirtWaistWidthMm": round(shirt_waist_half * 2000.0, 2),
        "trouserWaistWidthMm": round(trouser_waist_half * 2000.0, 2),
        "handCenterSpacingMm": round(hand_half * 2000.0, 2),
        "legCenterSpacingMm": round(leg_center_half * 2000.0, 2),
        "hemWidthMm": round(hem_half * 2000.0, 2),
    }


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

    clearance_m = max(0.003, min(0.018, options.clearance_mm / 1000.0))
    shirt_clearance_m = max(0.004, clearance_m - 0.0010)
    trouser_clearance_m = min(0.020, clearance_m + 0.0030)
    thickness_m = max(0.0006, min(0.004, options.thickness_mm / 1000.0))

    for name in GARMENT_OBJECTS:
        remove_existing(name)

    targets_raw = str(bpy.context.scene.get("linen_earth_identity_targets_json", "")).strip()
    try:
        targets = json.loads(targets_raw)
    except json.JSONDecodeError as error:
        raise RuntimeError("Locked model identity targets are not valid JSON.") from error

    authored, fit_profile = build_procedural_officewear(body, targets, shirt_clearance_m, trouser_clearance_m)
    for name, obj in authored.items():
        obj["linen_earth_auto_authored"] = True
        obj["linen_earth_fit_clearance_mm"] = round(
            shirt_clearance_m if name.startswith("Shirt") else trouser_clearance_m,
            3,
        )
        obj["linen_earth_cloth_thickness_mm"] = round(thickness_m * 1000.0, 3)
        planar_grain_uv(obj)

    bpy.context.scene["linen_earth_asset_status"] = "auto-authored-production-candidate-needs-tailor-review"
    bpy.context.scene["linen_earth_garment_authoring_method"] = "closed-tailoring-ring-shell-v2"
    bpy.context.scene["linen_earth_garment_clearance_mm"] = round(clearance_m * 1000.0, 3)
    bpy.context.scene["linen_earth_shirt_clearance_mm"] = round(shirt_clearance_m * 1000.0, 3)
    bpy.context.scene["linen_earth_trouser_clearance_mm"] = round(trouser_clearance_m * 1000.0, 3)
    bpy.context.scene["linen_earth_identity_fit_profile_json"] = json.dumps(fit_profile, sort_keys=True)
    bpy.context.scene["linen_earth_garment_thickness_mm"] = round(thickness_m * 1000.0, 3)

    output = Path(options.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))

    print(f"Authored Linen Earth six-piece officewear candidate: {output}")
    print("Garment objects: " + ", ".join(obj.name for obj in authored.values()))
    print(f"Shirt/trouser clearances: {shirt_clearance_m*1000:.1f}/{trouser_clearance_m*1000:.1f} mm · cloth shell thickness: {thickness_m*1000:.1f} mm")
    print("Identity fit profile: " + json.dumps(fit_profile, sort_keys=True))
    print("Status: candidate only; run Blender preflight and owner/tailor visual fit review before production export.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Linen Earth garment authoring failed: {error}", file=sys.stderr)
        raise SystemExit(1)
