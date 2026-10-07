# Render four neutral review views of the Linen Earth realistic officewear candidate.
# Run inside Blender 4.2+:
# blender --background candidate.blend --python scripts/blender/render-linen-earth-officewear-review.py -- --output-dir artifacts/realistic-3d/review

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

BODY_NAME = "Body"
SHIRT_OBJECTS = ("ShirtTorsoFabric", "ShirtSleeveLFabric", "ShirtSleeveRFabric")
TROUSER_OBJECTS = ("TrouserWaistFabric", "TrouserLegLFabric", "TrouserLegRFabric")
VIEWS = (
    ("front", 0.0),
    ("three-quarter", 35.0),
    ("side", 90.0),
    ("back", 180.0),
)


def cli_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--resolution-x", type=int, default=768)
    parser.add_argument("--resolution-y", type=int, default=1024)
    return parser.parse_args(argv)


def rgba(hex_value: str):
    value = hex_value.lstrip("#")
    if len(value) != 6:
        raise ValueError(hex_value)
    return tuple(int(value[i:i+2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)


def material(name: str, color: str, roughness: float):
    existing = bpy.data.materials.get(name)
    mat = existing or bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    principled = nodes.get("Principled BSDF")
    if principled is not None:
        principled.inputs["Base Color"].default_value = rgba(color)
        principled.inputs["Roughness"].default_value = roughness
        if "Specular IOR Level" in principled.inputs:
            principled.inputs["Specular IOR Level"].default_value = 0.28
    return mat


def assign_material(obj, mat):
    if obj is None or obj.type != "MESH":
        return
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def world_bounds(obj):
    return [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]


def body_frame(body):
    points = world_bounds(body)
    xs = [point.x for point in points]
    ys = [point.y for point in points]
    zs = [point.z for point in points]
    return {
        "center": Vector(((min(xs)+max(xs))*0.5, (min(ys)+max(ys))*0.5, (min(zs)+max(zs))*0.5)),
        "height": max(zs)-min(zs),
        "min_z": min(zs),
        "max_z": max(zs),
    }


def ensure_camera():
    camera = bpy.data.objects.get("LE_REVIEW_CAMERA")
    if camera is None:
        data = bpy.data.cameras.new("LE_REVIEW_CAMERA")
        camera = bpy.data.objects.new("LE_REVIEW_CAMERA", data)
        bpy.context.scene.collection.objects.link(camera)
    camera.data.lens = 58
    camera.data.sensor_width = 36
    bpy.context.scene.camera = camera
    return camera


def point_camera(camera, target: Vector):
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, energy, size, target):
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    bpy.context.scene.collection.objects.link(obj)
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


def studio_setup(body):
    frame = body_frame(body)
    target = Vector((frame["center"].x, frame["center"].y, frame["min_z"] + frame["height"] * 0.52))

    # Remove any previous review-only setup for deterministic reruns.
    for obj in list(bpy.data.objects):
        if obj.name.startswith("LE_REVIEW_"):
            bpy.data.objects.remove(obj, do_unlink=True)

    camera = ensure_camera()

    add_area_light(
        "LE_REVIEW_KEY",
        Vector((-1.55, -2.00, frame["min_z"] + frame["height"] * 1.15)),
        900,
        1.7,
        target,
    )
    add_area_light(
        "LE_REVIEW_FILL",
        Vector((1.55, -1.25, frame["min_z"] + frame["height"] * 0.85)),
        520,
        1.4,
        target,
    )
    add_area_light(
        "LE_REVIEW_RIM",
        Vector((0.0, 1.75, frame["min_z"] + frame["height"] * 1.05)),
        700,
        1.2,
        target,
    )

    bpy.ops.mesh.primitive_plane_add(size=7.0, location=(frame["center"].x, frame["center"].y, frame["min_z"] - 0.002))
    floor = bpy.context.object
    floor.name = "LE_REVIEW_FLOOR"
    assign_material(floor, material("LE_REVIEW_FLOOR_MAT", "#E7E2D7", 0.76))

    return frame, target, camera


def configure_scene(options):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = max(320, options.resolution_x)
    scene.render.resolution_y = max(480, options.resolution_y)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"

    world = scene.world or bpy.data.worlds.new("LE_REVIEW_WORLD")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background is not None:
        background.inputs["Color"].default_value = rgba("#F8F6F0")
        background.inputs["Strength"].default_value = 0.55

    scene.view_settings.look = "AgX - Medium High Contrast"


def main():
    options = cli_args()
    output_dir = Path(options.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    body = bpy.data.objects.get(BODY_NAME)
    if body is None or body.type != "MESH":
        raise RuntimeError("Realistic review render requires the prepared Body mesh.")

    missing = [name for name in (*SHIRT_OBJECTS, *TROUSER_OBJECTS) if bpy.data.objects.get(name) is None]
    if missing:
        raise RuntimeError("Review render is missing garment objects: " + ", ".join(missing))

    skin = material("LE_REVIEW_SKIN", "#BFA58F", 0.64)
    shirt = material("LE_REVIEW_SHIRT", "#EEE8DC", 0.72)
    trouser = material("LE_REVIEW_TROUSER", "#4B5360", 0.70)
    assign_material(body, skin)
    for name in SHIRT_OBJECTS:
        assign_material(bpy.data.objects.get(name), shirt)
    for name in TROUSER_OBJECTS:
        assign_material(bpy.data.objects.get(name), trouser)

    configure_scene(options)
    frame, target, camera = studio_setup(body)

    radius = max(2.65, frame["height"] * 1.68)
    z = frame["min_z"] + frame["height"] * 0.52
    manifest = []

    # Treat negative Y as canonical front. All four views are always rendered,
    # so orientation errors remain visible even if a source asset is reversed.
    for label, yaw_deg in VIEWS:
        angle = math.radians(yaw_deg)
        camera.location = Vector((
            frame["center"].x + math.sin(angle) * radius,
            frame["center"].y - math.cos(angle) * radius,
            z,
        ))
        point_camera(camera, target)
        output = output_dir / f"{label}.png"
        bpy.context.scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        manifest.append((label, yaw_deg, str(output)))
        print(f"Rendered {label}: {output}")

    manifest_path = output_dir / "review-views.txt"
    manifest_path.write_text(
        "\n".join(f"{label}\t{yaw:.1f}\t{path}" for label, yaw, path in manifest) + "\n",
        encoding="utf-8",
    )
    print(f"Rendered Linen Earth review set: {output_dir}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Linen Earth review rendering failed: {error}", file=sys.stderr)
        raise SystemExit(1)
