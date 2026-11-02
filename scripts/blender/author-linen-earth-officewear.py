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
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

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
    parser.add_argument("--experimental-waist-extra-clearance-mm", type=float, default=3.0,
                        help="Pinned tested waist layering (+3mm); alternatives are native candidate research only")
    parser.add_argument("--experimental-waist-refinement-level", type=int, choices=(0, 1), default=1,
                        help="0 is the native-control candidate; default 1 fixes real waist body clearance")
    return parser.parse_args(argv)


def bounded_measured_mm(value, field, minimum_mm, maximum_mm):
    """Reject invalid tailored dimensions instead of silently changing them."""
    if not math.isfinite(value) or not minimum_mm <= value <= maximum_mm:
        raise ValueError(
            f"{field} must be finite and between {minimum_mm:g} and "
            f"{maximum_mm:g} mm; the garment will not be silently resized."
        )
    return value / 1000.0


def safe_candidate_output(raw_output, source_blend):
    """Never overwrite the existing identity-locked body source scene."""
    if not source_blend:
        raise RuntimeError("Open a saved identity-locked source .blend before authoring.")
    source = Path(source_blend).expanduser().resolve()
    if source.suffix.lower() != ".blend" or not source.is_file():
        raise RuntimeError("The identity-locked source must be a saved .blend file.")
    output = Path(raw_output).expanduser().resolve()
    if output.suffix.lower() != ".blend":
        raise ValueError("The authored candidate output must end in .blend.")
    if output == source or (output.exists() and os.path.samefile(output, source)):
        raise ValueError("Refusing to overwrite the original identity-locked Blender source.")
    return output


def world_bounds(obj):
    return [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]


def body_frame(body):
    points = world_bounds(body)
    min_x = min(point.x for point in points)
    max_x = max(point.x for point in points)
    min_z = min(point.z for point in points)
    max_z = max(point.z for point in points)
    return {
        "centerX": (min_x + max_x) * 0.5,
        "minZ": min_z,
        "height": max_z - min_z,
    }


def locked_guide_height(scene, name):
    """Read true photographed-model horizontal guide height, never estimate it."""
    collection = bpy.data.collections.get("LinenEarthIdentityGuides")
    guide = collection.objects.get(name) if collection else None
    if guide is None or guide.type != "CURVE":
        raise RuntimeError(f"Missing locked photographic garment guide: {name}")
    points = [
        (guide.matrix_world @ Vector(point.co[:3])).z
        for spline in guide.data.splines for point in spline.points
    ]
    if not points or not all(math.isfinite(value) for value in points):
        raise RuntimeError(f"Invalid photographic waist guide geometry: {name}")
    return sum(points) / len(points)


def remove_existing(name):
    obj = bpy.data.objects.get(name)
    if obj is not None:
        bpy.data.objects.remove(obj, do_unlink=True)


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


def actual_world_bvh(obj):
    """Use the exact 0.5 mm world-space polygon BVH contract from preflight."""
    if obj is None or obj.type != "MESH":
        raise RuntimeError("Missing real mesh for contact-stage evidence.")
    bpy.context.view_layer.update()
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    try:
        points = [evaluated.matrix_world @ v.co for v in mesh.vertices]
        polygons = [tuple(poly.vertices) for poly in mesh.polygons]
        if not points or not polygons:
            raise RuntimeError("No actual surface geometry for contact-stage evidence.")
        if any(not all(math.isfinite(v) for v in p) for p in points):
            raise RuntimeError("Nonfinite world-space contact-stage geometry.")
        tree = BVHTree.FromPolygons(
            points, polygons, all_triangles=False, epsilon=0.0005
        )
        if tree is None:
            raise RuntimeError("Cannot create measured polygon BVH for contact stage.")
        return tree
    finally:
        evaluated.to_mesh_clear()


def actual_contact_pairs(body_tree, garment):
    """Count real evaluated world-space triangle contacts, not fake clearance."""
    count = len(body_tree.overlap(actual_world_bvh(garment)))
    if not isinstance(count, int) or count < 0:
        raise RuntimeError("Unmeasurable garment/body contact-stage count.")
    return count


def fit_shell(obj, body, clearance_m, thickness_m, body_tree=None, waist_refinement_level=1, waist_extra_m=0.0):
    # Measured diagnostics only. These are not garment acceptance or fit proof.
    stages = []
    def record_stage(stage):
        if body_tree is not None:
            stages.append({"stage": stage, "bodyIntersectionPairs": actual_contact_pairs(body_tree, obj)})
    record_stage("selectedBodyShell")
    # Smooth first. The old shrinkwrap→smooth order allowed smoothing to
    # pull the garment back THROUGH the scanned body after clearance was set.
    smooth = obj.modifiers.new("LE_GARMENT_SMOOTH", "CORRECTIVE_SMOOTH")
    smooth.factor = 0.22
    smooth.iterations = 3
    apply_modifier(obj, smooth)
    record_stage("afterSmoothing")

    # Real pinned CC0 body measurements showed 122 waistband/body polygon BVH
    # contacts before and ZERO after level-1 SIMPLE subdivision before 7mm
    # clearance. Apply to this real panel alone: other five panels regressed
    # under global subdivision. Never replace the locked source body.
    if obj.name == "TrouserWaistFabric" and waist_refinement_level == 1:
        refine = obj.modifiers.new("LE_WAIST_SURFACE_REFINEMENT", "SUBSURF")
        refine.subdivision_type = "SIMPLE"
        refine.levels = 1
        refine.render_levels = 1
        apply_modifier(obj, refine)
        obj["linen_earth_waist_surface_refinement_level"] = 1

    # Apply actual body clearance AFTER geometry-changing smoothing.
    # No subsequent surface-displacement modifier may consume that clearance.
    shrink = obj.modifiers.new("LE_BODY_CLEARANCE", "SHRINKWRAP")
    shrink.target = body
    shrink.wrap_method = "NEAREST_SURFACEPOINT"
    shrink.wrap_mode = "OUTSIDE_SURFACE"
    # Other five garments keep the locked 7mm. Only isolated waist candidates
    # test +0/+3/+6/+9mm radial layering; never silently alter live previews.
    effective_clearance = clearance_m + (waist_extra_m if obj.name == "TrouserWaistFabric" else 0.0)
    shrink.offset = effective_clearance
    apply_modifier(obj, shrink)
    record_stage("afterBodyClearance")

    solid = obj.modifiers.new("LE_CLOTH_THICKNESS", "SOLIDIFY")
    solid.thickness = thickness_m
    solid.offset = 1.0
    solid.use_rim = True
    apply_modifier(obj, solid)
    record_stage("afterClothThickness")
    if body_tree is not None:
        obj["linen_earth_body_contact_stages_json"] = json.dumps(stages, separators=(",", ":"))


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
    # Preserve the original locked .blend before any scene mutation.
    output = safe_candidate_output(options.output, bpy.data.filepath)
    # Validate every physical authoring parameter before touching the scene.
    clearance_m = bounded_measured_mm(options.clearance_mm, "Body clearance", 3.0, 18.0)
    thickness_m = bounded_measured_mm(options.thickness_mm, "Cloth shell thickness", 0.6, 4.0)
    waist_extra_m = bounded_measured_mm(
        options.experimental_waist_extra_clearance_mm,
        "Experimental extra waistband layering clearance", 0.0, 9.0
    )
    if clearance_m + waist_extra_m > 0.018:
        raise ValueError("Real garment waist clearance cannot exceed the original validated 18mm bound.")
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

    z = lambda ratio: min_z + height * ratio
    trouser_waist_guide_z = locked_guide_height(bpy.context.scene, "LE_GUIDE_TROUSER_WAIST")
    if not z(0.58) <= trouser_waist_guide_z <= z(0.70):
        raise RuntimeError("Locked trouser waist guide lies outside the approved body landmark region.")
    # The previous 0.620 height stopped ~47mm BELOW the true photo waist guide
    # (~0.647 of the body); no real cross-section could ever be measured.
    # Extend this shell through the guide while preserving measured fit checks.
    trouser_waist_upper_z = max(z(0.620), trouser_waist_guide_z + 0.028)
    # The previous shirt region extended down to 51.5% body height and
    # coincided with the trouser waist shell over most of the abdomen.
    # Preserve BOTH real photographic waist-guide samples while cutting the
    # physically tucked shirt hem 30mm below their lower locked landmark.
    shirt_waist_guide_z = locked_guide_height(bpy.context.scene, "LE_GUIDE_SHIRT_WAIST")
    if not z(0.58) <= shirt_waist_guide_z <= z(0.70):
        raise RuntimeError("Locked shirt waist guide is outside the photographed body waist.")
    if abs(shirt_waist_guide_z - trouser_waist_guide_z) > 0.050:
        raise RuntimeError("Shirt and trouser waist guides are too far apart for a single tucked seam.")
    tucked_shirt_hem_z = min(shirt_waist_guide_z, trouser_waist_guide_z) - 0.030
    if not z(0.57) <= tucked_shirt_hem_z < min(shirt_waist_guide_z, trouser_waist_guide_z):
        raise RuntimeError("Cannot locate a nonempty photographed tucked shirt hem.")
    torso_half = 0.245
    arm_root = 0.155
    hip_half = 0.245

    regions = {
        "ShirtTorsoFabric": lambda p: tucked_shirt_hem_z <= p.z <= z(0.895) and abs(p.x-center_x) <= torso_half,
        "ShirtSleeveLFabric": lambda p: z(0.500) <= p.z <= z(0.875) and p.x-center_x <= -arm_root,
        "ShirtSleeveRFabric": lambda p: z(0.500) <= p.z <= z(0.875) and p.x-center_x >= arm_root,
        "TrouserWaistFabric": lambda p: z(0.455) <= p.z <= trouser_waist_upper_z and abs(p.x-center_x) <= hip_half,
        "TrouserLegLFabric": lambda p: z(0.055) <= p.z <= z(0.535) and p.x < center_x,
        "TrouserLegRFabric": lambda p: z(0.055) <= p.z <= z(0.535) and p.x >= center_x,
    }

    # One original-body BVH, shared across all six actual modifier-stage samples.
    body_contact_tree = actual_world_bvh(body)
    for name in GARMENT_OBJECTS:
        remove_existing(name)

    authored = []
    for name, predicate in regions.items():
        obj = selected_shell(body, name, predicate)
        fit_shell(obj, body, clearance_m, thickness_m, body_contact_tree,
                  options.experimental_waist_refinement_level, waist_extra_m)
        planar_grain_uv(obj)
        obj["linen_earth_auto_authored"] = True
        actual_clearance = clearance_m + (waist_extra_m if name == "TrouserWaistFabric" else 0.0)
        obj["linen_earth_fit_clearance_mm"] = round(actual_clearance * 1000.0, 3)
        obj["linen_earth_cloth_thickness_mm"] = round(thickness_m * 1000.0, 3)
        authored.append(obj)

    bpy.context.scene["linen_earth_asset_status"] = "auto-authored-production-candidate-needs-tailor-review"
    bpy.context.scene["linen_earth_garment_authoring_method"] = "locked-body-surface-shell-v1"
    bpy.context.scene["linen_earth_garment_clearance_mm"] = round(clearance_m * 1000.0, 3)
    bpy.context.scene["linen_earth_garment_thickness_mm"] = round(thickness_m * 1000.0, 3)
    bpy.context.scene["linen_earth_waist_extra_clearance_mm"] = round(waist_extra_m * 1000.0, 3)
    bpy.context.scene["linen_earth_trouser_waist_guide_z_m"] = round(trouser_waist_guide_z, 6)
    bpy.context.scene["linen_earth_trouser_waist_authored_top_z_m"] = round(trouser_waist_upper_z, 6)
    bpy.context.scene["linen_earth_tucked_shirt_hem_z_m"] = round(tucked_shirt_hem_z, 6)
    bpy.context.scene["linen_earth_locked_shirt_waist_guide_z_m"] = round(shirt_waist_guide_z, 6)
    bpy.context.scene["linen_earth_trouser_waist_refinement_level"] = options.experimental_waist_refinement_level

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))

    print(f"Authored Linen Earth six-piece officewear candidate: {output}")
    print("Garment objects: " + ", ".join(obj.name for obj in authored))
    print(f"Body clearance: {clearance_m*1000:.1f} mm · cloth shell thickness: {thickness_m*1000:.1f} mm")
    print(f"Locked trouser waist guide Z: {trouser_waist_guide_z:.4f} m · authored shell top: {trouser_waist_upper_z:.4f} m")
    print(f"Locked shirt waist guide Z: {shirt_waist_guide_z:.4f} m · tucked shirt hem: {tucked_shirt_hem_z:.4f} m (30mm below guide)")
    print("Status: candidate only; run Blender preflight and owner/tailor visual fit review before production export.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Linen Earth garment authoring failed: {error}", file=sys.stderr)
        raise SystemExit(1)
