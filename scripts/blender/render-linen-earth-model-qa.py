# Blender 4.2+ — run against the existing, identity-locked Linen Earth scene:
# blender --background .cache/linen-earth/linen-earth-officewear-authored.blend \
#   --python scripts/blender/render-linen-earth-model-qa.py -- \
#   --output-dir artifacts/model-qa
#
# Studio turntable evidence is taken from the SAME source Blender scene.
# Never generate a replacement person, mutate the source file, or label
# renders as photorealism/tailor-approved. The file is deliberately not saved.
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

IDENTITY_ID = "linen-earth-studio-model-v1"
REFERENCE_IMAGE = "/designer/studio-tucked.webp"
GARMENT_OBJECTS = (
    "ShirtTorsoFabric", "ShirtSleeveLFabric", "ShirtSleeveRFabric",
    "TrouserWaistFabric", "TrouserLegLFabric", "TrouserLegRFabric",
)
VIEWS = (
    ("front", 0.0),
    ("three-quarter", 35.0),
    ("side", 90.0),
    ("back", 180.0),
)


def args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--width", type=int, default=768)
    parser.add_argument("--height", type=int, default=1088)
    parser.add_argument("--samples", type=int, default=48)
    return parser.parse_args(argv)


def verify_source():
    source = Path(bpy.data.filepath)
    if not source.is_file() or not source.name.endswith(".blend"):
        raise RuntimeError("Load the actual identity-locked Linen Earth .blend before rendering.")
    scene = bpy.context.scene
    if (scene.get("linen_earth_model_identity_id") != IDENTITY_ID
        or scene.get("linen_earth_model_reference_image") != REFERENCE_IMAGE
        or not scene.get("linen_earth_model_identity_locked")):
        raise RuntimeError("Scene is not locked to the canonical Designer Studio reference.")
    body = bpy.data.objects.get("Body")
    if body is None or body.type != "MESH":
        raise RuntimeError("Expected the existing realistic Body mesh, not a placeholder.")
    missing = [name for name in GARMENT_OBJECTS
               if (bpy.data.objects.get(name) is None
                   or bpy.data.objects[name].type != "MESH")]
    if missing:
        raise RuntimeError("Six garment mesh panels are required: " + ", ".join(missing))
    for name in GARMENT_OBJECTS:
        if len(bpy.data.objects[name].data.polygons) == 0:
            raise RuntimeError(f"Empty garment geometry cannot be photographed: {name}")
    bounds = [body.matrix_world @ Vector(corner) for corner in body.bound_box]
    bottom = min(p.z for p in bounds)
    top = max(p.z for p in bounds)
    if abs(top - bottom - 1.727) > 0.020:
        raise RuntimeError("Body height deviates from the locked 1727 mm studio model.")
    return source, (bottom + top) / 2.0, bottom


def material(name, color, roughness=0.9):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
    return mat


def add_area(name, location, power, size, target):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_studio(mid_height, floor_z, options):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.eevee.taa_render_samples = options.samples
    scene.render.resolution_x = options.width
    scene.render.resolution_y = options.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("LE_QA_WORLD")
    scene.world.use_nodes = True
    world_background = scene.world.node_tree.nodes.get("Background")
    if world_background is not None:
        world_background.inputs["Color"].default_value = (0.69, 0.69, 0.69, 1.0)
        world_background.inputs["Strength"].default_value = 0.8
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "AgX"

    # QA-only diagnostic cloth colors distinguish the garment shells from
    # imported skin. The file is NEVER saved: no customer swatch/color is
    # fabricated or applied to the persistent source scene.
    shirt_mat = material("LE_QA_UNVERIFIED_SHIRT", (0.22, 0.045, 0.072), 0.87)
    trouser_mat = material("LE_QA_UNVERIFIED_TROUSERS", (0.055, 0.085, 0.155), 0.88)
    body_mat = material("LE_QA_MATTE_BODY", (0.53, 0.51, 0.47), 0.94)
    for name in GARMENT_OBJECTS:
        obj = bpy.data.objects[name]
        obj.data.materials.clear()
        obj.data.materials.append(shirt_mat if name.startswith("Shirt") else trouser_mat)
        # Scan polygons can retain indexes into old material slots. With just
        # one QA slot, out-of-range polygon indices render misleading white
        # body/shirt patches instead of the intended diagnostic garment color.
        for polygon in obj.data.polygons:
            polygon.material_index = 0
    body_obj = bpy.data.objects["Body"]
    body_obj.data.materials.clear()
    body_obj.data.materials.append(body_mat)
    for polygon in body_obj.data.polygons:
        polygon.material_index = 0

    camera_data = bpy.data.cameras.new("LE_QA_TURNTABLE_CAMERA")
    camera = bpy.data.objects.new("LE_QA_TURNTABLE_CAMERA", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 2.06
    camera_data.lens = 50

    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, floor_z - 0.012))
    floor = bpy.context.object
    floor.name = "LE_QA_TEMP_FLOOR"
    floor.data.materials.append(material("LE_QA_FLOOR", (0.88, 0.87, 0.85)))
    target = (0, 0, mid_height)
    add_area("LE_QA_KEY", (-2.5, -3.3, 4.0), 650, 3.0, target)
    add_area("LE_QA_FILL", (2.8, -1.0, 3.3), 360, 2.4, target)
    add_area("LE_QA_RIM", (0.4, 2.8, 3.6), 500, 2.0, target)
    return camera


def main():
    options = args()
    if options.width < 480 or options.height < 640 or options.samples < 8:
        raise RuntimeError("QA render resolution/samples must retain usable inspection detail.")
    source, mid_height, floor_z = verify_source()
    output = options.output_dir.expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    camera = setup_studio(mid_height, floor_z, options)
    scene = bpy.context.scene
    manifest = {
        "version": "linen-earth-model-qa-turntable-v1",
        "referenceImage": REFERENCE_IMAGE,
        "modelIdentityId": IDENTITY_ID,
        "sourceBlendName": source.name,
        "sourceBlendSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "identityLocked": True,
        "candidateOnly": True,
        "diagnosticColorsOnly": True,
        "supplierColorCalibration": False,
        "photographicMatchApproved": False,
        "realismApproved": False,
        "tailorApproved": False,
        "measuredFabricDrapeApproved": False,
        "renderEngine": scene.render.engine,
        "resolution": [options.width, options.height],
        "angles": [],
    }
    target = Vector((0, 0, mid_height))
    for label, yaw_deg in VIEWS:
        yaw = math.radians(yaw_deg)
        camera.location = (3.6 * math.sin(yaw), -3.6 * math.cos(yaw), mid_height)
        camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
        filename = f"linen-earth-model-{label}.png"
        destination = output / filename
        scene.render.filepath = str(destination)
        bpy.ops.render.render(write_still=True)
        if not destination.is_file() or destination.stat().st_size < 12_000:
            raise RuntimeError(f"Rendered frame missing or too small: {label}")
        manifest["angles"].append({
            "view": label, "yawDeg": yaw_deg, "file": filename,
            "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        })
    (output / "model-qa-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Linen Earth candidate four-angle QA written to {output}")
    print("NOT APPROVED: visual identity, real drape, pattern scale and tailor signoff remain required.")


if __name__ == "__main__":
    main()
