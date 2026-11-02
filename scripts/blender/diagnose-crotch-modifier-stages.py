# Research only. Run on explicit --experimental-capture-crotch-stages .blend.
"""Identify whether true leg-leg intersections arise in source, smoothing, shrinkwrap or solidification."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import runpy
import sys

import bpy

IDENTITY = "linen-earth-studio-model-v1"
STAGES = ("selectedBodyShell", "afterSmoothing", "afterBodyClearance", "afterClothThickness")
LEGS = ("TrouserLegLFabric", "TrouserLegRFabric")


def main():
    cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    options = parser.parse_args(cli)
    scene = bpy.context.scene
    if (scene.get("linen_earth_model_identity_id") != IDENTITY
            or scene.get("linen_earth_model_identity_locked") is not True
            or scene.get("linen_earth_research_crotch_stages_emitted") is not True):
        raise RuntimeError("Missing locked source or explicit research-stage construction.")
    research = bpy.data.collections.get("TITAN_CrotchStageResearch")
    export = bpy.data.collections.get("LinenEarthExport")
    if research is None or export is None:
        raise RuntimeError("Neither production nor research geometry may be invented or omitted.")
    if len(research.objects) != 8:
        raise RuntimeError("Expected exactly four real modifier stages on both leg panels.")

    # Reuse the exact canonical native world-space BVH and face-area helpers.
    funcs = runpy.run_path(str(Path(__file__).with_name("diagnose-linen-earth-crotch.py")))
    world_geometry = funcs["world_geometry"]
    real_tree = funcs["real_tree"]
    reports = {}
    for stage in STAGES:
        meshes = []
        for leg in LEGS:
            obj = research.objects.get(f"TITAN_RESEARCH_{stage}_{leg}")
            if (obj is None or obj.type != "MESH" or obj.get("candidateOnly") is not True
                    or obj.get("productionApproved") is not False
                    or obj.get("sourceStage") != stage):
                raise RuntimeError(f"Missing unapproved actual Blender stage {stage}/{leg}")
            meshes.append(obj)
        lgeom, rgeom = [world_geometry(obj) for obj in meshes]
        overlap = real_tree(lgeom).overlap(real_tree(rgeom))
        lf = {left for left, _ in overlap}
        rf = {right for _, right in overlap}
        if any(index < 0 or index >= len(lgeom["polygons"]) for index in lf):
            raise RuntimeError("Invalid left leg source stage face index.")
        if any(index < 0 or index >= len(rgeom["polygons"]) for index in rf):
            raise RuntimeError("Invalid right leg source stage face index.")
        reports[stage] = {
            "legLegPolygonContactPairs": len(overlap),
            "leftContactingFaceAreaMm2": round(sum(lgeom["areas"][i] for i in lf) * 1e6, 3),
            "rightContactingFaceAreaMm2": round(sum(rgeom["areas"][i] for i in rf) * 1e6, 3),
            "leftFaces": len(lgeom["polygons"]),
            "rightFaces": len(rgeom["polygons"]),
        }
    actual = [export.objects.get(name) for name in LEGS]
    if any(x is None for x in actual):
        raise RuntimeError("Actual authored source leg meshes disappeared.")
    final = len(real_tree(world_geometry(actual[0])).overlap(real_tree(world_geometry(actual[1]))))
    if final != reports["afterClothThickness"]["legLegPolygonContactPairs"]:
        raise RuntimeError("Snapshot final cloth no longer matches original real six-panel candidate.")
    if not any(data["legLegPolygonContactPairs"] > 0 for data in reports.values()):
        raise RuntimeError("No observed crotch seam collision evidence was measured.")
    report = {
        "version": "titan-crotch-real-modifier-stage-pairs-v1",
        "modelIdentityId": IDENTITY,
        "candidateOnly": True,
        "productionApproved": False,
        "changesProductionGeometry": False,
        "actualFinalGarmentLegContactPairs": final,
        "actualNativeBodyProvenance": scene.get("linen_earth_garment_authoring_method"),
        "stages": reports,
        "interpretation": "Canonical 0.5mm world-space polygon BVH and contacted-face area, not volume or tailoring approval.",
    }
    options.output.parent.mkdir(parents=True, exist_ok=True)
    options.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print("TITAN_REAL_CROTCH_STAGE_PAIR_ORIGIN_MEASURED " + json.dumps(report, allow_nan=False))


if __name__ == "__main__":
    main()
