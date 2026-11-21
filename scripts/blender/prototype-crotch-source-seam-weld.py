# Native Blender research only: join source seam vertices into an isolated trial.
"""Weld only genuinely coincident original cut-edge vertices; never author an approved garment."""
from __future__ import annotations

import argparse
from collections import Counter
import json
import math
from pathlib import Path
import runpy
import sys

import bpy

IDENTITY = "linen-earth-studio-model-v1"
STAGE = "selectedBodyShell"
LEGS = ("TrouserLegLFabric", "TrouserLegRFabric")
TOLERANCE_M = 0.0005
CENTRE_BAND_M = 0.040
TRIAL_NAME = "TITAN_RESEARCH_CrotchSourceWeldOnly"


def edge_topology(faces):
    incidence = Counter()
    for face in faces:
        if len(face) < 3 or len(set(face)) != len(face):
            raise RuntimeError("Source/candidate has a degenerate or repeated-index face.")
        for a, b in zip(face, face[1:] + face[:1]):
            incidence[tuple(sorted((a, b)))] += 1
    if any(n > 2 for n in incidence.values()):
        raise RuntimeError("Nonmanifold source/candidate seam: more than two faces own an edge.")
    return [edge for edge, n in incidence.items() if n == 1], incidence


def original_inner_cut_edges(geom, centre_x):
    open_edges, _ = edge_topology(geom["polygons"])
    seam = [
        (a, b) for a, b in open_edges
        if abs((geom["points"][a].x + geom["points"][b].x) / 2.0 - centre_x)
        <= CENTRE_BAND_M
    ]
    if not seam:
        raise RuntimeError("Cannot weld without genuine original open cut-edge geometry.")
    return open_edges, seam


def reciprocal_real_vertex_matches(left, right, left_cut, right_cut):
    l_indices = sorted({index for edge in left_cut for index in edge})
    r_indices = sorted({index for edge in right_cut for index in edge})
    if not l_indices or not r_indices:
        raise RuntimeError("Native source cut vertices are missing.")
    # Independent closest vertex on each original border, then reciprocal only.
    def nearest(vertices, source, point):
        return min(((point - source[i]).length, i) for i in vertices)
    l_to_r = {
        li: nearest(r_indices, right["points"], left["points"][li])
        for li in l_indices
    }
    r_to_l = {
        ri: nearest(l_indices, left["points"], right["points"][ri])
        for ri in r_indices
    }
    welded = {}
    distances = []
    for li, (distance, ri) in l_to_r.items():
        reverse_distance, reverse_li = r_to_l[ri]
        if (reverse_li != li or distance > TOLERANCE_M
                or reverse_distance > TOLERANCE_M):
            continue
        if not math.isfinite(distance):
            raise RuntimeError("Nonfinite source vertex correspondence.")
        if ri in welded:
            raise RuntimeError("Ambiguous source weld vertex correspondence.")
        welded[ri] = li
        distances.append(distance * 1000)
    if not welded:
        raise RuntimeError("No actual reciprocal source seam vertex pair within 0.5mm.")
    return welded, distances


def make_research_only_mesh(left, right, right_to_left):
    vertices = [v.copy() for v in left["points"]]
    right_map = {}
    for ri, point in enumerate(right["points"]):
        if ri in right_to_left:
            right_map[ri] = right_to_left[ri]
        else:
            right_map[ri] = len(vertices)
            vertices.append(point.copy())
    polygons = [tuple(face) for face in left["polygons"]]
    polygons += [
        tuple(right_map[i] for i in face) for face in right["polygons"]
    ]
    before_open_l, _ = edge_topology(left["polygons"])
    before_open_r, _ = edge_topology(right["polygons"])
    after_open, incidence = edge_topology(polygons)
    if len(after_open) >= len(before_open_l) + len(before_open_r):
        raise RuntimeError("Actual source seam did not reduce boundary edges.")
    if any(not all(math.isfinite(v) for v in p) for p in vertices):
        raise RuntimeError("Nonfinite experimental sewn-source vertices.")
    mesh = bpy.data.meshes.new("TITAN_RESEARCH_CrotchSourceWeldMesh")
    mesh.from_pydata(vertices, [], polygons)
    mesh.update(calc_edges=True)
    if (len(mesh.polygons) != len(polygons)
            or sum(p.area <= 1e-12 or not math.isfinite(p.area) for p in mesh.polygons)):
        raise RuntimeError("Experimental seam produced zero-area/nonfinite physical faces.")
    if bpy.data.objects.get(TRIAL_NAME) is not None:
        raise RuntimeError("Do not overwrite previous source seam research.")
    obj = bpy.data.objects.new(TRIAL_NAME, mesh)
    obj.hide_render = True
    obj["candidateOnly"] = True
    obj["productionApproved"] = False
    obj["physicalFitApproved"] = False
    obj["sourceStage"] = STAGE
    research = bpy.data.collections.get("TITAN_CrotchStageResearch")
    research.objects.link(obj)
    if obj.name in bpy.data.collections["LinenEarthExport"].objects:
        raise RuntimeError("Unapproved experimental mesh was added to production garment export.")
    return {
        "leftBeforeOpenEdges": len(before_open_l),
        "rightBeforeOpenEdges": len(before_open_r),
        "afterWeldOpenEdges": len(after_open),
        "closedBoundaryEdges": len(before_open_l) + len(before_open_r) - len(after_open),
        "nonManifoldEdges": sum(n > 2 for n in incidence.values()),
        "degenerateFaces": sum(p.area <= 1e-12 for p in mesh.polygons),
        "combinedFaceCount": len(mesh.polygons),
        "combinedVertexCount": len(mesh.vertices),
    }


def main():
    cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(cli)
    scene = bpy.context.scene
    if (scene.get("linen_earth_model_identity_id") != IDENTITY
            or scene.get("linen_earth_model_identity_locked") is not True
            or scene.get("linen_earth_research_crotch_stages_emitted") is not True):
        raise RuntimeError("Only original locked model's eight real source research-stage meshes are valid.")
    research = bpy.data.collections.get("TITAN_CrotchStageResearch")
    export = bpy.data.collections.get("LinenEarthExport")
    body = bpy.data.objects.get("Body")
    if research is None or export is None or body is None or len(research.objects) != 8:
        raise RuntimeError("Source research stage, six-panel export or original body missing.")
    source = runpy.run_path(str(Path(__file__).with_name("diagnose-linen-earth-crotch.py")))
    geom = source["world_geometry"]
    body_points = geom(body)["points"]
    centre_x = (min(v.x for v in body_points) + max(v.x for v in body_points)) / 2
    source_geometries = []
    for name in LEGS:
        original = export.objects.get(name)
        mesh = research.objects.get(f"TITAN_RESEARCH_{STAGE}_{name}")
        if (original is None or mesh is None or mesh.type != "MESH"
                or mesh.get("candidateOnly") is not True
                or mesh.get("productionApproved") is not False
                or mesh.get("sourceStage") != STAGE):
            raise RuntimeError("Source-seam correspondence did not come from actual body cut geometry.")
        source_geometries.append(geom(mesh))
    left, right = source_geometries
    left_open, left_cut = original_inner_cut_edges(left, centre_x)
    right_open, right_cut = original_inner_cut_edges(right, centre_x)
    if len(left_cut) != 14 or len(right_cut) != 14:
        raise RuntimeError("Actual pinned-source cut topology changed; do not forge a 14-edge weld.")
    correspondence, distances = reciprocal_real_vertex_matches(left, right, left_cut, right_cut)
    left_edges = {tuple(sorted(edge)) for edge in left_cut}
    right_edges = {tuple(sorted(edge)) for edge in right_cut}
    sewn_edges = sum(
        tuple(sorted((correspondence[a], correspondence[b]))) in left_edges
        for a, b in right_edges if a in correspondence and b in correspondence
    )
    if sewn_edges == 0:
        raise RuntimeError("Source cut vertices matched but no genuine paired boundary segment was welded.")
    counts = make_research_only_mesh(left, right, correspondence)
    if counts["closedBoundaryEdges"] != 2 * sewn_edges or counts["nonManifoldEdges"] != 0:
        raise RuntimeError("Source-seam welding created invalid or mismatched edge topology.")
    report = {
        "version": "titan-actual-crotch-source-weld-research-v1",
        "modelIdentityId": IDENTITY,
        "candidateOnly": True,
        "productionApproved": False,
        "physicalFitApproved": False,
        "changesProductionGeometry": False,
        "sewnGarmentApproved": False,
        "metricCaveat": "Welds only reciprocal original cut-stage vertices within 0.5mm on an isolated unsaved mesh; not final thick cloth, stitch allowance, closure of remaining edges, body clearance, fit or UV.",
        "originalInnerOpenCutEdges": {"left": len(left_cut), "right": len(right_cut)},
        "originalOpenBoundaryEdges": {"left": len(left_open), "right": len(right_open)},
        "reciprocalWeldedSourceVertices": len(correspondence),
        "actualJoinedInnerCutEdges": sewn_edges,
        "weldVertexDistanceMm": {
            "minimum": round(min(distances), 4),
            "maximum": round(max(distances), 4),
        },
        "researchOnlyCombinedMesh": counts,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print("TITAN_REAL_ORIGINAL_CROTCH_SOURCE_SEAM_WELD_TRIAL_UNAPPROVED", json.dumps(report, allow_nan=False))


if __name__ == "__main__":
    main()
