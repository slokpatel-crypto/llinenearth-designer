"""Measure actual original-source UV cut network, never approve physical fabric.

Consumes the true 2,650 original trouser source face cycles, actual source 3D
mesh points, and separate research-only UV loops. UV discontinuities are
*proposed chart cuts*, NOT physical cutting/sewing lines, grain direction,
factory seam allowances, or certified fabric texture scale.
"""
from __future__ import annotations

from collections import Counter, defaultdict
import math


def classify_original_source_uv_cut_component(
        cut_graph, component_vertices, original_boundary_vertices):
    """Classify connected ORIGINAL source-edge UV cuts, not sewing lines.

    A component's cycle rank E-V+1 is independent of a UV chart's placement.
    A connected simple path has two degree-one ends and no junction; a
    connected simple loop has all degree two and one graph cycle. All other
    networks require more than one unbranched panel-edge path to represent.
    These are graph facts, not textile grain/cut/fit approvals.
    """
    component = set(component_vertices)
    if not component or len(component) != len(component_vertices):
        raise ValueError("Original UV cut graph component must have unique source vertices.")
    for vertex in component:
        neighbours = cut_graph[vertex]
        if vertex in neighbours or any(
                n not in component or vertex not in cut_graph[n]
                for n in neighbours):
            raise ValueError("Original UV cut graph is not symmetric or connected.")
    # Euler's E - V + 1 formula is valid for CONNECTED components only.
    # A disconnected path plus a closed loop can otherwise imitate one
    # simple-open-path (2 ends, zero apparent cycles, no junctions).
    visited = {min(component)}
    pending = [min(component)]
    while pending:
        for neighbor in cut_graph[pending.pop()]:
            if neighbor not in visited:
                visited.add(neighbor)
                pending.append(neighbor)
    if visited != component:
        raise ValueError("Original UV cut graph component is disconnected.")
    total_degrees = sum(len(cut_graph[v]) for v in component)
    if total_degrees % 2:
        raise ValueError("Original UV cut graph has unmatched source-edge owners.")
    edges = total_degrees // 2
    cycle_rank = edges - len(component) + 1
    if edges < 1 or cycle_rank < 0:
        raise ValueError("Original source UV cut component has invalid Euler rank.")
    ends = [v for v in component if len(cut_graph[v]) == 1]
    branches = sum(len(cut_graph[v]) >= 3 for v in component)
    touching = sum(v in original_boundary_vertices for v in component)
    internal_ends = sum(v not in original_boundary_vertices for v in ends)
    if len(ends) == 2 and branches == 0 and cycle_rank == 0:
        shape = "simple-open-path"
    elif not ends and branches == 0 and cycle_rank == 1:
        shape = "simple-closed-loop"
    else:
        shape = "branched-or-compound"
    return {
        "originalSourceVertexCount": len(component),
        "unclosedUvEdgeCount": edges,
        "touchesActualOriginalOpenBoundary": touching > 0,
        "originalBoundaryContactSourceVertexCount": touching,
        "degreeOneSourceVertices": len(ends),
        "interiorDegreeOneSourceVertices": internal_ends,
        "branchingSourceVertices": branches,
        "uvCutGraphCycleRank": cycle_rank,
        "uvCutGraphTopology": shape,
    }


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
        network_components.append(
            classify_original_source_uv_cut_component(
                cut_graph, component_vertices, original_boundary_vertices
            )
        )
    network_components.sort(
        key=lambda row: (
            -row["unclosedUvEdgeCount"], -row["originalSourceVertexCount"],
            row["degreeOneSourceVertices"],
        )
    )
    # Source 3D evidence for the worst graph junctions, not seam guidance.
    # Keep original vertex IDs and actual source point coordinates; do not
    # infer garment grain, body clearance or real tailor cut locations.
    actual_cut_vertices = {index for edge in original_cuts for index in edge}
    junction_rows = []
    for source_vertex, neighbours in cut_graph.items():
        if len(neighbours) < 3:
            continue
        incident_mm = sum(
            math.dist(vertices[source_vertex], vertices[other]) * 1000.0
            for other in neighbours
        )
        if not math.isfinite(incident_mm) or incident_mm <= 0:
            raise ValueError("Original source UV branch has invalid incident edge geometry.")
        junction_rows.append({
            "originalSourceVertexIndex": source_vertex,
            "sourceUvCutGraphDegree": len(neighbours),
            "realOriginalSourcePositionMm": [
                round(value * 1000.0, 5) for value in vertices[source_vertex]
            ],
            "incidentOriginalSourceCutEdgeLengthMm": round(incident_mm, 5),
            "touchesActualOriginalOpenBoundary":
                source_vertex in original_boundary_vertices,
            "touchesGenuineOriginalCrotchCut":
                source_vertex in actual_cut_vertices,
        })
    junction_rows.sort(key=lambda row: (
        -row["sourceUvCutGraphDegree"],
        -row["incidentOriginalSourceCutEdgeLengthMm"],
        row["originalSourceVertexIndex"],
    ))
    if len(junction_rows) != sum(
            count for degree, count in degrees.items() if degree >= 3):
        raise ValueError("Original source UV cut junction inventory is inconsistent.")
    cut_shape_counts = Counter(
        row["uvCutGraphTopology"] for row in network_components
    )
    cut_cycle_rank = len(uv_unclosed) - len(cut_graph) + len(network_components)
    if (cut_cycle_rank != sum(
            row["uvCutGraphCycleRank"] for row in network_components)
            or cut_cycle_rank < 0
            or sum(cut_shape_counts.values()) != len(network_components)
            or sum(row["unclosedUvEdgeCount"]
                   for row in network_components) != len(uv_unclosed)
            or sum(row["originalSourceVertexCount"]
                   for row in network_components) != len(cut_graph)):
        raise ValueError("Original UV cut graph failed independent Euler accounting.")
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
        "uvCutGraphCycleRank": cut_cycle_rank,
        "uvCutGraphSimpleOpenPathComponentCount":
            cut_shape_counts["simple-open-path"],
        "uvCutGraphSimpleClosedLoopComponentCount":
            cut_shape_counts["simple-closed-loop"],
        "uvCutGraphBranchedOrCompoundComponentCount":
            cut_shape_counts["branched-or-compound"],
        "uvCutGraphInteriorDegreeOneSourceVertexCount": sum(
            row["interiorDegreeOneSourceVertices"]
            for row in network_components
        ),
        "uvCutGraphComponentsWithoutActualOriginalOpenBoundary": sum(
            not row["touchesActualOriginalOpenBoundary"]
            for row in network_components
        ),
        "uvCutGraphMaximumJunctionDegree": max(
            (row["sourceUvCutGraphDegree"] for row in junction_rows),
            default=0,
        ),
        "uvCutGraphJunctionsOnActualOriginalBoundary": sum(
            row["touchesActualOriginalOpenBoundary"] for row in junction_rows
        ),
        "uvCutGraphJunctionsOnGenuineOriginalCrotchCut": sum(
            row["touchesGenuineOriginalCrotchCut"] for row in junction_rows
        ),
        "actualLargestOriginalSourceUvCutJunctions": junction_rows[:12],
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
