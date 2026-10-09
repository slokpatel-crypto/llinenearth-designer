# Render four neutral review views of the Linen Earth realistic officewear candidate.
# Run inside Blender 4.2+:
# blender --background candidate.blend --python scripts/blender/render-linen-earth-officewear-review.py -- --output-dir artifacts/realistic-3d/review

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

BODY_NAME = "Body"
SHIRT_OBJECTS = ("ShirtTorsoFabric", "ShirtSleeveLFabric", "ShirtSleeveRFabric")
TROUSER_OBJECTS = ("TrouserWaistFabric", "TrouserLegLFabric", "TrouserLegRFabric")
VIEWS = (
    ("front", 0.0),
    ("three-quarter", 35.0),
    ("side", 90.0),
    ("back", 180.0),
)


def cli_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--resolution-x", type=int, default=576)
    parser.add_argument("--resolution-y", type=int, default=768)
    parser.add_argument("--diagnostic-workbench", action="store_true",
                        help="Fast silhouette-only render of an UNAPPROVED scene; never used for production visual approval.")
    parser.add_argument("--diagnostic-cycles-cpu",action="store_true",
                        help="CPU path-traced colour/shadow evidence of real LAB geometry; never fabric, tailor or studio acceptance.")
    options=parser.parse_args(argv)
    if options.diagnostic_workbench and options.diagnostic_cycles_cpu:
        raise ValueError("Only one unapproved review backend may be selected.")
    return options


def rgba(hex_value: str):
    value = hex_value.lstrip("#")
    if len(value) != 6:
        raise ValueError(hex_value)
    return tuple(int(value[i:i+2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)


def material(name: str, color: str, roughness: float):
    existing = bpy.data.materials.get(name)
    mat = existing or bpy.data.materials.new(name=name)
    mat.use_nodes = True
    # Workbench's fast geometry-only diagnostic reads the material diffuse
    # swatch, while normal EEVEE review keeps its Principled shader unchanged.
    mat.diffuse_color = rgba(color)
    nodes = mat.node_tree.nodes
    principled = nodes.get("Principled BSDF")
    if principled is not None:
        principled.inputs["Base Color"].default_value = rgba(color)
        principled.inputs["Roughness"].default_value = roughness
        if "Specular IOR Level" in principled.inputs:
            principled.inputs["Specular IOR Level"].default_value = 0.28
    return mat


def assign_material(obj, mat):
    if obj is None or obj.type != "MESH":
        return
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def world_bounds(obj):
    return [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]


def body_frame(body):
    points = world_bounds(body)
    xs = [point.x for point in points]
    ys = [point.y for point in points]
    zs = [point.z for point in points]
    return {
        "center": Vector(((min(xs)+max(xs))*0.5, (min(ys)+max(ys))*0.5, (min(zs)+max(zs))*0.5)),
        "height": max(zs)-min(zs),
        "min_z": min(zs),
        "max_z": max(zs),
    }


def ensure_camera():
    camera = bpy.data.objects.get("LE_REVIEW_CAMERA")
    if camera is None:
        data = bpy.data.cameras.new("LE_REVIEW_CAMERA")
        camera = bpy.data.objects.new("LE_REVIEW_CAMERA", data)
        bpy.context.scene.collection.objects.link(camera)
    camera.data.lens = 58
    camera.data.sensor_width = 36
    bpy.context.scene.camera = camera
    return camera


def point_camera(camera, target: Vector):
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, energy, size, target):
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    bpy.context.scene.collection.objects.link(obj)
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


def studio_setup(body):
    frame = body_frame(body)
    target = Vector((frame["center"].x, frame["center"].y, frame["min_z"] + frame["height"] * 0.52))

    # Remove any previous review-only setup for deterministic reruns.
    for obj in list(bpy.data.objects):
        if obj.name.startswith("LE_REVIEW_"):
            bpy.data.objects.remove(obj, do_unlink=True)

    camera = ensure_camera()

    add_area_light(
        "LE_REVIEW_KEY",
        Vector((-1.55, -2.00, frame["min_z"] + frame["height"] * 1.15)),
        280,
        1.9,
        target,
    )
    add_area_light(
        "LE_REVIEW_FILL",
        Vector((1.55, -1.25, frame["min_z"] + frame["height"] * 0.85)),
        135,
        1.6,
        target,
    )
    add_area_light(
        "LE_REVIEW_RIM",
        Vector((0.0, 1.75, frame["min_z"] + frame["height"] * 1.05)),
        220,
        1.4,
        target,
    )

    bpy.ops.mesh.primitive_plane_add(size=7.0, location=(frame["center"].x, frame["center"].y, frame["min_z"] - 0.002))
    floor = bpy.context.object
    floor.name = "LE_REVIEW_FLOOR"
    assign_material(floor, material("LE_REVIEW_FLOOR_MAT", "#DCD8CF", 0.80))

    return frame, target, camera


def image_exposure_metrics(path):
    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        pixels = image.pixels[:]
        if not pixels:
            return {"samples": 0, "clippedRatio": 1.0, "darkRatio": 1.0, "meanLuma": 0.0}
        stride = max(4, (len(pixels) // 4) // 6000 * 4)
        lumas = []
        for index in range(0, len(pixels), stride):
            if index + 2 >= len(pixels):
                break
            red, green, blue = pixels[index], pixels[index + 1], pixels[index + 2]
            lumas.append(0.2126 * red + 0.7152 * green + 0.0722 * blue)
        if not lumas:
            return {"samples": 0, "clippedRatio": 1.0, "darkRatio": 1.0, "meanLuma": 0.0}
        clipped = sum(1 for value in lumas if value >= 0.985)
        dark = sum(1 for value in lumas if value <= 0.035)
        return {
            "samples": len(lumas),
            "clippedRatio": round(clipped / len(lumas), 5),
            "darkRatio": round(dark / len(lumas), 5),
            "meanLuma": round(sum(lumas) / len(lumas), 5),
        }
    finally:
        bpy.data.images.remove(image)


def configure_scene(options):
    scene = bpy.context.scene
    scene.render.engine = (
        "CYCLES" if options.diagnostic_cycles_cpu
        else "BLENDER_WORKBENCH" if options.diagnostic_workbench
        else "BLENDER_EEVEE_NEXT"
    )
    if options.diagnostic_cycles_cpu:
        # Blender EEVEE/Workbench both timed out initialising headless EGL on
        # CI. CPU Cycles builds a physically shaded review of the independently
        # checked REAL 205k-triangle LAB geometry without a GPU/display.
        # Three samples and 320x480 keep this auxiliary stage bounded. It is
        # NOT calibrated linen PBR or a visual approval for the original model.
        scene.cycles.device="CPU"
        scene.cycles.samples=3
        scene.render.threads_mode="FIXED"
        scene.render.threads=2
        scene.render.use_simplify=True
        scene.render.simplify_subdivision=0
    if options.diagnostic_workbench:
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "MATERIAL"
        scene.display.shading.show_shadows = True
        scene.display.shading.show_cavity = True
    scene.render.resolution_x = max(320, options.resolution_x)
    scene.render.resolution_y = max(480, options.resolution_y)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"

    world = scene.world or bpy.data.worlds.new("LE_REVIEW_WORLD")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background is not None:
        background.inputs["Color"].default_value = rgba("#DEDAD2")
        background.inputs["Strength"].default_value = 0.24

    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.65


def isolate_neutral_six_panel_fit_review():
    """Hide ALL alternate tailoring meshes ONLY in this throwaway render.

    The source .blend imported 586+ variant nodes with hide_render=False.
    Rendering those on top of each other created z-fighting horizontal bands,
    detached sleeves and a false open waist despite a green six-panel BVH.
    This view measures ONLY the real fitted master shirt/trousers plus body
    and genuine fitted footwear; it cannot represent a specific selected
    collar/cuff recipe or prove original-studio photographic identity.
    """
    alternate=[]
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        if bool(obj.get("linen_earth_tailoring_variant",False)):
            obj.hide_render=True
            alternate.append(obj.name)
    essentials=(BODY_NAME,*SHIRT_OBJECTS,*TROUSER_OBJECTS)
    for name in essentials:
        obj=bpy.data.objects.get(name)
        if obj is None or obj.type!="MESH":
            raise RuntimeError("Missing neutral real-mesh geometry for fit review: "+name)
        obj.hide_render=False
    for obj in bpy.data.objects:
        if obj.type=="MESH" and (obj.name.split(".")[0] in {
            "ShoeL","ShoeR","SoleL","SoleR","HeelL","HeelR"
        } or obj.name.startswith("ShoeLace")):
            obj.hide_render=False
    return alternate


def main():
    options = cli_args()
    output_dir = Path(options.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    body = bpy.data.objects.get(BODY_NAME)
    if body is None or body.type != "MESH":
        raise RuntimeError("Realistic review render requires the prepared Body mesh.")

    missing = [name for name in (*SHIRT_OBJECTS, *TROUSER_OBJECTS) if bpy.data.objects.get(name) is None]
    if missing:
        raise RuntimeError("Review render is missing garment objects: " + ", ".join(missing))
    hidden_alternates = isolate_neutral_six_panel_fit_review()

    skin = material("LE_REVIEW_SKIN", "#916F5A", 0.68)
    shirt = material("LE_REVIEW_SHIRT", "#C8B58E", 0.76)
    trouser = material("LE_REVIEW_TROUSER", "#343C49", 0.74)
    leather = material("LE_REVIEW_DRESS_SHOE", "#382C24", 0.38)
    assign_material(body, skin)
    for name in SHIRT_OBJECTS:
        assign_material(bpy.data.objects.get(name), shirt)
    for name in TROUSER_OBJECTS:
        assign_material(bpy.data.objects.get(name), trouser)
    # Footwear has intentionally distinct dark-brown leather in a neutral
    # four-view scene; colour masks can then detect *worn* shoes instead of
    # confusing pale floor fragments with a correctly shod foot.
    for obj in bpy.data.objects:
        clean = obj.name.split(".")[0]
        if clean in {"ShoeL","ShoeR","SoleL","SoleR","HeelL","HeelR"} or clean.startswith("ShoeLace"):
            assign_material(obj, leather)

    configure_scene(options)
    frame, target, camera = studio_setup(body)

    radius = max(2.65, frame["height"] * 1.68)
    z = frame["min_z"] + frame["height"] * 0.52
    manifest = []

    # Treat negative Y as canonical front. All four views are always rendered,
    # so orientation errors remain visible even if a source asset is reversed.
    for label, yaw_deg in VIEWS:
        angle = math.radians(yaw_deg)
        camera.location = Vector((
            frame["center"].x + math.sin(angle) * radius,
            frame["center"].y - math.cos(angle) * radius,
            z,
        ))
        point_camera(camera, target)
        output = output_dir / f"{label}.png"
        bpy.context.scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        metrics = image_exposure_metrics(output)
        manifest.append((label, yaw_deg, str(output), metrics))
        print(f"Rendered {label}: {output} · exposure {json.dumps(metrics, sort_keys=True)}")
        if metrics["clippedRatio"] > 0.22:
            raise RuntimeError(
                f"{label} review render is overexposed: {metrics['clippedRatio']*100:.1f}% of sampled pixels are clipped."
            )
        if metrics["meanLuma"] < 0.12 or metrics["meanLuma"] > 0.88:
            raise RuntimeError(
                f"{label} review render mean luminance {metrics['meanLuma']:.3f} is outside the useful QA range."
            )

    (output_dir / "review-geometry-provenance.json").write_text(json.dumps({
        "viewType":"neutral-six-panel-real-body-geometry",
        "variantsHiddenForReview":len(hidden_alternates),
        "hiddenAlternates":hidden_alternates[:20],
        "productionAssetAltered":False,
        "selectedTailoringRecipeVerified":False,
        "cpuCyclesLaboratoryReviewOnly":bool(options.diagnostic_cycles_cpu),
        "referencePhotoVisualParityApproved":False,
        "fabricColourRepeatOrDrapeApproved":False,
    },indent=2)+"\n",encoding="utf-8")
    manifest_path = output_dir / "review-views.txt"
    manifest_path.write_text(
        "\n".join(f"{label}\t{yaw:.1f}\t{path}" for label, yaw, path, _ in manifest) + "\n",
        encoding="utf-8",
    )
    if options.diagnostic_cycles_cpu:
        (output_dir / "UNAPPROVED-CPU-SHADED-REVIEW.txt").write_text(
            "Real BLENDER CPU Cycles colour/shadow on disposable LOD geometry. "
            "NOT the original studio model, supplier-calibrated linen, true "
            "drape, final production export or owner/tailor visual approval.\n",
            encoding="utf-8",
        )
    if options.diagnostic_workbench:
        (output_dir / "GEOMETRY-ONLY-NOT-REALISM.txt").write_text(
            "UNAPPROVED low-poly Workbench silhouette only. Fabric texture, drape optics, studio parity, and photorealism are NOT evaluated.\\n",
            encoding="utf-8",
        )
    metrics_path = output_dir / "review-metrics.json"
    metrics_path.write_text(
        json.dumps({label: metrics for label, _, _, metrics in manifest}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Rendered Linen Earth review set: {output_dir}")
    print(f"Review exposure metrics: {metrics_path}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Linen Earth review rendering failed: {error}", file=sys.stderr)
        raise SystemExit(1)
