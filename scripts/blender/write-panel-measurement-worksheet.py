# Write a non-promotional measurement worksheet from the current authored garment scene.
# The geometry estimates help a tailor/owner locate the six production pieces, but they
# NEVER count as verified physical panel dimensions.
#
# blender --background candidate.blend --python scripts/blender/write-panel-measurement-worksheet.py -- \
#   --output artifacts/realistic-3d/panel-measurement-worksheet.json

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from fabric_arc_uv import frame_at_height, ellipse_ring_perimeter_m

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
    return parser.parse_args(argv)


def evaluated_world_points(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        matrix = evaluated.matrix_world
        return [matrix @ vertex.co for vertex in mesh.vertices]
    finally:
        evaluated.to_mesh_clear()


def geometry_estimate(obj):
    points = evaluated_world_points(obj)
    if not points:
        raise RuntimeError(f"{obj.name} has no evaluated vertices.")
    xs = [point.x for point in points]
    ys = [point.y for point in points]
    zs = [point.z for point in points]
    result = {
        "worldBoundingWidthMm": round((max(xs) - min(xs)) * 1000.0, 2),
        "worldBoundingDepthMm": round((max(ys) - min(ys)) * 1000.0, 2),
        "worldBoundingHeightMm": round((max(zs) - min(zs)) * 1000.0, 2),
        "note": "Reference only. This is a 3D world-space bounding box, not a flat-pattern measurement.",
    }
    if obj.name.startswith(("ShirtSleeve","TrouserLeg")):
        raw=obj.get("linen_earth_source_ring_uv")
        if not raw:
            raise RuntimeError(
                f"{obj.name}: cannot estimate full-wrap UV circumference without source construction rings."
            )
        ring=frame_at_height(json.loads(raw),(min(zs)+max(zs))*0.5)
        result["estimatedUvMidHeightWrapMm"]=round(
            ellipse_ring_perimeter_m(ring)*1000.0,2
        )
        result["estimatedUvBasis"]="entire tubular arc circumference; geometry-only estimate, not measured fabric"
    return result


def uv_width_measurement_instructions(name):
    if name.startswith(("ShirtSleeve","TrouserLeg")):
        return (
            "Texture U goes around the ENTIRE finished tube at mid-height. "
            "Measure the full circumference with a flexible tape; if using "
            "flat pattern pieces, add their sewn widths excluding allowances "
            "to obtain one closed circumference. Never use X diameter."
        )
    return (
        "Texture U follows the X-span across the visible garment panel. "
        "Measure the approved physical cloth/pattern reference for this "
        "corresponding map extent and document the method."
    )


def main():
    options = cli_args()
    missing = [name for name in GARMENT_OBJECTS if bpy.data.objects.get(name) is None]
    if missing:
        raise RuntimeError("Missing garment objects: " + ", ".join(missing))

    panels = {}
    for name in GARMENT_OBJECTS:
        panels[name] = {
            "geometryEstimate": geometry_estimate(bpy.data.objects[name]),
            "verifiedPhysicalMeasurement": {
                "widthMm": None,
                "heightMm": None,
                "measuredBy": "",
                "measuredAt": "",
                "method": "",
                "uvWidthDefinition": uv_width_measurement_instructions(name),
                "physicalPrintedRepeatMm": None,
                "physicalRepeatMeasurementMethod": "",
            },
        }

    payload = {
        "version": "linen-earth-panel-measurement-worksheet-v1",
        "status": "WORKSHEET_ONLY_NOT_PRODUCTION_EVIDENCE",
        "modelIdentityId": str(bpy.context.scene.get("linen_earth_model_identity_id", "")),
        "instructions": [
            "Use the geometry estimate only to identify/check the correct garment piece.",
            "Measure the physical approved pattern or finished-garment panel with a ruler/tape.",
            "Record widthMm and heightMm in millimetres, plus who measured it, date and method.",
            "Do not copy the 3D bounding-box estimate into the production panel spec.",
            "For sleeve and trouser legs measure a full 360-degree mid-height circumference; flat-pattern widths must exclude seam allowances.",
            "Separately measure and record a supplier/owner verified stripe/check repeat in millimetres. Never infer a repeat from pixels alone.",
        ],
        "panels": panels,
    }

    output = Path(options.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote Linen Earth physical panel measurement worksheet: {output}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Panel measurement worksheet failed: {error}", file=sys.stderr)
        raise SystemExit(1)
