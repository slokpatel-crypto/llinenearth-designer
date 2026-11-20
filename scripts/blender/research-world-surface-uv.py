"""Research-only 3D surface-aware cloth UV candidate on the pinned CC0 model.

Unwraps the *existing* six physical garment meshes without modifying a vertex,
face, garment/body fit, reference guide, skin, or studio model identity. The
output is a separate .blend NOT eligible for production export. A face-local
UV island is deliberately used when a radial/axial projection collapses a real
3D face (e.g. Solidify rims or top caps); this is NOT approved seam matching.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector

MODEL_IDENTITY = "linen-earth-studio-model-v1"
REFERENCE_IMAGE = "/designer/studio-tucked.webp"
GARMENTS = (
    "ShirtTorsoFabric", "ShirtSleeveLFabric", "ShirtSleeveRFabric",
    "TrouserWaistFabric", "TrouserLegLFabric", "TrouserLegRFabric",
)
CANDIDATE_UV = "TITAN_SurfaceGrain_RESEARCH"
EPSILON_AREA = 1e-12


def world_mesh_signature(obj):
    """Byte-exact geometry/face signature; UVs and materials are excluded."""
    data = hashlib.sha256()
    world = obj.matrix_world
    for vertex in obj.data.vertices:
        p = world @ vertex.co
        if not all(math.isfinite(float(value)) for value in p):
            raise RuntimeError("Non-finite real mesh vertex in locked source.")
        data.update(struct.pack("<ddd", *p))
    for poly in obj.data.polygons:
        data.update(struct.pack("<I", len(poly.vertices)))
        for index in poly.vertices:
            data.update(struct.pack("<I", index))
    return data.hexdigest()


def uv_signature(mesh, uv):
    digest = hashlib.sha256()
    for sample in uv.data:
        if not all(math.isfinite(float(v)) for v in sample.uv):
            raise RuntimeError("Non-finite original UV coordinates.")
        digest.update(struct.pack("<dd", *sample.uv))
    return digest.hexdigest()


def triangle_area(a, b, c):
    return (b - a).cross(c - a).length / 2.0


def uv_twice_area(uvs):
    a, b, c = uvs
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])


def uv_metrics(obj, uv_layer):
    """No physical repeat or pixel/mm inferred; structural UV quality only."""
    mesh = obj.data
    mesh.calc_loop_triangles()
    world = [obj.matrix_world @ vertex.co for vertex in mesh.vertices]
    collapsed = 0
    density = []
    for triangle in mesh.loop_triangles:
        points = [world[mesh.loops[index].vertex_index] for index in triangle.loops]
        area = triangle_area(*points)
        if not math.isfinite(area) or area <= EPSILON_AREA:
            raise RuntimeError(f"{obj.name}: source contains a degenerate real 3D triangle.")
        uvs = [tuple(uv_layer.data[index].uv) for index in triangle.loops]
        if not all(math.isfinite(value) for item in uvs for value in item):
            raise RuntimeError(f"{obj.name}: invalid UV triangle.")
        mapped = abs(uv_twice_area(uvs)) / 2.0
        if mapped <= max(1e-12, area * 1e-8):
            collapsed += 1
        else:
            density.append(mapped / area)
    density.sort()
    ratio = None
    if len(density) >= 20:
        lo = density[int((len(density)-1)*0.1)]
        hi = density[int((len(density)-1)*0.9)]
        ratio = round(hi/lo, 6) if lo > 0 else None
    return {"triangles": len(mesh.loop_triangles),
            "collapsedUvTriangles": collapsed, "uvAreaDensityP90P10": ratio}


def inferred_axis_and_frame(obj):
    """Follows the actual shell orientation, including sloping sleeves."""
    coords = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    if len(coords) < 4:
        raise RuntimeError(f"{obj.name}: insufficient authentic shell vertices.")
    sorted_by_z = sorted(coords, key=lambda point: point.z)
    n = max(2, min(len(coords)//4, len(coords)//8))
    low = sum(sorted_by_z[:n], Vector((0.0,0.0,0.0))) / n
    high = sum(sorted_by_z[-n:], Vector((0.0,0.0,0.0))) / n
    axis = high-low
    if axis.length < 0.01:
        raise RuntimeError(f"{obj.name}: no physically measurable longitudinal axis.")
    axis.normalize()
    if axis.z < 0:
        axis.negate()
    helper = Vector((1, 0, 0))
    radial_x = helper - axis * helper.dot(axis)
    if radial_x.length < 0.1:
        helper = Vector((0, 1, 0))
        radial_x = helper - axis * helper.dot(axis)
    radial_x.normalize()
    radial_y = axis.cross(radial_x).normalized()
    center = sum(coords, Vector((0.0,0.0,0.0))) / len(coords)
    radii = [math.hypot((p-center).dot(radial_x),
                        (p-center).dot(radial_y)) for p in coords]
    radius = statistics.median(radii)
    if not math.isfinite(radius) or radius < 0.001:
        raise RuntimeError(f"{obj.name}: no real radial surface to unwrap.")
    return center, axis, radial_x, radial_y, radius


def face_plane_uv(points):
    """A separate face-local candidate island for a genuinely collapsed rim."""
    origin = points[0]
    edge = max((p-origin for p in points[1:]), key=lambda v: v.length)
    if edge.length <= 1e-8:
        raise RuntimeError("Degenerate input face has no tangent.")
    tangent = edge.normalized()
    best = max((edge.cross(p-origin) for p in points[1:]), key=lambda v: v.length)
    if best.length <= 1e-12:
        raise RuntimeError("Degenerate input face has no surface normal.")
    normal = best.normalized()
    side = normal.cross(tangent).normalized()
    uv = [((p-origin).dot(tangent), (p-origin).dot(side)) for p in points]
    if len(points) >= 3 and abs(uv_twice_area(uv[:3])) <= 1e-12:
        # Source face may have collinear first corners; choose shortest first
        # non-collinear edge as a basis rather than pretending it is UV-ready.
        raise RuntimeError("Face-local UV reconstruction is geometrically degenerate.")
    return uv


def map_surface_grain(obj):
    """Mutates UV coordinates only. All current geometric contact counts persist."""
    mesh = obj.data
    if not mesh.uv_layers or mesh.uv_layers.active is None:
        raise RuntimeError(f"{obj.name}: missing original UV map; fail closed.")
    source_uv = mesh.uv_layers.active
    if source_uv.name == CANDIDATE_UV or mesh.uv_layers.get(CANDIDATE_UV):
        raise RuntimeError("An existing research UV layer would invalidate provenance.")
    geometry_before = world_mesh_signature(obj)
    source_uv_before = uv_signature(mesh, source_uv)
    original = uv_metrics(obj, source_uv)
    center, axis, bx, by, radius = inferred_axis_and_frame(obj)
    candidate = mesh.uv_layers.new(name=CANDIDATE_UV)
    face_local_fallbacks = 0
    seam_wrap_faces = 0
    island_offset = 10.0
    for polygon in mesh.polygons:
        points = [obj.matrix_world @ mesh.vertices[index].co for index in polygon.vertices]
        raw_angles = [math.atan2((point-center).dot(by),
                                 (point-center).dot(bx)) for point in points]
        aligned = []
        for angle in raw_angles:
            while angle - raw_angles[0] > math.pi:
                angle -= 2*math.pi
            while angle - raw_angles[0] < -math.pi:
                angle += 2*math.pi
            aligned.append(angle)
        if any(abs(a-b) > 1e-8 for a,b in zip(raw_angles,aligned)):
            seam_wrap_faces += 1
        uvs = [(theta*radius, (point-center).dot(axis))
               for theta,point in zip(aligned,points)]
        # A triangle lying on a cap/thickness rim has near-zero cylindrical
        # area. Repair only its UV projection, not its genuine source geometry.
        world_area = triangle_area(*points[:3]) if len(points) >= 3 else 0
        projected_area = abs(uv_twice_area(uvs[:3])) / 2 if len(points) >= 3 else 0
        if world_area <= EPSILON_AREA:
            raise RuntimeError(f"{obj.name}: degenerate original source face.")
        if projected_area <= max(1e-12,world_area*1e-7):
            local = face_plane_uv(points)
            min_u = min(u for u,_ in local)
            min_v = min(v for _,v in local)
            uvs = [(u-min_u+island_offset,v-min_v) for u,v in local]
            island_offset += max(u for u,_ in local)-min_u+0.02
            face_local_fallbacks += 1
        for loop_index,uv in zip(polygon.loop_indices,uvs):
            candidate.data[loop_index].uv = uv
    candidate_metrics = uv_metrics(obj, candidate)
    if geometry_before != world_mesh_signature(obj):
        raise RuntimeError(f"{obj.name}: UV research changed physical mesh geometry.")
    if source_uv_before != uv_signature(mesh, source_uv):
        raise RuntimeError(f"{obj.name}: original production UV map was modified.")
    # Do not mark zero collapsed triangles as proof of valid *sewing* UV seams.
    if candidate_metrics["collapsedUvTriangles"] > original["collapsedUvTriangles"]:
        raise RuntimeError(f"{obj.name}: research made structural UV collapse worse.")
    mesh.uv_layers.active = candidate
    obj["titan_surface_uv_candidate_only"] = True
    obj["titan_surface_uv_physical_repeat_verified"] = False
    return {
        "original": original, "candidate": candidate_metrics,
        "faceLocalFallbackIslands": face_local_fallbacks,
        "radialSeamWrapFaces": seam_wrap_faces,
        "inferredAxisWorld": [round(float(v),6) for v in axis],
        "inferredRadiusMm": round(radius*1000,3),
        "geometryPreserved": True, "originalUvPreserved": True,
        "physicalGrainApproved": False, "seamContinuityApproved": False,
    }


def output_paths():
    argv = sys.argv
    argv = argv[argv.index("--")+1:] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output",required=True,type=Path)
    parser.add_argument("--report",required=True,type=Path)
    opts = parser.parse_args(argv)
    source = Path(bpy.data.filepath).resolve()
    output = opts.output.expanduser().resolve()
    report = opts.report.expanduser().resolve()
    if not source.is_file() or source.suffix != ".blend":
        raise RuntimeError("UV research requires an actual saved locked CC0 Blender source.")
    if output == source or output.suffix != ".blend":
        raise RuntimeError("Research output must be a different .blend from source.")
    if report == source or report == output:
        raise RuntimeError("Research report must be separate from both Blender files.")
    return source, output, report


def main():
    source, output, path = output_paths()
    scene = bpy.context.scene
    if (scene.get("linen_earth_model_identity_id") != MODEL_IDENTITY
            or scene.get("linen_earth_model_reference_image") != REFERENCE_IMAGE
            or not scene.get("linen_earth_model_identity_locked")):
        raise RuntimeError("Unapproved identity: never generate a replacement mannequin.")
    body = bpy.data.objects.get("Body")
    if body is None or body.type != "MESH":
        raise RuntimeError("Existing source body is required.")
    original_source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    body_hash = world_mesh_signature(body)
    results = {}
    for name in GARMENTS:
        obj = bpy.data.objects.get(name)
        if obj is None or obj.type != "MESH":
            raise RuntimeError(f"Missing existing six-panel garment source {name}.")
        results[name] = map_surface_grain(obj)
    if world_mesh_signature(body) != body_hash:
        raise RuntimeError("UV research mutated the original locked body.")
    scene["linen_earth_asset_status"] = "research-surface-grain-uv-unapproved"
    scene["titan_surface_uv_research_candidate_only"] = True
    scene["titan_surface_uv_production_approved"] = False
    output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output),check_existing=False)
    if hashlib.sha256(source.read_bytes()).hexdigest() != original_source_hash:
        raise RuntimeError("Original locked candidate file changed during research.")
    report = {
        "version":"titan-surface-grain-research-v1",
        "candidateOnly":True, "productionApproved":False,
        "modelIdentityId":MODEL_IDENTITY, "referenceImage":REFERENCE_IMAGE,
        "sourceSha256Preserved":True, "bodyGeometryPreserved":True,
        "physicalFabricRepeatVerified":False, "tailorApproved":False,
        "fourAnglePhotographicParityApproved":False,
        "panels":results,
    }
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(report,indent=2,allow_nan=False)+"\n",encoding="utf8")
    print("TITAN_SURFACE_UV_NATIVE_RESEARCH_ONLY",json.dumps({
        name:{"oldCollapsed":p["original"]["collapsedUvTriangles"],
              "researchCollapsed":p["candidate"]["collapsedUvTriangles"],
              "fallbackFaces":p["faceLocalFallbackIslands"]}
        for name,p in results.items()},sort_keys=True))
    print("Candidate UV work is NOT sewn-seam, physical-repeat, fit or photo approval.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"TITAN surface-UV research rejected: {error}",file=sys.stderr)
        raise SystemExit(1)
