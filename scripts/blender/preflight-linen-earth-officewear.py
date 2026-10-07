# Run inside Blender 4.2+:
# blender --background your-scene.blend --python scripts/blender/preflight-linen-earth-officewear.py
#
# This is a geometry/scene QA gate only. It does not modify the asset.

from __future__ import annotations

import json
import math
import sys

import bpy
from mathutils import Vector

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
        return {
            "vertices": vertices,
            "polygons": polygons,
            "triangles": triangles,
            "degenerateFaces": degenerate,
            "degenerateRatio": (degenerate / polygons) if polygons else 1.0,
            "uvLayers": uv_layers,
            "activeUv": uv_name,
        }
    finally:
        evaluated.to_mesh_clear()


def material_slot_names(obj):
    return [slot.material.name if slot.material else "" for slot in obj.material_slots]


def main():
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
        }
        guide_names = {obj.name for obj in identity_guides.objects}
        missing_guides = sorted(required_guides - guide_names)
        if missing_guides:
            reasons.append("Missing identity silhouette guides: " + ", ".join(missing_guides))

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
    print(json.dumps(report, indent=2))
    if reasons:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
