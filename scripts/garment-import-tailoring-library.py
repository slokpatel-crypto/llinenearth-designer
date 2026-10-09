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
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from footwear_fit_geometry import shoe_depth_bounds

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
# Unlike the deterministic mannequin, the base dress-shoe meshes have no
# realistic-body replacement. Retain them in the candidate until reviewed.
FOOTWEAR_OBJECT_NAMES = {"ShoeL", "ShoeR", "SoleL", "SoleR", "HeelL", "HeelR"}


def is_footwear_object(obj):
    name = normalized_name(obj.name)
    return name in FOOTWEAR_OBJECT_NAMES or bool(re.fullmatch(r"ShoeLace[LR][0-9]+", name))



def foot_side(obj):
    name = normalized_name(obj.name)
    if name in ("ShoeL", "SoleL", "HeelL") or re.fullmatch(r"ShoeLaceL[0-9]+", name):
        return -1
    if name in ("ShoeR", "SoleR", "HeelR") or re.fullmatch(r"ShoeLaceR[0-9]+", name):
        return 1
    return None


def fit_footwear_to_locked_body(footwear, body):
    """Map the entire shoe/sole/heel group onto the real body's feet in world space.

    The deterministic source was authored around a different ankle/depth centre.
    Merely retaining its footwear gives a barefoot mannequin and shoes lying in
    front of the foot in four-view renders. This is provisional geometry fitting,
    not an approved physical footwear pattern or replacement model identity.
    """
    # Source GLB instances share a SINGLE DressShoeUpperMesh across ShoeL/R
    # and a SINGLE SoleMesh across SoleL/R/HeelL/R. Editing shared mesh
    # vertices in a left-foot pass then a right-foot pass moves BOTH feet:
    # real 2026-10-09 GLB showed ShoeL and ShoeR incorrectly on +X and the
    # rendered mannequin was barefoot. Break mesh datablock aliasing BEFORE
    # taking group bounds or moving even one footwear vertex. No body edits.
    detached = 0
    for obj in footwear:
        if obj.type != "MESH":
            raise RuntimeError("Footwear fitting requires a real mesh object.")
        if obj.data.users > 1:
            obj.data = obj.data.copy()
            detached += 1
    world_body = [body.matrix_world @ vertex.co for vertex in body.data.vertices]
    if len(world_body) < 100:
        raise RuntimeError("Locked realistic body has too few vertices for footwear fitting.")
    floor = min(point.z for point in world_body)
    stature = max(point.z for point in world_body) - floor
    middle_x = (min(point.x for point in world_body) + max(point.x for point in world_body)) * 0.5
    evidence = {}
    for side, label in ((-1, "left"), (1, "right")):
        pieces = [obj for obj in footwear if foot_side(obj) == side]
        if len(pieces) < 3:
            raise RuntimeError(f"Missing {label} shoe, sole or heel pieces for real-foot fitting.")
        samples = [
            point for point in world_body
            if floor - 0.005 <= point.z <= floor + 0.135
            and side * (point.x - middle_x) >= 0.015
        ]
        if len(samples) < 20:
            raise RuntimeError(f"Cannot identify {label} foot on the locked human body.")
        points = [
            obj.matrix_world @ vertex.co
            for obj in pieces for vertex in obj.data.vertices
        ]
        if not points:
            raise RuntimeError(f"Missing {label} footwear mesh vertices.")
        original = [
            (min(point[axis] for point in points), max(point[axis] for point in points))
            for axis in range(3)
        ]
        # The low-ankle slice omits much of the toe; its raw Y bbox
        # collapsed a 540 mm source sole to 25% in the Blender candidate.
        # Use a bounded stature-based shoe depth and retain visual review.
        shoe_y_low, shoe_y_high = shoe_depth_bounds((point.y for point in samples), stature)
        target = [
            (min(point.x for point in samples)-0.010, max(point.x for point in samples)+0.010),
            (shoe_y_low, shoe_y_high),
            (floor-0.002, floor+0.128),
        ]
        scales = []
        for (low, high), (to_low, to_high) in zip(original, target):
            if high-low < 0.002:
                raise RuntimeError(f"{label} footwear has a degenerate bounding extent.")
            scale = (to_high-to_low)/(high-low)
            if not 0.20 <= scale <= 3.0:
                raise RuntimeError(
                    f"{label} footwear requires out-of-range fit scale {scale:.2f}; "
                    "the realistic foot and deterministic source cannot be safely aligned."
                )
            # Source footwear has a different coordinate/unit envelope from the
            # scanned body; 0.25x in the long axis is observed in native Blender
            # CI. Allow provisional fitting, but explicitly require independent
            # four-angle review. Bounds do NOT certify physically correct shoes.
            scales.append(scale)
        for obj in pieces:
            matrix = obj.matrix_world.copy()
            inverse = matrix.inverted()
            for vertex in obj.data.vertices:
                point = matrix @ vertex.co
                aligned = Vector(tuple(
                    (target[axis][0]+(point[axis]-original[axis][0])*scales[axis])
                    for axis in range(3)
                ))
                vertex.co = inverse @ aligned
            obj.data.update()
            obj["linen_earth_footwear_fit_method"] = "locked-body-foot-cross-section-provisional"
        # Verify ACTUAL post-fit world coordinates, not just calculated
        # targets; an aliased mesh or double transformation must fail here.
        aligned_points=[
            obj.matrix_world @ vertex.co
            for obj in pieces for vertex in obj.data.vertices
        ]
        shoe_center_x=(min(p.x for p in aligned_points)+max(p.x for p in aligned_points))*0.5
        if side*(shoe_center_x-middle_x)<0.015:
            raise RuntimeError(
                f"{label} footwear remained on the wrong side of the locked human body."
            )
        evidence[label] = {
            "postFitWorldCenterXmm":round(shoe_center_x*1000,2),
            "sharedSourceMeshCopiesDetached":detached,
            "sampleCount":len(samples),
            "scaleX":round(scales[0],4),
            "scaleY":round(scales[1],4),
            "scaleZ":round(scales[2],4),
            "requiresHumanGeometryReview": True,  # Provisional even within plausible scale
            "shoeVisibilityGateRequired": True,
            "floorMm":round(floor*1000,2),
            "targetShoeLengthMm":round((shoe_y_high-shoe_y_low)*1000,2),
            "source":"body-sampled-provisional-not-tailor-approved",
        }
    return evidence


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


def world_bvh(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        matrix = evaluated.matrix_world
        vertices = [matrix @ vertex.co for vertex in mesh.vertices]
        polygons = [tuple(polygon.vertices) for polygon in mesh.polygons if len(polygon.vertices) >= 3]
        if not vertices or not polygons:
            return None
        return BVHTree.FromPolygons(vertices, polygons, all_triangles=False, epsilon=0.0)
    finally:
        evaluated.to_mesh_clear()


def normal_orientation(obj, max_samples=160):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        if not mesh.polygons:
            return 1.0
        points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        center = sum(points, Vector()) / max(1, len(points))
        matrix = evaluated.matrix_world
        normal_matrix = matrix.to_3x3().inverted().transposed()
        polygons = list(mesh.polygons)
        stride = max(1, len(polygons) // max_samples)
        values = []
        for polygon in polygons[::stride][:max_samples]:
            point = matrix @ polygon.center
            normal = normal_matrix @ polygon.normal
            if normal.length <= 1e-8:
                continue
            normal.normalize()
            values.append((point-center).dot(normal))
        if not values:
            return 1.0
        values.sort()
        return 1.0 if values[len(values)//2] >= 0 else -1.0
    finally:
        evaluated.to_mesh_clear()


def repair_variant_outside_body(obj, body, minimum_clearance_m, body_tree=None, body_orientation=None):
    # The locked body geometry does not change during variant import. Reusing its
    # BVH and surface orientation prevents an expensive body mesh evaluation
    # for each of the many independently fitted tailoring variants.
    if obj.type != "MESH":
        raise RuntimeError("Tailoring clearance requires a mesh variant.")
    tree = body_tree if body_tree is not None else world_bvh(body)
    if tree is None:
        raise RuntimeError("Locked body BVH is unavailable; cannot certify tailoring clearance.")
    orientation = body_orientation if body_orientation is not None else normal_orientation(body)
    matrix = obj.matrix_world
    inverse = matrix.inverted()
    moved = 0
    max_correction = 0.0
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
        max_correction = max(max_correction, correction)
    obj.data.update()
    return {
        "movedVertices": moved,
        "maxCorrectionMm": round(max_correction*1000.0, 2),
        "minimumClearanceMm": round(minimum_clearance_m*1000.0, 2),
    }


def variant_clearance(materials):
    joined = " ".join(materials)
    if joined.startswith("MannequinSkinArmVariant__") or "MannequinSkinArmVariant__" in joined:
        return None
    if "Trouser" in joined:
        return 0.0055
    if "Shirt" in joined:
        return 0.0045
    return 0.0035


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
    body = bpy.data.objects.get("Body")
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
        footwear = obj.type == "MESH" and is_footwear_object(obj)
        keep = obj.type == "MESH" and (footwear or any(is_tailoring_variant_material(name) for name in names))
        if keep:
            detach_keep_world(obj)
            for name in names:
                if is_tailoring_variant_material(name):
                    variant_materials.add(name)
            if footwear:
                obj["linen_earth_footwear_source"] = "deterministic-library-fit-review-required"
                obj["linen_earth_footwear_unverified"] = True
            else:
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
    # Build the immutable locked-body collision reference once. Per-variant
    # repairs must be checked against the same human body, never a stale
    # deterministic mannequin or silently skipped because BVH is missing.
    body_tree = world_bvh(body)
    if body_tree is None:
        raise RuntimeError("Locked body collision tree could not be built.")
    body_orientation = normal_orientation(body)
    repair_stats = {}
    for obj in kept:
        for current in list(obj.users_collection):
            current.objects.unlink(obj)
        collection.objects.link(obj)
        obj.hide_viewport = False
        obj.hide_render = False

        names = material_names(obj)
        footwear = is_footwear_object(obj)
        clearance = None if footwear else variant_clearance(names)
        if clearance is not None:
            repair_stats[obj.name] = repair_variant_outside_body(
                obj, body, clearance, body_tree, body_orientation
            )

        if footwear:
            # Genuine shoe, sole and lace surfaces stay visible during four-angle
            # review; hiding them like selectable shirt variants left a barefoot
            # human in the alleged officewear production candidate.
            continue
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
    leaked_base = sorted(retained_names.intersection(BASE_OBJECT_NAMES - FOOTWEAR_OBJECT_NAMES))
    if leaked_base:
        raise RuntimeError("Deterministic base geometry leaked into realistic scene: " + ", ".join(leaked_base))

    footwear_kept = sorted(normalized_name(obj.name) for obj in kept if is_footwear_object(obj))
    missing_footwear = sorted(FOOTWEAR_OBJECT_NAMES - set(footwear_kept))
    if missing_footwear:
        raise RuntimeError("Dress-shoe geometry is missing after library import: " + ", ".join(missing_footwear))
    footwear_fit = fit_footwear_to_locked_body(
        [obj for obj in kept if is_footwear_object(obj)], body
    )
    bpy.context.scene["linen_earth_footwear_fit_evidence_json"] = json.dumps(footwear_fit, sort_keys=True)
    bpy.context.scene["linen_earth_footwear_source"] = "deterministic-library-fit-review-required"
    bpy.context.scene["linen_earth_footwear_object_names_json"] = json.dumps(footwear_kept)
    bpy.context.scene["linen_earth_tailoring_library_source"] = str(variant_glb)
    bpy.context.scene["linen_earth_tailoring_variant_object_count"] = len(kept)
    bpy.context.scene["linen_earth_tailoring_variant_material_count"] = len(variant_materials)
    bpy.context.scene["linen_earth_tailoring_variant_materials_json"] = json.dumps(sorted(variant_materials))
    bpy.context.scene["linen_earth_tailoring_variant_repair_json"] = json.dumps(repair_stats, sort_keys=True)

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))

    print(f"Imported Linen Earth tailoring library: {variant_glb}")
    print(f"Retained variant objects: {len(kept)}")
    print(f"Retained variant materials: {len(variant_materials)}")
    print("Variant body-clearance repairs: " + json.dumps(repair_stats, sort_keys=True))
    print(f"Saved realistic + tailoring hybrid scene: {output}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Linen Earth tailoring-library import failed: {error}", file=sys.stderr)
        raise SystemExit(1)
