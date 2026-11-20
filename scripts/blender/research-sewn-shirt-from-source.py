#!/usr/bin/env python3
"""RESEARCH ONLY: construct the 3 shirt panels as one sewn source surface.

Must be run on the *already saved* pinned-CC0 disjoint-armhole candidate,
never on a substitute body, temporary mannequin, live viewer or approved GLB.
The single native mesh is smoothed, wrapped and solidified ONCE. Faces are then
partitioned by original source panel assignment into the existing three
independently swatchable material objects; no separate artificial inner
armhole rim is allowed. A connected source seam is NOT a tailored seam.
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
AUTHOR_FILE = ROOT / "scripts/blender/author-linen-earth-officewear.py"
PREFLIGHT_FILE = ROOT / "scripts/blender/preflight-linen-earth-officewear.py"
PANELS = ("ShirtTorsoFabric", "ShirtSleeveLFabric", "ShirtSleeveRFabric")


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Missing original Blender helper: " + str(path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


author = load_module("titan_officewear_author_original", AUTHOR_FILE)
preflight = load_module("titan_officewear_preflight_original", PREFLIGHT_FILE)


def args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    return parser.parse_args(argv)


def fingerprint(body):
    payload = [
        [[round(float(v), 9) for v in body.matrix_world @ vertex.co] for vertex in body.data.vertices],
        [list(poly.vertices) for poly in body.data.polygons],
    ]
    return hashlib.sha256(json.dumps(payload, separators=(",", ":")).encode()).hexdigest()


def apply(obj, kind, label, configure):
    modifier = obj.modifiers.new(label, kind)
    configure(modifier)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def source_faces(body, cx, zlow, z):
    faces = [[], [], []]
    transform = body.matrix_world
    for polygon in body.data.polygons:
        center = transform @ polygon.center
        index = None
        if zlow <= center.z <= z(0.895) and abs(center.x - cx) <= 0.245:
            index = 0
        elif z(0.500) <= center.z <= z(0.875) and center.x - cx < -0.245:
            index = 1
        elif z(0.500) <= center.z <= z(0.875) and center.x - cx > 0.245:
            index = 2
        if index is not None:
            faces[index].append(polygon)
    if any(len(chunk) < 4 for chunk in faces):
        raise RuntimeError("Original source has missing torso/sleeve panels")
    source_sets = [{int(v) for poly in chunk for v in poly.vertices} for chunk in faces]
    for side in (1, 2):
        shared = source_sets[0] & source_sets[side]
        if len(shared) < 8:
            raise RuntimeError("Unconnected original-body source armhole: "+PANELS[side])
    return faces, source_sets


def build_joint(body, faces):
    used = sorted({int(v) for group in faces for poly in group for v in poly.vertices})
    remap = {old: new for new, old in enumerate(used)}
    vertices = [tuple(body.matrix_world @ body.data.vertices[i].co) for i in used]
    polygons = [tuple(remap[int(i)] for i in polygon.vertices) for group in faces for polygon in group]
    materials = [i for i, group in enumerate(faces) for polygon in group]
    mesh = bpy.data.meshes.new("TITAN_RESEARCH_SEWN_ORIGINAL_CC0_SHIRT")
    mesh.from_pydata(vertices, [], polygons)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new("TITAN_RESEARCH_SOURCE_SHIRT_JOINT", mesh)
    obj.matrix_world.identity()
    collection = bpy.data.collections.new("TITAN_ResearchSeamSingleSolidify")
    bpy.context.scene.collection.children.link(collection)
    collection.objects.link(obj)
    for name in PANELS:
        material = bpy.data.materials.get(name)
        if material is None:
            raise RuntimeError("Pinned six-panel source material not found: "+name)
        mesh.materials.append(material)
    if len(mesh.polygons) != len(materials):
        raise RuntimeError("Original-source garment panel assignment is not 1:1")
    for polygon, material_id in zip(mesh.polygons, materials):
        polygon.material_index = material_id
        polygon.use_smooth = True
    return obj, materials, collection


def split_to_source_panel_objects(joint, original_materials, source_blend):
    old_materials = {name: bpy.data.objects[name].data.materials[0] for name in PANELS}
    vertices = [tuple(v.co) for v in joint.data.vertices]
    counts = {}
    collection = bpy.data.collections.get(author.EXPORT_COLLECTION)
    if collection is None:
        raise RuntimeError("Pinned export collection missing")
    for material_index, name in enumerate(PANELS):
        faces = [tuple(int(i) for i in poly.vertices)
                 for poly in joint.data.polygons if poly.material_index == material_index]
        if len(faces) < len(original_materials[material_index]):
            raise RuntimeError("Native Solidify lost source panel faces: " + name)
        used = sorted({index for face in faces for index in face})
        remap = {old: i for i, old in enumerate(used)}
        mesh = bpy.data.meshes.new(name+"ResearchSingleSolidifyMesh")
        mesh.from_pydata([vertices[i] for i in used], [],
                         [tuple(remap[i] for i in face) for face in faces])
        mesh.update(calc_edges=True)
        mesh.materials.append(old_materials[name])
        for poly in mesh.polygons:
            poly.use_smooth = True
        old = bpy.data.objects.get(name)
        if old is None:
            raise RuntimeError("Original six-panel object absent during replacement: "+name)
        bpy.data.objects.remove(old, do_unlink=True)
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        obj.matrix_world.identity()
        author.planar_grain_uv(obj)
        obj["linen_earth_auto_authored"] = True
        obj["candidateOnly"] = True
        obj["productionApproved"] = False
        obj["sewnSeamVerified"] = False
        obj["measuredFabricDrapeApproved"] = False
        obj["linen_earth_research_joint_solidify"] = True
        obj["linen_earth_research_source_blend"] = source_blend.name
        counts[name] = {"faces": len(faces), "vertices": len(used), "sourceFaces": len(original_materials[material_index])}
    return counts


def main():
    o = args()
    source = Path(bpy.data.filepath).resolve()
    target = o.output.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".blend":
        raise RuntimeError("Saved original pinned Blender scene required")
    if target == source or target.suffix.lower() != ".blend":
        raise RuntimeError("Must write a NEW research .blend; original source immutable")
    scene = bpy.context.scene
    if (scene.get("linen_earth_model_identity_id") != "linen-earth-studio-model-v1"
        or scene.get("linen_earth_model_reference_image") != "/designer/studio-tucked.webp"
        or scene.get("linen_earth_model_identity_locked") is not True
        or scene.get("linen_earth_research_disjoint_armholes") is not True
        or scene.get("linen_earth_research_open_armhole_rims") is True):
        raise RuntimeError("Only exact locked CC0 disjoint-source body trial may be stitched")
    body = bpy.data.objects.get("Body")
    if body is None or body.type != "MESH":
        raise RuntimeError("Real pinned source body missing")
    original = fingerprint(body)
    bbox = [body.matrix_world @ Vector(v) for v in body.bound_box]
    center = (min(v.x for v in bbox)+max(v.x for v in bbox))/2
    zmin = min(v.z for v in bbox)
    height = max(v.z for v in bbox)-zmin
    if abs(height-1.727) > 0.020:
        raise RuntimeError("Changed original source height")
    z = lambda ratio: zmin + height*ratio
    tucked_hem = scene.get("linen_earth_tucked_shirt_hem_z_m")
    if not isinstance(tucked_hem, (int, float)) or not z(0.57) < tucked_hem < z(0.70):
        raise RuntimeError("Cannot prove actual photographed waist/tuck guide for seam selection")
    clearance = scene.get("linen_earth_garment_clearance_mm")
    thickness = scene.get("linen_earth_garment_thickness_mm")
    if not all(type(value) in (int,float) and math.isfinite(value) for value in (clearance,thickness)):
        raise RuntimeError("No measured source garment clearance or thickness")
    if not 3.0 <= clearance <= 18.0 or not 0.6 <= thickness <= 4.0:
        raise RuntimeError("Changed accepted authoring parameter bounds")
    regions, source_sets = source_faces(body,center,tucked_hem,z)
    joint, material_indices, collection = build_joint(body, regions)
    apply(joint,"CORRECTIVE_SMOOTH","LE_RESEARCH_JOINED_SMOOTH",
          lambda m:(setattr(m,"factor",0.22),setattr(m,"iterations",3)))
    apply(joint,"SHRINKWRAP","LE_RESEARCH_JOINED_BODY_CLEARANCE",
          lambda m:(setattr(m,"target",body),setattr(m,"wrap_method","NEAREST_SURFACEPOINT"),
                    setattr(m,"wrap_mode","OUTSIDE_SURFACE"),setattr(m,"offset",clearance/1000)))
    apply(joint,"SOLIDIFY","LE_RESEARCH_SINGLE_JOINT_SOLIDIFY",
          lambda m:(setattr(m,"thickness",thickness/1000),
                    setattr(m,"offset",1.0),setattr(m,"use_rim",True)))
    counts = split_to_source_panel_objects(joint, regions, source)
    bpy.data.objects.remove(joint, do_unlink=True)
    if collection.objects:
        raise RuntimeError("Combined research mesh unexpectedly survived splitting")
    if fingerprint(body) != original:
        raise RuntimeError("Original CC0 body was mutated by seam research")
    scene["linen_earth_asset_status"] = "RESEARCH-only-joint-shirt-solidify-unapproved"
    scene["linen_earth_research_single_solidify_shirt"] = True
    scene["linen_earth_production_approved"] = False
    pairs = {}
    for index,left in enumerate(PANELS):
        for right in PANELS[index+1:]:
            count=preflight.intersection_pair_count(bpy.data.objects[left],bpy.data.objects[right])
            if type(count) is not int or count<0:
                raise RuntimeError("Unmeasurable actual sewn-shirt panel intersection")
            pairs[left+"::"+right]=count
    report={
      "version":"titan-cc0-joint-shirt-solidify-research-v1",
      "modelIdentityId":"linen-earth-studio-model-v1",
      "referenceImage":"/designer/studio-tucked.webp",
      "sourceBodySha256":original,
      "sourceBlend":source.name,
      "productionApproved":False,
      "tailorApproved":False,
      "watertightShirtConstructionApproved":False,
      "photographicMatchApproved":False,
      "measuredFabricDrapeApproved":False,
      "singleNativeSolidify":True,
      "sharedBodySourceVertexCounts":{
          "leftTorsoSleeve":len(source_sets[0] & source_sets[1]),
          "rightTorsoSleeve":len(source_sets[0] & source_sets[2])
      },
      "authoredPanelMesh":counts,
      "realBVHShirtPanelContacts":pairs,
      "caveat":"Research-only stitched polygon ownership, NOT sewn construction, proper collar or approved fit",
    }
    target.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(target))
    o.report.parent.mkdir(parents=True,exist_ok=True)
    o.report.write_text(json.dumps(report,indent=2)+"\n")
    print("TITAN_ORIGINAL_CC0_SINGLE_SOLIDIFY_RESEARCH_NOT_PRODUCTION",json.dumps(report))


if __name__=="__main__":
    try:
        main()
    except Exception as exc:
        print("Original CC0 shirt joint research failed: "+str(exc),file=sys.stderr)
        raise SystemExit(1)
