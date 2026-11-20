#!/usr/bin/env python3
"""Research-only UV geometry for the ORIGINAL identity-locked Blender candidate.

The existing x/z planar projection collapses vertical side triangles and every
horizontal rim cap. This experiment adds a second UV layer using cylindrical
angular distance along vertical cloth surfaces and x/y on horizontal caps.
Per-face fallback uses the dominant real surface normal. It does not create
measured fabric scale, a sewing pattern, approved seam charts or a new model.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
PRE = ROOT / "scripts/blender/preflight-linen-earth-officewear.py"
EXPECTED_ID = "linen-earth-studio-model-v1"
EXPECTED_PHOTO = "/designer/studio-tucked.webp"
UV_NAME = "TITAN_RESEARCH_SURFACE_GRAIN"
GARMENTS = (
    "ShirtTorsoFabric", "ShirtSleeveLFabric", "ShirtSleeveRFabric",
    "TrouserWaistFabric", "TrouserLegLFabric", "TrouserLegRFabric",
)


def preflight_module():
    spec = importlib.util.spec_from_file_location("titan_uv_source_preflight", PRE)
    if not spec or not spec.loader:
        raise RuntimeError("Original source preflight module is unavailable.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def geometry_fingerprint(obj):
    """Geometry and model-space transform, deliberately excluding UV data."""
    mesh = obj.data
    payload = {
        "name": obj.name,
        "matrix": [list(row) for row in obj.matrix_world],
        "vertices": [list(v.co) for v in mesh.vertices],
        "faces": [list(p.vertices) for p in mesh.polygons],
    }
    return hashlib.sha256(json.dumps(payload, separators=(",", ":")).encode()).hexdigest()


def _normal_projection(v, axis):
    if axis == 0:
        return (v.y, v.z)
    if axis == 1:
        return (v.x, v.z)
    return (v.x, v.y)


def _unwrapped_angles(points, cx, cy):
    angles = [math.atan2(v.y - cy, v.x - cx) for v in points]
    anchor = angles[0]
    for index in range(1, len(angles)):
        while angles[index] - anchor > math.pi:
            angles[index] -= 2.0 * math.pi
        while angles[index] - anchor < -math.pi:
            angles[index] += 2.0 * math.pi
    return angles


def _face_has_collapsed_uv(polygon, projected, triangles, check):
    """Examine only this face's actual triangles (pre-indexed once per mesh).

    Scanning *every* evaluated triangle per polygon would make real CC0
    garment candidate unwrap quadratic and effectively untestable.
    """
    uv_by_loop = dict(zip(polygon.loop_indices, projected))
    if not triangles:
        return True
    for loops in triangles:
        status = check([uv_by_loop[i] for i in loops])
        if status is not None:
            return True
    return False


def apply_source_grain_uv(obj, preflight):
    """Add native UV coordinates; never alter any source polygon or mesh vertex.

    UV dimensions reflect GEOMETRY coordinates in metres, not physical repeat
    length or weave scale. Cylinder seam/chart continuity is not sewn approval.
    """
    if obj is None or obj.type != "MESH":
        raise RuntimeError("Only an existing six-panel garment mesh can receive research UV.")
    mesh = obj.data
    if not mesh.uv_layers or len(mesh.vertices) < 4 or len(mesh.polygons) < 4:
        raise RuntimeError("Original garment source mesh/UV layer is missing.")
    if mesh.uv_layers.get(UV_NAME):
        raise RuntimeError("Research UV cannot overwrite a prior UV trial.")
    mesh.calc_loop_triangles()
    triangles_by_polygon = {}
    for tri in mesh.loop_triangles:
        triangles_by_polygon.setdefault(tri.polygon_index, []).append(tuple(tri.loops))
    original_hash = geometry_fingerprint(obj)
    old_active_name = mesh.uv_layers.active.name if mesh.uv_layers.active else None
    old_uv = [
        tuple(mesh.uv_layers.active.data[index].uv)
        for index in range(len(mesh.loops))
    ]
    base_stats = preflight.evaluated_mesh_stats(obj)
    mat = obj.matrix_world
    world = [mat @ vert.co for vert in mesh.vertices]
    if any(not all(math.isfinite(float(x)) for x in v) for v in world):
        raise RuntimeError("Invalid real world-space garment coordinates.")
    cx = sum(v.x for v in world) / len(world)
    cy = sum(v.y for v in world) / len(world)
    radius = sum(math.hypot(v.x - cx, v.y - cy) for v in world) / len(world)
    if not math.isfinite(radius) or radius < 0.001:
        raise RuntimeError("Garment circumference is not measurable.")
    uv = mesh.uv_layers.new(name=UV_NAME)
    mesh.uv_layers.active = uv
    count = {"cylindricalFaces": 0, "horizontalFaces": 0, "fallbackFaces": 0}
    for polygon in mesh.polygons:
        vertices = [world[mesh.loops[li].vertex_index] for li in polygon.loop_indices]
        normal = mat.to_3x3().inverted().transposed() @ polygon.normal
        if not all(math.isfinite(float(x)) for x in normal):
            raise RuntimeError("Nonfinite original surface normal.")
        if abs(normal.z) >= 0.75:
            projected = [(v.x, v.y) for v in vertices]
            count["horizontalFaces"] += 1
        else:
            projected = [
                (radius * theta, vertex.z)
                for vertex, theta in zip(vertices, _unwrapped_angles(vertices, cx, cy))
            ]
            count["cylindricalFaces"] += 1
        if _face_has_collapsed_uv(polygon, projected, triangles_by_polygon.get(polygon.index), preflight.uv_triangle_issue):
            n = (abs(normal.x), abs(normal.y), abs(normal.z))
            axis = max(range(3), key=lambda i: n[i])
            projected = [_normal_projection(v, axis) for v in vertices]
            count["fallbackFaces"] += 1
        if _face_has_collapsed_uv(polygon, projected, triangles_by_polygon.get(polygon.index), preflight.uv_triangle_issue):
            raise RuntimeError(
                "Real original-source polygon still has degenerate UV triangles: "
                + obj.name + "/" + str(polygon.index)
            )
        for loop_index, point in zip(polygon.loop_indices, projected):
            uv.data[loop_index].uv = point
    mesh.update()
    bpy.context.view_layer.update()
    evaluated = preflight.evaluated_mesh_stats(obj)
    if geometry_fingerprint(obj) != original_hash:
        raise RuntimeError("UV experimentation mutated geometry or model identity.")
    old = mesh.uv_layers.get(old_active_name)
    if old is None or any(
        tuple(old.data[i].uv) != old_uv[i] for i in range(len(mesh.loops))
    ):
        raise RuntimeError("Original textile UV coordinates were altered.")
    if evaluated["uvNonFiniteTriangles"] or evaluated["uvCollapsedTriangles"]:
        raise RuntimeError("Proposed source-surface UV contains nonfinite/collapsed triangles.")
    obj["linen_earth_research_uv_grain_only"] = True
    obj["linen_earth_measured_textile_repeat_approved"] = False
    return {
        "sourceGeometrySha256": original_hash,
        "originalUvLayer": old_active_name,
        "newUvLayer": UV_NAME,
        "beforeCollapsedUvTriangles": base_stats["uvCollapsedTriangles"],
        "afterCollapsedUvTriangles": evaluated["uvCollapsedTriangles"],
        "beforeNonFiniteUvTriangles": base_stats["uvNonFiniteTriangles"],
        "afterNonFiniteUvTriangles": evaluated["uvNonFiniteTriangles"],
        **count,
        "measuredRepeatVerified": False,
        "seamChartApproved": False,
    }


def args():
    raw = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    return parser.parse_args(raw)


def main():
    opt = args()
    source = Path(bpy.data.filepath).resolve()
    target = opt.output.expanduser().resolve()
    report = opt.report.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".blend":
        raise RuntimeError("A saved original-source candidate .blend is required.")
    if source == target or target.suffix.lower() != ".blend" or target.exists():
        raise RuntimeError("Research must create a distinct, previously absent .blend.")
    if report.exists():
        raise RuntimeError("Research must not overwrite existing UV evidence.")
    scene = bpy.context.scene
    if (scene.get("linen_earth_model_identity_id") != EXPECTED_ID
        or scene.get("linen_earth_model_reference_image") != EXPECTED_PHOTO
        or scene.get("linen_earth_model_identity_locked") is not True
        or scene.get("linen_earth_auto_approved") is True
        or scene.get("linen_earth_production_approved") is True):
        raise RuntimeError("Locked original Studio model identity and unapproved source required.")
    body = bpy.data.objects.get("Body")
    if not body or body.type != "MESH":
        raise RuntimeError("Exact original source body mesh missing.")
    original_body_sha = geometry_fingerprint(body)
    preflight = preflight_module()
    results = {}
    for name in GARMENTS:
        obj = bpy.data.objects.get(name)
        if not obj or obj.get("linen_earth_auto_authored") is not True:
            raise RuntimeError("Pinned, native six-panel garment source missing: " + name)
        results[name] = apply_source_grain_uv(obj, preflight)
    if original_body_sha != geometry_fingerprint(body):
        raise RuntimeError("Original scanned body identity changed during UV research.")
    scene["linen_earth_asset_status"] = "RESEARCH-ONLY-source-UV-unapproved"
    scene["linen_earth_research_surface_grain_uv"] = True
    scene["linen_earth_production_approved"] = False
    scene["linen_earth_textile_repeat_approved"] = False
    result = {
        "version": "titan-original-source-grain-uv-research-v1",
        "modelIdentityId": EXPECTED_ID,
        "referenceImage": EXPECTED_PHOTO,
        "candidateOnly": True,
        "productionApproved": False,
        "measuredFabricRepeatApproved": False,
        "seamChartsApproved": False,
        "realTailorFitApproved": False,
        "photographicMatchApproved": False,
        "originalBodySha256": original_body_sha,
        "sourceBlend": source.name,
        "garmentPanels": results,
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(target))
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("TITAN_REAL_CC0_GRAIN_UV_EXPERIMENT_NOT_PRODUCTION", json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("TITAN unapproved UV source experiment blocked: " + str(exc), file=sys.stderr)
        raise SystemExit(1)
