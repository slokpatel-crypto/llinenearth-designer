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
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

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
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
            # Geometry-space metres, NOT normalized 0..1 per panel. This avoids
            # re-scaling the same motif across differently sized shells. Physical
            # textile repeat, warp/weft orientation and seams remain UNCALIBRATED.
            u = vertex.co.x - min_x
            v = vertex.co.z - min_z
            uv_layer.data[loop_index].uv = (u, v)


def record_uv_diagnostics(obj):
    # Geometry-only audit. Report folded/collapsed UVs; never pass this off as
    # supplier-calibrated fabric repeat or as a successful UV approval gate.
    mesh = obj.data
    mesh.calc_loop_triangles()
    uv = mesh.uv_layers.active
    triangles = len(mesh.loop_triangles)
    collapsed = 0
    for triangle in mesh.loop_triangles:
        a, b, c = (uv.data[index].uv for index in triangle.loops)
        area_twice = abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))
        if not math.isfinite(area_twice) or area_twice <= 1e-12:
            collapsed += 1
    obj["linen_earth_uv_triangle_count"] = triangles
    obj["linen_earth_uv_collapsed_triangles"] = collapsed
    obj["linen_earth_uv_collapsed_ratio"] = round(collapsed / triangles, 6) if triangles else 1.0
    return collapsed, triangles


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

    z = lambda ratio: min_z + height * ratio
    torso_half = 0.245
    arm_root = 0.155
    hip_half = 0.245

    regions = {
        "ShirtTorsoFabric": lambda p: z(0.515) <= p.z <= z(0.895) and abs(p.x-center_x) <= torso_half,
        "ShirtSleeveLFabric": lambda p: z(0.500) <= p.z <= z(0.875) and p.x-center_x <= -arm_root,
        "ShirtSleeveRFabric": lambda p: z(0.500) <= p.z <= z(0.875) and p.x-center_x >= arm_root,
        "TrouserWaistFabric": lambda p: z(0.455) <= p.z <= z(0.620) and abs(p.x-center_x) <= hip_half,
        "TrouserLegLFabric": lambda p: z(0.055) <= p.z <= z(0.535) and -hip_half <= p.x - center_x < 0,
        "TrouserLegRFabric": lambda p: z(0.055) <= p.z <= z(0.535) and 0 <= p.x - center_x <= hip_half,
    }

    if not math.isfinite(options.clearance_mm) or not (3.0 <= options.clearance_mm <= 18.0):
        raise RuntimeError("Clearance must be finite and within 3–18 mm; refusing silent fit changes.")
    if not math.isfinite(options.thickness_mm) or not (0.6 <= options.thickness_mm <= 4.0):
        raise RuntimeError("Thickness must be finite and within 0.6–4 mm; refusing silent fit changes.")
    clearance_m = options.clearance_mm / 1000.0
    thickness_m = options.thickness_mm / 1000.0

    for name in GARMENT_OBJECTS:
        remove_existing(name)

    authored = []
    for name, predicate in regions.items():
        obj = selected_shell(body, name, predicate)
        fit_shell(obj, body, clearance_m, thickness_m)
        planar_grain_uv(obj)
        collapsed, triangles = record_uv_diagnostics(obj)
        print(f"Candidate UV audit {name}: {collapsed}/{triangles} collapsed triangles (uncalibrated)")
        obj["linen_earth_auto_authored"] = True
        obj["linen_earth_uv_units"] = "metres-geometry-only"
        obj["linen_earth_supplier_repeat_verified"] = False
        obj["linen_earth_grain_direction_verified"] = False
        obj["linen_earth_fit_clearance_mm"] = round(clearance_m * 1000.0, 3)
        obj["linen_earth_cloth_thickness_mm"] = round(thickness_m * 1000.0, 3)
        authored.append(obj)

    bpy.context.scene["linen_earth_uv_calibration_status"] = "uncalibrated-metric-projection"
    bpy.context.scene["linen_earth_asset_status"] = "auto-authored-production-candidate-needs-tailor-review"
    bpy.context.scene["linen_earth_garment_authoring_method"] = "locked-body-surface-shell-v1"
    bpy.context.scene["linen_earth_garment_clearance_mm"] = round(clearance_m * 1000.0, 3)
    bpy.context.scene["linen_earth_garment_thickness_mm"] = round(thickness_m * 1000.0, 3)

    output = Path(options.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))

    print(f"Authored Linen Earth six-piece officewear candidate: {output}")
    print("Garment objects: " + ", ".join(obj.name for obj in authored))
    print(f"Body clearance: {clearance_m*1000:.1f} mm · cloth shell thickness: {thickness_m*1000:.1f} mm")
    print("Status: candidate only; run Blender preflight and owner/tailor visual fit review before production export.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Linen Earth garment authoring failed: {error}", file=sys.stderr)
        raise SystemExit(1)
