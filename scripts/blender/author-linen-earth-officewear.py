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
from uv_candidate_audit import audit_uv_triangles, metric_planar_uv, cylindrical_metric_face_uv, cylindrical_ambiguous_face_diagnostic, metric_tangent_chart_uv, audit_shared_uv_edges, phase_align_cylindrical_charts, align_metric_tangent_charts, classify_unapproved_uv_seams, estimate_source_tube_radius_m
from region_islands import keep_ankle_connected_faces
from sleeve_stance_math import MAX_INBOARD_MM, candidate_sleeve_inboard_mm, bounded_sleeve_cuff_refinement_trials
from leg_stance_math import MAX_INBOARD_MM as MAX_LEG_INBOARD_MM, candidate_leg_inboard_mm, candidate_inner_seam_relief_mm
from leg_gap_safety import bounded_leg_gap_trials, bounded_leg_gap_refinement_trials

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
    parser.add_argument("--surface-refine", type=int, choices=(0, 1), default=0,
                        help="0/1 optional candidate surface subdivision; compare native collision evidence before enabling")
    parser.add_argument("--contact-repair-passes", type=int, default=6,
                        help="0..6 world-space collision correction passes; max 12 mm per source vertex")
    parser.add_argument("--hem-taper-fraction", type=float, default=0.10,
                        help="0..0.12 subtle lower-leg cloth taper, candidate only; not measured tailor ease")
    parser.add_argument("--waist-layer-extra-mm", type=float, default=5.0,
                        help="Unverified waistband-over-tuck layer separation, 0..7 mm")
    parser.add_argument("--candidate-relief-mm", type=float, default=3.0,
                        help="0 for a clean shell; 0..6 mm art-directed visual microfolds, not physical drape")
    parser.add_argument("--sleeve-cuff-inboard-mm", type=float, default=22.0,
                        help="OFF by default: native 20mm experiment intersected locked body; 0..22mm/side for diagnostic only")
    parser.add_argument("--trouser-leg-inboard-mm", type=float, default=3.0,
                        help="Conservative cloth-only leg-gap trial 3mm per leg; 7mm trial intersected left/right cloth")
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
    selected_z = []

    for polygon in source_mesh.polygons:
        world_center = matrix @ polygon.center
        if not predicate(world_center):
            continue
        selected.append(tuple(polygon.vertices))
        selected_z.append(world_center.z)

    if not selected:
        raise RuntimeError(f"No body surface polygons matched garment region: {name}")

    excluded_islands = 0
    if name.startswith("TrouserLeg"):
        frame = body_frame(body)
        try:
            retained = keep_ankle_connected_faces(
                selected, selected_z,
                ankle_z_max=frame["minZ"] + frame["height"] * 0.16,
                thigh_z_min=frame["minZ"] + frame["height"] * 0.475,
            )
        except ValueError as error:
            raise RuntimeError(f"Unsafe trouser-leg source segmentation for {name}: {error}") from error
        excluded_islands = len(selected) - len(retained)
        selected = [selected[index] for index in retained]

    used = {index for face in selected for index in face}
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
    if name.startswith("TrouserLeg"):
        obj["linen_earth_excluded_disconnected_leg_faces"] = excluded_islands
        obj["linen_earth_leg_source_island_rule"] = "shared_edges_ankle_to_thigh_candidate_only"

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


def taper_candidate_trouser_hem(obj, body_floor_z, body_height, fraction):
    """Bounded lower-leg trouser silhouette taper; does not deform the body.

    The source-based pants stay too wide at the real photographed identity
    guide. A small cloth-only calf-to-hem taper is a construction experiment,
    not an approved human fit or a calibrated textile mechanics measurement.
    Native source-contact preflight must still reject any embedded cloth.
    """
    if fraction <= 0:
        return 0.0
    mesh = obj.data
    band = [vertex.co.x for vertex in mesh.vertices
            if 0.06 <= (vertex.co.z - body_floor_z) / body_height <= 0.15]
    if len(band) < 4:
        raise RuntimeError("Cannot taper trouser hem: lower-leg band is missing")
    centre_x = (min(band) + max(band)) * 0.5
    max_move = 0.0
    for vertex in mesh.vertices:
        ratio = (vertex.co.z - body_floor_z) / body_height
        if ratio >= 0.31:
            continue
        position = max(0.0, min(1.0, (0.31 - ratio) / 0.20))
        influence = position * position * (3.0 - 2.0 * position)
        original_x = vertex.co.x
        vertex.co.x = centre_x + (original_x - centre_x) * (1.0 - fraction * influence)
        max_move = max(max_move, abs(vertex.co.x - original_x))
    mesh.update()
    return round(max_move * 1000.0, 3)


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
    # Count unique *physical garment faces*, not only overlapping triangle
    # pairs: a few badly embedded shirt patches can create thousands of pairs.
    # These 10-height-band diagnostics never change the source mesh, fitted
    # silhouette, 12 mm movement ceiling or the independent release preflight.
    frame = body_frame(body)
    remaining_faces = sorted({
        shell_poly for _body_poly, shell_poly in pairs
        if 0 <= shell_poly < len(shell.data.polygons)
    })
    height_bins = {str(index): 0 for index in range(10)}
    lateral_bins = {"left": 0, "centre": 0, "right": 0}
    contact_samples = []
    for polygon_index in remaining_faces:
        point = shell_matrix @ shell.data.polygons[polygon_index].center
        height_ratio = (point.z - frame["minZ"]) / frame["height"]
        band = max(0, min(9, math.floor(height_ratio * 10)))
        height_bins[str(band)] += 1
        side = "left" if point.x < frame["centerX"] - 0.02 else (
            "right" if point.x > frame["centerX"] + 0.02 else "centre"
        )
        lateral_bins[side] += 1
        if len(contact_samples) < 12:
            contact_samples.append([round(point.x, 4), round(point.y, 4), round(point.z, 4)])
    return {
        "contactPairsByPass": counts,
        "remainingContactPairs": counts[-1],
        "remainingContactFaceCount": len(remaining_faces),
        "remainingContactHeightDeciles": height_bins,
        "remainingContactLateralZones": lateral_bins,
        "remainingContactSampleWorldMetres": contact_samples,
        "affectedVertexCount": len(vertex_moves),
        "maxVertexCorrectionMm": round(max(vertex_moves.values(), default=0.0) * 1000, 3),
        "candidateOnly": True,
        "measuredEaseApproved": False,
    }


def fit_shell(obj, body, clearance_m, thickness_m, panel, relief_mm, body_floor_z, body_height, surface_refine, repair_passes, hem_taper_fraction, sleeve_cuff_inboard_mm, trouser_leg_inboard_mm):
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
    if panel.startswith("ShirtSleeve") and sleeve_cuff_inboard_mm > 0:
        # Correct only the experimental garment silhouette, not skin, hands or
        # original reference geometry. A true arm pose change needs model/owner
        # signoff. Native BVH + cuff silhouette gates still apply unchanged.
        for vertex in obj.data.vertices:
            ratio = (vertex.co.z - body_floor_z) / body_height
            dx_mm = candidate_sleeve_inboard_mm(panel, ratio, sleeve_cuff_inboard_mm)
            vertex.co.x += dx_mm / 1000.0
        obj.data.update()
        bpy.context.view_layer.update()
        phase_pairs["candidate_inboard_cuff"] = source_fit_collision_pairs(body, obj)
    obj["linen_earth_sleeve_cuff_inboard_candidate_mm"] = (
        sleeve_cuff_inboard_mm if panel.startswith("ShirtSleeve") else 0.0
    )
    hem_taper_mm = (taper_candidate_trouser_hem(obj, body_floor_z, body_height, hem_taper_fraction)
                    if panel.startswith("TrouserLeg") else 0.0)
    obj["linen_earth_hem_taper_candidate_max_move_mm"] = hem_taper_mm
    if panel.startswith("TrouserLeg") and trouser_leg_inboard_mm > 0:
        for vertex in obj.data.vertices:
            ratio = (vertex.co.z - body_floor_z) / body_height
            dx_mm = candidate_leg_inboard_mm(panel, ratio, trouser_leg_inboard_mm)
            vertex.co.x += dx_mm / 1000.0
        obj.data.update()
        bpy.context.view_layer.update()
        phase_pairs["candidate_leg_inboard"] = source_fit_collision_pairs(body, obj)
    obj["linen_earth_trouser_leg_inboard_candidate_mm"] = (
        trouser_leg_inboard_mm if panel.startswith("TrouserLeg") else 0.0
    )
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



def restore_collision_free_leg_gap(body, body_floor_z, body_height, requested_mm, applied_mm=None):
    """Retreat a garment-only gap trial until TWO leg shells AND skin do not collide.

    The requested shift was applied during individual shell fitting. Record
    each post-fit X baseline so the rollback only undoes part of that shift;
    it never moves the source body or overwrites the bounded contact repairs.
    Independent release preflight remains mandatory for all other panels.
    """
    names = ("TrouserLegLFabric", "TrouserLegRFabric")
    legs = [bpy.data.objects.get(name) for name in names]
    if any(obj is None or obj.type != "MESH" for obj in legs):
        raise RuntimeError("Both source-derived trouser shells are required for gap QA")

    if applied_mm is None:
        applied_mm = requested_mm
    base_x = {}
    for name, obj in zip(names, legs):
        base_x[name] = [
            vertex.co.x - candidate_leg_inboard_mm(
                name, (vertex.co.z - body_floor_z) / body_height, applied_mm
            ) / 1000.0
            for vertex in obj.data.vertices
        ]

    attempts = []

    def evaluate_trial(candidate_mm):
        # Always start with the SAME post-fitting XYZ base. Failed probes
        # must never accumulate a previous contour or alter body coordinates.
        for name, obj in zip(names, legs):
            for index, vertex in enumerate(obj.data.vertices):
                ratio = (vertex.co.z - body_floor_z) / body_height
                vertex.co.x = base_x[name][index] + candidate_leg_inboard_mm(
                    name, ratio, candidate_mm
                ) / 1000.0
            obj.data.update()
        bpy.context.view_layer.update()
        trial = {
            "candidateInboardMmPerLeg": candidate_mm,
            "legToLegIntersectionPairs": source_fit_collision_pairs(legs[0], legs[1]),
            "leftBodyIntersectionPairs": source_fit_collision_pairs(body, legs[0]),
            "rightBodyIntersectionPairs": source_fit_collision_pairs(body, legs[1]),
        }
        attempts.append(trial)
        return trial

    def collision_free(trial):
        return (trial["legToLegIntersectionPairs"] ==
                trial["leftBodyIntersectionPairs"] ==
                trial["rightBodyIntersectionPairs"] == 0)

    last_rejected_mm = None
    for candidate_mm in bounded_leg_gap_trials(requested_mm):
        trial = evaluate_trial(candidate_mm)
        if collision_free(trial):
            selected_mm = candidate_mm
            coarse_safe_mm = candidate_mm
            refinement_candidates = ()
            if last_rejected_mm is not None:
                # The 0.5-mm coarse rollback may leave a visibly unnecessary
                # remainder. Make at most three smaller, physical-BVH-checked
                # probes within the last rejected/safe bracket. A failed probe
                # is NEVER treated as numerically or physically safe.
                refinement_candidates = bounded_leg_gap_refinement_trials(
                    last_rejected_mm, candidate_mm
                )
                for refined_mm in refinement_candidates:
                    refined_trial = evaluate_trial(refined_mm)
                    if collision_free(refined_trial):
                        selected_mm = refined_mm
                        break
            if attempts[-1]["candidateInboardMmPerLeg"] != selected_mm:
                # The final rejected fine probe changed real mesh positions.
                # Reapply and independently remeasure the accepted candidate;
                # never leave the scene at its last rejected trial.
                restored_trial = evaluate_trial(selected_mm)
                if not collision_free(restored_trial):
                    raise RuntimeError("Previously safe trouser fit did not survive BVH restoration")
            evidence = {
                "requestedMmPerLeg": requested_mm,
                "coarseSafeMmPerLeg": coarse_safe_mm,
                "selectedMmPerLeg": selected_mm,
                "fineProbesRequested": list(refinement_candidates),
                "trials": attempts,
                "nativeWorldSpaceCollisionFree": True,
                "photographicPoseApproved": False,
                "tailorFitApproved": False,
                "productionApproved": False,
            }
            for obj in legs:
                obj["linen_earth_trouser_leg_inboard_candidate_mm"] = selected_mm
                obj["linen_earth_leg_gap_rollback_audit_json"] = json.dumps(evidence, sort_keys=True)
            print("SOURCE_FIT_LEG_GAP_COLLISION_ROLLBACK=" + json.dumps(evidence, sort_keys=True))
            return evidence
        last_rejected_mm = candidate_mm

    # Even the original post-fit candidate may have a colliding crotch seam.
    # Preserve this rejected scene for FOUR-angle diagnostic rendering, but
    # preflight must still fail on the actual nonzero leg-to-leg BVH pairs.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    overlaps = _world_mesh_bvh(legs[0], depsgraph).overlap(
        _world_mesh_bvh(legs[1], depsgraph)
    )
    face_height_bins = {str(index): 0 for index in range(10)}
    approximate_face_centres = []
    for left_index, right_index in overlaps:
        if left_index >= len(legs[0].data.polygons) or right_index >= len(legs[1].data.polygons):
            continue
        left_center = legs[0].matrix_world @ legs[0].data.polygons[left_index].center
        right_center = legs[1].matrix_world @ legs[1].data.polygons[right_index].center
        centre = (left_center + right_center) * 0.5
        index = max(0, min(9, int(10 * (centre.z - body_floor_z) / body_height)))
        face_height_bins[str(index)] += 1
        if len(approximate_face_centres) < 16:
            approximate_face_centres.append(
                [round(centre.x, 4), round(centre.y, 4), round(centre.z, 4)]
            )
    evidence = {
        "requestedMmPerLeg": requested_mm,
        "selectedMmPerLeg": 0.0,
        "trials": attempts,
        "nativeWorldSpaceCollisionFree": False,
        "unresolvedLegToLegPairs": attempts[-1]["legToLegIntersectionPairs"],
        "contactFaceCentroidHeightDeciles": face_height_bins,
        "approximateContactFaceCentresMetres": approximate_face_centres,
        "diagnosticOnly": True,
        "photographicPoseApproved": False,
        "tailorFitApproved": False,
        "productionApproved": False,
    }
    for obj in legs:
        obj["linen_earth_trouser_leg_inboard_candidate_mm"] = 0.0
        obj["linen_earth_leg_gap_rollback_audit_json"] = json.dumps(evidence, sort_keys=True)
    print("SOURCE_FIT_LEG_GAP_REJECTED_DIAGNOSTIC=" + json.dumps(evidence, sort_keys=True))
    return evidence


def trial_inner_crotch_seam_relief(body, floor_z, height, centre_x):
    """Native contact-gated candidate contour: try seam spacing AND skin relief.

    A 4-mm outward inner-seam trial cleared the 100 cloth/cloth overlaps in
    native evidence but introduced 36/24 skin-contact pairs. Resolve that
    competing constraint with the existing bounded, real-body-normal repair
    (at most 12 mm per garment vertex). All unsuccessful trials restore every
    XYZ coordinate, not just X: collision repair can move Y and Z too.
    Nothing here moves the locked body, certifies physical tailoring, or
    relaxes the independent source/model/UV/identity release gates.
    """
    names = ("TrouserLegLFabric", "TrouserLegRFabric")
    legs = [bpy.data.objects.get(name) for name in names]
    if any(obj is None or obj.type != "MESH" for obj in legs):
        raise RuntimeError("Need both locked-source trouser shells for crotch seam QA")
    if not all(math.isfinite(v) for v in (floor_z, height, centre_x)) or height <= 0:
        raise RuntimeError("Source seam trial needs a finite positive body frame")

    original = {
        obj.name: [vertex.co.copy() for vertex in obj.data.vertices]
        for obj in legs
    }

    def restore():
        for obj in legs:
            for vertex, position in zip(obj.data.vertices, original[obj.name]):
                vertex.co = position
            obj.data.update()
        bpy.context.view_layer.update()

    def contacts():
        return (
            source_fit_collision_pairs(legs[0], legs[1]),
            source_fit_collision_pairs(body, legs[0]),
            source_fit_collision_pairs(body, legs[1]),
        )

    attempts = []
    # Keep the measured default 65-mm taper trials first. If those cannot
    # separate cloth without touching source skin, try smaller/larger LOCAL
    # falloff footprints before rejecting the candidate. Every trial restores
    # full XYZ and is independently checked against both real leg/body BVHs.
    # These are experiments, never a bypass of the zero-contact rule.
    contours = [(peak, .065) for peak in (2.0, 4.0, 6.0, 8.0, 10.0)]
    contours += [
        (peak, taper) for taper in (.03, .045, .08)
        for peak in (3.0, 4.0, 5.0)
    ]
    for peak_mm, taper_width_m in contours:
        restore()
        for obj in legs:
            for index, vertex in enumerate(obj.data.vertices):
                position = original[obj.name][index]
                ratio = (position.z - floor_z) / height
                vertex.co.x = position.x + candidate_inner_seam_relief_mm(
                    obj.name, ratio, position.x - centre_x, peak_mm,
                    taper_width_m=taper_width_m
                ) / 1000.0
            obj.data.update()
        bpy.context.view_layer.update()

        before = contacts()
        corrections = {}
        # Do not repair skin at the expense of an already-intersecting inseam.
        # The first attempt must geometrically separate both trouser shells.
        if before[0] == 0 and (before[1] > 0 or before[2] > 0):
            for obj, body_pairs in zip(legs, before[1:]):
                if body_pairs > 0:
                    correction = repair_body_intersections(body, obj, 6)
                    corrections[obj.name] = {
                        "contactPairsByPass": correction["contactPairsByPass"],
                        "maxVertexCorrectionMm": correction["maxVertexCorrectionMm"],
                        "remainingContactPairs": correction["remainingContactPairs"],
                    }
        after = contacts()
        trial = {
            "peakSeamReliefMm": peak_mm,
            "contourTaperWidthMm": round(taper_width_m * 1000, 3),
            "legToLegPairsBeforeRepair": before[0],
            "leftBodyPairsBeforeRepair": before[1],
            "rightBodyPairsBeforeRepair": before[2],
            "legToLegPairs": after[0],
            "leftBodyPairs": after[1],
            "rightBodyPairs": after[2],
            "boundedBodyContactCorrections": corrections,
        }
        attempts.append(trial)
        if after == (0, 0, 0):
            evidence = {
                "selectedPeakSeamReliefMm": peak_mm,
                "selectedContourTaperWidthMm": round(taper_width_m * 1000, 3),
                "nativeWorldSpaceCollisionFree": True,
                "trials": attempts,
                "photographicPoseApproved": False,
                "tailorSeamApproved": False,
                "productionApproved": False,
            }
            for obj in legs:
                obj["linen_earth_crotch_seam_relief_candidate_mm"] = peak_mm
                obj["linen_earth_crotch_seam_relief_evidence_json"] = json.dumps(evidence, sort_keys=True)
            print("SOURCE_FIT_CROTCH_SEAM_RELIEF=" + json.dumps(evidence, sort_keys=True))
            return evidence

    # A trial that repaired body contact but reintroduced inter-leg contact
    # must NOT survive into UV authoring or the next gap optimization.
    restore()
    evidence = {
        "selectedPeakSeamReliefMm": 0.0,
        "selectedContourTaperWidthMm": None,
        "nativeWorldSpaceCollisionFree": False,
        "trials": attempts,
        "photographicPoseApproved": False,
        "tailorSeamApproved": False,
        "productionApproved": False,
    }
    for obj in legs:
        obj["linen_earth_crotch_seam_relief_candidate_mm"] = 0.0
        obj["linen_earth_crotch_seam_relief_evidence_json"] = json.dumps(evidence, sort_keys=True)
    print("SOURCE_FIT_CROTCH_SEAM_REJECTED=" + json.dumps(evidence, sort_keys=True))
    return evidence



def try_collision_safe_cuff_spacing(body, floor_z, height, requested_mm):
    """Independently contact-gated cloth-only sleeve correction.

    Probe at 1-mm resolution, then sample ONLY the last measured rejected/safe
    bracket at submillimetre resolution. Rebuild every trial from untouched
    post-fit garment XYZ; keep the original human/body pose immutable. A fine
    candidate is never called safe from arithmetic alone: repair and remeasure
    both sleeve/body and sleeve/sleeve world-space BVH contacts every time.
    """
    required = (requested_mm, floor_z, height)
    if any(isinstance(v, (bool, str, bytes)) or not isinstance(v, (int, float))
           or not math.isfinite(v) for v in required):
        raise RuntimeError("Cuff trial requires finite numeric source-frame values")
    if not 0 <= requested_mm <= MAX_INBOARD_MM or height <= 0:
        raise RuntimeError("Cuff trial exceeds 0..22 mm contour or source-frame bounds")
    names = ("ShirtSleeveLFabric", "ShirtSleeveRFabric")
    sleeves = [bpy.data.objects.get(name) for name in names]
    if any(obj is None or obj.type != "MESH" for obj in sleeves):
        raise RuntimeError("Both source-derived sleeves are required for cuff spacing QA")
    original = {
        obj.name: [vertex.co.copy() for vertex in obj.data.vertices]
        for obj in sleeves
    }
    # Body clearance alone is insufficient: a cuff repair can pull the
    # garment through its own shirt torso while avoiding the source skin.
    # The source armhole is an intentionally sewn junction, so compare to
    # its actual pre-trial contact count rather than falsely requiring zero.
    torso = bpy.data.objects.get("ShirtTorsoFabric")
    if torso is None or torso.type != "MESH":
        raise RuntimeError("Source shirt torso is required for sleeve/torso collision QA")
    torso_baseline_pairs = [
        source_fit_collision_pairs(torso, obj) for obj in sleeves
    ]

    def restore(source):
        for obj in sleeves:
            if len(obj.data.vertices) != len(source[obj.name]):
                raise RuntimeError("Source sleeve topology changed during a contact trial")
            for vertex, position in zip(obj.data.vertices, source[obj.name]):
                vertex.co = position
            obj.data.update()
        bpy.context.view_layer.update()

    def snapshot():
        return {obj.name: [vertex.co.copy() for vertex in obj.data.vertices]
                for obj in sleeves}

    def evaluate(mm):
        # A rejected repair may have changed X, Y and Z, not only horizontal
        # spacing. Every candidate starts from the same source-locked shell.
        restore(original)
        for obj in sleeves:
            for index, vertex in enumerate(obj.data.vertices):
                position = original[obj.name][index]
                ratio = (position.z - floor_z) / height
                vertex.co.x = position.x + candidate_sleeve_inboard_mm(
                    obj.name, ratio, mm
                ) / 1000.0
            obj.data.update()
        bpy.context.view_layer.update()
        before = [source_fit_collision_pairs(body, obj) for obj in sleeves]
        torso_before = [source_fit_collision_pairs(torso, obj) for obj in sleeves]
        repairs = {}
        for obj, count in zip(sleeves, before):
            if count > 0:
                report = repair_body_intersections(body, obj, 6)
                repairs[obj.name] = {
                    "contactPairsByPass": report["contactPairsByPass"],
                    "maxVertexCorrectionMm": report["maxVertexCorrectionMm"],
                    "remainingContactPairs": report["remainingContactPairs"],
                }
        after = [source_fit_collision_pairs(body, obj) for obj in sleeves]
        torso_after = [source_fit_collision_pairs(torso, obj) for obj in sleeves]
        sleeve_pairs = source_fit_collision_pairs(sleeves[0], sleeves[1])
        # Only accept a shift if it did not introduce additional contact
        # with the actual fitted shirt. This is not proof of a sewn seam or
        # a visually approved armhole; the native preflight still applies.
        torso_not_worsened = all(
            current <= baseline for current, baseline in
            zip(torso_after, torso_baseline_pairs)
        )
        evidence = {
            "requestedCuffInboardMmPerSleeve": mm,
            "bodyPairsBeforeRepair": before,
            "bodyPairsAfterRepair": after,
            "shirtTorsoPairsAtOriginal": torso_baseline_pairs,
            "shirtTorsoPairsBeforeRepair": torso_before,
            "shirtTorsoPairsAfterRepair": torso_after,
            "shirtTorsoContactNotWorsened": torso_not_worsened,
            "sleeveToSleevePairs": sleeve_pairs,
            "boundedBodyContactCorrections": repairs,
        }
        return evidence, after == [0, 0] and sleeve_pairs == 0 and torso_not_worsened

    values = [round(max(0.0, requested_mm-i), 6)
              for i in range(math.ceil(requested_mm)+1)]
    if values[-1] != 0.0:
        values.append(0.0)
    attempts = []
    last_rejected = None
    for mm in dict.fromkeys(values):
        trial, safe = evaluate(mm)
        attempts.append(trial)
        if not safe:
            last_rejected = mm
            continue

        selected_mm = mm
        safe_positions = snapshot()
        # Every fine candidate is separately contact-checked. Never assume
        # monotonically improving clearance as cloth moves towards the body.
        if last_rejected is not None and last_rejected > mm:
            for fine_mm in bounded_sleeve_cuff_refinement_trials(last_rejected, mm):
                fine_trial, fine_safe = evaluate(fine_mm)
                attempts.append(fine_trial)
                if fine_safe:
                    selected_mm = fine_mm
                    safe_positions = snapshot()
                    break
        # Failed fine probes may alter all XYZ through normal-direction
        # repairs. Commit ONLY the last independently safe full XYZ snapshot.
        restore(safe_positions)
        evidence = {
            "requestedMmPerSleeve": requested_mm,
            "selectedMmPerSleeve": selected_mm,
            "nativeWorldSpaceCollisionFree": True,
            "trials": attempts,
            "submillimetreContactRefinementAttempted": last_rejected is not None,
            "photographicPoseApproved": False,
            "tailorSleeveApproved": False,
            "productionApproved": False,
        }
        for obj in sleeves:
            obj["linen_earth_sleeve_cuff_inboard_candidate_mm"] = selected_mm
            obj["linen_earth_sleeve_spacing_evidence_json"] = json.dumps(evidence, sort_keys=True)
        print("SOURCE_FIT_SLEEVE_GAP_COLLISION_ROLLBACK=" + json.dumps(evidence, sort_keys=True))
        return evidence

    restore(original)
    evidence = {
        "requestedMmPerSleeve": requested_mm,
        "selectedMmPerSleeve": 0.0,
        "nativeWorldSpaceCollisionFree": False,
        "trials": attempts,
        "submillimetreContactRefinementAttempted": False,
        "photographicPoseApproved": False,
        "tailorSleeveApproved": False,
        "productionApproved": False,
    }
    for obj in sleeves:
        obj["linen_earth_sleeve_cuff_inboard_candidate_mm"] = 0.0
        obj["linen_earth_sleeve_spacing_evidence_json"] = json.dumps(evidence, sort_keys=True)
    print("SOURCE_FIT_SLEEVE_GAP_REJECTED=" + json.dumps(evidence, sort_keys=True))
    return evidence


def planar_grain_uv(obj):
    """Candidate X/Z UV uses mesh metres, not an arbitrary 0..1 per panel.

    A stripe must not double in width merely because the sleeve shell is
    narrower than the torso. The geometric planar projection is still NOT
    cylindrical grain calibration, fabric-mill repeat or approved drape.
    """
    mesh = obj.data
    if not mesh.vertices:
        raise RuntimeError(f"Cannot UV-map an empty garment shell: {obj.name}")
    if not mesh.uv_layers:
        uv_layer = mesh.uv_layers.new(name="UVMap")
    else:
        uv_layer = mesh.uv_layers.active
    min_x = min(vertex.co.x for vertex in mesh.vertices)
    min_z = min(vertex.co.z for vertex in mesh.vertices)
    tubular = "Sleeve" in obj.name or "TrouserLeg" in obj.name
    if tubular:
        # Sleeve/leg are narrow vertical tubes. XY-angle * metre-radius avoids
        # flattening the back/sides to almost zero U density in an XZ projection.
        # Radius is a geometry ESTIMATE: never convert to measured textile scale.
        min_y = min(vertex.co.y for vertex in mesh.vertices)
        max_y = max(vertex.co.y for vertex in mesh.vertices)
        max_x = max(vertex.co.x for vertex in mesh.vertices)
        cx, cy = (min_x + max_x) * 0.5, (min_y + max_y) * 0.5
        radius_m = estimate_source_tube_radius_m(
            [tuple(vertex.co) for vertex in mesh.vertices]
        )
        fallback_faces = 0
        fallback_receipts = []
        unapproved_tangent_indices = []
        for polygon in mesh.polygons:
            loops = tuple(polygon.loop_indices)
            xyz = [
                (mesh.vertices[mesh.loops[i].vertex_index].co.x,
                 mesh.vertices[mesh.loops[i].vertex_index].co.y,
                 mesh.vertices[mesh.loops[i].vertex_index].co.z)
                for i in loops
            ]
            try:
                uv_points = cylindrical_metric_face_uv(
                    xyz, center_xy=(cx, cy), radius_m=radius_m, origin_z=min_z
                )
            except ValueError as error:
                # A near-axis source quad can exceed half a cylindrical turn.
                # An XZ projection compresses the true 3D face there. Build a
                # separate metre-scale tangent chart, retaining its unapproved
                # seam flag until neighbouring chart continuity is authored.
                if "ambiguous half-cylinder seam" not in str(error):
                    raise
                fallback_faces += 1
                unapproved_tangent_indices.append(polygon.index)
                receipt = cylindrical_ambiguous_face_diagnostic(
                    xyz, center_xy=(cx, cy)
                )
                receipt["sourcePolygonIndex"] = polygon.index
                receipt["mapping"] = "metric_tangent_face_chart_requires_seam_stitch"
                fallback_receipts.append(receipt)
                uv_points = metric_tangent_chart_uv(xyz)
            for i, uv_point in zip(loops, uv_points):
                uv_layer.data[i].uv = uv_point
        # Adjacent cylindrical faces can differ by an arbitrary full-turn U
        # origin. Align ONLY numerically exact circumference shifts along
        # genuine shared source edges. Tangent fallback charts are excluded.
        # Remaining seam breaks stay visible and release-blocking.
        chart_faces = [
            [
                (mesh.loops[i].vertex_index, tuple(uv_layer.data[i].uv))
                for i in polygon.loop_indices
            ]
            for polygon in mesh.polygons
        ]
        aligned_faces, phase_report = phase_align_cylindrical_charts(
            chart_faces, radius_m=radius_m,
            excluded_face_indices=unapproved_tangent_indices,
        )
        aligned_faces, tangent_report = align_metric_tangent_charts(
            aligned_faces, tangent_face_indices=unapproved_tangent_indices
        )
        for polygon, face in zip(mesh.polygons, aligned_faces):
            for loop_index, (_, uv_xy) in zip(polygon.loop_indices, face):
                uv_layer.data[loop_index].uv = uv_xy
        obj["linen_earth_uv_tangent_alignment_evidence_json"] = json.dumps(
            tangent_report, sort_keys=True
        )
        # Real current garment vertex positions in metres: report how long
        # candidate UV cut chains actually are and whether they run axially.
        # Neither these geometric lengths nor verticality prove fabric grain.
        uv_cut_classification = classify_unapproved_uv_seams(
            aligned_faces, radius_m=radius_m,
            tangent_face_indices=unapproved_tangent_indices,
            source_vertex_positions=[
                tuple(vertex.co) for vertex in mesh.vertices
            ],
        )
        obj["linen_earth_uv_cut_classification_json"] = json.dumps(
            uv_cut_classification, sort_keys=True
        )
        print("SOURCE_FIT_UV_CUT_CLASSIFICATION=" + obj.name + ":" +
              json.dumps(uv_cut_classification, sort_keys=True))
        obj["linen_earth_uv_phase_alignment_evidence_json"] = json.dumps(
            phase_report, sort_keys=True
        )
        obj["linen_earth_uv_geometry_radius_estimate_mm"] = round(radius_m * 1000, 3)
        obj["linen_earth_uv_mixed_projection_fallback_faces"] = fallback_faces
        obj["linen_earth_uv_unapproved_local_tangent_chart_faces"] = fallback_faces
        obj["linen_earth_uv_fallback_spatial_evidence_json"] = json.dumps({
            "faceCount": fallback_faces,
            "sourcePolygonIndices": [face["sourcePolygonIndex"] for face in fallback_receipts],
            "sampledFaceBounds": fallback_receipts[:12],
            "originalSourceModelPreserved": True,
            "seamLayoutApproved": False,
            "productionApproved": False,
        }, sort_keys=True)
        obj["linen_earth_uv_seam_certified"] = False
        method = "uncalibrated_metric_cylindrical_plus_local_tangent_seam_charts"
    else:
        for polygon in mesh.polygons:
            for loop_index in polygon.loop_indices:
                vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
                uv_layer.data[loop_index].uv = metric_planar_uv(
                    (vertex.co.x, vertex.co.y, vertex.co.z),
                    origin_x=min_x, origin_z=min_z,
                )
        method = "uncalibrated_metric_xz_planar"
    obj["linen_earth_uv_coordinate_units"] = "mesh_metres"
    obj["linen_earth_uv_method"] = method
    obj["linen_earth_supplier_repeat_verified"] = False
    obj["linen_earth_grain_direction_verified"] = False


def audit_authored_panel_uv(obj):
    """Record source-projection UV defects; never certify textile pattern scale."""
    mesh = obj.data
    mesh.calc_loop_triangles()
    uv = mesh.uv_layers.active
    if uv is None:
        raise RuntimeError(f"Candidate panel has no UV layer: {obj.name}")
    triangles = []
    for tri in mesh.loop_triangles:
        xyz = tuple(tuple(mesh.vertices[mesh.loops[i].vertex_index].co) for i in tri.loops)
        uv_coords = tuple(tuple(uv.data[i].uv) for i in tri.loops)
        triangles.append((xyz, uv_coords, tri.polygon_index))
    # Source polygon IDs survive stable evaluated triangulation. Keep a
    # bounded face-level hotspot inventory for targeted unapproved chart work.
    result = audit_uv_triangles(triangles)
    faces = [
        [
            (mesh.loops[loop_index].vertex_index, tuple(uv.data[loop_index].uv))
            for loop_index in polygon.loop_indices
        ]
        for polygon in mesh.polygons
    ]
    seam_audit = audit_shared_uv_edges(faces)
    result["sharedEdgeContinuity"] = seam_audit
    obj["linen_earth_uv_shared_edge_audit_json"] = json.dumps(seam_audit, sort_keys=True)
    obj["linen_earth_uv_candidate_audit_json"] = json.dumps(result, sort_keys=True)
    return result


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
    if not math.isfinite(options.hem_taper_fraction) or not 0 <= options.hem_taper_fraction <= 0.12:
        raise RuntimeError("Candidate hem taper must be finite and within 0 to 12 percent.")
    if not math.isfinite(options.trouser_leg_inboard_mm) or not 0 <= options.trouser_leg_inboard_mm <= MAX_LEG_INBOARD_MM:
        raise RuntimeError("Unverified leg spacing adjustment must stay within 0..8 mm per shell.")
    if not math.isfinite(options.sleeve_cuff_inboard_mm) or not 0 <= options.sleeve_cuff_inboard_mm <= MAX_INBOARD_MM:
        raise RuntimeError("Unverified sleeve cuff shift must be within 0..22 mm, not an approved body pose.")
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
        # Native spatial BVH evidence localizes all 82 residual torso faces to the
        # uppermost neck-edge band (around z=1.546m). Stop the unsewn torso
        # shell at the sleeve-root height; a real collar must be separate.
        "ShirtTorsoFabric": lambda p: z(0.615) <= p.z <= z(0.875)
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
    candidate_uv_report = {}
    for name, predicate in regions.items():
        obj = selected_shell(body, name, predicate)
        # Outer waistband is outside the tucked shirt instead of z-fighting
        # against an identically offset body-derived surface for 10 cm.
        panel_clearance = clearance_m + (options.waist_layer_extra_mm / 1000.0 if name == "TrouserWaistFabric" else 0.0)
        max_relief, shoulder_guide, phase_pairs, repair = fit_shell(obj, body, panel_clearance, thickness_m, name, options.candidate_relief_mm, min_z, height, options.surface_refine, options.contact_repair_passes, options.hem_taper_fraction, 0.0, options.trouser_leg_inboard_mm)
        fit_stage_report[name] = phase_pairs
        contact_repair_report[name] = repair
        obj["linen_earth_auto_authored"] = True
        obj["linen_earth_fit_clearance_mm"] = round(panel_clearance * 1000.0, 3)
        obj["linen_earth_cloth_thickness_mm"] = round(thickness_m * 1000.0, 3)
        obj["linen_earth_drape_method"] = "unverified_art_directed_candidate_relief_v1"
        obj["linen_earth_drape_max_relief_mm"] = round(max_relief, 3)
        if shoulder_guide:
            obj["linen_earth_shoulder_width_source_mm"] = round(shoulder_guide[0], 2)
            obj["linen_earth_shoulder_contour_scale"] = round(shoulder_guide[1], 6)
        authored.append(obj)

    # The default 3-mm trial created 138 actual leg/leg triangle intersections
    # in CI. Back off in <=0.5-mm steps using the measured final thickened
    # cloth, not just the apparent spacing. UVs are rebuilt AFTER geometry
    # settles, avoiding stale texture coordinates from the rejected trial.
    leg_gap_audit = restore_collision_free_leg_gap(
        body, min_z, height, options.trouser_leg_inboard_mm
    )
    seam_audit = None
    if not leg_gap_audit["nativeWorldSpaceCollisionFree"]:
        # Independent source CI shows residual cloth/cloth collisions even
        # with requested inward movement reversed to zero. Probe a 10-mm
        # maximum inner-seam-only contour; NEVER claim it is measured ease.
        seam_audit = trial_inner_crotch_seam_relief(body, min_z, height, center_x)
        if seam_audit["nativeWorldSpaceCollisionFree"]:
            # The seam probe is at zero leg-inboard; request the best safe
            # reduction again without subtracting a shift not yet applied.
            leg_gap_audit = restore_collision_free_leg_gap(
                body, min_z, height, options.trouser_leg_inboard_mm, applied_mm=0.0
            )
    cuff_audit = try_collision_safe_cuff_spacing(
        body, min_z, height, options.sleeve_cuff_inboard_mm
    )
    # The final attempted fine probe is not necessarily the SAFE snapshot.
    # Recompute source-world BVH contacts on the restored, actually retained
    # meshes. Never record the last rejected trial as the final garment state.
    sleeves = [bpy.data.objects[name] for name in
               ("ShirtSleeveLFabric", "ShirtSleeveRFabric")]
    legs = [bpy.data.objects[name] for name in
            ("TrouserLegLFabric", "TrouserLegRFabric")]
    sleeve_contact_final = [source_fit_collision_pairs(body, obj) for obj in sleeves]
    sleeve_mutual_final = source_fit_collision_pairs(sleeves[0], sleeves[1])
    leg_contact_final = [source_fit_collision_pairs(body, obj) for obj in legs]
    leg_mutual_final = source_fit_collision_pairs(legs[0], legs[1])
    for obj, post_count in zip(sleeves, sleeve_contact_final):
        fit_stage_report[obj.name]["postCuffBodyPairs"] = post_count
        fit_stage_report[obj.name]["postCuffSelectedMmPerSleeve"] = cuff_audit["selectedMmPerSleeve"]
        fit_stage_report[obj.name]["postCuffSleevePairs"] = sleeve_mutual_final
    for obj, post_count in zip(legs, leg_contact_final):
        fit_stage_report[obj.name]["postGapRollbackBodyPairs"] = post_count
        fit_stage_report[obj.name]["postGapRollbackLegPairs"] = leg_mutual_final
        fit_stage_report[obj.name]["postGapRollbackSelectedMm"] = leg_gap_audit["selectedMmPerLeg"]
    # A claimed collision-free rollback MUST describe the retained mesh, not
    # merely one safe intermediate probe: release remains closed on mismatch.
    if cuff_audit["nativeWorldSpaceCollisionFree"] and (
        sleeve_contact_final != [0, 0] or sleeve_mutual_final != 0
    ):
        raise RuntimeError("Restored cuff snapshot failed final independent BVH contact recheck")
    if leg_gap_audit["nativeWorldSpaceCollisionFree"] and (
        leg_contact_final != [0, 0] or leg_mutual_final != 0
    ):
        raise RuntimeError("Restored leg-gap snapshot failed final independent BVH contact recheck")
    for obj in authored:
        planar_grain_uv(obj)
        candidate_uv_report[obj.name] = audit_authored_panel_uv(obj)
    uv_seam_evidence = {
        obj.name: json.loads(obj["linen_earth_uv_fallback_spatial_evidence_json"])
        for obj in authored if "linen_earth_uv_fallback_spatial_evidence_json" in obj
    }
    print("SOURCE_FIT_UV_SEAM_SPATIAL_EVIDENCE=" + json.dumps(uv_seam_evidence, sort_keys=True))

    bpy.context.scene["linen_earth_uv_candidate_audit_json"] = json.dumps(candidate_uv_report, sort_keys=True)
    bpy.context.scene["linen_earth_uv_coordinate_units"] = "mesh_metres"
    bpy.context.scene["linen_earth_uv_method"] = "uncalibrated_metric_xz_torso_waist_cylindrical_sleeves_legs"
    bpy.context.scene["linen_earth_uv_supplier_repeat_verified"] = False
    bpy.context.scene["linen_earth_uv_grain_direction_verified"] = False
    print("SOURCE_FIT_UV_TOPOLOGY_UNAPPROVED=" + json.dumps(candidate_uv_report, sort_keys=True))
    bpy.context.scene["linen_earth_contact_repair_json"] = json.dumps(contact_repair_report, sort_keys=True)
    print("SOURCE_FIT_BOUNDED_CONTACT_REPAIR=" + json.dumps(contact_repair_report, sort_keys=True))
    bpy.context.scene["linen_earth_fit_collision_stages_json"] = json.dumps(fit_stage_report, sort_keys=True)
    print("SOURCE_FIT_COLLISION_STAGES_WORLD_SPACE=" + json.dumps(fit_stage_report, sort_keys=True))
    bpy.context.scene["linen_earth_asset_status"] = "auto-authored-production-candidate-needs-tailor-review"
    bpy.context.scene["linen_earth_garment_authoring_method"] = "locked-body-surface-shell-v2-bounded-preview-folds"
    bpy.context.scene["linen_earth_drape_provenance"] = "art_directed_unverified_visual_candidate"
    bpy.context.scene["linen_earth_measured_fabric_physics"] = False
    bpy.context.scene["linen_earth_production_approved"] = False
    bpy.context.scene["linen_earth_photo_parity_verified"] = False
    bpy.context.scene["linen_earth_preview_relief_requested_mm"] = options.candidate_relief_mm
    bpy.context.scene["linen_earth_surface_refine_level"] = options.surface_refine
    bpy.context.scene["linen_earth_contact_repair_passes"] = options.contact_repair_passes
    bpy.context.scene["linen_earth_waist_layer_extra_mm"] = options.waist_layer_extra_mm
    bpy.context.scene["linen_earth_hem_taper_candidate_fraction"] = options.hem_taper_fraction
    bpy.context.scene["linen_earth_candidate_sleeve_inboard_mm"] = cuff_audit["selectedMmPerSleeve"]
    bpy.context.scene["linen_earth_candidate_sleeve_inboard_requested_mm"] = options.sleeve_cuff_inboard_mm
    bpy.context.scene["linen_earth_sleeve_gap_rollback_audit_json"] = json.dumps(cuff_audit, sort_keys=True)
    bpy.context.scene["linen_earth_candidate_trouser_leg_inboard_mm"] = leg_gap_audit["selectedMmPerLeg"]
    bpy.context.scene["linen_earth_candidate_trouser_leg_inboard_requested_mm"] = options.trouser_leg_inboard_mm
    bpy.context.scene["linen_earth_leg_gap_rollback_audit_json"] = json.dumps(leg_gap_audit, sort_keys=True)
    bpy.context.scene["linen_earth_crotch_seam_relief_audit_json"] = json.dumps(seam_audit, sort_keys=True) if seam_audit else "not_needed"
    bpy.context.scene["linen_earth_candidate_crotch_seam_relief_mm"] = (
        seam_audit["selectedPeakSeamReliefMm"] if seam_audit else 0.0
    )
    bpy.context.scene["linen_earth_source_body_pose_changed"] = False
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
