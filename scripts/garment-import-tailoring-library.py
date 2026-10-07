# Import the deterministic tailoring-variant geometry library into the realistic
# Blender body/garment scene while discarding the deterministic mannequin/base shells.
#
# blender --background realistic-authored.blend --python scripts/garment-import-tailoring-library.py -- \
#   --variant-glb public/models/linen-earth-officewear-v1.glb \
#   --output .cache/linen-earth/linen-earth-officewear-authored.blend

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import bpy

EXPORT_COLLECTION = "LinenEarthExport"
BASE_OBJECT_NAMES = {
    "Head", "EarL", "EarR", "Neck", "HandL", "HandR",
    "ShirtTorsoFabric", "ShirtSleeveLFabric", "ShirtSleeveRFabric",
    "TrouserWaistFabric", "TrouserLegLFabric", "TrouserLegRFabric",
    "ShoeL", "ShoeR", "SoleL", "SoleR", "HeelL", "HeelR",
}
VARIANT_MARKERS = (
    "Variant__",
    "Length__",
)
SKIN_VARIANT_PREFIX = "MannequinSkinArmVariant__"


def cli_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant-glb", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


def normalized_name(name):
    return re.sub(r"\.\d{3}$", "", str(name or ""))


def material_names(obj):
    if obj.type != "MESH":
        return []
    return [str(slot.name or "").strip() for slot in obj.data.materials if slot is not None]


def is_tailoring_variant_material(name):
    value = str(name or "").strip()
    return (
        any(marker in value for marker in VARIANT_MARKERS)
        or value.startswith(SKIN_VARIANT_PREFIX)
    )


def ensure_export_collection():
    collection = bpy.data.collections.get(EXPORT_COLLECTION)
    if collection is None:
        collection = bpy.data.collections.new(EXPORT_COLLECTION)
        bpy.context.scene.collection.children.link(collection)
    return collection


def detach_keep_world(obj):
    matrix = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = matrix


def main():
    options = cli_args()
    variant_glb = Path(options.variant_glb).expanduser().resolve()
    output = Path(options.output).expanduser().resolve()
    if not variant_glb.exists():
        raise RuntimeError(f"Tailoring variant GLB not found: {variant_glb}")

    required_realistic = {
        "Body",
        "ShirtTorsoFabric", "ShirtSleeveLFabric", "ShirtSleeveRFabric",
        "TrouserWaistFabric", "TrouserLegLFabric", "TrouserLegRFabric",
    }
    missing_realistic = sorted(name for name in required_realistic if bpy.data.objects.get(name) is None)
    if missing_realistic:
        raise RuntimeError(
            "Tailoring library import requires the authored realistic scene first. Missing: "
            + ", ".join(missing_realistic)
        )

    existing_objects = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(variant_glb))
    imported = [obj for obj in bpy.data.objects if obj not in existing_objects]
    if not imported:
        raise RuntimeError("Deterministic tailoring GLB imported no Blender objects.")

    kept = []
    discarded = []
    variant_materials = set()
    for obj in imported:
        names = material_names(obj)
        keep = obj.type == "MESH" and any(is_tailoring_variant_material(name) for name in names)
        if keep:
            detach_keep_world(obj)
            for name in names:
                if is_tailoring_variant_material(name):
                    variant_materials.add(name)
            obj["linen_earth_tailoring_variant"] = True
            obj["linen_earth_tailoring_source"] = "deterministic-library-fit-to-locked-identity"
            kept.append(obj)
        else:
            discarded.append(obj)

    # Remove all deterministic mannequin/base objects and import parents. Kept mesh
    # objects were detached first so their world transforms remain stable.
    for obj in sorted(discarded, key=lambda item: len(list(item.children)), reverse=True):
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)

    collection = ensure_export_collection()
    for obj in kept:
        for current in list(obj.users_collection):
            current.objects.unlink(obj)
        collection.objects.link(obj)
        obj.hide_viewport = False
        obj.hide_render = False

        for material in obj.data.materials:
            if material is None:
                continue
            material.use_nodes = True
            # Variant materials must start hidden; GarmentViewer activates the selected
            # construction by changing the material alpha at runtime.
            principled = material.node_tree.nodes.get("Principled BSDF")
            if principled is not None and "Alpha" in principled.inputs:
                principled.inputs["Alpha"].default_value = 0.0
            material.diffuse_color = (*material.diffuse_color[:3], 0.0)
            if hasattr(material, "surface_render_method"):
                try:
                    material.surface_render_method = "DITHERED"
                except Exception:
                    pass
            elif hasattr(material, "blend_method"):
                try:
                    material.blend_method = "BLEND"
                except Exception:
                    pass

    if not kept or not variant_materials:
        raise RuntimeError("No tailoring variant geometry survived deterministic-library import.")

    # Guard against accidentally retaining a second deterministic body/base garment.
    retained_names = {normalized_name(obj.name) for obj in kept}
    leaked_base = sorted(retained_names.intersection(BASE_OBJECT_NAMES))
    if leaked_base:
        raise RuntimeError("Deterministic base geometry leaked into realistic scene: " + ", ".join(leaked_base))

    bpy.context.scene["linen_earth_tailoring_library_source"] = str(variant_glb)
    bpy.context.scene["linen_earth_tailoring_variant_object_count"] = len(kept)
    bpy.context.scene["linen_earth_tailoring_variant_material_count"] = len(variant_materials)
    bpy.context.scene["linen_earth_tailoring_variant_materials_json"] = json.dumps(sorted(variant_materials))

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))

    print(f"Imported Linen Earth tailoring library: {variant_glb}")
    print(f"Retained variant objects: {len(kept)}")
    print(f"Retained variant materials: {len(variant_materials)}")
    print(f"Saved realistic + tailoring hybrid scene: {output}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Linen Earth tailoring-library import failed: {error}", file=sys.stderr)
        raise SystemExit(1)
