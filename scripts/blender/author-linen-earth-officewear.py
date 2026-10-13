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
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

# The conservative drape preview is local, deterministic and testable without
# Blender. It must not be mistaken for a material-calibrated cloth simulation.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from drape_preview_math import MAX_PREVIEW_RELIEF_MM, candidate_drape_offset_mm

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
    parser.add_argument("--surface-refine", type=int, choices=(0, 1), default=1,
                        help="0/1 simple topology subdivision before body-clearance fitting; default 1 for concave body-contact safety")
    parser.add_argument("--contact-repair-passes", type=int, default=6,
                        help="0..6 world-space collision correction passes; max 12 mm per source vertex")
    parser.add_argument("--waist-layer-extra-mm", type=float, default=5.0,
                        help="Unverified waistband-over-tuck layer separation, 0..7 mm")
    parser.add_argument("--candidate-relief-mm", type=float, default=3.0,
                        help="0 for a clean shell; 0..6 mm art-directed visual microfolds, not physical drape")
    return parser.parse_args(argv)


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


def fit_shirt_shoulder_to_locked_guide(obj, body_floor_z, body_height):
    """Expand only the shirt shoulder to the existing photo's 388-mm guide.

    The scan base has narrower shoulders than the photographed officewear
    target. Outward garment ease adds contour without scaling the model's
    anatomical torso or substituting an unrelated mannequin.
    """
    mesh = obj.data
    mesh.update()
    shoulder_ratio = 1.0 - 244.0 / 1536.0
    shoulder_z = body_floor_z + body_height * shoulder_ratio
    band = 0.020
    section = [v.co.x for v in mesh.vertices if abs(v.co.z - shoulder_z) <= band]
    if len(section) < 4:
        raise RuntimeError("Cannot fit shoulder silhouette: no shirt section at identity guide.")
    center = 0.5 * (max(section) + min(section))
    initial_width = max(section) - min(section)
    if initial_width <= 0.005:
        raise RuntimeError("Cannot fit shoulder silhouette from degenerate source geometry.")
    target_width = 0.388
    scale = min(1.34, max(1.0, target_width / initial_width))
    for v in mesh.vertices:
        z_distance = (v.co.z - shoulder_z) / 0.080
        influence = math.exp(-0.5 * z_distance * z_distance)
        v.co.x = center + (v.co.x - center) * (1.0 + (scale - 1.0) * influence)
    mesh.update()
    return initial_width * 1000, scale


def sculpt_unverified_preview_relief(obj, panel, peak_mm):
    """Small outward folds on the existing body-fitted mesh, no new model.

    This is art-directed geometry only. Real bending, GSM, shear and gravity
    require measured textile input and a cloth solver with independently
    reviewed collision/ease and sewn construction.
    """
    if peak_mm <= 0:
        return 0.0
    mesh = obj.data
    mesh.update()
    if not mesh.vertices:
        raise RuntimeError(f"No vertices for candidate drape panel {panel}")
    min_x = min(vertex.co.x for vertex in mesh.vertices)
    max_x = max(vertex.co.x for vertex in mesh.vertices)
    min_z = min(vertex.co.z for vertex in mesh.vertices)
    max_z = max(vertex.co.z for vertex in mesh.vertices)
    span_x = max_x - min_x
    span_z = max_z - min_z
    if span_x <= 1e-5 or span_z <= 1e-5:
        raise RuntimeError(f"Candidate drape panel has degenerate dimensions: {panel}")
    offsets = []
    for vertex in mesh.vertices:
        lateral = max(-1.0, min(1.0, 2 * (vertex.co.x - min_x) / span_x - 1.0))
        vertical = max(0.0, min(1.0, (vertex.co.z - min_z) / span_z))
        delta_mm = candidate_drape_offset_mm(panel, lateral, vertical, peak_mm)
        normal = vertex.normal.copy()
        if normal.length_squared < 1e-10:
            raise RuntimeError(f"Unusable garment vertex normal: {panel}")
        # Relief is strictly positive along the existing surface normal,
        # retaining the shrinkwrap body clearance rather than inventing an
        # inward crease that intersects the model.
        vertex.co += normal.normalized() * (delta_mm / 1000.0)
        offsets.append(delta_mm)
    mesh.update()
    return max(offsets)


def _world_mesh_bvh(obj, depsgraph):
    """Evaluate source and fitted garments in the same world coordinate frame."""
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        coords = [evaluated.matrix_world @ vert.co for vert in mesh.vertices]
        faces = [tuple(poly.vertices) for poly in mesh.polygons]
        return BVHTree.FromPolygons(coords, faces, all_triangles=False, epsilon=0.0005)
    finally:
        evaluated.to_mesh_clear()


def source_fit_collision_pairs(body, shell):
    """Independent, *diagnostic* count; it never overrides release preflight."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    body_bvh = _world_mesh_bvh(body, depsgraph)
    shell_bvh = _world_mesh_bvh(shell, depsgraph)
    return len(body_bvh.overlap(shell_bvh))


def repair_body_intersections(body, shell, max_passes):
    """Bounded source-body contact corrections on the SAME garment vertices.

    The mesh stays source-derived. An intersection marks a triangle, not a
    proof that all its vertices are inside; move touched vertices along the
    closest actual body-surface normal in small, strictly capped increments.
    This is a candidate collision repair, not calibrated ease or cloth physics.
    """
    depsgraph = bpy.context.evaluated_depsgraph_get()
    body_bvh = _world_mesh_bvh(body, depsgraph)
    shell_matrix = shell.matrix_world.copy()
    inverse = shell_matrix.inverted()
    vertex_moves = {}
    counts = []
    for pass_number in range(max_passes + 1):
        shell_bvh = _world_mesh_bvh(shell, depsgraph)
        pairs = body_bvh.overlap(shell_bvh)
        counts.append(len(pairs))
        if not pairs or pass_number == max_passes:
            break
        affected = set()
        for _body_poly, shell_poly in pairs:
            if 0 <= shell_poly < len(shell.data.polygons):
                affected.update(shell.data.polygons[shell_poly].vertices)
        if not affected:
            break
        moved = 0
        for vertex_index in sorted(affected):
            already_moved = vertex_moves.get(vertex_index, 0.0)
            budget_m = 0.012 - already_moved
            if budget_m <= 1e-8:
                continue
            vertex = shell.data.vertices[vertex_index]
            point = shell_matrix @ vertex.co
            closest = body_bvh.find_nearest(point)
            if closest is None or closest[1] is None or closest[1].length_squared <= 1e-10:
                continue
            # Never invent negative cloth clearance: displaced geometry always
            # follows the genuine scanned skin's world-space outward normal.
            displacement = min(0.002, budget_m)
            vertex.co = inverse @ (point + closest[1].normalized() * displacement)
            vertex_moves[vertex_index] = already_moved + displacement
            moved += 1
        shell.data.update()
        # Direct mesh edits do not necessarily invalidate evaluated modifier/BVH
        # snapshots until the view layer is refreshed. Using stale contacts
        # re-moves already cleared vertices six times and falsifies diagnostics.
        bpy.context.view_layer.update()
        if moved == 0:
            break
    return {
        "contactPairsByPass": counts,
        "remainingContactPairs": counts[-1],
        "affectedVertexCount": len(vertex_moves),
        "maxVertexCorrectionMm": round(max(vertex_moves.values(), default=0.0) * 1000, 3),
        "candidateOnly": True,
        "measuredEaseApproved": False,
    }


def fit_shell(obj, body, clearance_m, thickness_m, panel, relief_mm, body_floor_z, body_height, surface_refine, repair_passes):
    phase_pairs = {"source_surface": source_fit_collision_pairs(body, obj)}
    if surface_refine:
        # SIMPLE subdivides existing source faces without moving the body-derived
        # shell. The subsequent outward shrinkwrap fits intermediate vertices
        # at concave arm/hip bends instead of spanning the skin with coarse faces.
        refine = obj.modifiers.new("LE_CONTACT_FACE_REFINEMENT", "SUBSURF")
        refine.subdivision_type = "SIMPLE"
        refine.levels = 1
        refine.render_levels = 1
        apply_modifier(obj, refine)
        phase_pairs["refined_source_surface"] = source_fit_collision_pairs(body, obj)
    shrink = obj.modifiers.new("LE_BODY_CLEARANCE", "SHRINKWRAP")
    shrink.target = body
    shrink.wrap_method = "NEAREST_SURFACEPOINT"
    shrink.wrap_mode = "OUTSIDE_SURFACE"
    shrink.offset = clearance_m
    apply_modifier(obj, shrink)
    phase_pairs["shrinkwrap"] = source_fit_collision_pairs(body, obj)

    smooth = obj.modifiers.new("LE_GARMENT_SMOOTH", "CORRECTIVE_SMOOTH")
    smooth.factor = 0.22
    smooth.iterations = 3
    apply_modifier(obj, smooth)
    phase_pairs["corrective_smooth"] = source_fit_collision_pairs(body, obj)

    shoulder_guide = None
    if panel == "ShirtTorsoFabric":
        shoulder_guide = fit_shirt_shoulder_to_locked_guide(obj, body_floor_z, body_height)
    max_relief = sculpt_unverified_preview_relief(obj, panel, relief_mm)
    phase_pairs["candidate_relief"] = source_fit_collision_pairs(body, obj)

    solid = obj.modifiers.new("LE_CLOTH_THICKNESS", "SOLIDIFY")
    solid.thickness = thickness_m
    solid.offset = 1.0
    solid.use_rim = True
    apply_modifier(obj, solid)
    phase_pairs["solidify"] = source_fit_collision_pairs(body, obj)
    contact_repair = repair_body_intersections(body, obj, repair_passes)
    phase_pairs["bounded_contact_repair"] = contact_repair["remainingContactPairs"]
    obj["linen_earth_contact_repair_json"] = json.dumps(contact_repair, sort_keys=True)
    obj["linen_earth_fit_collision_stages_json"] = json.dumps(phase_pairs, sort_keys=True)
    return max_relief, shoulder_guide, phase_pairs, contact_repair


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
    if not math.isfinite(options.candidate_relief_mm) or not 0 <= options.candidate_relief_mm <= MAX_PREVIEW_RELIEF_MM:
        raise RuntimeError("Art-directed preview relief must be a finite value from 0 to 6 mm.")
    if not math.isfinite(options.clearance_mm) or not 3 <= options.clearance_mm <= 18:
        raise RuntimeError("Source-body clearance must be 3 to 18 mm; do not silently clamp measured ease.")
    if not math.isfinite(options.thickness_mm) or not 0.6 <= options.thickness_mm <= 4.0:
        raise RuntimeError("Candidate shell thickness must be 0.6 to 4.0 mm.")
    if not 0 <= options.contact_repair_passes <= 6:
        raise RuntimeError("Candidate body-contact repair must use between 0 and 6 bounded passes.")
    if not math.isfinite(options.waist_layer_extra_mm) or not 0 <= options.waist_layer_extra_mm <= 7:
        raise RuntimeError("Unverified tuck/waist layer separation must be between 0 and 7 mm.")
    if options.clearance_mm + options.waist_layer_extra_mm > 18:
        raise RuntimeError("Waistband clearance must not exceed the fixed 18 mm candidate limit.")
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
    arm_root = 0.155
    hip_half = 0.205

    def torso_half_width(z_world):
        # The original fixed 245-mm radius unintentionally captured forearms
        # beside the abdomen: the waist then measured ~491 mm instead of the
        # studio's locked 294-mm front silhouette. Shape a separate torso
        # region from the source body without moving/shrinking its arms.
        ratio = (z_world - min_z) / height
        start, end = 0.645, 0.841
        if ratio <= start:
            return 0.158
        if ratio >= end:
            return 0.205
        t = (ratio - start) / (end - start)
        t = t * t * (3.0 - 2.0 * t)
        return 0.158 + (0.205 - 0.158) * t

    def leg_outer_boundary(z_world):
        """Allow the FULL scanned calf/ankle silhouette while separating
        upper thighs from the hands near the hips.

        Restricting every leg section to a guessed narrow cylinder made the
        hem pass the width gate but left exposed white strips at the knees and
        shins in actual four-angle Blender evidence. Below hand height the
        original scan's complete leg cross-section must stay covered.
        """
        ratio = (z_world - min_z) / height
        if ratio <= 0.36:
            return 0.40
        if ratio >= 0.43:
            return 0.255
        t = (ratio - 0.36) / 0.07
        t = t * t * (3.0 - 2.0 * t)
        return 0.40 + (0.255 - 0.40) * t

    def leg_region(point, side):
        if not z(0.055) <= point.z <= z(0.535):
            return False
        signed_x = (point.x - center_x) * side
        return signed_x > 0 and signed_x <= leg_outer_boundary(point.z)

    regions = {
        # A real tucked shirt reaches the trouser waistband; its lower
        # boundary is not a free-hanging hem halfway down the pelvis.
        "ShirtTorsoFabric": lambda p: z(0.615) <= p.z <= z(0.895)
        and abs(p.x-center_x) <= torso_half_width(p.z),
        "ShirtSleeveLFabric": lambda p: z(0.500) <= p.z <= z(0.875) and p.x-center_x <= -arm_root,
        "ShirtSleeveRFabric": lambda p: z(0.500) <= p.z <= z(0.875) and p.x-center_x >= arm_root,
        # The reference waistband lies at z ~= 0.647 of body height; the
        # previous .620 upper cap never reached its own identity guide.
        "TrouserWaistFabric": lambda p: z(0.455) <= p.z <= z(0.675) and abs(p.x-center_x) <= hip_half,
        "TrouserLegLFabric": lambda p: leg_region(p, -1),
        "TrouserLegRFabric": lambda p: leg_region(p, +1),
    }

    clearance_m = options.clearance_mm / 1000.0
    thickness_m = options.thickness_mm / 1000.0

    for name in GARMENT_OBJECTS:
        remove_existing(name)

    authored = []
    fit_stage_report = {}
    contact_repair_report = {}
    for name, predicate in regions.items():
        obj = selected_shell(body, name, predicate)
        # Outer waistband is outside the tucked shirt instead of z-fighting
        # against an identically offset body-derived surface for 10 cm.
        panel_clearance = clearance_m + (options.waist_layer_extra_mm / 1000.0 if name == "TrouserWaistFabric" else 0.0)
        max_relief, shoulder_guide, phase_pairs, repair = fit_shell(obj, body, panel_clearance, thickness_m, name, options.candidate_relief_mm, min_z, height, options.surface_refine, options.contact_repair_passes)
        fit_stage_report[name] = phase_pairs
        contact_repair_report[name] = repair
        planar_grain_uv(obj)
        obj["linen_earth_auto_authored"] = True
        obj["linen_earth_fit_clearance_mm"] = round(panel_clearance * 1000.0, 3)
        obj["linen_earth_cloth_thickness_mm"] = round(thickness_m * 1000.0, 3)
        obj["linen_earth_drape_method"] = "unverified_art_directed_candidate_relief_v1"
        obj["linen_earth_drape_max_relief_mm"] = round(max_relief, 3)
        if shoulder_guide:
            obj["linen_earth_shoulder_width_source_mm"] = round(shoulder_guide[0], 2)
            obj["linen_earth_shoulder_contour_scale"] = round(shoulder_guide[1], 6)
        authored.append(obj)

    bpy.context.scene["linen_earth_contact_repair_json"] = json.dumps(contact_repair_report, sort_keys=True)
    print("SOURCE_FIT_BOUNDED_CONTACT_REPAIR=" + json.dumps(contact_repair_report, sort_keys=True))
    bpy.context.scene["linen_earth_fit_collision_stages_json"] = json.dumps(fit_stage_report, sort_keys=True)
    print("SOURCE_FIT_COLLISION_STAGES_WORLD_SPACE=" + json.dumps(fit_stage_report, sort_keys=True))
    bpy.context.scene["linen_earth_asset_status"] = "auto-authored-production-candidate-needs-tailor-review"
    bpy.context.scene["linen_earth_garment_authoring_method"] = "locked-body-surface-shell-v2-bounded-preview-folds"
    bpy.context.scene["linen_earth_drape_provenance"] = "art_directed_unverified_visual_candidate"
    bpy.context.scene["linen_earth_measured_fabric_physics"] = False
    bpy.context.scene["linen_earth_preview_relief_requested_mm"] = options.candidate_relief_mm
    bpy.context.scene["linen_earth_surface_refine_level"] = options.surface_refine
    bpy.context.scene["linen_earth_contact_repair_passes"] = options.contact_repair_passes
    bpy.context.scene["linen_earth_waist_layer_extra_mm"] = options.waist_layer_extra_mm
    bpy.context.scene["linen_earth_garment_clearance_mm"] = round(clearance_m * 1000.0, 3)
    bpy.context.scene["linen_earth_garment_thickness_mm"] = round(thickness_m * 1000.0, 3)

    output = Path(options.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))

    print(f"Authored Linen Earth six-piece officewear candidate: {output}")
    print("Garment objects: " + ", ".join(obj.name for obj in authored))
    print(f"Body clearance: {clearance_m*1000:.1f} mm · shell thickness: {thickness_m*1000:.1f} mm")
    print(f"Art-directed microfold relief (not physical cloth simulation): {options.candidate_relief_mm:.1f} mm peak")
    print("Status: candidate only; run Blender preflight and owner/tailor visual fit review before production export.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Linen Earth garment authoring failed: {error}", file=sys.stderr)
        raise SystemExit(1)
