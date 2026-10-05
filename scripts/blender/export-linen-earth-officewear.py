# Run inside Blender 4.2+:
# blender --background your-scene.blend --python scripts/blender/export-linen-earth-officewear.py -- --output public/models/linen-earth-officewear-v1.glb
#
# Scene contract:
# - garment mesh objects must be named exactly like the six material slots below
# - each garment object needs UV0
# - body/eyes/shoes may use any names/materials
# - use a collection named LinenEarthExport for the exact export set
#
# This script does NOT invent garment drape, pattern dimensions or tailoring.
# It prepares an already-approved body/garment scene for the web GLB contract.

import argparse
import math
import os
import sys

import bpy
from mathutils import Vector

MODEL_ID = "LE-OFFICEWEAR-V1"
EXPORT_COLLECTION = "LinenEarthExport"
REFERENCE_BODY = "Body"
REFERENCE_HEIGHT_M = 1.727
HEIGHT_TOLERANCE_M = 0.020

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
    parser.add_argument("--collection", default=EXPORT_COLLECTION)
    parser.add_argument("--reference-body", default=REFERENCE_BODY)
    return parser.parse_args(argv)


def world_bounds(obj):
    return [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]


def object_height(obj):
    points = world_bounds(obj)
    return max(point.z for point in points) - min(point.z for point in points)


def ensure_material(obj, material_name):
    material = bpy.data.materials.get(material_name) or bpy.data.materials.new(material_name)
    material.use_nodes = True
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0


def validate_scene(collection_name, reference_body_name):
    collection = bpy.data.collections.get(collection_name)
    if collection is None:
        raise RuntimeError(f"Missing export collection: {collection_name}")

    export_objects = list(collection.all_objects)
    export_names = {obj.name for obj in export_objects}
    missing = [name for name in GARMENT_OBJECTS if name not in export_names]
    if missing:
        raise RuntimeError("Missing garment objects: " + ", ".join(missing))

    for name in GARMENT_OBJECTS:
        obj = bpy.data.objects[name]
        if obj.type != "MESH":
            raise RuntimeError(f"{name} must be a MESH object.")
        if not obj.data.uv_layers:
            raise RuntimeError(f"{name} needs a UV map before export.")
        ensure_material(obj, name)

    reference = bpy.data.objects.get(reference_body_name)
    if reference is None or reference.type != "MESH":
        raise RuntimeError(f"Reference body mesh not found: {reference_body_name}")

    height = object_height(reference)
    if not math.isfinite(height) or height <= 0:
        raise RuntimeError("Reference body height could not be measured.")

    delta = abs(height - REFERENCE_HEIGHT_M)
    if delta > HEIGHT_TOLERANCE_M:
        raise RuntimeError(
            f"Reference body is {height:.3f} m tall; Linen Earth target is "
            f"{REFERENCE_HEIGHT_M:.3f} m ± {HEIGHT_TOLERANCE_M:.3f} m. "
            "Adjust the body intentionally before export rather than auto-scaling at export time."
        )

    return collection, height


def export_glb(collection, output_path):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in collection.all_objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(output_path),
        export_format="GLB",
        use_selection=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
    )


def main():
    args = cli_args()
    collection, height = validate_scene(args.collection, args.reference_body)
    export_glb(collection, args.output)
    print(f"Linen Earth model exported: {os.path.abspath(args.output)}")
    print(f"Model ID: {MODEL_ID}")
    print(f"Reference body height: {height * 1000:.1f} mm")
    print("Next: create the matching .viewer.json from measured garment-panel dimensions.")
    print("Then run: npm run garment:model-check -- " + os.path.abspath(args.output))


if __name__ == "__main__":
    main()
