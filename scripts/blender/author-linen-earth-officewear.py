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
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

# Authoring and Blender preflight use the same exact triangle/guide intersection.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from section_geometry import triangle_section_x_span
from surface_coverage import bounded_source_panel_displacement, body_aware_sleeve_ring, waist_to_chest_taper_radius, needs_tailoring_face_triangulation, terminal_face_patch_allowed, belongs_to_locked_shirt_trunk, reproject_vertex_to_fitted_ring, rounded_tailoring_ring_xy, adaptive_surface_cut_rounds, anatomically_enclose_intermediate_rings, nested_tucked_hem_ring, outward_ring_quad, subdivide_ring_profiles

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


def world_bounds(obj):
    return [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]


def body_frame(body):
    points = world_bounds(body)
    min_x = min(point.x for point in points)
    max_x = max(point.x for point in points)
    min_y = min(point.y for point in points)
    max_y = max(point.y for point in points)
    min_z = min(point.z for point in points)
    max_z = max(point.z for point in points)
    return {
        "centerX": (min_x + max_x) * 0.5,
        "centerY": (min_y + max_y) * 0.5,
        "minZ": min_z,
        "height": max_z - min_z,
    }


def remove_existing(name):
    obj = bpy.data.objects.get(name)
    if obj is not None:
        bpy.data.objects.remove(obj, do_unlink=True)


def ensure_export_collection():
    collection = bpy.data.collections.get(EXPORT_COLLECTION)
    if collection is None:
        collection = bpy.data.collections.new(EXPORT_COLLECTION)
        bpy.context.scene.collection.children.link(collection)
    return collection


def build_ring_shell(name, rings, segments=48, neck_opening=None, collar_height=0.0):
    if len(rings) < 2:
        raise RuntimeError(f"{name} requires at least two rings.")
    # Refine sparse garment surfaces BEFORE body collision repair. Merely
    # linearly interpolating torso and seat radii created a 95+mm collision
    # at 1.1909m in native Blender: the body bulges between construction rings.
    # Enclose measured anatomy at NEW levels while leaving every locked guide
    # and original production panel measurement ring exactly unchanged.
    intermediate = subdivide_ring_profiles(rings)
    if name in ("ShirtTorsoFabric", "TrouserWaistFabric"):
        body = bpy.data.objects.get(BODY_NAME)
        if body is None or body.type != "MESH":
            raise RuntimeError("Locked realistic body required for intermediate ring fitting.")
        body_samples = [body.matrix_world @ vertex.co for vertex in body.data.vertices]
        # Broad chest/seat sections are softly squared rather than circular
        # cylinders. A real anatomical front-side corner no longer requires
        # >70 mm fake expansion from a mathematically inappropriate ellipse.
        section_power = 3.2 if name == "ShirtTorsoFabric" else 2.6
        rings = anatomically_enclose_intermediate_rings(
            rings, intermediate, body_samples,
            profile_power=section_power,
            max_center_shift_m=0.018 if name == "ShirtTorsoFabric" else 0.012,
        )
    elif name in ("ShirtSleeveLFabric","ShirtSleeveRFabric"):
        # Six rings alone do not reproduce the bent real forearm. Linear
        # interpolation between upper-arm/elbow/cuff guides introduced actual
        # penetrations deep in the inboard sleeve despite fully fitted endpoints.
        # Measure the LOCKED body at every new 55mm (or shorter) real sleeve
        # construction section before generating cloth faces. Preserve the
        # original five source rings and the photographed hand-centre guide.
        section_power = 2.0
        body = bpy.data.objects.get(BODY_NAME)
        if body is None or body.type!="MESH":
            raise RuntimeError("Real locked body required for intermediate arm fitting.")
        body_samples=[body.matrix_world @ vertex.co for vertex in body.data.vertices]
        originals={round(row[0],8) for row in rings}
        body_cx=body_frame(body)["centerX"]
        side=-1 if name=="ShirtSleeveLFabric" else 1
        fitted=[]
        evidence=[]
        for row in intermediate:
            if round(row[0],8) in originals:
                fitted.append(row)
                continue
            upper=row[0] > 1.31
            measured,info=body_aware_sleeve_ring(
                body_samples,row,body_center_x=body_cx,side=side,
                clearance_m=0.006,
                sample_band_m=0.060 if upper else 0.035,
                min_arm_distance_m=0.172 if upper else 0.202,
                locked_hand_center=row[0]<1.025,
            )
            fitted.append(measured)
            evidence.append({"zMm":round(row[0]*1000,2),**info})
        rings=fitted
        print("Linen Earth real intermediate arm panels: "+name+" "
              +json.dumps(evidence,sort_keys=True),flush=True)
    else:
        section_power = 2.0
        rings = intermediate
    collection = ensure_export_collection()
    vertices = []
    faces = []
    # Sleeves/trouser legs are authored high->low but torso/waist low->high.
    # Inverting these quads is essential: SOLIDIFY offset=+1 must add cloth
    # thickness OUTSIDE, never toward the locked real body's skin.
    rings_ascending = rings[-1][0] > rings[0][0]
    for ring_index, ring in enumerate(rings):
        z_value, center_x, center_y, radius_x, radius_y = ring
        for segment in range(segments):
            angle = 2.0 * math.pi * segment / segments
            px, py = rounded_tailoring_ring_xy(
                angle, center_x, center_y, radius_x, radius_y,
                profile_power=section_power
            )
            vertices.append((px, py, z_value))
        if ring_index:
            previous = (ring_index - 1) * segments
            current = ring_index * segments
            for segment in range(segments):
                nxt = (segment + 1) % segments
                faces.append(outward_ring_quad(
                    previous, current, segment, nxt, ascending=rings_ascending
                ))

    if neck_opening is not None:
        top_index = (len(rings) - 1) * segments
        z_value, center_x, center_y, neck_rx, neck_ry = neck_opening
        neck_start = len(vertices)
        for segment in range(segments):
            angle = 2.0 * math.pi * segment / segments
            vertices.append((
                center_x + math.cos(angle) * neck_rx,
                center_y + math.sin(angle) * neck_ry,
                z_value,
            ))
        for segment in range(segments):
            nxt = (segment + 1) % segments
            faces.append((
                top_index + segment,
                top_index + nxt,
                neck_start + nxt,
                neck_start + segment,
            ))
        if collar_height > 0:
            collar_top = len(vertices)
            for segment in range(segments):
                angle = 2.0 * math.pi * segment / segments
                front_bias = max(0.0, -math.sin(angle))
                lift = collar_height * (0.78 + 0.22 * front_bias)
                vertices.append((
                    center_x + math.cos(angle) * (neck_rx + 0.006),
                    center_y + math.sin(angle) * (neck_ry + 0.005),
                    z_value + lift,
                ))
            for segment in range(segments):
                nxt = (segment + 1) % segments
                faces.append((
                    neck_start + segment,
                    neck_start + nxt,
                    collar_top + nxt,
                    collar_top + segment,
                ))

    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    material.use_nodes = True
    mesh.materials.append(material)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def body_depth_at_z(body, z_world, center_x, half_window, band=0.030, minimum=0.10):
    matrix = body.matrix_world
    ys = []
    for vertex in body.data.vertices:
        point = matrix @ vertex.co
        if abs(point.z - z_world) <= band and abs(point.x - center_x) <= half_window:
            ys.append(point.y)
    if len(ys) < 6:
        return minimum
    return max(minimum, (max(ys) - min(ys)) * 0.5)



def body_section_y_depth(body, z_world, center_x, half_window, minimum=0.10, band=0.045):
    """Fit the shirt/seat around real locked torso posture, not global Y=0.

    The scan's shoulder blades and seat are offset from its waist centre;
    a single global Y used by all ring cylinders exposes the back and glutes.
    Quantile bounds ignore isolated fingers near the same height while still
    enclosing the observed trunk with an intentional clearance.
    """
    matrix = body.matrix_world
    section = [
        (matrix @ vertex.co).y for vertex in body.data.vertices
        if abs((matrix @ vertex.co).z - z_world) <= band
        and abs((matrix @ vertex.co).x - center_x) <= half_window
    ]
    if len(section) < 16:
        raise RuntimeError(
            f"Locked body has only {len(section)} torso/seat samples at z={z_world:.3f}m; "
            "cannot certify garment depth or posture."
        )
    section.sort()
    low = section[int(len(section) * 0.01)]
    high = section[min(len(section)-1, int(len(section) * 0.99))]
    if high - low < 0.04:
        raise RuntimeError("Locked body torso/seat section is implausibly thin.")
    return (low + high) * 0.5, max(minimum, (high - low) * 0.5)


def body_aware_leg_ring(body_points, ring, side, body_center_x, target_leg_x,
                        clearance_m, keep_locked_hem_width=False):
    """Match leg-shell depth and calf/thigh extent to the actual locked body.

    The old tubes were centered on a global body Y center and sat behind local
    knee/calves, leaving skin exposed even when 3D intersection QA passed.
    This is geometric ease estimation, NOT a physical-panel measurement.
    """
    z, center_x, center_y, radius_x, radius_y = ring
    corridor = 0.145
    samples = [
        point for point in body_points
        if abs(point.z - z) <= 0.040
        and abs(point.x - target_leg_x) <= corridor
        and side * (point.x - body_center_x) >= 0.006
    ]
    if len(samples) < 16:
        return ring, {
            "status": "unverified-insufficient-body-cross-section",
            "sampleCount": len(samples),
            "zMm": round(z * 1000, 2),
        }

    xs = sorted(point.x for point in samples)
    ys = sorted(point.y for point in samples)
    lo = max(0, int(len(xs) * 0.015))
    hi = min(len(xs) - 1, int(len(xs) * 0.985))
    anatomical_center_x = (xs[lo] + xs[hi]) * 0.5
    anatomical_center_y = (ys[lo] + ys[hi]) * 0.5
    # Model identity fixes the overall stance. Move each tube at most 8 mm
    # laterally; follow the local anatomical front/back depth without drifting
    # the locked leg spacing.
    fitted_x = target_leg_x + max(-0.008, min(0.008, anatomical_center_x - target_leg_x))
    fitted_y = anatomical_center_y
    half_x = max(radius_x, max(fitted_x - xs[lo], xs[hi] - fitted_x) + clearance_m + 0.008)
    half_y = max(radius_y, max(fitted_y - ys[lo], ys[hi] - fitted_y) + clearance_m + 0.010)
    if keep_locked_hem_width:
        # The photographed identity locks the hem silhouette; do not invent a
        # wider physical opening without owner/tailor measurement evidence.
        half_x = radius_x

    return (z, fitted_x, fitted_y, half_x, half_y), {
        "status": "anatomy-fitted-geometry-only",
        "sampleCount": len(samples),
        "zMm": round(z * 1000, 2),
        "widthChangeMm": round((half_x - radius_x) * 2000, 2),
        "depthChangeMm": round((half_y - radius_y) * 2000, 2),
        "lateralShiftMm": round((fitted_x - target_leg_x) * 1000, 2),
        "depthShiftMm": round((fitted_y - center_y) * 1000, 2),
        "hemWidthLocked": keep_locked_hem_width,
    }


def build_procedural_officewear(body, targets, shirt_clearance_m, trouser_clearance_m):
    frame = body_frame(body)
    cx = frame["centerX"]
    cy = frame["centerY"]
    shoulder_z = guide_center_z("LE_GUIDE_SHIRT_SHOULDER")
    shirt_waist_z = guide_center_z("LE_GUIDE_SHIRT_WAIST")
    trouser_waist_z = guide_center_z("LE_GUIDE_TROUSER_WAIST")
    left_hem_z = guide_center_z("LE_GUIDE_LEFT_HEM")
    right_hem_z = guide_center_z("LE_GUIDE_RIGHT_HEM")
    left_hand_z = guide_center_z("LE_GUIDE_LEFT_HAND_CENTER_H")
    right_hand_z = guide_center_z("LE_GUIDE_RIGHT_HAND_CENTER_H")
    if any(value is None for value in (shoulder_z, shirt_waist_z, trouser_waist_z, left_hem_z, right_hem_z, left_hand_z, right_hand_z)):
        raise RuntimeError("Locked identity guides are required for procedural officewear authoring.")

    shoulder_half = float(targets["shoulderSeamWidth"]) / 2000.0
    shirt_waist_half = float(targets["shirtWaistWidth"]) / 2000.0
    trouser_waist_half = float(targets["trouserWaistWidth"]) / 2000.0
    hand_half = float(targets["handCenterSpacing"]) / 2000.0
    leg_center_half = float(targets["legCenterSpacing"]) / 2000.0
    hem_half = float(targets["hemWidth"]) / 2000.0

    chest_z = shoulder_z - 0.150
    upper_waist_z = shirt_waist_z + 0.115
    shirt_hem_z = trouser_waist_z - 0.035
    shoulder_y, shoulder_depth = body_section_y_depth(body, shoulder_z - 0.035, cx, 0.225, minimum=0.105)
    chest_y, chest_depth = body_section_y_depth(body, chest_z, cx, 0.210, minimum=0.115)
    waist_y, waist_depth = body_section_y_depth(body, shirt_waist_z, cx, 0.185, minimum=0.100)
    shirt_depth_shoulder = shoulder_depth + shirt_clearance_m
    shirt_depth_chest = chest_depth + shirt_clearance_m
    shirt_depth_waist = waist_depth + shirt_clearance_m
    # A tucked shirt's final 35 mm must sit directly UNDER the trouser waistband.
    # Earlier we anchored it to the higher shirt-waist guide instead, leaving a
    # visible floating shirt/trouser gap (Blender proof: 32.7 mm median).
    # Use the SAME locked-body hip cross-section and actual trouser waist ease.
    trouser_waist_y, waist_depth_at_hip = body_section_y_depth(
        body, trouser_waist_z, cx, 0.205, minimum=0.115
    )
    trouser_depth_waist = waist_depth_at_hip + trouser_clearance_m
    tucked_hem = nested_tucked_hem_ring(
        shirt_hem_z, cx, trouser_waist_y, trouser_waist_half, trouser_depth_waist,
        inset_m=0.007,
    )

    shirt = build_ring_shell(
        "ShirtTorsoFabric",
        [
            tucked_hem,
            (shirt_waist_z, cx, waist_y, shirt_waist_half, shirt_depth_waist),
            (upper_waist_z, cx, (waist_y+chest_y)*0.5, shirt_waist_half + 0.012, shirt_depth_waist + 0.006),
            (chest_z, cx, chest_y, shoulder_half - 0.020, shirt_depth_chest),
            (shoulder_z - 0.045, cx, shoulder_y, shoulder_half - 0.006, shirt_depth_shoulder),
            (shoulder_z, cx, shoulder_y, shoulder_half, shirt_depth_shoulder * 0.96),
        ],
        segments=64,
        neck_opening=(shoulder_z, cx, shoulder_y - 0.006, 0.061, 0.054),
        collar_height=0.032,
    )

    sleeve_top_z = shoulder_z - 0.018
    cuff_z = (left_hand_z + right_hand_z) * 0.5 + 0.055
    sleeve_length = max(0.42, sleeve_top_z - cuff_z)
    # Sleeve cap must start OUTSIDE the locked shoulder seam, not run a
    # complete tube inside the chest. The photographed 574mm outer-arm
    # silhouette remains the construction bound at this upper armhole.
    sleeve_top_center = shoulder_half + 0.037
    sleeve_top_radius = 0.056
    sleeve_elbow_radius = 0.052
    cuff_radius_x = 0.038
    cuff_radius_y = 0.032
    body_points = [body.matrix_world @ vertex.co for vertex in body.data.vertices]
    sleeve_profile_evidence = {}
    sleeves = {}
    for side, name in ((-1, "ShirtSleeveLFabric"), (1, "ShirtSleeveRFabric")):
        top_x = cx + side * sleeve_top_center
        cuff_x = cx + side * hand_half
        elbow_z = cuff_z + sleeve_length * 0.48
        elbow_x = top_x + (cuff_x - top_x) * 0.58
        source_sleeve_rings=[
            (sleeve_top_z, top_x, cy, sleeve_top_radius, sleeve_top_radius * 0.82),
            (sleeve_top_z - 0.105, top_x + side * 0.010, cy, 0.062, 0.050),
            (elbow_z, elbow_x, cy, sleeve_elbow_radius, 0.043),
            (cuff_z + 0.085, cuff_x, cy, 0.043, 0.035),
            (cuff_z, cuff_x, cy, cuff_radius_x, cuff_radius_y),
        ]
        fitted_sleeve_rings=[]
        sleeve_profile_evidence[name]=[]
        for index, ring in enumerate(source_sleeve_rings):
            # The photographed hand centre stays locked. Nearby arm rings
            # follow real source-body forearm and elbow depths, NOT global Y=0.
            fit,evidence=body_aware_sleeve_ring(
                body_points,ring,body_center_x=cx,side=side,
                clearance_m=shirt_clearance_m,
                locked_hand_center=index==len(source_sleeve_rings)-1,
                # Native Blender found only 11 upper-arm vertices near z=1.4347m;
                # keep the 16-real-sample minimum, widen shoulder band only.
                sample_band_m=0.060 if index==0 else 0.035,
                # Near elbow, only the actual hanging arm is sampled.
                # The torso at x=+-0.17m otherwise widens the cylindrical
                # sleeve INWARD until it collides with the locked chest.
                min_arm_distance_m=0.172 if index==0 else (
                    0.197 if index==1 else 0.202
                ),
            )
            fitted_sleeve_rings.append(fit)
            sleeve_profile_evidence[name].append(evidence)
        print("Linen Earth measured sleeve source fit: "
              + name + " " + json.dumps({
                  "rings":[[round(v,5) for v in row] for row in fitted_sleeve_rings],
                  "evidence":sleeve_profile_evidence[name],
              },sort_keys=True),flush=True)
        sleeves[name] = build_ring_shell(
            name, fitted_sleeve_rings, segments=48,
        )

    seat_z = trouser_waist_z - 0.165
    upper_thigh_z = trouser_waist_z - 0.260
    seat_y, depth_at_seat = body_section_y_depth(body, seat_z, cx, 0.220, minimum=0.135)
    trouser_depth_seat = depth_at_seat + trouser_clearance_m
    trouser_waist = build_ring_shell(
        "TrouserWaistFabric",
        [
            (upper_thigh_z, cx, seat_y, trouser_waist_half + 0.026, trouser_depth_seat),
            (seat_z, cx, seat_y - 0.006, trouser_waist_half + 0.034, trouser_depth_seat + 0.006),
            (trouser_waist_z - 0.070, cx, (seat_y+trouser_waist_y)*0.5, trouser_waist_half + 0.010, trouser_depth_waist + 0.004),
            (trouser_waist_z, cx, trouser_waist_y, trouser_waist_half, trouser_depth_waist),
        ],
        segments=64,
    )

    # Register candidate garment rings to the real body at each height.
    # A fixed global Y center makes thigh/calf skin poke through the cloth.
    # Reuse same immutable locked source body samples for sleeve and leg fit.
    leg_profile_evidence = {}
    legs = {}
    for side, name, hem_z in (
        (-1, "TrouserLegLFabric", left_hem_z),
        (1, "TrouserLegRFabric", right_hem_z),
    ):
        thigh_center_x = cx + side * (leg_center_half - 0.012)
        lower_center_x = cx + side * leg_center_half
        knee_z = hem_z + (upper_thigh_z - hem_z) * 0.48
        calf_z = hem_z + (upper_thigh_z - hem_z) * 0.20
        base_rings = [
            (upper_thigh_z + 0.050, thigh_center_x, cy - 0.002, 0.078, 0.082),
            (upper_thigh_z - 0.070, thigh_center_x, cy, 0.071, 0.075),
            (knee_z, lower_center_x, cy, 0.050, 0.052),
            (calf_z, lower_center_x, cy, 0.042, 0.045),
            (hem_z + 0.035, lower_center_x, cy, hem_half, 0.038),
            (hem_z, lower_center_x, cy, hem_half, 0.037),
        ]
        fitted_rings = []
        leg_profile_evidence[name] = []
        for index, ring in enumerate(base_rings):
            fitted, evidence = body_aware_leg_ring(
                body_points, ring, side, cx,
                thigh_center_x if index < 2 else lower_center_x,
                trouser_clearance_m, keep_locked_hem_width=index >= 4,
            )
            leg_profile_evidence[name].append(evidence)
            if evidence["status"] != "anatomy-fitted-geometry-only":
                raise RuntimeError(
                    f"{name} cannot be fitted at z={ring[0]:.3f}m: "
                    f"{evidence['sampleCount']} realistic-body cross-section samples. "
                    "Refusing to substitute the generic tube without visible-body fit evidence."
                )
            fitted_rings.append(fitted)
        legs[name] = build_ring_shell(name, fitted_rings, segments=48)

    authored = {
        "ShirtTorsoFabric": shirt,
        **sleeves,
        "TrouserWaistFabric": trouser_waist,
        **legs,
    }
    return authored, {
        "method": "closed-tailoring-ring-shell-v2",
        "shirtShoulderWidthMm": round(shoulder_half * 2000.0, 2),
        "shirtWaistWidthMm": round(shirt_waist_half * 2000.0, 2),
        "trouserWaistWidthMm": round(trouser_waist_half * 2000.0, 2),
        "handCenterSpacingMm": round(hand_half * 2000.0, 2),
        "legCenterSpacingMm": round(leg_center_half * 2000.0, 2),
        "hemWidthMm": round(hem_half * 2000.0, 2),
        "bodyAwareSleeveProfileEvidence": sleeve_profile_evidence,
        "bodyAwareLegProfileEvidence": leg_profile_evidence,
        "source": "geometry-estimated-locked-body-not-physical-panel-evidence",
    }


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


def fit_shell(obj, body, clearance_m, thickness_m):
    shrink = obj.modifiers.new("LE_BODY_CLEARANCE", "SHRINKWRAP")
    shrink.target = body
    shrink.wrap_method = "NEAREST_SURFACEPOINT"
    shrink.wrap_mode = "OUTSIDE_SURFACE"
    shrink.offset = clearance_m
    apply_modifier(obj, shrink)

    smooth = obj.modifiers.new("LE_GARMENT_SMOOTH", "CORRECTIVE_SMOOTH")
    smooth.factor = 0.22
    smooth.iterations = 3
    apply_modifier(obj, smooth)

    solid = obj.modifiers.new("LE_CLOTH_THICKNESS", "SOLIDIFY")
    solid.thickness = thickness_m
    solid.offset = 1.0
    solid.use_rim = True
    apply_modifier(obj, solid)


def world_bvh(obj, epsilon=0.0):
    if obj is None or obj.type != "MESH":
        return None
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        matrix = evaluated.matrix_world
        vertices = [matrix @ vertex.co for vertex in mesh.vertices]
        polygons = [tuple(polygon.vertices) for polygon in mesh.polygons if len(polygon.vertices) >= 3]
        if not vertices or not polygons:
            return None
        return BVHTree.FromPolygons(vertices, polygons, all_triangles=False, epsilon=epsilon)
    finally:
        evaluated.to_mesh_clear()


def point_inside_closed_bvh(tree, point, epsilon=1e-5, max_hits=64):
    direction = Vector((1.0, 0.371, 0.117)).normalized()
    origin = point + direction * epsilon
    hits = 0
    for _ in range(max_hits):
        result = tree.ray_cast(origin, direction)
        location = result[0] if result else None
        distance = result[3] if result and len(result) > 3 else None
        if location is None or distance is None:
            break
        hits += 1
        origin = location + direction * epsilon
    return (hits % 2) == 1




def enclose_post_identity_torso_profile(
    obj, body, locked_z_planes, clearance_m, *,
    profile_power=2.0, max_center_shift_m=0.0,
):
    """Re-fit true body sections AFTER shoulder/waist guide normalization.

    Identity shaping scales X after authoring. That can pull intermediate
    chest/seat rings back into the locked human at an armpit. Re-check every
    non-guide ring against actual human cross-sections before making smaller
    faces. Never alter the photographed shoulder, shirt-waist or trouser-waist
    guide rings. The existing 70mm envelope and 95mm vertex-repair caps stay.
    """
    matrix=obj.matrix_world
    inverse=matrix.inverted()
    grouped={}
    for vertex in obj.data.vertices:
        point=matrix @ vertex.co
        grouped.setdefault(round(point.z,6),[]).append((vertex,point))
    if len(grouped)<3:
        raise RuntimeError(f"{obj.name} lacks enough garment construction rings.")
    entries=[]
    shirt_shoulder_z=max(locked_z_planes) if obj.name=="ShirtTorsoFabric" else None
    for z,items in sorted(grouped.items()):
        if len(items)<24:
            continue
        # Raised collar-band and neck-gasket levels are NOT torso cross-sections.
        # The native Blender candidate previously tried to expand a 67x29.5mm
        # collar cap around full shoulders (4.778x growth). The collar stays
        # real, but is checked by separate neck/collar coverage gates instead.
        if shirt_shoulder_z is not None and not belongs_to_locked_shirt_trunk(z,shirt_shoulder_z):
            continue
        # The original torso neck opening shares the shoulder Z guide and
        # must remain untouched. All real shoulder/waist guide planes lock.
        xs=[point.x for _,point in items]
        ys=[point.y for _,point in items]
        row=(z,(min(xs)+max(xs))*0.5,(min(ys)+max(ys))*0.5,
             (max(xs)-min(xs))*0.5,(max(ys)-min(ys))*0.5)
        entries.append((items,row))
    profile=[row for _,row in entries]
    protected=[
        row for row in profile
        if any(abs(row[0]-guide_z)<0.002 for guide_z in locked_z_planes)
    ]
    if not protected:
        raise RuntimeError(f"{obj.name} missing physical guide rings.")
    body_points=[body.matrix_world @ vertex.co for vertex in body.data.vertices]
    enclosed=anatomically_enclose_intermediate_rings(
        protected, profile, body_points,
        clearance_m=max(0.004,min(0.012,clearance_m)),
        max_growth_m=0.070,
        # This mesh already uses a softly rectangular profile. Re-checking it
        # as an ellipse artificially rejects real chest/seat corner geometry.
        profile_power=profile_power,
        max_center_shift_m=max_center_shift_m,
    )
    altered=0
    max_growth=0.0
    for (items,row),target in zip(entries,enclosed):
        _,cx,cy,rx,ry=row
        added=max(target[3]-rx,target[4]-ry)
        center_shift_y=target[2]-cy
        if added<=1e-7 and abs(center_shift_y)<=1e-7:
            continue
        # Preserve the original physically locked guide positions.
        if any(abs(row[0]-guide_z)<0.002 for guide_z in locked_z_planes):
            raise RuntimeError(f"{obj.name} cannot change a locked physical guide.")
        for vertex,point in items:
            fitted_xyz=reproject_vertex_to_fitted_ring(
                (point.x,point.y,point.z), row, target
            )
            vertex.co=inverse @ Vector(fitted_xyz)
        altered+=1
        max_growth=max(max_growth,added)
    obj.data.update()
    return {"nonGuideRingsExpanded":altered,
            "maxRadiusGrowthMm":round(max_growth*1000,2),
            "lockedGuideCount":len(protected),
            "maxAllowedRadiusGrowthMm":70.0}

def restore_shirt_waist_side_seam(obj, waist_z, waist_half_width_m, shoulder_z, center_x):
    """Reshape the SOURCE garment near a locked waist, not the locked body.

    Native Blender showed an absurd 245mm shirt half-width merely 16-30mm
    above the photographed 147mm waist guide: torso section fitting had
    accidentally enclosed the adjacent hanging arm. Reconstruct a smooth,
    physically bounded waist-to-chest taper before the strict BVH clearance
    phase, while preserving every photographed identity guide unchanged.
    """
    matrix=obj.matrix_world
    inverse=matrix.inverted()
    groups={}
    for vertex in obj.data.vertices:
        point=matrix @ vertex.co
        groups.setdefault(round(point.z,6),[]).append((vertex,point))
    corrected=0
    max_shaping_mm=0.0
    for z,items in groups.items():
        if not (waist_z+0.002 < z < min(waist_z+0.160,shoulder_z-0.002)):
            continue
        actual=max(abs(point.x-center_x) for _,point in items)
        # Only correct the arm-driven flare; maintain genuine natural chest
        # breadth where there is sufficient height to taper from the waist.
        allowed=waist_to_chest_taper_radius(waist_half_width_m,z-waist_z)
        if actual<=allowed+1e-7: continue
        factor=allowed/actual
        for vertex,point in items:
            update_x=center_x+(point.x-center_x)*factor
            movement=abs(update_x-point.x)
            if movement>0.095:
                raise RuntimeError(
                    f"{obj.name}: source side seam needs >95mm reshape near z={z:.4f}m."
                )
            vertex.co=inverse @ Vector((update_x,point.y,point.z))
            max_shaping_mm=max(max_shaping_mm,movement*1000)
        corrected+=1
    obj.data.update()
    print("Linen Earth shirt-source waist taper: "
          + json.dumps({"reshapedRings":corrected,
                        "maximumSideSeamCorrectionMm":round(max_shaping_mm,2),
                        "lockedWaistZ":round(waist_z,5)},sort_keys=True),flush=True)
    return {"reshapedRings":corrected,
            "maximumSideSeamCorrectionMm":round(max_shaping_mm,2),
            "lockedWaistPreserved":True}


def relieve_inboard_sleeve_contact(obj, body_center_x, *, side, contact_z=1.155,
                                  amplitude_m=0.030, half_span_m=0.125):
    """Tuck the *medial* sleeve seam out of a bent hanging arm / torso crease.

    Measured body-contact samples show the source sleeve *itself* crosses
    the armpit/body near z=1.11m. Even after repeated projection, a 5mm
    source edge split into a 120mm crossing between two opposite skin exits.
    Correct the MEDIAL source pattern by up to 30mm before BVH projection,
    rather than distorting safe neighbors or weakening the 95mm guard.
    Reform only the cloth's
    inner side in the contact band before BVH fitting, retaining the outside
    silhouette, shoulder, photographed cuff/hand centre and locked body.
    """
    if side not in (-1,1) or isinstance(side,bool):
        raise RuntimeError("Sleeve medial relief requires a real left/right side.")
    if not 0.002 <= amplitude_m <= 0.035 or not 0.09 <= half_span_m <= 0.16:
        raise RuntimeError("Medial sleeve relief exceeds a small tailoring adjustment.")
    if not obj.name.startswith("ShirtSleeve"):
        raise RuntimeError("Only the shirt's real sleeve panels support medial relief.")
    matrix=obj.matrix_world
    inverse=matrix.inverted()
    sleeve_center_x=body_center_x+side*0.242
    displaced=0
    max_delta=0.0
    for vertex in obj.data.vertices:
        point=matrix@vertex.co
        normalized_z=abs(point.z-contact_z)/half_span_m
        if normalized_z>=1.0: continue
        # Leave the outward half completely unchanged: the locked overall
        # model silhouette and outer-arm width must stay the same.
        inward=side*(point.x-sleeve_center_x)
        if inward>=0.0: continue
        lateral_weight=min(1.0, max(0.0,-inward/0.050))
        axial_weight=(1-normalized_z**2)**2
        delta=amplitude_m*lateral_weight*axial_weight
        if delta<0.000001: continue
        vertex.co=inverse@Vector((point.x+side*delta,point.y,point.z))
        displaced+=1
        max_delta=max(max_delta,delta)
    obj.data.update()
    return {"physicalSleeveMedialReliefMm":round(max_delta*1000,2),
            "sourceVerticesReshaped":displaced,
            "bodyAndOutsideSilhouetteUnchanged":True}


def refine_collision_faces(obj, max_edge_m=0.025, max_faces=80000):
    """Add genuine surface vertices at long shell edges before body-fit repair.

    A previously sparse six-piece panel can cut through the locked human even
    though its corner/ring vertices pass containment. Blender's BMesh halves
    long edges; the existing strict body-BVH repair then moves *real* new
    vertices outside, rather than hiding face penetration in the preflight.
    Original guide-plane vertices and target dimensions are preserved.
    """
    bm=bmesh.new()
    try:
        bm.from_mesh(obj.data)
        if not bm.verts or not bm.faces:
            raise RuntimeError(f"{obj.name} has no physical garment surface to refine.")
        largest=max(edge.calc_length() for edge in bm.edges)
        rounds=adaptive_surface_cut_rounds(largest,max_edge_m)
        before=len(bm.verts)
        # A partial edge split of ring-shell quads turns adjacent quads into
        # huge non-planar n-gons, which Blender may triangulate THROUGH the
        # real body. Refine the WHOLE structured panel uniformly each round:
        # contiguous cloth retains its true local quad topology and original
        # locked guide vertices, and only new vertices need BVH projection.
        for _ in range(rounds):
            if max((edge.calc_length() for edge in bm.edges),default=0)<=max_edge_m:
                break
            # Regular quads become four quads, not disconnected edge fans.
            # Refuse mesh explosion instead of diluting physical collision QA.
            if len(bm.faces)*4>max_faces:
                raise RuntimeError(
                    f"{obj.name} uniform cloth surface would exceed "
                    f"{max_faces} physical faces; remodel panel resolution."
                )
            bmesh.ops.subdivide_edges(
                bm,edges=list(bm.edges),cuts=1,use_grid_fill=True
            )
            if len(bm.faces)>max_faces:
                raise RuntimeError(f"{obj.name} exceeded safe garment topology limit.")
            if any(needs_tailoring_face_triangulation(len(face.verts)) for face in bm.faces):
                raise RuntimeError(
                    f"{obj.name} uniform refinement produced non-local cloth polygons."
                )
        bm.normal_update()
        bm.to_mesh(obj.data)
        obj.data.update(calc_edges=True)
        return {
            "newVertices": len(obj.data.vertices)-before,
            "refinementRounds": rounds,
            "faces": len(obj.data.polygons),
            "maxEdgeTargetMm": round(max_edge_m*1000,1),
        }
    finally:
        bm.free()

def repair_body_penetrations(obj, body, clearance_m, max_passes=4):
    """Push only garment vertices that are actually inside the locked body outside.

    The procedural tailoring shell keeps its authored ease/drape everywhere else.
    This deliberately uses the same odd/even BVH containment rule as production
    preflight, so authoring and QA agree on what counts as a penetration.
    """
    body_tree = world_bvh(body, epsilon=0.0)
    if body_tree is None:
        raise RuntimeError("Could not build locked-body BVH for garment collision repair.")

    matrix = obj.matrix_world
    inverse = matrix.inverted()
    total_moved = 0
    max_before_mm = 0.0

    for _ in range(max_passes):
        moved_this_pass = 0
        for vertex in obj.data.vertices:
            point = matrix @ vertex.co
            if not point_inside_closed_bvh(body_tree, point):
                continue
            nearest = body_tree.find_nearest(point)
            if nearest is None or nearest[0] is None or nearest[1] is None:
                continue
            surface, normal = nearest[0], nearest[1].normalized()
            distance = (point - surface).length
            max_before_mm = max(max_before_mm, distance * 1000.0)

            # The old fallback picked a point that could STILL be classified
            # inside at deep shoulder/waist concavities. In the real Blender
            # candidate this left one torso vertex embedded after four passes.
            # Search both normal directions at increasing distances and choose
            # the nearest point actually verified OUTSIDE the locked body.
            target = None
            possible = []
            frame = body_frame(body)
            radial = Vector((
                point.x - frame["centerX"],
                point.y - frame["centerY"],
                0.0,
            ))
            directions = [normal, -normal]
            if radial.length > 1e-7:
                directions.append(radial.normalized())
            # The closest polygon normal can be nearly tangent at an armpit
            # crease. A real locked-body vertex at (-.167,.056,1.303) resisted
            # both normal signs even 96mm away. Probe lateral/fore-aft outward
            # too; every chosen point is still validated by identical BVH parity.
            directions += [
                Vector((-1.0 if point.x < frame["centerX"] else 1.0,0.0,0.0)),
                Vector((0.0,-1.0 if point.y < frame["centerY"] else 1.0,0.0)),
            ]
            for probe_distance in (
                clearance_m, 0.012, 0.024, 0.045, 0.075, 0.110, 0.160
            ):
                for direction in directions:
                    # Local projected surface keeps normal-based repairs
                    # minimal; radial proposals are measured from the original
                    # vertex so the shirt cannot jump across the body.
                    start = surface if direction in (normal, -normal) else point
                    candidate = start + direction * probe_distance
                    if not point_inside_closed_bvh(body_tree, candidate):
                        possible.append(((candidate - point).length, candidate))
                if possible:
                    target = min(possible, key=lambda item: item[0])[1]
                    break
            if target is None:
                raise RuntimeError(
                    f"{obj.name} could not find an outside body projection "
                    f"for embedded vertex near {tuple(round(value,4) for value in point)}."
                )
            if (target - point).length > 0.095:
                raise RuntimeError(
                    f"{obj.name} needs more than 95mm anatomy correction at "
                    f"{tuple(round(value,4) for value in point)}; reshape panels instead."
                )

            vertex.co = inverse @ target
            moved_this_pass += 1
            total_moved += 1

        obj.data.update()
        if moved_this_pass == 0:
            break

    remaining_inside = 0
    for vertex in obj.data.vertices:
        if point_inside_closed_bvh(body_tree, matrix @ vertex.co):
            remaining_inside += 1

    if remaining_inside:
        raise RuntimeError(
            f"{obj.name} collision repair left {remaining_inside} garment vertices inside the locked body."
        )

    return {
        "movedVertices": total_moved,
        "maxPenetrationBeforeMm": round(max_before_mm, 2),
        "clearanceMm": round(clearance_m * 1000.0, 2),
        "remainingInsideVertices": remaining_inside,
    }



def repair_between_vertex_collisions(obj, body, clearance_m, max_rounds=8):
    """Fix true face-centre and edge-midpoint body penetrations, not just vertices.

    A mesh can pass the original vertex BVH gate while its planar faces cut
    into the curved torso, shoulder and calves. Correct local connected panel
    vertices against physically measured body contact, within the SAME 95mm
    clearance and locked-identity bounds. Re-test real face/edge samples after
    each bounded pass; reject the candidate if it still collides.
    """
    body_tree=world_bvh(body)
    if body_tree is None:
        raise RuntimeError("Locked body BVH unavailable for face fitting.")
    matrix=obj.matrix_world
    source_world_positions=[matrix @ vertex.co for vertex in obj.data.vertices]
    moved_total=0
    refined_total=0
    progress=[]
    if not isinstance(max_rounds,int) or isinstance(max_rounds,bool) or not 1<=max_rounds<=8:
        raise RuntimeError("Real garment face collision fitting must use 1..8 bounded passes.")
    def penetration(point):
        if not point_inside_closed_bvh(body_tree,point):
            return False
        nearest=body_tree.find_nearest(point)
        return (
            nearest is not None and nearest[0] is not None
            and (point-nearest[0]).length > 0.0015
        )

    for iteration in range(max_rounds+1):
        bm=bmesh.new()
        terminal_poked=False
        try:
            bm.from_mesh(obj.data)
            if len(bm.faces)>80000:
                raise RuntimeError(f"{obj.name}: unsafe cloth mesh complexity in body-fit refinement.")
            # BMesh edge subdivision can leave a huge 80+ vertex ngon. Its
            # arithmetic face centre is NOT a local cloth triangle; such a
            # centre is often embedded 32mm inside a real waist even though
            # its perimeter is skin-safe. Triangulate only nonquad regions,
            # then test their TRUE physical surface instead of moving a giant
            # polygon or inventing isolated centre spikes.
            giant_faces=[
                face for face in bm.faces
                if needs_tailoring_face_triangulation(len(face.verts))
            ]
            if giant_faces:
                bmesh.ops.triangulate(
                    bm,faces=giant_faces,
                    quad_method="BEAUTY",ngon_method="BEAUTY",
                )
                if len(bm.faces)>80000:
                    raise RuntimeError(f"{obj.name}: ngon correction exceeds physical cloth face limit.")
                bm.normal_update()
                print(f"Linen Earth cloth topology normalized: {obj.name} "
                      f"pass={iteration} nGons={len(giant_faces)} faces={len(bm.faces)}",flush=True)
            selected=set()
            penetrated_faces=[]
            centroid_hits=0
            edge_hits=0
            for face in bm.faces:
                if penetration(matrix @ face.calc_center_median()):
                    selected.update(face.edges)
                    penetrated_faces.append(face)
                    centroid_hits+=1
            for edge in bm.edges:
                mid=(edge.verts[0].co+edge.verts[1].co)*0.5
                if penetration(matrix @ mid):
                    selected.add(edge)
                    edge_hits+=1
            progress.append({
                "pass":iteration, "bodyFaceHits":centroid_hits,
                "bodyEdgeHits":edge_hits, "faces":len(bm.faces)
            })
            print(
                "Linen Earth measured face fit: "
                + obj.name + " " + json.dumps(progress[-1],sort_keys=True),
                flush=True,
            )
            if (iteration==0 or iteration==max_rounds) and selected:
                # Real Blender telemetry identifies WHICH measured cloth
                # locations need source-panel correction; face counts alone
                # cannot distinguish shoulder, armpit and waist problems.
                sample_evidence=[]
                for face in penetrated_faces[:8]:
                    point=matrix @ face.calc_center_median()
                    nearest=body_tree.find_nearest(point)
                    sample_evidence.append({
                        "kind":"face","xyz":[round(v,5) for v in point],
                        "depthMm":round((point-nearest[0]).length*1000,2)
                        if nearest and nearest[0] is not None else None,
                        "zExtents":[round(min((matrix @ v.co).z for v in face.verts),5),
                                    round(max((matrix @ v.co).z for v in face.verts),5)],
                        "lockedGuideVertexCount":sum(1 for vertex in face.verts if any(
                            guide_center_z(name) is not None and
                            abs((matrix @ vertex.co).z-guide_center_z(name))<0.002
                            for name in ("LE_GUIDE_SHIRT_SHOULDER","LE_GUIDE_SHIRT_WAIST")
                        )),
                        "sourceDisplacementMm":round(max(
                            ((matrix @ vertex.co)-source_world_positions[vertex.index]).length*1000
                            for vertex in face.verts
                        ),2),
                    })
                for edge in list(selected)[:8]:
                    point=matrix @ ((edge.verts[0].co+edge.verts[1].co)*0.5)
                    if not penetration(point): continue
                    nearest=body_tree.find_nearest(point)
                    sample_evidence.append({
                        "kind":"edge","xyz":[round(v,5) for v in point],
                        "depthMm":round((point-nearest[0]).length*1000,2)
                        if nearest and nearest[0] is not None else None,
                        "endpoints":[
                            {
                                "xyz":[round(x,5) for x in (matrix @ v.co)],
                                "totalSourceShiftMm":round(
                                    ((matrix@v.co)-source_world_positions[v.index]).length*1000,2
                                ),
                                "source":[round(x,5) for x in source_world_positions[v.index]]
                            }
                            for v in edge.verts
                        ] if iteration==max_rounds else [],
                    })
                print("Linen Earth real cloth contact samples: "
                      + obj.name + " pass=" + str(iteration)
                      + " " + json.dumps(sample_evidence,sort_keys=True),flush=True)
            if not selected:
                # The pass inspected REAL triangles rather than an enormous
                # synthetic ngon. Persist exactly the validated triangulated
                # topology before returning, so Blender export and independent
                # BVH preflight assess the same garment surface.
                if giant_faces:
                    bm.to_mesh(obj.data)
                    obj.data.update(calc_edges=True)
                return {
                    "passes":iteration, "newVertices":refined_total,
                    "projectedVertices":moved_total,
                    "remainingDeepFaceHits":0, "remainingDeepEdgeHits":0,
                    "minimumInsideDepthMm":1.5,
                    "boundedPassEvidence":progress,
                }
            before=len(bm.verts)
            if iteration>=max_rounds:
                if not terminal_face_patch_allowed(centroid_hits,edge_hits):
                    raise RuntimeError(
                        f"{obj.name} retains {centroid_hits} face and {edge_hits} edge "
                        f"body penetrations deeper than 1.5mm after {max_rounds} "
                        f"bounded physical mesh-projection passes, progression={json.dumps(progress)}; "
                        "reshape source garment panels rather than relaxing clearance."
                    )
                # Native Blender proof showed that poking a single point
                # produced 183 NEW face crossings from four old ones: the
                # centre was pulled away from its intact perimeter. Instead
                # move the entire local cloth FACE coherently by the nearest
                # small real-body surface correction, averaging corrections
                # at shared vertices to avoid jagged disconnected seams.
                # Original photographed shirt guide planes must not move.
                inverse=matrix.inverted()
                guide_zs=(
                    [guide_center_z("LE_GUIDE_SHIRT_SHOULDER"),
                     guide_center_z("LE_GUIDE_SHIRT_WAIST")]
                    if obj.name=="ShirtTorsoFabric" else []
                )
                proposed={}
                for affected in penetrated_faces:
                    centre=matrix @ affected.calc_center_median()
                    nearest=body_tree.find_nearest(centre)
                    if nearest is None or nearest[0] is None or nearest[1] is None:
                        raise RuntimeError(f"{obj.name}: cannot measure the final body-facing cloth patch.")
                    surface,normal=nearest[0],nearest[1].normalized()
                    alternatives=[]
                    for distance in (clearance_m+0.002,0.012,0.020):
                        for direction in (normal,-normal):
                            outside=surface+direction*distance
                            if not point_inside_closed_bvh(body_tree,outside):
                                alternatives.append(((outside-centre).length,outside))
                        if alternatives:
                            break
                    if not alternatives:
                        raise RuntimeError(f"{obj.name}: last cloth face cannot be projected physically outside.")
                    distance,outside=min(alternatives,key=lambda proposal:proposal[0])
                    if distance>0.025:
                        raise RuntimeError(
                            f"{obj.name}: terminal cloth face needs {distance*1000:.1f}mm "
                            f"physical correction at centre={tuple(round(v,4) for v in centre)} "
                            f"nearestBody={tuple(round(v,4) for v in surface)} "
                            f"normal={tuple(round(v,3) for v in normal)} "
                            f"faceHeights={[round((matrix @ v.co).z,4) for v in affected.verts]}; "
                            "reshape actual source panel, never exceed the 25mm face-patch bound."
                        )
                    delta=outside-centre
                    for vertex in affected.verts:
                        world=matrix @ vertex.co
                        if any(z is not None and abs(world.z-z)<0.002 for z in guide_zs):
                            continue
                        proposed.setdefault(vertex,[]).append(delta)
                if not proposed:
                    raise RuntimeError(f"{obj.name}: last cloth face touches only locked guides; source pattern correction required.")
                for vertex,corrections in proposed.items():
                    original=matrix @ vertex.co
                    average=sum(corrections,Vector((0.0,0.0,0.0)))/len(corrections)
                    vertex.co=inverse @ (original+average)
                terminal_poked=True
            else:
                # Blender 4.2 real-body telemetry exposed 35mm crossings where
                # the hanging arms meet the shirt side. Repeatedly subdividing
                # already small panels created more skin-crossing triangles:
                # 25 face / 29 edge hits became 19/20 after 5 cuts (46k faces).
                # Fit existing, connected cloth instead of creating yet more
                # disconnected spikes. Every proposal is independently tested
                # OUTSIDE the locked body; no collision threshold is waived.
                inverse=matrix.inverted()
                protected=[
                    guide_center_z("LE_GUIDE_SHIRT_SHOULDER"),
                    guide_center_z("LE_GUIDE_SHIRT_WAIST"),
                ] if obj.name=="ShirtTorsoFabric" else (
                    [guide_center_z("LE_GUIDE_TROUSER_WAIST")]
                    if obj.name=="TrouserWaistFabric" else []
                )
                def outside_correction(point):
                    nearest=body_tree.find_nearest(point)
                    if nearest is None or nearest[0] is None or nearest[1] is None:
                        raise RuntimeError(f"{obj.name}: cannot project measured contact.")
                    surface,normal=nearest[0],nearest[1].normalized()
                    options=[]
                    # Test both BVH normal directions; mesh normals may face
                    # either way around armpit concavities and shoulder seams.
                    for distance in (clearance_m+0.002,0.012,0.025,0.045,0.070):
                        for direction in (normal,-normal):
                            candidate=surface+direction*distance
                            shift=candidate-point
                            if (shift.length<=0.095
                                    and not point_inside_closed_bvh(body_tree,candidate)):
                                options.append((shift.length,shift))
                    # A bent arm has a different outward clearance direction
                    # from the neighboring torso. Always consider laterally
                    # OUTWARD sleeve proposals before choosing a correction:
                    # the nearest triangle can be on the *wrong* side of an
                    # armpit crease, leading to 95mm oscillating projections.
                    sleeve_side=(
                        -1 if obj.name=="ShirtSleeveLFabric"
                        else 1 if obj.name=="ShirtSleeveRFabric" else 0
                    )
                    if sleeve_side:
                        for distance in (0.008,0.016,0.024,0.035,0.048,0.070,0.090):
                            candidate=point+Vector((sleeve_side*distance,0,0))
                            if not point_inside_closed_bvh(body_tree,candidate):
                                options.append((distance,candidate-point))
                    if not options:
                        for distance in (0.012,0.024,0.040,0.060,0.080,0.095):
                            for direction in (
                                Vector((1,0,0)),Vector((-1,0,0)),
                                Vector((0,1,0)),Vector((0,-1,0)),
                            ):
                                candidate=point+direction*distance
                                if not point_inside_closed_bvh(body_tree,candidate):
                                    options.append((distance,candidate-point))
                            if options: break
                    if not options:
                        raise RuntimeError(
                            f"{obj.name}: actual cloth contact cannot clear "
                            "the locked anatomy within 95mm; remodel source panels."
                        )
                    return min(options,key=lambda item:(
                        item[0]+max(0,-sleeve_side*item[1].x)*2.5
                    ))[1]
                proposals={}
                def add_contact(vertices,point):
                    shift=outside_correction(point)
                    for vertex in vertices:
                        if vertex not in proposals: proposals[vertex]=[]
                        proposals[vertex].append(shift)
                for face in penetrated_faces:
                    add_contact(face.verts,matrix @ face.calc_center_median())
                for edge in bm.edges:
                    centre=matrix @ ((edge.verts[0].co+edge.verts[1].co)*0.5)
                    if penetration(centre):
                        add_contact(edge.verts,centre)
                if not proposals:
                    raise RuntimeError(
                        f"{obj.name}: actual BVH contacts had no candidate source-panel vertices."
                    )
                patched=0
                capped=0
                cap_evidence=[]
                bm.verts.index_update()
                for vertex,changes in proposals.items():
                    original=matrix @ vertex.co
                    if any(guide is not None and abs(original.z-guide)<0.002
                           for guide in protected):
                        continue
                    # Neighbouring face and edge corrections must agree on one
                    # vertex, so share one coherent vector rather than poking
                    # multiple artificial centroid vertices into the fabric.
                    # Deep (measured) face/edge contacts take precedence
                    # over neighbouring shallow intersections. Equal averaging
                    # cancelled opposite local normals and stalled with 1/1
                    # intersections even after five genuinely measured passes.
                    weights=[max(shift.length,0.001)**2 for shift in changes]
                    delta=sum((shift*weight for shift,weight in zip(changes,weights)),
                              Vector((0,0,0)))/sum(weights)
                    bounded,was_capped=bounded_source_panel_displacement(
                        tuple(source_world_positions[vertex.index]),
                        tuple(original+delta),
                        limit_m=0.09495,
                    )
                    # Every vertex remains under 95mm TOTAL displacement from
                    # its actual fitted source; clipping a proposal does not
                    # waive independent BVH face/edge/vertex inspection.
                    if was_capped:
                        capped+=1
                        if len(cap_evidence)<8:
                            cap_evidence.append({
                                "at":[round(v,5) for v in original],
                                "requested":[round(v,5) for v in original+delta],
                                "bounded":[round(v,5) for v in bounded],
                                "source":[round(v,5) for v in source_world_positions[vertex.index]],
                            })
                    vertex.co=inverse @ Vector(bounded)
                    patched+=1
                if not patched:
                    raise RuntimeError(
                        f"{obj.name}: measured contacts touch only identity-locked guide vertices."
                    )
                progress[-1]["coherentContactVertices"]=patched
                progress[-1]["boundedAt95mmVertices"]=capped
                if capped:
                    print("Linen Earth bounded real source panel contacts: "
                          +obj.name+" pass="+str(iteration)+" "
                          +json.dumps(cap_evidence,sort_keys=True),flush=True)
            if len(bm.faces)>80000:
                raise RuntimeError(f"{obj.name}: local face repair exceeds cloth complexity limit.")
            bm.normal_update()
            refined_total+=len(bm.verts)-before
            bm.to_mesh(obj.data)
            obj.data.update(calc_edges=True)
        finally:
            bm.free()
        repair=repair_body_penetrations(obj,body,clearance_m)
        moved_total+=repair["movedVertices"]
        if len(obj.data.vertices)!=len(source_world_positions) or any(
            ((matrix @ vertex.co)-source_world_positions[i]).length>0.095
            for i,vertex in enumerate(obj.data.vertices)
        ):
            raise RuntimeError(
                f"{obj.name}: connected cloth crossed the 95mm TOTAL source-panel correction guard."
            )
        if terminal_poked:
            # A centroid poke is permitted only as a final, bounded physical
            # correction; all newly created triangles and edges must STILL
            # pass the same exact 1.5mm BVH predicate before we claim success.
            verify=bmesh.new()
            try:
                verify.from_mesh(obj.data)
                remaining_face=sum(
                    1 for face in verify.faces
                    if penetration(matrix @ face.calc_center_median())
                )
                remaining_edge=sum(
                    1 for edge in verify.edges
                    if penetration(matrix @ ((edge.verts[0].co+edge.verts[1].co)*0.5))
                )
                progress.append({
                    "pass":iteration+1,
                    "terminalCoherentPatch":True,
                    "bodyFaceHits":remaining_face,
                    "bodyEdgeHits":remaining_edge,
                    "faces":len(verify.faces),
                })
            finally:
                verify.free()
            if remaining_face or remaining_edge:
                raise RuntimeError(
                    f"{obj.name} final coherent face patch still crosses real skin "
                    f"({remaining_face} faces, {remaining_edge} edges); "
                    f"progression={json.dumps(progress)}; fix garment geometry."
                )
            return {
                "passes":iteration+1,
                "terminalCentroidPoke":True,
                "newVertices":refined_total,
                "projectedVertices":moved_total,
                "remainingDeepFaceHits":0,"remainingDeepEdgeHits":0,
                "minimumInsideDepthMm":1.5,
                "boundedPassEvidence":progress,
            }
    raise RuntimeError(f"{obj.name}: unreachable face-repair state.")

def finish_procedural_shell(obj, thickness_m):
    solid = obj.modifiers.new("LE_CLOTH_THICKNESS", "SOLIDIFY")
    solid.thickness = thickness_m
    solid.offset = 1.0
    solid.use_rim = True
    solid.use_rim_only = False
    apply_modifier(obj, solid)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def guide_center_z(name):
    obj = bpy.data.objects.get(name)
    if obj is None or obj.type != "CURVE":
        return None
    points = []
    for spline in obj.data.splines:
        for point in spline.points:
            points.append(obj.matrix_world @ Vector(point.co[:3]))
    if not points:
        return None
    return sum(point.z for point in points) / len(points)


def x_span_at_z(obj, z_world, band=0.025):
    """Measure the authored garment at its actual guide plane.

    Sparse ring meshes normally have no vertices at waist/hem or cuff guides.
    Using a +/-band around guide Z incorrectly measures a different ring,
    causing fit authoring and production preflight to disagree.
    """
    if obj is None or z_world is None or obj.type != "MESH":
        return None
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        matrix = evaluated.matrix_world
        points = [matrix @ vertex.co for vertex in mesh.vertices]
        triangles = (
            tuple((points[index].x, points[index].y, points[index].z) for index in triangle.vertices)
            for triangle in mesh.loop_triangles
        )
        # Fail closed; this must agree with the production scene preflight.
        return triangle_section_x_span(triangles, z_world)
    finally:
        evaluated.to_mesh_clear()


def width_at_z(obj, z_world, band=0.025):
    span = x_span_at_z(obj, z_world, band)
    return (span[1] - span[0]) if span else None


def center_x_at_z(obj, z_world, band=0.040):
    span = x_span_at_z(obj, z_world, band)
    return ((span[0] + span[1]) * 0.5) if span else None


def interpolate_profile(z, anchors):
    ordered = sorted(anchors, key=lambda item: item[0])
    if z <= ordered[0][0]:
        return ordered[0][1]
    if z >= ordered[-1][0]:
        return ordered[-1][1]
    for (z0, value0), (z1, value1) in zip(ordered, ordered[1:]):
        if z0 <= z <= z1:
            t = (z - z0) / max(z1 - z0, 1e-6)
            t = t * t * (3.0 - 2.0 * t)
            return value0 + (value1 - value0) * t
    return ordered[-1][1]


def scale_x_profile(obj, center_x, anchors):
    matrix = obj.matrix_world
    inverse = matrix.inverted()
    for vertex in obj.data.vertices:
        point = matrix @ vertex.co
        factor = interpolate_profile(point.z, anchors)
        point.x = center_x + (point.x - center_x) * factor
        vertex.co = inverse @ point
    obj.data.update()


def shift_x_profile(obj, anchors):
    matrix = obj.matrix_world
    inverse = matrix.inverted()
    for vertex in obj.data.vertices:
        point = matrix @ vertex.co
        point.x += interpolate_profile(point.z, anchors)
        vertex.co = inverse @ point
    obj.data.update()


def shape_officewear_to_identity(authored, body, targets):
    frame = body_frame(body)
    center_x = frame["centerX"]
    shoulder_z = guide_center_z("LE_GUIDE_SHIRT_SHOULDER")
    shirt_waist_z = guide_center_z("LE_GUIDE_SHIRT_WAIST")
    trouser_waist_z = guide_center_z("LE_GUIDE_TROUSER_WAIST")
    left_hem_z = guide_center_z("LE_GUIDE_LEFT_HEM")
    right_hem_z = guide_center_z("LE_GUIDE_RIGHT_HEM")
    left_hand_z = guide_center_z("LE_GUIDE_LEFT_HAND_CENTER_H")
    right_hand_z = guide_center_z("LE_GUIDE_RIGHT_HAND_CENTER_H")
    required = (shoulder_z, shirt_waist_z, trouser_waist_z, left_hem_z, right_hem_z, left_hand_z, right_hand_z)
    if any(value is None for value in required):
        raise RuntimeError("Identity guides are incomplete; cannot fit the production garment candidate.")

    shirt = authored["ShirtTorsoFabric"]
    shoulder_width = width_at_z(shirt, shoulder_z, 0.018)
    waist_width = width_at_z(shirt, shirt_waist_z, 0.025)
    if not shoulder_width or not waist_width:
        raise RuntimeError("Could not measure shirt shell at locked shoulder/waist guides.")
    shoulder_factor = (float(targets["shoulderSeamWidth"]) / 1000.0) / shoulder_width
    waist_factor = (float(targets["shirtWaistWidth"]) / 1000.0) / waist_width
    scale_x_profile(
        shirt,
        center_x,
        [
            (shirt_waist_z - 0.16, waist_factor),
            (shirt_waist_z, waist_factor),
            (shoulder_z, shoulder_factor),
            (shoulder_z + 0.07, shoulder_factor),
        ],
    )
    # Re-measure at the same narrow guide band used by production preflight.
    # Shoulder anatomy slopes quickly, so a wider sampling band can otherwise
    # make the authoring pass believe the seam width is correct while the exact
    # locked shoulder plane is still too narrow.
    corrected_shoulder = width_at_z(shirt, shoulder_z, 0.018)
    if not corrected_shoulder:
        raise RuntimeError("Could not re-measure shirt shoulder after identity fitting.")
    shoulder_correction = (float(targets["shoulderSeamWidth"]) / 1000.0) / corrected_shoulder
    scale_x_profile(
        shirt,
        center_x,
        [
            (shoulder_z - 0.11, 1.0),
            (shoulder_z - 0.035, shoulder_correction),
            (shoulder_z + 0.07, shoulder_correction),
        ],
    )

    trouser_waist = authored["TrouserWaistFabric"]
    trouser_width = width_at_z(trouser_waist, trouser_waist_z, 0.040)
    if not trouser_width:
        raise RuntimeError("Could not measure trouser waist shell at the locked waist guide.")
    trouser_factor = (float(targets["trouserWaistWidth"]) / 1000.0) / trouser_width
    scale_x_profile(
        trouser_waist,
        center_x,
        [(trouser_waist_z - 0.18, trouser_factor), (trouser_waist_z + 0.08, trouser_factor)],
    )

    target_hem = float(targets["hemWidth"]) / 1000.0
    leg_center_half = float(targets["legCenterSpacing"]) / 2000.0
    for name, hem_z, leg_center in (
        ("TrouserLegLFabric", left_hem_z, -leg_center_half),
        ("TrouserLegRFabric", right_hem_z, leg_center_half),
    ):
        leg = authored[name]
        current_hem = width_at_z(leg, hem_z, 0.040)
        if not current_hem:
            raise RuntimeError(f"Could not measure {name} at the locked hem guide.")
        hem_factor = target_hem / current_hem
        scale_x_profile(
            leg,
            leg_center,
            [
                (hem_z - 0.03, hem_factor),
                (hem_z + 0.10, hem_factor),
                (trouser_waist_z - 0.28, 1.0),
                (trouser_waist_z - 0.10, 1.0),
            ],
        )

    target_hand_half = float(targets["handCenterSpacing"]) / 2000.0
    for name, hand_z, target_center in (
        ("ShirtSleeveLFabric", left_hand_z, -target_hand_half),
        ("ShirtSleeveRFabric", right_hand_z, target_hand_half),
    ):
        sleeve = authored[name]
        # The actual cuff edge finishes 55 mm ABOVE the bare-hand landmark.
        # Exact triangle-plane QA correctly fails at hand_z: that plane is
        # outside the sleeve. Measure and align the real cloth hem instead of
        # widening tolerance until an unrelated elbow ring is sampled.
        cuff_hem_z = hand_z + 0.055
        current_center = center_x_at_z(sleeve, cuff_hem_z, 0.018)
        if current_center is None:
            raise RuntimeError(f"Could not measure {name} at the physical cuff hem above the locked hand guide.")
        delta = target_center - current_center
        shift_x_profile(
            sleeve,
            [(hand_z - 0.10, delta), (cuff_hem_z, delta), (shoulder_z - 0.05, 0.0), (shoulder_z + 0.05, 0.0)],
        )

    return {
        "shirtShoulderScale": round(shoulder_factor, 5),
        "shirtShoulderCorrection": round(shoulder_correction, 5),
        "shirtWaistScale": round(waist_factor, 5),
        "trouserWaistScale": round(trouser_factor, 5),
        "targetHemWidthMm": round(target_hem * 1000.0, 2),
        "targetHandCenterSpacingMm": round(target_hand_half * 2000.0, 2),
    }


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

    clearance_m = max(0.003, min(0.018, options.clearance_mm / 1000.0))
    shirt_clearance_m = max(0.004, clearance_m - 0.0010)
    trouser_clearance_m = min(0.020, clearance_m + 0.0030)
    thickness_m = max(0.0006, min(0.004, options.thickness_mm / 1000.0))

    for name in GARMENT_OBJECTS:
        remove_existing(name)

    targets_raw = str(bpy.context.scene.get("linen_earth_identity_targets_json", "")).strip()
    try:
        targets = json.loads(targets_raw)
    except json.JSONDecodeError as error:
        raise RuntimeError("Locked model identity targets are not valid JSON.") from error

    authored, fit_profile = build_procedural_officewear(body, targets, shirt_clearance_m, trouser_clearance_m)
    identity_fit = shape_officewear_to_identity(authored, body, targets)
    # Reconstruct skin-safe middle rings AFTER exact identity-scale transforms.
    # The locked shoulder/waist guides are never moved by this operation.
    post_identity_fit = {
        "ShirtTorsoFabric": enclose_post_identity_torso_profile(
            authored["ShirtTorsoFabric"],body,
            (guide_center_z("LE_GUIDE_SHIRT_SHOULDER"),
             guide_center_z("LE_GUIDE_SHIRT_WAIST")),shirt_clearance_m,
            profile_power=3.2,max_center_shift_m=0.018,
        ),
        "TrouserWaistFabric": enclose_post_identity_torso_profile(
            authored["TrouserWaistFabric"],body,
            (guide_center_z("LE_GUIDE_TROUSER_WAIST"),),trouser_clearance_m,
            profile_power=2.6,max_center_shift_m=0.012,
        ),
    }
    fit_profile["postIdentityAnatomyFit"] = post_identity_fit
    fit_profile["shirtWaistSeamContinuity"] = restore_shirt_waist_side_seam(
        authored["ShirtTorsoFabric"],
        guide_center_z("LE_GUIDE_SHIRT_WAIST"),
        float(targets["shirtWaistWidth"])/2000.0,
        guide_center_z("LE_GUIDE_SHIRT_SHOULDER"),
        center_x,
    )
    fit_profile["medialSleeveRelief"] = {
        name:relieve_inboard_sleeve_contact(
            authored[name],center_x,side=(-1 if "SleeveL" in name else 1)
        )
        for name in ("ShirtSleeveLFabric","ShirtSleeveRFabric")
    }
    collision_repairs = {}
    face_refinements = {}
    for name, obj in authored.items():
        object_clearance = shirt_clearance_m if name.startswith("Shirt") else trouser_clearance_m
        # Project authored construction rings BEFORE interpolation. Subdividing
        # a deeply embedded original face first caused a new shoulder vertex
        # at (0.1385,0.0468,1.2646) to require >95mm projection. Correct the
        # actual source silhouette within the unchanged limit, then interpolate
        # that safe geometry and repair newly introduced face/edge samples.
        guide_projection = repair_body_penetrations(obj, body, object_clearance)
        face_refinements[name] = refine_collision_faces(obj)
        projection = repair_body_penetrations(obj, body, object_clearance)
        projection["guidePassMovedVertices"] = guide_projection["movedVertices"]
        projection["guidePassMaxPenetrationMm"] = guide_projection["maxPenetrationBeforeMm"]
        collision_repairs[name] = projection
        face_refinements[name]["deepSurfaceCorrection"] = repair_between_vertex_collisions(
            obj, body, object_clearance
        )
        finish_procedural_shell(obj, thickness_m)
        obj["linen_earth_auto_authored"] = True
        obj["linen_earth_fit_clearance_mm"] = round(
            shirt_clearance_m if name.startswith("Shirt") else trouser_clearance_m,
            3,
        )
        obj["linen_earth_cloth_thickness_mm"] = round(thickness_m * 1000.0, 3)
        planar_grain_uv(obj)

    bpy.context.scene["linen_earth_asset_status"] = "auto-authored-production-candidate-needs-tailor-review"
    bpy.context.scene["linen_earth_garment_authoring_method"] = "closed-tailoring-ring-shell-v2"
    bpy.context.scene["linen_earth_garment_clearance_mm"] = round(clearance_m * 1000.0, 3)
    bpy.context.scene["linen_earth_shirt_clearance_mm"] = round(shirt_clearance_m * 1000.0, 3)
    bpy.context.scene["linen_earth_trouser_clearance_mm"] = round(trouser_clearance_m * 1000.0, 3)
    fit_profile["identityShaping"] = identity_fit
    fit_profile["collisionRepairs"] = collision_repairs
    fit_profile["adaptiveFaceRefinements"] = face_refinements
    bpy.context.scene["linen_earth_identity_fit_profile_json"] = json.dumps(fit_profile, sort_keys=True)
    bpy.context.scene["linen_earth_garment_thickness_mm"] = round(thickness_m * 1000.0, 3)

    output = Path(options.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))

    print(f"Authored Linen Earth six-piece officewear candidate: {output}")
    print("Garment objects: " + ", ".join(obj.name for obj in authored.values()))
    print(f"Shirt/trouser clearances: {shirt_clearance_m*1000:.1f}/{trouser_clearance_m*1000:.1f} mm · cloth shell thickness: {thickness_m*1000:.1f} mm")
    print("Identity fit profile: " + json.dumps(fit_profile, sort_keys=True))
    print("Status: candidate only; run Blender preflight and owner/tailor visual fit review before production export.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Linen Earth garment authoring failed: {error}", file=sys.stderr)
        raise SystemExit(1)
