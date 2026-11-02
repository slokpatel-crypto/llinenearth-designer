# Read-only native research; inspect original open cut boundaries before Solidify.
"""Measure whether true final leg/leg BVH contacts cluster near selected-body seam boundaries.

This is a face-centroid distance proxy, NOT physical seam fit or a signed pattern.
No garment vertex is moved, sewn, hidden, rendered, exported or approved.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import math
from pathlib import Path
import runpy
import statistics
import sys

import bpy

IDENTITY = "linen-earth-studio-model-v1"
EXPORT = "LinenEarthExport"
RESEARCH = "TITAN_CrotchStageResearch"
LEGS = ("TrouserLegLFabric", "TrouserLegRFabric")
CUT_STAGE = "selectedBodyShell"
SEAM_HALF_WIDTH_M = 0.040
PROXIMITY_MM = (5, 20, 50)


def native_helpers():
    base = Path(__file__).with_name("diagnose-linen-earth-crotch.py")
    if not base.is_file():
        raise RuntimeError("Canonical Blender BVH measurement helper is missing.")
    source = runpy.run_path(str(base))
    return source["world_geometry"], source["real_tree"], source["center"]


def actual_centerline_source_segments(geom, center_x):
    edges = Counter()
    for face in geom["polygons"]:
        for a, b in zip(face, face[1:] + face[:1]):
            if a == b:
                raise RuntimeError("Degenerate selected-body cut-edge provenance.")
            edges[tuple(sorted((a, b)))] += 1
    if any(n > 2 for n in edges.values()):
        raise RuntimeError("Nonmanifold original cut-surface topology; cannot infer seam boundary.")
    all_open = [key for key, n in edges.items() if n == 1]
    seam = [
        (geom["points"][a], geom["points"][b])
        for a, b in all_open
        if abs((geom["points"][a].x + geom["points"][b].x) / 2.0 - center_x)
        <= SEAM_HALF_WIDTH_M
    ]
    if not all_open or not seam:
        raise RuntimeError("Missing actual source cut-boundary edges near centerline.")
    return {"allOpenBoundaryEdges": len(all_open), "nearCenterlineBoundaryEdges": len(seam)}, seam


def nearest_segment_distance_mm(point, segments):
    nearest = float("inf")
    for start, end in segments:
        delta = end - start
        squared = delta.length_squared
        fraction = max(0.0, min(1.0, (point - start).dot(delta) / squared)) if squared > 1e-16 else 0.0
        distance = (point - (start + fraction * delta)).length * 1000.0
        if distance < nearest:
            nearest = distance
    if not math.isfinite(nearest):
        raise RuntimeError("Crotch seam locality cannot be measured with finite geometry.")
    return nearest


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)

    scene = bpy.context.scene
    if (scene.get("linen_earth_model_identity_id") != IDENTITY
            or scene.get("linen_earth_model_identity_locked") is not True
            or scene.get("linen_earth_research_crotch_stages_emitted") is not True):
        raise RuntimeError("Only the identity-locked actual selected-body stage is valid research input.")
    export = bpy.data.collections.get(EXPORT)
    research = bpy.data.collections.get(RESEARCH)
    body = bpy.data.objects.get("Body")
    if export is None or research is None or body is None or len(research.objects) != 8:
        raise RuntimeError("Missing original six-panel garment, body or eight native stage snapshots.")

    world_geometry, real_tree, center = native_helpers()
    geometry = [world_geometry(export.objects.get(name)) for name in LEGS]
    contact = real_tree(geometry[0]).overlap(real_tree(geometry[1]))
    if not contact:
        raise RuntimeError("Original seam diagnostic expected actual nonzero rejected BVH contacts.")

    body_geom = world_geometry(body)
    center_x = (min(v.x for v in body_geom["points"]) + max(v.x for v in body_geom["points"])) / 2.0
    boundaries, seams = [], []
    for name in LEGS:
        source = research.objects.get(f"TITAN_RESEARCH_{CUT_STAGE}_{name}")
        if (source is None or source.type != "MESH" or source.get("candidateOnly") is not True
                or source.get("productionApproved") is not False
                or source.get("sourceStage") != CUT_STAGE):
            raise RuntimeError("Unverified source cut stage; refusing invented seam evidence.")
        info, segments = actual_centerline_source_segments(world_geometry(source), center_x)
        boundaries.append(info)
        seams.append(segments)

    bins = {str(mm): {"bothLegFacesNear": 0, "eitherLegFaceNear": 0} for mm in PROXIMITY_MM}
    distances = [[], []]
    for li, ri in contact:
        if li < 0 or ri < 0 or li >= len(geometry[0]["polygons"]) or ri >= len(geometry[1]["polygons"]):
            raise RuntimeError("Native source reports an invalid final garment contact face.")
        delta = [
            nearest_segment_distance_mm(center(geometry[side], face), seams[side])
            for side, face in enumerate((li, ri))
        ]
        for side in (0, 1):
            distances[side].append(delta[side])
        for mm in PROXIMITY_MM:
            bins[str(mm)]["bothLegFacesNear"] += int(all(d <= mm for d in delta))
            bins[str(mm)]["eitherLegFaceNear"] += int(any(d <= mm for d in delta))

    count = len(contact)
    for counts in bins.values():
        if not 0 <= counts["bothLegFacesNear"] <= counts["eitherLegFaceNear"] <= count:
            raise RuntimeError("Source seam proximity contact partition was inconsistent.")
    for earlier, later in zip(PROXIMITY_MM, PROXIMITY_MM[1:]):
        if bins[str(earlier)]["bothLegFacesNear"] > bins[str(later)]["bothLegFacesNear"]:
            raise RuntimeError("Source seam proximity bins are not monotonic.")
    report = {
        "version": "titan-crotch-actual-source-seam-proximity-v1",
        "modelIdentityId": IDENTITY,
        "candidateOnly": True,
        "productionApproved": False,
        "changesProductionGeometry": False,
        "physicalFitApproved": False,
        "metricCaveat": "Distances use actual FINAL contacting face centroids to nearest ORIGINAL open cut edge within 40mm centerline band; not true contact-point penetration, sewing specification or seam approval.",
        "actualFinalLegLegBVHPairs": count,
        "actualSourceBoundaryEdges": dict(zip(("left", "right"), boundaries)),
        "contactFaceCentroidToOriginalCutMm": {
            side: {"minimum": round(min(vals), 3), "median": round(statistics.median(vals), 3),
                   "maximum": round(max(vals), 3), "count": len(vals)}
            for side, vals in zip(("left", "right"), distances)
        },
        "contactPairProximityBinsMm": bins,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print("TITAN_REAL_CROTCH_SOURCE_SEAM_PROXIMITY", json.dumps(report, allow_nan=False))


if __name__ == "__main__":
    main()
