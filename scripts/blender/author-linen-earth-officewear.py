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

import bmesh
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


def measure_solidify_variants(obj, body_tree, thickness_m):
    """Run destructive solidification only on disposable in-memory mesh copies.

    Six measured variants isolate normal winding, normal offset and rim closure without
    changing the candidate or the original identity-locked .blend file.
    """
    specs = (
        ("outwardNoRim", 1.0, False, False),
        ("outwardWithRim", 1.0, True, False),
        ("inwardNoRim", -1.0, False, False),
        ("inwardWithRim", -1.0, True, False),
        # Real Blender BMesh winding repair trials. These must not replace
        # the saved production candidate without physical-geometry proof.
        ("recalculatedOutwardWithRim", 1.0, True, True),
        ("recalculatedInwardWithRim", -1.0, True, True),
    )
    baseline = actual_contact_pairs(body_tree, obj)
    observations = []
    for label, offset, rim, recalculate_normals in specs:
        clone = obj.copy()
        temporary_mesh = obj.data.copy()
        clone.data = temporary_mesh
        clone.name = "LE_UNSAVED_CONTACT_VARIANT_" + label
        bpy.context.scene.collection.objects.link(clone)
        try:
            face_count = len(clone.data.polygons)
            if face_count <= 0:
                raise RuntimeError("Cannot characterize face winding for an empty cloth.")
            face_normal_changes = None
            if recalculate_normals:
                # Compare the same actual polygon vertex sets before/after BMesh
                # orientation. Face order need not survive Blender reconstruction.
                original_normals = {
                    tuple(sorted(face.vertices)): face.normal.copy()
                    for face in clone.data.polygons
                }
                if len(original_normals) != face_count:
                    raise RuntimeError("Duplicate face topology prevents reliable winding measurements.")
                bm = bmesh.new()
                try:
                    bm.from_mesh(clone.data)
                    if not bm.faces:
                        raise RuntimeError("Cannot recalculate normals for an empty garment shell.")
                    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
                    bm.to_mesh(clone.data)
                finally:
                    bm.free()
                clone.data.update()
                if len(clone.data.polygons) != face_count:
                    raise RuntimeError("Face winding trial changed real mesh topology.")
                face_normal_changes = 0
                for face in clone.data.polygons:
                    original = original_normals.get(tuple(sorted(face.vertices)))
                    if original is None:
                        raise RuntimeError("Recalculated face no longer corresponds to the same cloth polygon.")
                    agreement = face.normal.dot(original)
                    if not math.isfinite(agreement) or abs(agreement) < 0.5:
                        raise RuntimeError("Cannot interpret a nonparallel face-normal comparison.")
                    if agreement < -0.5:
                        face_normal_changes += 1
            modifier = clone.modifiers.new("LE_EXPERIMENTAL_CLOTH_THICKNESS", "SOLIDIFY")
            modifier.thickness = thickness_m
            modifier.offset = offset
            modifier.use_rim = rim
            apply_modifier(clone, modifier)
            observations.append({
                "variant": label,
                "offset": offset,
                "rim": rim,
                "recalculatedNormals": recalculate_normals,
                "sourceClothFaceCount": face_count,
                "reversedClothFaceCount": face_normal_changes,
                "bodyIntersectionPairs": actual_contact_pairs(body_tree, clone),
            })
        finally:
            bpy.data.objects.remove(clone, do_unlink=True)
            if temporary_mesh.users == 0:
                bpy.data.meshes.remove(temporary_mesh)
    if len(observations) != len(specs):
        raise RuntimeError("Native solidify variant evaluation was incomplete.")
    return {"baselineAfterBodyClearance": baseline, "variants": observations}


def measure_shrinkwrap_modes(obj, body, body_tree, clearance_m, thickness_m):
    """Compare actual native shrinkwrap modes using unsaved, disposable mesh copies.

    All trials use the exact original 7 mm clearance and 1.6 mm cloth
    thickness. They never change the approved candidate or body source.
    """
    modes = ("OUTSIDE_SURFACE", "ABOVE_SURFACE", "ON_SURFACE")
    before = actual_contact_pairs(body_tree, obj)
    results = []
    for mode in modes:
        clone = obj.copy()
        temporary_mesh = obj.data.copy()
        clone.data = temporary_mesh
        clone.name = "LE_UNSAVED_SHRINKWRAP_TRIAL_" + mode
        bpy.context.scene.collection.objects.link(clone)
        try:
            wrap = clone.modifiers.new("LE_UNSAVED_SHRINKWRAP", "SHRINKWRAP")
            wrap.target = body
            wrap.wrap_method = "NEAREST_SURFACEPOINT"
            wrap.wrap_mode = mode
            wrap.offset = clearance_m
            apply_modifier(clone, wrap)
            after_wrap = actual_contact_pairs(body_tree, clone)
            thick = clone.modifiers.new("LE_UNSAVED_SOLIDIFY", "SOLIDIFY")
            thick.thickness = thickness_m
            thick.offset = 1.0
            thick.use_rim = True
            apply_modifier(clone, thick)
            results.append({
                "mode": mode,
                "clearanceMm": round(clearance_m * 1000.0, 3),
                "bodyPairsAfterWrap": after_wrap,
                "bodyPairsAfterClothThickness": actual_contact_pairs(body_tree, clone),
            })
        finally:
            bpy.data.objects.remove(clone, do_unlink=True)
            if temporary_mesh.users == 0:
                bpy.data.meshes.remove(temporary_mesh)
    if len(results) != len(modes):
        raise RuntimeError("Real shrinkwrap mode test failed to examine all native variants.")
    return {"beforeWrap": before, "trialModes": results}


def measure_surface_refinement_trial(obj, body, body_tree, clearance_m, thickness_m):
    """Measure whether true 7mm surface projection needs more cloth vertices.

    Simple subdivision creates edges and interpolated vertices without moving
    the original garment surface. All geometry is temporary and unapproved.
    No candidate output parameters or photographic guides are modified.
    """
    outcomes = []
    for level in (0, 1):
        probe = obj.copy()
        probe_mesh = obj.data.copy()
        probe.data = probe_mesh
        probe.name = "LE_UNSAVED_REFINEMENT_TRIAL_" + str(level)
        bpy.context.scene.collection.objects.link(probe)
        try:
            original_vertices = len(probe.data.vertices)
            if level:
                subdivision = probe.modifiers.new("LE_UNSAVED_SIMPLE_REFINEMENT", "SUBSURF")
                subdivision.subdivision_type = "SIMPLE"
                subdivision.levels = level
                subdivision.render_levels = level
                apply_modifier(probe, subdivision)
            refined_vertices = len(probe.data.vertices)
            if refined_vertices < original_vertices or (level and refined_vertices == original_vertices):
                raise RuntimeError("Native surface refinement did not create actual mesh vertices.")

            shrink = probe.modifiers.new("LE_UNSAVED_REFINEMENT_CLEARANCE", "SHRINKWRAP")
            shrink.target = body
            shrink.wrap_method = "NEAREST_SURFACEPOINT"
            shrink.wrap_mode = "OUTSIDE_SURFACE"
            shrink.offset = clearance_m
            apply_modifier(probe, shrink)
            after_clearance = actual_contact_pairs(body_tree, probe)
            solid = probe.modifiers.new("LE_UNSAVED_REFINEMENT_THICKNESS", "SOLIDIFY")
            solid.thickness = thickness_m
            solid.offset = 1.0
            solid.use_rim = True
            apply_modifier(probe, solid)
            outcomes.append({
                "simpleSubdivisionLevel": level,
                "sourceVertices": original_vertices,
                "preWrapVertices": refined_vertices,
                "clearanceMm": round(clearance_m * 1000.0, 3),
                "clothThicknessMm": round(thickness_m * 1000.0, 3),
                "bodyPairsAfterWrap": after_clearance,
                "bodyPairsAfterClothThickness": actual_contact_pairs(body_tree, probe),
            })
        finally:
            bpy.data.objects.remove(probe, do_unlink=True)
            if probe_mesh.users == 0:
                bpy.data.meshes.remove(probe_mesh)
    if len(outcomes) != 2:
        raise RuntimeError("Incomplete native simple-subdivision trials.")
    return outcomes


def fit_shell(obj, body, clearance_m, thickness_m, body_tree=None):
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
    surface_refinement = (
        measure_surface_refinement_trial(obj, body, body_tree, clearance_m, thickness_m)
        if body_tree is not None else None
    )
    shrinkwrap_modes = (
        measure_shrinkwrap_modes(obj, body, body_tree, clearance_m, thickness_m)
        if body_tree is not None else None
    )

    # Apply actual body clearance AFTER geometry-changing smoothing.
    # No subsequent surface-displacement modifier may consume that clearance.
    shrink = obj.modifiers.new("LE_BODY_CLEARANCE", "SHRINKWRAP")
    shrink.target = body
    shrink.wrap_method = "NEAREST_SURFACEPOINT"
    shrink.wrap_mode = "OUTSIDE_SURFACE"
    shrink.offset = clearance_m
    apply_modifier(obj, shrink)
    record_stage("afterBodyClearance")
    variants = measure_solidify_variants(obj, body_tree, thickness_m) if body_tree is not None else None

    solid = obj.modifiers.new("LE_CLOTH_THICKNESS", "SOLIDIFY")
    solid.thickness = thickness_m
    solid.offset = 1.0
    solid.use_rim = True
    apply_modifier(obj, solid)
    record_stage("afterClothThickness")
    if body_tree is not None:
        if variants is None or variants["baselineAfterBodyClearance"] != stages[2]["bodyIntersectionPairs"]:
            raise RuntimeError("Solidify trials disagree with the measured clearance-stage geometry.")
        production_variant = next(
            item for item in variants["variants"] if item["variant"] == "outwardWithRim"
        )
        if production_variant["bodyIntersectionPairs"] != stages[3]["bodyIntersectionPairs"]:
            raise RuntimeError("Solidify trial no longer matches the unchanged final authoring recipe.")
        if shrinkwrap_modes is None or shrinkwrap_modes["beforeWrap"] != stages[1]["bodyIntersectionPairs"]:
            raise RuntimeError("Measured shrinkwrap alternatives disagree with the smoothed source shell.")
        current_mode = shrinkwrap_modes["trialModes"][0]
        if (current_mode["mode"] != "OUTSIDE_SURFACE"
            or current_mode["bodyPairsAfterWrap"] != stages[2]["bodyIntersectionPairs"]
            or current_mode["bodyPairsAfterClothThickness"] != stages[3]["bodyIntersectionPairs"]):
            raise RuntimeError("Unchanged real shrinkwrap recipe does not match separately measured trial.")
        if surface_refinement is None or len(surface_refinement) != 2:
            raise RuntimeError("Native real-surface refinement measurements are incomplete.")
        baseline = surface_refinement[0]
        if (baseline["simpleSubdivisionLevel"] != 0
            or baseline["bodyPairsAfterWrap"] != stages[2]["bodyIntersectionPairs"]
            or baseline["bodyPairsAfterClothThickness"] != stages[3]["bodyIntersectionPairs"]):
            raise RuntimeError("Unrefined surface trial disagrees with unchanged production candidate.")
        if surface_refinement[1]["simpleSubdivisionLevel"] != 1:
            raise RuntimeError("Simple surface refinement was not actually measured.")
        obj["linen_earth_surface_refinement_trials_json"] = json.dumps(
            surface_refinement, separators=(",", ":")
        )
        obj["linen_earth_shrinkwrap_modes_json"] = json.dumps(shrinkwrap_modes, separators=(",", ":"))
        obj["linen_earth_solidify_variant_contacts_json"] = json.dumps(variants, separators=(",", ":"))
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
    torso_half = 0.245
    arm_root = 0.155
    hip_half = 0.245

    regions = {
        "ShirtTorsoFabric": lambda p: z(0.515) <= p.z <= z(0.895) and abs(p.x-center_x) <= torso_half,
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
        fit_shell(obj, body, clearance_m, thickness_m, body_contact_tree)
        planar_grain_uv(obj)
        obj["linen_earth_auto_authored"] = True
        obj["linen_earth_fit_clearance_mm"] = round(clearance_m * 1000.0, 3)
        obj["linen_earth_cloth_thickness_mm"] = round(thickness_m * 1000.0, 3)
        authored.append(obj)

    bpy.context.scene["linen_earth_asset_status"] = "auto-authored-production-candidate-needs-tailor-review"
    bpy.context.scene["linen_earth_garment_authoring_method"] = "locked-body-surface-shell-v1"
    bpy.context.scene["linen_earth_garment_clearance_mm"] = round(clearance_m * 1000.0, 3)
    bpy.context.scene["linen_earth_garment_thickness_mm"] = round(thickness_m * 1000.0, 3)
    bpy.context.scene["linen_earth_trouser_waist_guide_z_m"] = round(trouser_waist_guide_z, 6)
    bpy.context.scene["linen_earth_trouser_waist_authored_top_z_m"] = round(trouser_waist_upper_z, 6)

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))

    print(f"Authored Linen Earth six-piece officewear candidate: {output}")
    print("Garment objects: " + ", ".join(obj.name for obj in authored))
    print(f"Body clearance: {clearance_m*1000:.1f} mm · cloth shell thickness: {thickness_m*1000:.1f} mm")
    print(f"Locked trouser waist guide Z: {trouser_waist_guide_z:.4f} m · authored shell top: {trouser_waist_upper_z:.4f} m")
    print("Status: candidate only; run Blender preflight and owner/tailor visual fit review before production export.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Linen Earth garment authoring failed: {error}", file=sys.stderr)
        raise SystemExit(1)
