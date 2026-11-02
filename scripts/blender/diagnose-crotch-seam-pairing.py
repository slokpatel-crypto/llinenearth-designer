# Read-only native actual original selected-body seam pairing analysis.
"""Measure nearest cut-edge correspondences before attempting a sewn bridge.

This determines the geometry of existing open garment-source boundaries only.
Nearest edges are not stitched edges, body-fit approval or cutting instructions.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import runpy
import statistics
import sys

import bpy

IDENTITY = "linen-earth-studio-model-v1"
STAGE = "selectedBodyShell"
LEGS = ("TrouserLegLFabric", "TrouserLegRFabric")
THRESHOLDS_MM = (5, 10, 20, 40, 80)


def nearest_point_to_segment(point, segment):
    start, end = segment
    delta = end - start
    squared = delta.length_squared
    fraction = max(0.0, min(1.0, (point - start).dot(delta) / squared)) if squared > 1e-16 else 0.0
    nearest = start + fraction * delta
    return (point - nearest).length * 1000.0


def match_cut_edges(source, destination):
    results = []
    for index, (start, end) in enumerate(source):
        midpoint = (start + end) / 2.0
        distance, best_index = min(
            (nearest_point_to_segment(midpoint, segment), j)
            for j, segment in enumerate(destination)
        )
        match_start, match_end = destination[best_index]
        direction = end - start
        other_direction = match_end - match_start
        if direction.length <= 1e-9 or other_direction.length <= 1e-9:
            raise RuntimeError("Zero-length original source sewing edge is not valid.")
        alignment = abs(direction.normalized().dot(other_direction.normalized()))
        if not all(math.isfinite(v) for v in (distance, alignment)):
            raise RuntimeError("Nonfinite original cut-edge matching geometry.")
        results.append({
            "sourceEdgeIndex": index,
            "nearestOtherEdgeIndex": best_index,
            "midpointToOtherCutEdgeMm": round(distance, 4),
            "sourceEdgeLengthMm": round(direction.length * 1000.0, 4),
            "axisAlignmentAbsoluteCosine": round(alignment, 6),
            "midpointHeightDifferenceMm": round(
                abs(midpoint.z - (match_start.z + match_end.z) / 2.0) * 1000.0, 4
            ),
        })
    return results


def distances_summary(data):
    values = [row["midpointToOtherCutEdgeMm"] for row in data]
    if not values or not all(math.isfinite(v) and v >= 0 for v in values):
        raise RuntimeError("No finite real source cutting edges can be paired.")
    return {
        "count": len(values),
        "minMm": round(min(values), 4),
        "medianMm": round(statistics.median(values), 4),
        "maxMm": round(max(values), 4),
        "withinMm": {str(mm): sum(v <= mm for v in values) for mm in THRESHOLDS_MM},
    }


def main():
    cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    options = parser.parse_args(cli)
    scene = bpy.context.scene
    if (scene.get("linen_earth_model_identity_id") != IDENTITY
            or scene.get("linen_earth_model_identity_locked") is not True
            or scene.get("linen_earth_research_crotch_stages_emitted") is not True):
        raise RuntimeError("Need original identity-locked source and explicit real stage research scene.")
    research = bpy.data.collections.get("TITAN_CrotchStageResearch")
    export = bpy.data.collections.get("LinenEarthExport")
    body = bpy.data.objects.get("Body")
    if research is None or export is None or body is None or len(research.objects) != 8:
        raise RuntimeError("Cannot measure real seam correspondences without intact source garments.")
    helpers = runpy.run_path(str(Path(__file__).with_name("diagnose-linen-earth-crotch.py")))
    proximity = runpy.run_path(str(Path(__file__).with_name("diagnose-crotch-seam-proximity.py")))
    geometry = helpers["world_geometry"]
    body_points = geometry(body)["points"]
    center_x = (min(v.x for v in body_points) + max(v.x for v in body_points)) / 2.0
    bounds, edges = [], []
    for leg in LEGS:
        if export.objects.get(leg) is None:
            raise RuntimeError("Missing original candidate garment; no source-only inference permitted.")
        stage = research.objects.get(f"TITAN_RESEARCH_{STAGE}_{leg}")
        if (stage is None or stage.type != "MESH"
                or stage.get("candidateOnly") is not True
                or stage.get("productionApproved") is not False
                or stage.get("sourceStage") != STAGE):
            raise RuntimeError("Invalid actual original cut-stage topology.")
        info, segments = proximity["actual_centerline_source_segments"](
            geometry(stage), center_x
        )
        bounds.append(info)
        edges.append(segments)
    forward = match_cut_edges(edges[0], edges[1])
    backward = match_cut_edges(edges[1], edges[0])
    mutual = [
        entry for entry in forward
        if backward[entry["nearestOtherEdgeIndex"]]["nearestOtherEdgeIndex"]
        == entry["sourceEdgeIndex"]
    ]
    if len(forward) != bounds[0]["nearCenterlineBoundaryEdges"] or len(backward) != bounds[1]["nearCenterlineBoundaryEdges"]:
        raise RuntimeError("Cut-edge counts differ from independent native source boundary audit.")
    if len(mutual) > min(len(forward), len(backward)):
        raise RuntimeError("Invalid mutual nearest-neighbour seam correspondence.")
    report = {
        "version": "titan-crotch-actual-source-seam-matching-v1",
        "modelIdentityId": IDENTITY,
        "candidateOnly": True,
        "productionApproved": False,
        "physicalFitApproved": False,
        "changesProductionGeometry": False,
        "metricCaveat": "Midpoint-to-nearest-original-open-edge correspondences are an unsigned sewing feasibility proxy, not sewn topology or approved garment pattern.",
        "sourceOpenBoundaryEvidence": {"left": bounds[0], "right": bounds[1]},
        "nearestEdgeMidpointDistanceMm": {
            "leftToRight": distances_summary(forward),
            "rightToLeft": distances_summary(backward),
        },
        "mutualNearestEdgeCount": len(mutual),
        "pairedLeftEdgeCount": len(forward),
        "pairedRightEdgeCount": len(backward),
        "mutualPairIndices": [
            [entry["sourceEdgeIndex"], entry["nearestOtherEdgeIndex"]]
            for entry in mutual
        ],
        "leftEdgeCorrespondences": forward,
        "rightEdgeCorrespondences": backward,
    }
    options.output.parent.mkdir(parents=True, exist_ok=True)
    options.output.write_text(json.dumps(report, allow_nan=False, indent=2) + "\n", encoding="utf-8")
    print("TITAN_REAL_CROTCH_SOURCE_SEAM_PAIRING_UNAPPROVED", json.dumps({
        "leftEdges": len(forward),
        "rightEdges": len(backward),
        "mutualNearestPairs": len(mutual),
        "leftToRight": report["nearestEdgeMidpointDistanceMm"]["leftToRight"],
        "rightToLeft": report["nearestEdgeMidpointDistanceMm"]["rightToLeft"],
        "productionApproved": False,
    }, allow_nan=False))


if __name__ == "__main__":
    main()
