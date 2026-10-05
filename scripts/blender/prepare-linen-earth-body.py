# Run inside Blender 4.2+:
# blender --background --factory-startup --python scripts/blender/prepare-linen-earth-body.py -- \
#   --asset-root .cache/linen-earth/blender-human-base-meshes-v1.4.1 \
#   --output .cache/linen-earth/linen-earth-officewear-body-base.blend
#
# This script intentionally prepares only the licensed realistic body source.
# It does not invent shirt/trouser geometry or promote a production GLB.

from __future__ import annotations

import argparse
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


def cli_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset-root", required=True)
    parser.add_argument("--output", required=True)
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


def stamp_provenance(scene, source_file: Path, source_datablock: str, original_height: float, factor: float):
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
    scene["linen_earth_asset_status"] = "body-source-prepared-garments-required"


def main():
    options = cli_args()
    asset_root = Path(options.asset_root).expanduser().resolve()
    output = Path(options.output).expanduser().resolve()

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
    original_height, factor, measured = normalize_height(objects, body)
    ensure_export_collection(objects)
    stamp_provenance(bpy.context.scene, blend_path, datablock, original_height, factor)

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))

    print(f"Prepared Linen Earth realistic body base: {output}")
    print(f"Source: {SOURCE_NAME} v{SOURCE_VERSION} · {SOURCE_LICENSE}")
    print(f"Selected: {blend_path.name} :: {kind} {datablock} (score {score})")
    print(f"Body object: {original_name} -> {BODY_NAME}")
    print(f"Explicit height normalization: {original_height:.4f} m -> {measured:.4f} m")
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
