# Run inside Blender 4.2+:
# blender --background your-scene.blend --python scripts/blender/export-linen-earth-officewear.py -- \
#   --output public/models/linen-earth-officewear-v1.glb \
#   --panel-spec path/to/measured-panel-spec.json
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
import json
import math
import os
import re
import runpy
import sys

import bpy
from mathutils import Vector

MODEL_ID = "LE-OFFICEWEAR-V1"
CONTRACT_VERSION = "linen-earth-garment-viewer-v2"
EXPORT_COLLECTION = "LinenEarthExport"
REFERENCE_BODY = "Body"
REFERENCE_HEIGHT_M = 1.727
HEIGHT_TOLERANCE_M = 0.020
MODEL_IDENTITY_ID = "linen-earth-studio-model-v1"
MODEL_REFERENCE_IMAGE = "/designer/studio-tucked.webp"
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

SOURCE_KEYS = {
    "name": "linen_earth_model_source_name",
    "version": "linen_earth_model_source_version",
    "license": "linen_earth_model_source_license",
    "verifiedAt": "linen_earth_model_source_verified_at",
    "sourceUrl": "linen_earth_model_source_url",
}


def cli_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--collection", default=EXPORT_COLLECTION)
    parser.add_argument("--reference-body", default=REFERENCE_BODY)
    parser.add_argument(
        "--panel-spec",
        help=(
            "JSON containing measured physical panel dimensions. "
            "When supplied, the exporter writes the matching .viewer.json sidecar."
        ),
    )
    parser.add_argument(
        "--lab-preview",
        action="store_true",
        help=(
            "Write an explicitly non-promotional realistic-body lab manifest using "
            "geometry-estimated panel extents. Never use this mode for customer promotion."
        ),
    )
    options = parser.parse_args(argv)
    if options.lab_preview and options.panel_spec:
        parser.error("--lab-preview and --panel-spec are mutually exclusive.")
    return options


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


def scene_source_provenance(scene):
    source = {}
    for output_key, scene_key in SOURCE_KEYS.items():
        value = str(scene.get(scene_key, "")).strip()
        if value:
            source[output_key] = value

    missing = [key for key in ("name", "license", "verifiedAt") if not source.get(key)]
    if missing:
        raise RuntimeError(
            "Measured-panel export requires body-source provenance in the Blender scene. "
            "Missing: " + ", ".join(missing) + ". "
            "Use prepare-linen-earth-body.py or stamp equivalent verified source fields."
        )
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", source["verifiedAt"]):
        raise RuntimeError("Source verifiedAt must use YYYY-MM-DD.")

    # Version is useful evidence but the web contract only requires name/license/date.
    if source.get("version"):
        source["name"] = f'{source["name"]} v{source["version"]}'
    source.pop("version", None)
    return source


def scene_model_identity(scene):
    identity_id = str(scene.get("linen_earth_model_identity_id", "")).strip()
    reference_image = str(scene.get("linen_earth_model_reference_image", "")).strip()
    locked = bool(scene.get("linen_earth_model_identity_locked", False))
    targets_raw = str(scene.get("linen_earth_identity_targets_json", "")).strip()
    try:
        targets = json.loads(targets_raw) if targets_raw else None
    except json.JSONDecodeError:
        targets = None
    if identity_id != MODEL_IDENTITY_ID or reference_image != MODEL_REFERENCE_IMAGE or not locked:
        raise RuntimeError(
            "Production export requires the exact Linen Earth Real Model Designer identity. "
            f"Expected {MODEL_IDENTITY_ID} / {MODEL_REFERENCE_IMAGE} with identity lock enabled."
        )
    if targets != EXPECTED_IDENTITY_TARGETS_MM:
        raise RuntimeError("Production export identity physical targets do not match the shared Linen Earth model contract.")
    return {"id": identity_id, "referenceImage": reference_image, "physicalTargetsMm": targets}


def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def geometry_panel_spec():
    panels = {}
    for name in GARMENT_OBJECTS:
        obj = bpy.data.objects.get(name)
        if obj is None or obj.type != "MESH":
            raise RuntimeError(f"Lab preview cannot estimate missing garment panel: {name}")
        points = world_bounds(obj)
        width_mm = (max(point.x for point in points) - min(point.x for point in points)) * 1000.0
        height_mm = (max(point.z for point in points) - min(point.z for point in points)) * 1000.0
        if width_mm <= 0 or height_mm <= 0:
            raise RuntimeError(f"Lab preview panel estimate is invalid for {name}.")
        panels[name] = {
            "widthMm": round(width_mm, 2),
            "heightMm": round(height_mm, 2),
        }
    return {
        "panels": panels,
        "cameraOrbits": None,
        "measurementEvidence": None,
        "dimensionSource": "geometry-estimate-unverified",
    }


def load_panel_spec(path):
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if not isinstance(payload, dict):
        raise RuntimeError("Panel spec must be a JSON object.")

    evidence = payload.get("measurementEvidence")
    if not isinstance(evidence, dict):
        raise RuntimeError(
            "Panel spec requires measurementEvidence so production scale cannot be supplied as anonymous/guessed numbers."
        )
    evidence_source = str(evidence.get("source", "")).strip()
    evidence_date = str(evidence.get("measuredAt", "")).strip()
    evidence_note = str(evidence.get("note", "")).strip()
    allowed_sources = {"owner_measured", "tailor_measured", "pattern_room_measured", "supplier_pattern_verified"}
    if evidence_source not in allowed_sources:
        raise RuntimeError(
            "measurementEvidence.source must be owner_measured, tailor_measured, "
            "pattern_room_measured or supplier_pattern_verified."
        )
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", evidence_date):
        raise RuntimeError("measurementEvidence.measuredAt must use YYYY-MM-DD.")
    if len(evidence_note) < 8:
        raise RuntimeError("measurementEvidence.note must briefly describe how the panel dimensions were measured.")

    panels = payload.get("panels")
    if not isinstance(panels, dict):
        raise RuntimeError("Panel spec must contain a panels object.")

    missing = [name for name in GARMENT_OBJECTS if name not in panels]
    if missing:
        raise RuntimeError("Panel spec is missing measured dimensions for: " + ", ".join(missing))

    normalized = {}
    for name in GARMENT_OBJECTS:
        panel = panels.get(name)
        if not isinstance(panel, dict):
            raise RuntimeError(f"Panel spec entry must be an object: {name}")
        width = panel.get("widthMm")
        height = panel.get("heightMm")
        if not finite_number(width) or width <= 0 or width > 2000:
            raise RuntimeError(f"{name} widthMm must be a measured value between 0 and 2000 mm.")
        if not finite_number(height) or height <= 0 or height > 2500:
            raise RuntimeError(f"{name} heightMm must be a measured value between 0 and 2500 mm.")

        entry = {"widthMm": width, "heightMm": height}
        for key, limit in (("offsetU", 10), ("offsetV", 10), ("rotationDeg", 360)):
            if key not in panel:
                continue
            value = panel[key]
            if not finite_number(value) or abs(value) > limit:
                raise RuntimeError(f"{name} {key} is outside the viewer contract.")
            entry[key] = value
        normalized[name] = entry

    camera_orbits = payload.get("cameraOrbits")
    if camera_orbits is not None:
        if not isinstance(camera_orbits, dict):
            raise RuntimeError("cameraOrbits must be an object when provided.")
        allowed = {"front", "three-quarter", "side", "back"}
        if any(key not in allowed or not isinstance(value, str) or not value.strip() for key, value in camera_orbits.items()):
            raise RuntimeError("cameraOrbits may contain only non-empty front/three-quarter/side/back strings.")

    return {
        "panels": normalized,
        "cameraOrbits": camera_orbits or None,
        "measurementEvidence": {
            "source": evidence_source,
            "measuredAt": evidence_date,
            "note": evidence_note,
        },
    }


def run_scene_preflight():
    preflight_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "preflight-linen-earth-officewear.py")
    if not os.path.exists(preflight_path):
        raise RuntimeError(f"Production scene preflight is missing: {preflight_path}")
    namespace = runpy.run_path(preflight_path, run_name="linen_earth_export_preflight")
    preflight_main = namespace.get("main")
    if not callable(preflight_main):
        raise RuntimeError("Production scene preflight does not expose main().")
    try:
        return preflight_main()
    except SystemExit as error:
        code = error.code if isinstance(error.code, int) else 1
        if code:
            raise RuntimeError("Production scene preflight failed; export is blocked.") from error
        return None


def viewer_manifest_path(output_path):
    root, extension = os.path.splitext(os.path.abspath(output_path))
    if extension.lower() != ".glb":
        raise RuntimeError("--output must end in .glb")
    return root + ".viewer.json"


def write_viewer_manifest(output_path, height, source, model_identity, panel_spec, preflight_report=None, lab_preview=False):
    payload = {
        "version": CONTRACT_VERSION,
        "modelId": MODEL_ID,
        "referenceHeightMm": round(height * 1000),
        "modelIdentity": model_identity,
        "source": source,
        "panels": panel_spec["panels"],
        "productionAssetStatus": (
            "realistic-body-lab-preview-unverified-panel-scale"
            if lab_preview
            else "realistic-body-production-candidate"
        ),
    }
    if lab_preview:
        payload["labPreviewScaleNotice"] = (
            "Panel dimensions are geometry estimates only; physical pattern scale is unverified."
        )
        payload["panelDimensionSource"] = panel_spec.get("dimensionSource")
    else:
        payload["panelMeasurementEvidence"] = panel_spec["measurementEvidence"]
    if isinstance(preflight_report, dict):
        payload["productionFitEvidence"] = {
            "gate": preflight_report.get("gate"),
            "ready": preflight_report.get("ready") is True,
            "identityFitMeasurementsMm": preflight_report.get("identityFitMeasurementsMm"),
            "boundaryIntersections": preflight_report.get("boundaryIntersections"),
            "boundaryClearanceMm": preflight_report.get("boundaryClearanceMm"),
            "totals": preflight_report.get("totals"),
        }
    if panel_spec.get("cameraOrbits"):
        payload["cameraOrbits"] = panel_spec["cameraOrbits"]

    manifest_path = viewer_manifest_path(output_path)
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")
    return manifest_path


def export_glb(collection, output_path):
    # Blender 4.2.23 crashes inside the native glTF operator when asked to
    # apply imported modifiers in-process (CI crash trace, Oct 8). Meshes
    # were explicitly preflighted and baked during scene authoring, so export
    # their evaluated static topology WITHOUT export_apply. Rigged, animated
    # or non-mesh assets are not part of the fixed 3D viewer contract.
    if bpy.context.object is not None and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    selected = [obj for obj in collection.all_objects if obj.type == "MESH"]
    if len(selected) < len(GARMENT_OBJECTS) + 1:
        raise RuntimeError("Blender GLB export selection is missing realistic body/garment meshes.")
    for obj in selected:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = selected[0]
    print(
        "Linen Earth GLB export: static mesh count="
        + str(len(selected)) + "; applying modifiers during export=off",
        flush=True,
    )

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(output_path),
        export_format="GLB",
        use_selection=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_apply=False,
        export_yup=True,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
    )


def main():
    args = cli_args()
    print("Linen Earth GLB export: running independent scene preflight", flush=True)
    preflight_report = run_scene_preflight()
    print("Linen Earth GLB export: preflight complete", flush=True)
    panel_spec = (
        load_panel_spec(args.panel_spec)
        if args.panel_spec
        else geometry_panel_spec() if args.lab_preview else None
    )
    source = scene_source_provenance(bpy.context.scene) if panel_spec else None
    model_identity = scene_model_identity(bpy.context.scene) if panel_spec else None
    print("Linen Earth GLB export: validating source identity and materials", flush=True)
    collection, height = validate_scene(args.collection, args.reference_body)
    print("Linen Earth GLB export: exporting approved collection", flush=True)
    export_glb(collection, args.output)
    print("Linen Earth GLB export: glTF exporter returned successfully", flush=True)

    manifest_path = None
    if panel_spec and source:
        manifest_path = write_viewer_manifest(
            args.output,
            height,
            source,
            model_identity,
            panel_spec,
            preflight_report,
            lab_preview=args.lab_preview,
        )

    print(f"Linen Earth model exported: {os.path.abspath(args.output)}")
    print(f"Model ID: {MODEL_ID}")
    print(f"Model identity: {MODEL_IDENTITY_ID}")
    print(f"Reference body height: {height * 1000:.1f} mm")
    if manifest_path:
        if args.lab_preview:
            print(f"LAB-ONLY viewer manifest written: {manifest_path}")
            print("Panel scale is geometry-estimated and cannot satisfy production promotion evidence.")
        else:
            print(f"Measured viewer manifest written: {manifest_path}")
        print("Next: npm run garment:model-check -- " + os.path.abspath(args.output))
    else:
        print("No .viewer.json was written because --panel-spec was omitted.")
        print(
            "Measure the actual garment/pattern panel dimensions, fill the template, "
            "then export again with --panel-spec before production QA."
        )


if __name__ == "__main__":
    main()
