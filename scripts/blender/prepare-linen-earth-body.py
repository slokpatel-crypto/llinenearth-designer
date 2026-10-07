# Run inside Blender 4.2+:
# blender --background --factory-startup --python scripts/blender/prepare-linen-earth-body.py -- \
#   --asset-root .cache/linen-earth/blender-human-base-meshes-v1.4.1 \
#   --output .cache/linen-earth/linen-earth-officewear-body-base.blend
#
# This script intentionally prepares only the licensed realistic body source.
# It does not invent shirt/trouser geometry or promote a production GLB.

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector

TARGET_HEIGHT_M = 1.727
EXPORT_COLLECTION = "LinenEarthExport"
BODY_NAME = "Body"
SOURCE_NAME = "Blender Human Base Meshes"
SOURCE_VERSION = "1.4.1"
SOURCE_LICENSE = "CC0"
SOURCE_VERIFIED_AT = "2026-10-05"
SOURCE_URL = "https://www.blender.org/download/demo-files/"
MODEL_IDENTITY_ID = "linen-earth-studio-model-v1"
MODEL_REFERENCE_IMAGE = "/designer/studio-tucked.webp"
IDENTITY_GUIDE_COLLECTION = "LinenEarthIdentityGuides"
DEFAULT_IDENTITY_SPEC = Path("public/model-identity/linen-earth-studio-model-v1.json")
MODEL_SHOE_OBJECTS = ("LE_ShoeL", "LE_ShoeR")


def cli_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset-root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--identity-spec", type=Path, default=DEFAULT_IDENTITY_SPEC)
    return parser.parse_args(argv)


def score_name(name: str) -> int:
    value = name.lower()
    score = 0
    if "realistic" in value:
        score += 50
    if "male" in value:
        score += 35
    if "body" in value:
        score += 25
    if re.search(r"body\s*male\s*-?\s*realistic", value):
        score += 100
    return score


def discover_candidate(asset_root: Path):
    candidates = []
    for blend_path in sorted(asset_root.rglob("*.blend")):
        file_score = score_name(blend_path.name)
        try:
            with bpy.data.libraries.load(str(blend_path), link=False) as (data_from, _):
                for name in data_from.collections:
                    score = score_name(name) + file_score
                    if score >= 75:
                        candidates.append((score, "collection", blend_path, name))
                for name in data_from.objects:
                    score = score_name(name) + file_score
                    if score >= 85:
                        candidates.append((score, "object", blend_path, name))
        except Exception:
            continue
    if not candidates:
        raise RuntimeError(
            "No realistic male body candidate was found in the extracted Blender Human Base Meshes library."
        )
    candidates.sort(key=lambda item: (-item[0], str(item[2]), item[3]))
    return candidates[0]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.users == 0:
            bpy.data.collections.remove(collection)


def load_identity_spec(path: Path):
    resolved = path.expanduser().resolve()
    if not resolved.exists():
        raise RuntimeError(f"Model identity spec does not exist: {resolved}")
    payload = json.loads(resolved.read_text(encoding="utf-8"))
    if payload.get("version") != MODEL_IDENTITY_ID:
        raise RuntimeError("Identity spec version does not match the locked Linen Earth model.")
    if payload.get("referenceImage") != MODEL_REFERENCE_IMAGE:
        raise RuntimeError("Identity spec does not point to the exact Real Model Designer reference.")
    if int(payload.get("referenceHeightMm", 0)) != int(TARGET_HEIGHT_M * 1000):
        raise RuntimeError("Identity spec reference height does not match the 1727 mm model lock.")
    targets = payload.get("physicalTargetsMm")
    required = (
        "height",
        "shoulderSeamWidth",
        "outerArmSilhouette",
        "shirtWaistWidth",
        "trouserWaistWidth",
        "handCenterSpacing",
        "legCenterSpacing",
        "hemWidth",
    )
    if not isinstance(targets, dict) or any(not isinstance(targets.get(key), (int, float)) or targets[key] <= 0 for key in required):
        raise RuntimeError("Identity spec is missing positive physicalTargetsMm values.")
    return payload, resolved


def normalize_floor(objects, body):
    min_z = min(point.z for point in world_bounds(body))
    for obj in objects:
        obj.location.z -= min_z
    bpy.context.view_layer.update()
    residual = min(point.z for point in world_bounds(body))
    if abs(residual) > 0.002:
        raise RuntimeError(f"Body floor normalization failed: lowest point is {residual:.4f} m.")
    return min_z


def center_body_xy(body):
    points = world_bounds(body)
    center_x = (min(point.x for point in points) + max(point.x for point in points)) * 0.5
    center_y = (min(point.y for point in points) + max(point.y for point in points)) * 0.5
    body.matrix_world.translation -= Vector((center_x, center_y, 0.0))
    bpy.context.view_layer.update()
    residual = world_bounds(body)
    residual_x = (min(point.x for point in residual) + max(point.x for point in residual)) * 0.5
    residual_y = (min(point.y for point in residual) + max(point.y for point in residual)) * 0.5
    if abs(residual_x) > 0.002 or abs(residual_y) > 0.002:
        raise RuntimeError(
            f"Body XY centering failed: residual center is ({residual_x:.4f}, {residual_y:.4f}) m."
        )
    return center_x, center_y


def apply_body_transforms(body):
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    try:
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    finally:
        body.select_set(False)
    bpy.context.view_layer.update()


def align_arm_stance_to_identity(body, identity_spec):
    mesh = body.data
    targets = identity_spec["physicalTargetsMm"]
    frame = identity_spec["referenceFrame"]
    shoulder_anchor = identity_spec["frontSilhouetteAnchors"]["shirtShoulder"]
    shoulder_z = TARGET_HEIGHT_M * (1.0 - float(shoulder_anchor["yPx"]) / float(frame["heightPx"]))
    hand_z = TARGET_HEIGHT_M * 0.54
    target_half = float(targets["handCenterSpacing"]) / 2000.0

    side_vertices = {
        -1: [vertex for vertex in mesh.vertices if vertex.co.x < -0.16],
        1: [vertex for vertex in mesh.vertices if vertex.co.x > 0.16],
    }
    deltas = {}
    for side, vertices in side_vertices.items():
        hand_band = [
            vertex.co.x
            for vertex in vertices
            if abs(vertex.co.z - hand_z) <= 0.085
        ]
        if len(hand_band) < 8:
            deltas[side] = 0.0
            continue
        hand_band.sort()
        current = hand_band[len(hand_band) // 2]
        target = side * target_half
        delta = target - current
        deltas[side] = delta
        for vertex in vertices:
            z = vertex.co.z
            if z > shoulder_z + 0.03 or z < hand_z - 0.30:
                continue
            if z >= shoulder_z:
                blend = 0.0
            elif z <= hand_z:
                blend = 1.0
            else:
                blend = (shoulder_z - z) / max(shoulder_z - hand_z, 1e-6)
            blend = max(0.0, min(1.0, blend))
            # Smoothstep keeps the shoulder fixed while bringing the hanging arm
            # gradually into the locked straight-officewear stance.
            blend = blend * blend * (3.0 - 2.0 * blend)
            vertex.co.x += delta * blend

    mesh.update()
    bpy.context.view_layer.update()
    return {
        "leftDeltaMm": round(deltas.get(-1, 0.0) * 1000.0, 2),
        "rightDeltaMm": round(deltas.get(1, 0.0) * 1000.0, 2),
    }


def create_identity_shoes(body):
    for name in MODEL_SHOE_OBJECTS:
        existing = bpy.data.objects.get(name)
        if existing is not None:
            bpy.data.objects.remove(existing, do_unlink=True)

    points = [body.matrix_world @ vertex.co for vertex in body.data.vertices]
    floor_z = min(point.z for point in points)
    foot_band = [point for point in points if point.z <= floor_z + 0.14]
    if len(foot_band) < 20:
        raise RuntimeError("Could not isolate realistic body feet for the locked dress-shoe silhouette.")

    collection = bpy.data.collections.get(EXPORT_COLLECTION)
    if collection is None:
        collection = bpy.data.collections.new(EXPORT_COLLECTION)
        bpy.context.scene.collection.children.link(collection)

    material = bpy.data.materials.get("LE_SHOE_MATERIAL") or bpy.data.materials.new(name="LE_SHOE_MATERIAL")
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled is not None:
        principled.inputs["Base Color"].default_value = (0.055, 0.043, 0.034, 1.0)
        principled.inputs["Roughness"].default_value = 0.42

    created = []
    for side, name in ((-1, "LE_ShoeL"), (1, "LE_ShoeR")):
        side_points = [point for point in foot_band if point.x * side > 0.0]
        if len(side_points) < 8:
            raise RuntimeError(f"Could not isolate foot geometry for {name}.")
        min_x, max_x = min(point.x for point in side_points), max(point.x for point in side_points)
        min_y, max_y = min(point.y for point in side_points), max(point.y for point in side_points)
        width = min(0.145, max(0.095, (max_x - min_x) + 0.014))
        length = min(0.315, max(0.250, (max_y - min_y) + 0.050))
        center_x = (min_x + max_x) * 0.5
        center_y = (min_y + max_y) * 0.5 - 0.018

        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=32,
            ring_count=16,
            location=(center_x, center_y, floor_z + 0.055),
        )
        shoe = bpy.context.object
        shoe.name = name
        shoe.scale = (width * 0.50, length * 0.50, 0.057)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

        # A subtle toe taper prevents the upper from reading like a generic capsule.
        for vertex in shoe.data.vertices:
            if vertex.co.y < 0:
                normalized = min(1.0, abs(vertex.co.y) / max(length * 0.52, 1e-6))
                vertex.co.x *= 1.0 - 0.10 * normalized
                vertex.co.z *= 0.92 + 0.08 * (1.0 - normalized)
        shoe.data.update()
        for polygon in shoe.data.polygons:
            polygon.use_smooth = True
        shoe.data.materials.append(material)
        shoe["linen_earth_identity_shoe"] = True
        shoe["linen_earth_shoe_style"] = "minimal-dress-shoe-v1"
        if collection.objects.get(shoe.name) is None:
            collection.objects.link(shoe)
        created.append(shoe)

    return created


def create_identity_guides(identity_spec):
    existing = bpy.data.collections.get(IDENTITY_GUIDE_COLLECTION)
    if existing is not None:
        for obj in list(existing.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(existing)

    collection = bpy.data.collections.new(IDENTITY_GUIDE_COLLECTION)
    bpy.context.scene.collection.children.link(collection)
    frame = identity_spec["referenceFrame"]
    anchors = identity_spec["frontSilhouetteAnchors"]
    targets = identity_spec["physicalTargetsMm"]
    frame_height = float(frame["heightPx"])
    leg_center = float(targets["legCenterSpacing"]) / 2000.0
    hand_center = float(targets["handCenterSpacing"]) / 2000.0
    outer_arm_half = float(targets["outerArmSilhouette"]) / 2000.0

    def anchor_z(anchor):
        return TARGET_HEIGHT_M * (1.0 - float(anchor["yPx"]) / frame_height)

    def add_segment(name, start, end):
        curve = bpy.data.curves.new(name=name, type="CURVE")
        curve.dimensions = "3D"
        curve.bevel_depth = 0.0015
        curve.bevel_resolution = 1
        spline = curve.splines.new("POLY")
        spline.points.add(1)
        spline.points[0].co = (*start, 1.0)
        spline.points[1].co = (*end, 1.0)
        obj = bpy.data.objects.new(name, curve)
        obj.hide_render = True
        obj.hide_viewport = False
        obj.display_type = "WIRE"
        obj["linen_earth_identity_guide"] = True
        collection.objects.link(obj)

    def add_bar(name, center_x, z, width_m):
        half = width_m / 2.0
        add_segment(name, (center_x - half, 0.0, z), (center_x + half, 0.0, z))

    def add_marker(name, x, z, half_size=0.012):
        add_segment(name + "_H", (x - half_size, 0.0, z), (x + half_size, 0.0, z))
        add_segment(name + "_V", (x, 0.0, z - half_size), (x, 0.0, z + half_size))

    add_bar(
        "LE_GUIDE_SHIRT_SHOULDER",
        0.0,
        anchor_z(anchors["shirtShoulder"]),
        float(targets["shoulderSeamWidth"]) / 1000.0,
    )
    add_bar(
        "LE_GUIDE_SHIRT_WAIST",
        0.0,
        anchor_z(anchors["shirtWaist"]),
        float(targets["shirtWaistWidth"]) / 1000.0,
    )
    add_bar(
        "LE_GUIDE_TROUSER_WAIST",
        0.0,
        anchor_z(anchors["trouserWaist"]),
        float(targets["trouserWaistWidth"]) / 1000.0,
    )
    hem_width = float(targets["hemWidth"]) / 1000.0
    left_hem_z = anchor_z(anchors["leftTrouserHem"])
    right_hem_z = anchor_z(anchors["rightTrouserHem"])
    shoulder_z = anchor_z(anchors["shirtShoulder"])
    hand_z = TARGET_HEIGHT_M * 0.54

    add_bar("LE_GUIDE_LEFT_HEM", -leg_center, left_hem_z, hem_width)
    add_bar("LE_GUIDE_RIGHT_HEM", leg_center, right_hem_z, hem_width)
    add_bar("LE_GUIDE_OUTER_ARM_SILHOUETTE", 0.0, shoulder_z - 0.19, outer_arm_half * 2.0)
    add_marker("LE_GUIDE_LEFT_HAND_CENTER", -hand_center, hand_z)
    add_marker("LE_GUIDE_RIGHT_HAND_CENTER", hand_center, hand_z)
    add_marker("LE_GUIDE_LEFT_LEG_CENTER", -leg_center, (left_hem_z + anchor_z(anchors["trouserWaist"])) / 2.0)
    add_marker("LE_GUIDE_RIGHT_LEG_CENTER", leg_center, (right_hem_z + anchor_z(anchors["trouserWaist"])) / 2.0)
    add_segment("LE_GUIDE_HEIGHT", (0.0, 0.0, 0.0), (0.0, 0.0, TARGET_HEIGHT_M))
    return collection


def append_candidate(kind: str, blend_path: Path, name: str):
    loaded = []
    with bpy.data.libraries.load(str(blend_path), link=False) as (data_from, data_to):
        if kind == "collection":
            if name not in data_from.collections:
                raise RuntimeError(f"Collection disappeared from source library: {name}")
            data_to.collections = [name]
        else:
            if name not in data_from.objects:
                raise RuntimeError(f"Object disappeared from source library: {name}")
            data_to.objects = [name]

    if kind == "collection":
        collection = data_to.collections[0]
        bpy.context.scene.collection.children.link(collection)
        loaded = list(collection.all_objects)
    else:
        obj = data_to.objects[0]
        bpy.context.scene.collection.objects.link(obj)
        loaded = [obj]
    return [obj for obj in loaded if obj is not None]


def world_bounds(obj):
    return [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]


def mesh_height(obj):
    points = world_bounds(obj)
    return max(point.z for point in points) - min(point.z for point in points)


def mesh_volume_score(obj):
    points = world_bounds(obj)
    xs = [point.x for point in points]
    ys = [point.y for point in points]
    zs = [point.z for point in points]
    return max(0.0, max(xs) - min(xs)) * max(0.0, max(ys) - min(ys)) * max(0.0, max(zs) - min(zs))


def choose_body_object(objects):
    meshes = [obj for obj in objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("The chosen Blender source contains no mesh object.")
    meshes.sort(
        key=lambda obj: (
            score_name(obj.name),
            mesh_volume_score(obj),
        ),
        reverse=True,
    )
    return meshes[0]


def retain_locked_body_only(objects, body):
    removed = []
    for obj in list(objects):
        if obj is body:
            continue
        removed.append(obj.name)
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()
    return [body], removed


def normalize_height(objects, body):
    height = mesh_height(body)
    if not math.isfinite(height) or height <= 0:
        raise RuntimeError("Could not measure the realistic male body height.")
    factor = TARGET_HEIGHT_M / height
    for obj in objects:
        obj.location *= factor
        obj.scale *= factor
    bpy.context.view_layer.update()
    measured = mesh_height(body)
    if abs(measured - TARGET_HEIGHT_M) > 0.002:
        raise RuntimeError(
            f"Body normalization failed: measured {measured:.4f} m after explicit scaling."
        )
    return height, factor, measured


def ensure_export_collection(objects):
    collection = bpy.data.collections.get(EXPORT_COLLECTION)
    if collection is None:
        collection = bpy.data.collections.new(EXPORT_COLLECTION)
        bpy.context.scene.collection.children.link(collection)
    for obj in objects:
        if collection.objects.get(obj.name) is None:
            collection.objects.link(obj)
    return collection


def stamp_provenance(scene, source_file: Path, source_datablock: str, original_height: float, factor: float, identity_spec, identity_spec_path: Path):
    scene["linen_earth_model_source_name"] = SOURCE_NAME
    scene["linen_earth_model_source_version"] = SOURCE_VERSION
    scene["linen_earth_model_source_license"] = SOURCE_LICENSE
    scene["linen_earth_model_source_verified_at"] = SOURCE_VERIFIED_AT
    scene["linen_earth_model_source_url"] = SOURCE_URL
    scene["linen_earth_model_source_file"] = str(source_file)
    scene["linen_earth_model_source_datablock"] = source_datablock
    scene["linen_earth_body_target_height_mm"] = int(TARGET_HEIGHT_M * 1000)
    scene["linen_earth_body_original_height_m"] = round(original_height, 6)
    scene["linen_earth_body_scale_factor"] = round(factor, 8)
    scene["linen_earth_model_identity_id"] = MODEL_IDENTITY_ID
    scene["linen_earth_model_reference_image"] = MODEL_REFERENCE_IMAGE
    scene["linen_earth_model_identity_locked"] = True
    scene["linen_earth_asset_status"] = "body-source-prepared-garments-required"
    scene["linen_earth_identity_spec_path"] = str(identity_spec_path)
    scene["linen_earth_identity_targets_json"] = json.dumps(identity_spec["physicalTargetsMm"], sort_keys=True)
    scene["linen_earth_identity_guide_collection"] = IDENTITY_GUIDE_COLLECTION


def main():
    options = cli_args()
    asset_root = Path(options.asset_root).expanduser().resolve()
    output = Path(options.output).expanduser().resolve()
    identity_spec, identity_spec_path = load_identity_spec(options.identity_spec)

    if not asset_root.exists():
        raise RuntimeError(
            f"Asset root does not exist: {asset_root}. "
            "Run npm run garment:model-base:fetch first."
        )

    score, kind, blend_path, datablock = discover_candidate(asset_root)
    clear_scene()
    objects = append_candidate(kind, blend_path, datablock)
    body = choose_body_object(objects)
    original_name = body.name
    body.name = BODY_NAME
    objects, removed_auxiliary_objects = retain_locked_body_only(objects, body)
    original_height, factor, measured = normalize_height(objects, body)
    floor_shift = normalize_floor(objects, body)
    center_shift = center_body_xy(body)
    apply_body_transforms(body)
    arm_stance = align_arm_stance_to_identity(body, identity_spec)
    ensure_export_collection(objects)
    identity_shoes = create_identity_shoes(body)
    create_identity_guides(identity_spec)
    stamp_provenance(
        bpy.context.scene,
        blend_path,
        datablock,
        original_height,
        factor,
        identity_spec,
        identity_spec_path,
    )
    bpy.context.scene["linen_earth_body_center_shift_x_m"] = round(center_shift[0], 6)
    bpy.context.scene["linen_earth_body_center_shift_y_m"] = round(center_shift[1], 6)
    bpy.context.scene["linen_earth_arm_stance_json"] = json.dumps(arm_stance, sort_keys=True)
    bpy.context.scene["linen_earth_removed_auxiliary_objects_json"] = json.dumps(removed_auxiliary_objects)
    bpy.context.scene["linen_earth_identity_shoes_json"] = json.dumps([shoe.name for shoe in identity_shoes])

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))

    print(f"Prepared Linen Earth realistic body base: {output}")
    print(f"Source: {SOURCE_NAME} v{SOURCE_VERSION} · {SOURCE_LICENSE}")
    print(f"Locked model identity: {MODEL_IDENTITY_ID} · {MODEL_REFERENCE_IMAGE}")
    print(f"Selected: {blend_path.name} :: {kind} {datablock} (score {score})")
    print(f"Body object: {original_name} -> {BODY_NAME}")
    print(f"Removed non-body source objects: {len(removed_auxiliary_objects)}")
    print(f"Explicit height normalization: {original_height:.4f} m -> {measured:.4f} m")
    print(f"Floor normalization shift: {floor_shift:.4f} m")
    print(f"Body XY source offset removed: ({center_shift[0]:.4f}, {center_shift[1]:.4f}) m")
    print(f"Officewear arm stance adjustment: {json.dumps(arm_stance, sort_keys=True)}")
    print("Identity shoes: " + ", ".join(shoe.name for shoe in identity_shoes))
    print(f"Identity guide collection: {IDENTITY_GUIDE_COLLECTION}")
    print(f"Identity targets: {json.dumps(identity_spec['physicalTargetsMm'], sort_keys=True)}")
    print(
        "Next: author/finalize the tucked shirt and tailored trouser in this file, "
        "then use export-linen-earth-officewear.py. No production GLB has been approved."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Linen Earth body preparation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
