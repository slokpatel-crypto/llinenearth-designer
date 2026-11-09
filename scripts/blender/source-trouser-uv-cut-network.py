"""Measure actual original-source UV cut network, never approve physical fabric.

Consumes the true 2,650 original trouser source face cycles, actual source 3D
mesh points, and separate research-only UV loops. UV discontinuities are
*proposed chart cuts*, NOT physical cutting/sewing lines, grain direction,
factory seam allowances, or certified fabric texture scale.
"""
from __future__ import annotations

from collections import Counter, defaultdict
import math


def audit_original_source_uv_cut_network(
        points, original_faces, face_uv_loops, original_cut_edges, tree_report):
    if (len(original_faces) != 2650 or len(face_uv_loops) != 2650
            or len(original_cut_edges) != 8):
        raise ValueError("Actual original 2650-face trouser source and eight cut edges required.")
    vertices = []
    for point in points:
        # Reject coercible source impostors before treating 3D coordinates as
        # native measured geometry (bool, numeric text, complex and null).
        if (len(point) != 3 or any(
                isinstance(v, bool) or not isinstance(v, (int, float))
                or not math.isfinite(v) for v in point)):
            raise ValueError("Original trouser mesh has an unknown nonfinite source point.")
        vertices.append(tuple(float(v) for v in point))
    if not vertices:
        raise ValueError("Original trouser mesh cannot be empty.")
    owners = defaultdict(list)
    for face_id, (raw_face, raw_uv) in enumerate(zip(original_faces, face_uv_loops)):
        # Face vertex IDs are exact source topology, not coercible labels.
        if (len(raw_face) != 4 or any(
                type(i) is not int or i < 0 or i >= len(vertices)
                for i in raw_face) or len(set(raw_face)) != 4
                or len(raw_uv) != 4):
            raise ValueError("Actual source quad or UV loops are not four finite original corners.")
        face = tuple(raw_face)
        coord = []
        for uv in raw_uv:
            if (len(uv) != 2 or any(
                    isinstance(k, bool) or not isinstance(k, (int, float))
                    or not math.isfinite(k) for k in uv)):
                raise ValueError("Actual source quad or UV loops are not four finite original corners.")
            coord.append(tuple(float(k) for k in uv))
        for i in range(4):
            a, b = face[i], face[(i + 1) % 4]
            key = (min(a, b), max(a, b))
            endpoints = (coord[i], coord[(i + 1) % 4])
            if (a, b) != key:
                endpoints = endpoints[::-1]
            owners[key].append((face_id, endpoints))
    if any(len(value) > 2 for value in owners.values()):
        raise ValueError("Original source UV has more than two owners for a real edge.")

    if any(
            len(edge) != 2 or any(type(i) is not int or i < 0 for i in edge)
            for edge in original_cut_edges):
        raise ValueError("Original source crotch edge must contain literal integer vertex IDs.")
    original_cuts = {tuple(sorted(edge)) for edge in original_cut_edges}
    if len(original_cuts) != 8 or any(
            edge[0] == edge[1]
            or len(owners.get(edge, [])) != 1 for edge in original_cuts):
        raise ValueError("Original source actual crotch cut-edge provenance is invalid.")
    shared_edges = sum(len(v) == 2 for v in owners.values())
    boundary_edges = sum(len(v) == 1 for v in owners.values())
    if (shared_edges != tree_report["sharedOriginalSourceEdgeCount"]
            or boundary_edges != tree_report["openSourceBoundaryEdgeCount"]
            or len(original_cuts) != tree_report["originalSourceCutEdgeCount"]):
        raise ValueError("Native UV cut source must share exact verified original topology.")

    uv_unclosed = []
    continuous_shared_edges = 0
    max_uv_gap_mm = 0.0
    for (a, b), rows in owners.items():
        if len(rows) != 2:
            continue
        (_face_1, (first_a, first_b)), (_face_2, (second_a, second_b)) = rows
        gap_mm = max(
            math.dist(first_a, second_a),
            math.dist(first_b, second_b),
        ) * 1000.0
        if not math.isfinite(gap_mm) or gap_mm < 0:
            raise ValueError("Original UV shared source edge has nonfinite seam mismatch.")
        if gap_mm <= 0.001:
            continuous_shared_edges += 1
        else:
            real_mm = math.dist(vertices[a], vertices[b]) * 1000.0
            if not math.isfinite(real_mm) or real_mm <= 1e-6:
                raise ValueError("Original source UV cut candidate is not a real 3D edge.")
            uv_unclosed.append((gap_mm, real_mm, a, b))
            max_uv_gap_mm = max(max_uv_gap_mm, gap_mm)

    if (len(uv_unclosed) != tree_report["nonTreeCycleUnclosedUvEdges"]
            or continuous_shared_edges !=
            (tree_report["verifiedTreeConnectedSharedEdges"] +
             tree_report["nonTreeCycleEdgesWithinOneMicrometre"])
            or continuous_shared_edges + len(uv_unclosed) != shared_edges):
        raise ValueError("UV seam-cut network did not match measured spanning forest.")

    # Geometric cut-candidate graph can contain arbitrary junctions; measure
    # them explicitly. A high-branch cut graph is NOT a shop-floor cutting path.
    cut_graph = defaultdict(set)
    total_cut_mm = 0.0
    for _gap_mm, real_mm, a, b in uv_unclosed:
        cut_graph[a].add(b)
        cut_graph[b].add(a)
        total_cut_mm += real_mm
    degrees = Counter(len(neighbours) for neighbours in cut_graph.values())
    unseen = set(cut_graph)
    network_components = []
    original_boundary_vertices = {
        v for edge, rows in owners.items()
        if len(rows) == 1 for v in edge
    }
    while unseen:
        root = min(unseen)
        queue = [root]
        unseen.remove(root)
        component_vertices = []
        while queue:
            current = queue.pop()
            component_vertices.append(current)
            for nxt in sorted(cut_graph[current]):
                if nxt in unseen:
                    unseen.remove(nxt)
                    queue.append(nxt)
        component_set = set(component_vertices)
        component_edges = sum(
            1 for _gap, _length, a, b in uv_unclosed
            if a in component_set and b in component_set
        )
        network_components.append({
            "originalSourceVertexCount": len(component_set),
            "unclosedUvEdgeCount": component_edges,
            "touchesActualOriginalOpenBoundary": bool(
                component_set.intersection(original_boundary_vertices)
            ),
            "degreeOneSourceVertices": sum(len(cut_graph[v]) == 1
                                          for v in component_vertices),
            "branchingSourceVertices": sum(len(cut_graph[v]) >= 3
                                          for v in component_vertices),
        })
    network_components.sort(
        key=lambda row: (
            -row["unclosedUvEdgeCount"], -row["originalSourceVertexCount"],
            row["degreeOneSourceVertices"],
        )
    )
    first = sorted(
        uv_unclosed, key=lambda v: (-v[0], v[2], v[3])
    )[:12]
    boundary_mm = sum(
        math.dist(vertices[a], vertices[b]) * 1000.0
        for (a, b), rows in owners.items() if len(rows) == 1
    )
    real_cut_mm = sum(
        math.dist(vertices[a], vertices[b]) * 1000.0
        for a, b in original_cuts
    )
    report = {
        "researchOnly": True,
        "actualOriginalSourceQuadCount": len(original_faces),
        "originalSourceVertexCount": len(vertices),
        "originalSourceUvLoopCount": sum(len(x) for x in face_uv_loops),
        "originalSharedSourceEdgeCount": shared_edges,
        "originalOpenSourceBoundaryEdges": boundary_edges,
        "genuineCrotchCutEdgeCount": len(original_cuts),
        "joinedSharedUvEdges": continuous_shared_edges,
        "unclosedSharedUvCutCandidateEdges": len(uv_unclosed),
        "unclosedUvCutCandidateFraction": round(
            len(uv_unclosed) / shared_edges, 8
        ) if shared_edges else 0.0,
        "totalRealGeometryOfUvCutCandidatesMm": round(total_cut_mm, 5),
        "allOriginalSourceBoundaryGeometryMm": round(boundary_mm, 5),
        "genuineOriginalCrotchCutEdgesGeometryMm": round(real_cut_mm, 5),
        "maximumUnclosedUvEdgeGapMm": round(max_uv_gap_mm, 5),
        "uvCutCandidateSourceVertexCount": len(cut_graph),
        "uvCutCandidateDegreeHistogram": {
            str(i): degrees[i] for i in sorted(degrees)
        },
        "uvCutCandidateDegreeOneSourceVertices": degrees[1],
        "uvCutCandidateDegreeThreePlusSourceVertices": sum(
            count for degree, count in degrees.items() if degree >= 3
        ),
        "uvCutCandidateGraphComponentCount": len(network_components),
        "uvCutCandidateGraphLargestComponents": network_components[:12],
        "actualLargestGapUvCutEdges": [
            {
                "originalSourceEdgeVertexIndices": [a, b],
                "sourceRealEdgeLengthMm": round(length, 5),
                "provisionalUvEndpointGapMm": round(gap, 5),
            }
            for gap, length, a, b in first
        ],
        "seamCutTopologyApproved": False,
        "realTailorCutLinesApproved": False,
        "originalBodyFitApproved": False,
        "sourcePanelUVContinuityVerified": False,
        "fabricGrainAndRepeatVerified": False,
        "measuredSupplierTextileRepeatMm": None,
        "productionApproved": False,
        "metricCaveat": (
            "Proposed cuts are UV discontinuities in a REAL source-face "
            "dual-tree geometry witness; their 3D lengths are mesh units, "
            "not sewn garment cut/seam paths. Topology branching, overlaps, "
            "physical cloth, grain, fit and fabric scale are unverified."
        ),
    }
    for scalar in (
        total_cut_mm, boundary_mm, real_cut_mm, max_uv_gap_mm
    ):
        if not math.isfinite(scalar) or scalar < 0:
            raise ValueError("Original source UV cut metric is nonfinite.")
    return report
