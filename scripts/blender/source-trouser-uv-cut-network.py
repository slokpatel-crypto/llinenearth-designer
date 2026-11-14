"""Measure actual original-source UV cut network, never approve physical fabric.

Consumes the true 2,650 original trouser source face cycles, actual source 3D
mesh points, and separate research-only UV loops. UV discontinuities are
*proposed chart cuts*, NOT physical cutting/sewing lines, grain direction,
factory seam allowances, or certified fabric texture scale.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from itertools import combinations
import math


def best_fit_original_source_uv_edge_translation(offset_0, offset_1):
    """Optimal rigid translation for the two actual source UV edge endpoints.

    The mean of two signed offsets minimises sum-of-squared residuals;
    each residual norm is necessarily half the endpoint-vector drift.
    This is a single-edge research lower bound, NOT an approved UV chart.
    """
    for raw in (offset_0, offset_1):
        if (not hasattr(raw, "__len__") or len(raw) != 2 or any(
                isinstance(v, bool) or not isinstance(v, (int, float))
                or not math.isfinite(v) for v in raw)):
            raise ValueError("Actual UV source edge offsets require two finite numeric coordinates.")
    average = tuple(math.fsum((offset_0[i], offset_1[i])) / 2.0 for i in range(2))
    drift = math.dist(offset_0, offset_1)
    residual = math.dist(average, offset_0)
    if (not all(math.isfinite(v) for v in (*average, drift, residual))
            or abs(residual - drift / 2.0) > 0.0000001
            or abs(math.dist(average, offset_1) - residual) > 0.0000001):
        raise ValueError("Actual source UV edge translation lower bound is inconsistent.")
    return {
        "bestFitSingleRigidUvEdgeTranslationMm": [
            round(v, 5) for v in average
        ],
        "irreducibleSingleRigidTranslationEndpointResidualMm":
            round(residual, 5),
        "rigidTranslationCannotExactlyCloseBothEndpoints": drift > 0.000000001,
    }


def best_fit_original_source_uv_edge_rigid_alignment(owner_a, owner_b):
    """Optimal proper 2D rotation+translation for ONE real edge (mm).

    The oriented source edge's 2 endpoints must be aligned without mirror,
    scale or distortion. For edge lengths L_a and L_b, midpoint alignment
    after vector alignment leaves an unavoidable |L_a-L_b|/2 residual at
    EACH endpoint. No complete-chart closure or sewn panel is implied.
    """
    for owner in (owner_a, owner_b):
        if (not hasattr(owner, "__len__") or len(owner) != 2 or any(
                not hasattr(pt, "__len__") or len(pt) != 2
                or any(isinstance(v, bool) or not isinstance(v, (int, float))
                       or not math.isfinite(v) for v in pt)
                for pt in owner)):
            raise ValueError("Actual UV edge rigid alignment needs two finite 2D owner endpoints.")
    a0, a1 = (tuple(float(v) for v in pt) for pt in owner_a)
    b0, b1 = (tuple(float(v) for v in pt) for pt in owner_b)
    va = (a1[0] - a0[0], a1[1] - a0[1])
    vb = (b1[0] - b0[0], b1[1] - b0[1])
    la, lb = math.hypot(*va), math.hypot(*vb)
    if not all(math.isfinite(v) and v > 0.000000001 for v in (la, lb)):
        raise ValueError("Actual UV owner edge has zero or invalid metric length.")
    cos = (va[0] * vb[0] + va[1] * vb[1]) / (la * lb)
    sin = (vb[0] * va[1] - vb[1] * va[0]) / (la * lb)
    norm = math.hypot(cos, sin)
    if not math.isfinite(norm) or norm <= 0:
        raise ValueError("Actual UV owner edge rotation is not finite.")
    cos, sin = cos / norm, sin / norm
    a_center = tuple(math.fsum((a0[i], a1[i])) / 2 for i in range(2))
    b_center = tuple(math.fsum((b0[i], b1[i])) / 2 for i in range(2))
    bx = cos * b_center[0] - sin * b_center[1]
    by = sin * b_center[0] + cos * b_center[1]
    translation = (a_center[0] - bx, a_center[1] - by)
    residuals = []
    for a, b in ((a0, b0), (a1, b1)):
        aligned = (
            cos * b[0] - sin * b[1] + translation[0],
            sin * b[0] + cos * b[1] + translation[1],
        )
        residuals.append(math.dist(a, aligned))
    lower_bound = abs(la - lb) / 2
    if (not all(math.isfinite(v) for v in (*translation, *residuals, lower_bound))
            or abs(residuals[0] - lower_bound) > 0.0000001
            or abs(residuals[1] - lower_bound) > 0.0000001):
        raise ValueError("Actual source rigid UV alignment residual violated edge-length invariant.")
    return {
        "sourceUvOwnerEdgeLengthsMm": [round(la, 5), round(lb, 5)],
        "bestFitProperRigidUvRotationDegrees":
            round(math.degrees(math.atan2(sin, cos)), 6),
        "bestFitRigidUvTranslationMm": [round(v, 5) for v in translation],
        "irreducibleProperRigidAlignmentEndpointResidualMm":
            round(lower_bound, 5),
        "singleEdgeExactRigidClosurePossible": lower_bound <= 0.000000001,
        "sourceUvOriginalOwnerEdgeEndpointsMm": [
            [[round(v, 5) for v in p] for p in (a0, a1)],
            [[round(v, 5) for v in p] for p in (b0, b1)],
        ],
    }


def best_fit_original_source_uv_edge_similarity_alignment(owner_a, owner_b):
    """Exact proper similarity alignment for ONE real UV edge (mm).

    Unlike the rigid lower bound, this diagnostic permits one uniform scale
    factor. Two noncollapsed segments can therefore close exactly; the
    required scale departure from 1 is the measured distortion witness, not
    permission to stretch an original chart or a physical textile.
    """
    rigid = best_fit_original_source_uv_edge_rigid_alignment(owner_a, owner_b)
    a0, a1 = (tuple(float(v) for v in pt) for pt in owner_a)
    b0, b1 = (tuple(float(v) for v in pt) for pt in owner_b)
    la, lb = (math.dist(*owner) for owner in ((a0, a1), (b0, b1)))
    scale = la / lb
    if not math.isfinite(scale) or scale <= 0:
        raise ValueError("Actual source UV similarity scale is invalid.")
    va = (a1[0] - a0[0], a1[1] - a0[1])
    vb = (b1[0] - b0[0], b1[1] - b0[1])
    cos = (va[0] * vb[0] + va[1] * vb[1]) / (la * lb)
    sin = (vb[0] * va[1] - vb[1] * va[0]) / (la * lb)
    norm = math.hypot(cos, sin)
    cos, sin = cos / norm, sin / norm
    a_center = tuple(math.fsum((a0[i], a1[i])) / 2 for i in range(2))
    b_center = tuple(math.fsum((b0[i], b1[i])) / 2 for i in range(2))
    rotated_center = (
        scale * (cos * b_center[0] - sin * b_center[1]),
        scale * (sin * b_center[0] + cos * b_center[1]),
    )
    translation = tuple(a_center[i] - rotated_center[i] for i in range(2))
    residuals = []
    for a, b in ((a0, b0), (a1, b1)):
        aligned = (
            scale * (cos * b[0] - sin * b[1]) + translation[0],
            scale * (sin * b[0] + cos * b[1]) + translation[1],
        )
        residuals.append(math.dist(a, aligned))
    residual = max(residuals)
    if (not all(math.isfinite(v) for v in (*translation, *residuals))
            or residual > 0.0000001):
        raise ValueError("Actual source UV similarity alignment did not close its edge.")
    scale_change = abs(scale - 1.0)
    return {
        "sourceUvSimilarityScaleOwnerBToOwnerA": round(scale, 8),
        "sourceUvSimilarityScaleChangePercent": round(scale_change * 100.0, 6),
        "bestFitProperSimilarityUvRotationDegrees":
            rigid["bestFitProperRigidUvRotationDegrees"],
        "bestFitSimilarityUvTranslationMm": [round(v, 5) for v in translation],
        "singleEdgeSimilarityClosureResidualMm": round(residual, 8),
        "singleEdgeClosureRequiresUvScaleChange": scale_change > 0.000000001,
        "sourceUvSimilarityDistortionApproved": False,
    }


def trial_original_source_uv_junction_face_rigid_placement(
        original_faces, face_uv_loops, junction_vertex, incident_source_edges):
    """Close the largest exact subset of one junction by whole-face poses.

    This is a disposable research trial.  It moves complete UV owner faces by
    proper rigid transforms and never edits source geometry, stored UVs, or a
    Blender scene.  The exact subset search is deliberately limited to the
    supplied incident edges; callers still have to run whole-layout overlap
    and cut-network audits before interpreting the candidate.
    """
    if (len(original_faces) != len(face_uv_loops)
            or type(junction_vertex) is not int or junction_vertex < 0
            or not hasattr(incident_source_edges, "__len__")
            or len(incident_source_edges) < 3):
        raise ValueError("Junction face placement needs matching source faces and incident edges.")
    faces = []
    uvs = []
    owners = defaultdict(list)
    for face_id, (raw_face, raw_uv) in enumerate(zip(original_faces, face_uv_loops)):
        if (len(raw_face) != 4 or len(set(raw_face)) != 4
                or any(type(v) is not int or v < 0 for v in raw_face)
                or len(raw_uv) != 4):
            raise ValueError("Junction face placement requires literal source quads.")
        face = tuple(raw_face)
        uv = []
        for point in raw_uv:
            if (not hasattr(point, "__len__") or len(point) != 2
                    or any(isinstance(v, bool) or not isinstance(v, (int, float))
                           or not math.isfinite(v) for v in point)):
                raise ValueError("Junction face placement requires finite UV loops.")
            uv.append(tuple(float(v) for v in point))
        faces.append(face)
        uvs.append(uv)
        for corner in range(4):
            a, b = face[corner], face[(corner + 1) % 4]
            edge = (min(a, b), max(a, b))
            endpoints = (uv[corner], uv[(corner + 1) % 4])
            owners[edge].append((face_id, endpoints if (a, b) == edge else endpoints[::-1]))
    edges = []
    for raw_edge in incident_source_edges:
        if (not hasattr(raw_edge, "__len__") or len(raw_edge) != 2
                or any(type(v) is not int or v < 0 for v in raw_edge)):
            raise ValueError("Junction face placement requires literal source edges.")
        edge = tuple(sorted(raw_edge))
        if (edge[0] == edge[1] or junction_vertex not in edge
                or edge in edges or len(owners.get(edge, ())) != 2):
            raise ValueError("Junction face placement edge provenance is invalid.")
        edges.append(edge)
    edges.sort()

    # A pose is (angle radians, tx, ty), mapping original UV to candidate UV.
    def apply(pose, point):
        angle, tx, ty = pose
        cos, sin = math.cos(angle), math.sin(angle)
        return (cos * point[0] - sin * point[1] + tx,
                sin * point[0] + cos * point[1] + ty)

    def compose(left, right):
        """Return left(right(point))."""
        angle = left[0] + right[0]
        rotated_translation = apply((left[0], left[1], left[2]),
                                    (right[1], right[2]))
        return (angle, rotated_translation[0], rotated_translation[1])

    def inverse(pose):
        angle, tx, ty = pose
        cos, sin = math.cos(angle), math.sin(angle)
        return (-angle, -cos * tx - sin * ty, sin * tx - cos * ty)

    relations = {}
    for edge in edges:
        (face_a, owner_a), (face_b, owner_b) = owners[edge]
        if face_a > face_b:
            face_a, face_b, owner_a, owner_b = face_b, face_a, owner_b, owner_a
        rigid = best_fit_original_source_uv_edge_rigid_alignment(owner_a, owner_b)
        if not rigid["singleEdgeExactRigidClosurePossible"]:
            raise ValueError("Junction owner edge lengths cannot close rigidly.")
        a0, a1 = owner_a
        b0, b1 = owner_b
        va = (a1[0] - a0[0], a1[1] - a0[1])
        vb = (b1[0] - b0[0], b1[1] - b0[1])
        angle = math.atan2(va[1], va[0]) - math.atan2(vb[1], vb[0])
        cos, sin = math.cos(angle), math.sin(angle)
        translation = (
            a0[0] - (cos * b0[0] - sin * b0[1]),
            a0[1] - (sin * b0[0] + cos * b0[1]),
        )
        relations[edge] = (
            face_a, face_b,
            (angle, *translation),
        )

    def solve(subset):
        adjacency = defaultdict(list)
        for edge in subset:
            face_a, face_b, b_to_a = relations[edge]
            adjacency[face_a].append((face_b, b_to_a))
            adjacency[face_b].append((face_a, inverse(b_to_a)))
        poses = {}
        for root in sorted(adjacency):
            if root in poses:
                continue
            poses[root] = (0.0, 0.0, 0.0)
            queue = [root]
            while queue:
                face = queue.pop(0)
                for neighbour, neighbour_to_face in sorted(adjacency[face]):
                    candidate = compose(poses[face], neighbour_to_face)
                    if neighbour not in poses:
                        poses[neighbour] = candidate
                        queue.append(neighbour)
                    else:
                        old = poses[neighbour]
                        if (abs(math.remainder(old[0] - candidate[0], 2 * math.pi)) > 1e-8
                                or math.dist(old[1:], candidate[1:]) > 1e-8):
                            return None
        return poses

    selected = None
    poses = None
    for size in range(len(edges), 0, -1):
        for subset in combinations(edges, size):
            candidate = solve(subset)
            if candidate is not None:
                selected, poses = tuple(subset), candidate
                break
        if selected is not None:
            break
    if selected is None:
        raise ValueError("Junction face placement could not solve any incident edge.")

    candidate_uvs = [list(row) for row in uvs]
    for face_id, pose in poses.items():
        candidate_uvs[face_id] = [apply(pose, point) for point in uvs[face_id]]

    def edge_gap(edge, layout):
        rows = []
        for face_id, endpoints in owners[edge]:
            face = faces[face_id]
            mapped = []
            for vertex in edge:
                mapped.append(layout[face_id][face.index(vertex)])
            rows.append(mapped)
        return max(math.dist(rows[0][i], rows[1][i]) for i in range(2))

    closed = [edge for edge in edges if edge_gap(edge, candidate_uvs) <= 1e-8]
    if tuple(closed) != selected:
        raise ValueError("Junction face placement exact closure set is inconsistent.")
    max_edge_change = 0.0
    for face_id, face in enumerate(faces):
        for tri in ((0, 1, 2), (0, 2, 3)):
            for a, b in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])):
                max_edge_change = max(max_edge_change, abs(
                    math.dist(uvs[face_id][a], uvs[face_id][b]) -
                    math.dist(candidate_uvs[face_id][a], candidate_uvs[face_id][b])
                ))
    shared = [edge for edge, rows in owners.items() if len(rows) == 2]
    baseline_unclosed = sum(edge_gap(edge, uvs) > 0.000001 for edge in shared)
    candidate_unclosed = sum(edge_gap(edge, candidate_uvs) > 0.000001 for edge in shared)
    return {
        "face_uv_loops": candidate_uvs,
        "report": {
            "researchOnly": True,
            "targetOriginalSourceVertex": junction_vertex,
            "incidentOriginalSourceEdges": [list(edge) for edge in edges],
            "maximumSimultaneouslyClosedIncidentEdges": len(closed),
            "closedIncidentOriginalSourceEdges": [list(edge) for edge in closed],
            "openIncidentOriginalSourceEdges": [list(edge) for edge in edges if edge not in closed],
            "candidateIncidentEdgeGapsMm": [
                {"originalSourceEdge": list(edge),
                 "candidateUvEndpointGapMm": round(edge_gap(edge, candidate_uvs) * 1000, 8)}
                for edge in edges
            ],
            "rigidlyMovedOriginalSourceFaceIds": sorted(poses),
            "maximumOriginalTriangleEdgeChangeMm": round(max_edge_change * 1000, 8),
            "baselineUnclosedSharedUvEdgeCount": baseline_unclosed,
            "candidateUnclosedSharedUvEdgeCount": candidate_unclosed,
            "unclosedSharedUvEdgeCountDelta": candidate_unclosed - baseline_unclosed,
            "sourceUvExportOrSavePerformed": False,
            "physicalPatternApproved": False,
            "productionApproved": False,
        },
    }


def trial_original_source_uv_junction_four_chart_split(
        original_faces, face_uv_loops, junction_vertex, incident_source_edges):
    """Split four owner quads through a junction, then close all four edges.

    Each target quad is represented by two research-only triangles divided by
    the junction-to-opposite diagonal.  The triangle adjacent to each incident
    edge receives its own proper-rigid pose.  This intentionally exposes the
    internal diagonal seams and collateral shared-edge changes required to
    close an inconsistent four-way cycle; it does not modify stored UVs.
    """
    if (len(original_faces) != len(face_uv_loops)
            or type(junction_vertex) is not int or junction_vertex < 0
            or not hasattr(incident_source_edges, "__len__")
            or len(incident_source_edges) != 4):
        raise ValueError("Four-chart split needs matching source faces and four incident edges.")
    faces = []
    uvs = []
    edge_faces = defaultdict(list)
    for face_id, (raw_face, raw_uv) in enumerate(zip(original_faces, face_uv_loops)):
        if (len(raw_face) != 4 or len(set(raw_face)) != 4
                or any(type(v) is not int or v < 0 for v in raw_face)
                or len(raw_uv) != 4):
            raise ValueError("Four-chart split requires literal source quads.")
        face = tuple(raw_face)
        uv = []
        for point in raw_uv:
            if (not hasattr(point, "__len__") or len(point) != 2
                    or any(isinstance(v, bool) or not isinstance(v, (int, float))
                           or not math.isfinite(v) for v in point)):
                raise ValueError("Four-chart split requires finite UV loops.")
            uv.append(tuple(float(v) for v in point))
        faces.append(face)
        uvs.append(tuple(uv))
        for corner in range(4):
            edge = tuple(sorted((face[corner], face[(corner + 1) % 4])))
            edge_faces[edge].append(face_id)
    if any(len(rows) > 2 for rows in edge_faces.values()):
        raise ValueError("Four-chart split source topology is nonmanifold.")
    edges = []
    for raw_edge in incident_source_edges:
        if (not hasattr(raw_edge, "__len__") or len(raw_edge) != 2
                or any(type(v) is not int or v < 0 for v in raw_edge)):
            raise ValueError("Four-chart split requires literal source edges.")
        edge = tuple(sorted(raw_edge))
        if (edge[0] == edge[1] or junction_vertex not in edge
                or edge in edges or len(edge_faces.get(edge, ())) != 2):
            raise ValueError("Four-chart split edge provenance is invalid.")
        edges.append(edge)
    edges.sort()
    target_faces = sorted({face_id for edge in edges for face_id in edge_faces[edge]})
    incidence = Counter(face_id for edge in edges for face_id in edge_faces[edge])
    if len(target_faces) != 4 or any(incidence[face_id] != 2 for face_id in target_faces):
        raise ValueError("Four-chart split requires one four-face incident cycle.")

    triangle_vertices = {}
    original_triangles = {}
    candidate_triangles = {}
    for face_id in target_faces:
        face = faces[face_id]
        if junction_vertex not in face:
            raise ValueError("Four-chart split target face lacks the source junction.")
        start = face.index(junction_vertex)
        order = tuple((start + offset) % 4 for offset in range(4))
        rotated_vertices = tuple(face[index] for index in order)
        rotated_uv = tuple(uvs[face_id][index] for index in order)
        triangle_vertices[face_id] = (
            (rotated_vertices[0], rotated_vertices[1], rotated_vertices[2]),
            (rotated_vertices[0], rotated_vertices[2], rotated_vertices[3]),
        )
        original_triangles[face_id] = (
            (rotated_uv[0], rotated_uv[1], rotated_uv[2]),
            (rotated_uv[0], rotated_uv[2], rotated_uv[3]),
        )
        candidate_triangles[face_id] = [
            list(original_triangles[face_id][0]),
            list(original_triangles[face_id][1]),
        ]

    def owner_triangle(face_id, edge, layout):
        matches = []
        for triangle_id, vertices in enumerate(triangle_vertices[face_id]):
            if all(vertex in vertices for vertex in edge):
                coordinates = layout[face_id][triangle_id]
                matches.append((triangle_id, tuple(
                    coordinates[vertices.index(vertex)] for vertex in edge
                )))
        if len(matches) != 1:
            raise ValueError("Four-chart split edge does not have one triangle owner.")
        return matches[0]

    def rigid_b_to_a(owner_a, owner_b):
        rigid = best_fit_original_source_uv_edge_rigid_alignment(owner_a, owner_b)
        if not rigid["singleEdgeExactRigidClosurePossible"]:
            raise ValueError("Four-chart split owner edge lengths cannot close rigidly.")
        va = (owner_a[1][0] - owner_a[0][0], owner_a[1][1] - owner_a[0][1])
        vb = (owner_b[1][0] - owner_b[0][0], owner_b[1][1] - owner_b[0][1])
        angle = math.atan2(va[1], va[0]) - math.atan2(vb[1], vb[0])
        cos, sin = math.cos(angle), math.sin(angle)
        translation = (
            owner_a[0][0] - (cos * owner_b[0][0] - sin * owner_b[0][1]),
            owner_a[0][1] - (sin * owner_b[0][0] + cos * owner_b[0][1]),
        )
        return angle, translation

    moved_triangles = set()
    for edge in edges:
        face_a, face_b = sorted(edge_faces[edge])
        _triangle_a, owner_a = owner_triangle(face_a, edge, original_triangles)
        triangle_b, owner_b = owner_triangle(face_b, edge, original_triangles)
        move_key = (face_b, triangle_b)
        if move_key in moved_triangles:
            raise ValueError("Four-chart split attempted to reuse one triangle pose.")
        moved_triangles.add(move_key)
        angle, translation = rigid_b_to_a(owner_a, owner_b)
        cos, sin = math.cos(angle), math.sin(angle)
        candidate_triangles[face_b][triangle_b] = [
            (cos * point[0] - sin * point[1] + translation[0],
             sin * point[0] + cos * point[1] + translation[1])
            for point in original_triangles[face_b][triangle_b]
        ]

    def boundary_owner(face_id, edge, layout):
        if face_id in target_faces:
            return owner_triangle(face_id, edge, layout)[1]
        face = faces[face_id]
        return tuple(uvs[face_id][face.index(vertex)] for vertex in edge)

    def shared_gap(edge, layout):
        face_a, face_b = edge_faces[edge]
        owner_a = boundary_owner(face_a, edge, layout)
        owner_b = boundary_owner(face_b, edge, layout)
        return max(math.dist(owner_a[index], owner_b[index]) for index in range(2))

    closed = [edge for edge in edges if shared_gap(edge, candidate_triangles) <= 1e-8]
    if closed != edges:
        raise ValueError("Four-chart split did not close all four incident edges.")
    internal_rows = []
    for face_id in target_faces:
        vertices = triangle_vertices[face_id]
        diagonal = (junction_vertex, vertices[0][2])
        endpoints = []
        for triangle_id in range(2):
            endpoints.append(tuple(
                candidate_triangles[face_id][triangle_id][
                    vertices[triangle_id].index(vertex)
                ] for vertex in diagonal
            ))
        gap = max(math.dist(endpoints[0][index], endpoints[1][index])
                  for index in range(2))
        internal_rows.append({
            "originalSourceFaceId": face_id,
            "splitDiagonalSourceVertices": list(diagonal),
            "candidateInternalDiagonalGapMm": round(gap * 1000, 8),
        })
    shared_edges = [edge for edge, rows in edge_faces.items() if len(rows) == 2]
    baseline_unclosed = sum(
        max(math.dist(
            tuple(uvs[rows[0]][faces[rows[0]].index(vertex)] for vertex in edge)[index],
            tuple(uvs[rows[1]][faces[rows[1]].index(vertex)] for vertex in edge)[index],
        ) for index in range(2)) > 0.000001
        for edge, rows in ((edge, edge_faces[edge]) for edge in shared_edges)
    )
    candidate_unclosed = sum(
        shared_gap(edge, candidate_triangles) > 0.000001 for edge in shared_edges
    )
    internal_unclosed = sum(
        row["candidateInternalDiagonalGapMm"] > 0.001 for row in internal_rows
    )
    max_edge_change = 0.0
    for face_id in target_faces:
        for triangle_id in range(2):
            before = original_triangles[face_id][triangle_id]
            after = candidate_triangles[face_id][triangle_id]
            for a, b in ((0, 1), (1, 2), (2, 0)):
                max_edge_change = max(max_edge_change, abs(
                    math.dist(before[a], before[b]) - math.dist(after[a], after[b])
                ))
    overrides = {
        face_id: tuple(tuple(point for point in triangle)
                       for triangle in candidate_triangles[face_id])
        for face_id in target_faces
    }
    return {
        "research_triangle_overrides": overrides,
        "report": {
            "researchOnly": True,
            "targetOriginalSourceVertex": junction_vertex,
            "incidentOriginalSourceEdges": [list(edge) for edge in edges],
            "closedIncidentOriginalSourceEdges": [list(edge) for edge in closed],
            "closedIncidentEdgeCount": len(closed),
            "splitOriginalSourceFaceIds": target_faces,
            "movedTrianglePoseCount": len(moved_triangles),
            "internalSplitDiagonalEvidence": internal_rows,
            "newUnclosedInternalSplitDiagonalCount": internal_unclosed,
            "baselineUnclosedSharedUvEdgeCount": baseline_unclosed,
            "candidateUnclosedSharedUvEdgeCount": candidate_unclosed,
            "candidateTotalUnclosedUvSeamCount":
                candidate_unclosed + internal_unclosed,
            "totalUnclosedUvSeamCountDelta":
                candidate_unclosed + internal_unclosed - baseline_unclosed,
            "maximumOriginalTriangleEdgeChangeMm": round(max_edge_change * 1000, 8),
            "storedSourceUvChanged": False,
            "sourceUvExportOrSavePerformed": False,
            "physicalPatternApproved": False,
            "productionApproved": False,
        },
    }


def compare_original_source_uv_junction_rigid_alignments(incident_edges):
    """Compare deterministic proper-rigid fits at one real cut junction.

    Each item is ``(source_edge, owner_a, owner_b)`` with source-edge vertex
    IDs and the two face-owner UV segments in deterministic face-ID order.
    Agreement only tests whether those exact local B-to-A mappings are one
    common 2D transform; it does not infer a movable cloth panel or seam.
    """
    if not hasattr(incident_edges, "__len__") or len(incident_edges) < 3:
        raise ValueError("Actual UV branch consistency needs at least three incident edges.")
    seen = set()
    rows = []
    for item in incident_edges:
        if not hasattr(item, "__len__") or len(item) != 3:
            raise ValueError("Actual UV branch incident evidence is malformed.")
        edge, owner_a, owner_b = item
        if (not hasattr(edge, "__len__") or len(edge) != 2
                or any(type(v) is not int or v < 0 for v in edge)
                or edge[0] >= edge[1] or tuple(edge) in seen):
            raise ValueError("Actual UV branch needs unique canonical source edges.")
        seen.add(tuple(edge))
        rigid = best_fit_original_source_uv_edge_rigid_alignment(owner_a, owner_b)
        rows.append({
            "originalSourceEdge": list(edge),
            "properRigidRotationDegrees":
                rigid["bestFitProperRigidUvRotationDegrees"],
            "properRigidTranslationMm": rigid["bestFitRigidUvTranslationMm"],
            "irreducibleEndpointResidualMm":
                rigid["irreducibleProperRigidAlignmentEndpointResidualMm"],
        })
    common_vertices = set(next(iter(seen)))
    for edge in seen:
        common_vertices.intersection_update(edge)
    if len(common_vertices) != 1:
        raise ValueError("Actual UV branch edges do not share one source junction.")
    rotations = [row["properRigidRotationDegrees"] for row in rows]
    translations = [row["properRigidTranslationMm"] for row in rows]
    def compatible(i, j):
        return (
            abs(math.remainder(rotations[i] - rotations[j], 360.0)) <= 0.000001
            and math.dist(translations[i], translations[j]) <= 0.00001
        )

    compatibility = [
        [i == j or compatible(i, j) for j in range(len(rows))]
        for i in range(len(rows))
    ]

    # This is an exact minimum clique cover of the compatibility graph (or,
    # equivalently, an exact colouring of its incompatibility complement).
    # Incident degrees are small on the locked source mesh. Trying group
    # limits in ascending order makes the first complete assignment minimal;
    # fixed edge order and group symmetry breaking make its witness stable.
    def assignment_with_group_limit(limit):
        groups = []

        def assign(row_index):
            if row_index == len(rows):
                return [list(group) for group in groups]
            for group in groups:
                if all(compatibility[row_index][other] for other in group):
                    group.append(row_index)
                    result = assign(row_index + 1)
                    if result is not None:
                        return result
                    group.pop()
            if len(groups) < limit:
                groups.append([row_index])
                result = assign(row_index + 1)
                if result is not None:
                    return result
                groups.pop()
            return None

        return assign(0)

    minimum_groups = None
    for group_limit in range(1, len(rows) + 1):
        minimum_groups = assignment_with_group_limit(group_limit)
        if minimum_groups is not None:
            break
    if minimum_groups is None:
        raise ValueError("Actual UV branch rigid-transform grouping failed.")

    group_rows = []
    for group in minimum_groups:
        group_rotation_spread = max(
            [abs(math.remainder(rotations[a] - rotations[b], 360.0))
             for pos, a in enumerate(group) for b in group[pos + 1:]] or [0.0]
        )
        group_translation_spread = max(
            [math.dist(translations[a], translations[b])
             for pos, a in enumerate(group) for b in group[pos + 1:]] or [0.0]
        )
        group_rows.append({
            "incidentOriginalSourceEdges": [
                rows[index]["originalSourceEdge"] for index in group
            ],
            "maximumWithinGroupRotationDisagreementDegrees":
                round(group_rotation_spread, 6),
            "maximumWithinGroupTranslationDisagreementMm":
                round(group_translation_spread, 5),
        })
    rotation_spread = max(
        abs(math.remainder(a - b, 360.0))
        for i, a in enumerate(rotations) for b in rotations[i + 1:]
    )
    translation_spread = max(
        math.dist(a, b)
        for i, a in enumerate(translations) for b in translations[i + 1:]
    )
    if not all(math.isfinite(v) for v in (rotation_spread, translation_spread)):
        raise ValueError("Actual UV branch rigid-transform disagreement is nonfinite.")
    consistent = rotation_spread <= 0.000001 and translation_spread <= 0.00001
    return {
        "incidentBestFitProperRigidTransforms": rows,
        "maximumPairwiseRigidRotationDisagreementDegrees":
            round(rotation_spread, 6),
        "maximumPairwiseRigidTranslationDisagreementMm":
            round(translation_spread, 5),
        "minimumDeterministicRigidTransformGroupCount": len(minimum_groups),
        "minimumDeterministicRigidTransformGroups": group_rows,
        "allIncidentEdgesRequireDistinctRigidTransforms":
            len(minimum_groups) == len(rows),
        "singleDeterministicRigidTransformClosesAllIncidentEdges": consistent,
        "junctionRigidUvConsistencyApproved": False,
    }


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


def trace_original_source_uv_cut_chains(
        cut_graph, component_vertices):
    """Partition a genuine connected UV cut graph into maximal edge chains.

    Every original source edge must appear in exactly one chain. Vertices of
    degree two are internal to chains; endpoints are genuine graph terminals
    (degree one or three-plus). A pure degree-two connected component is
    one closed loop, not an invented cut-open sewing path.
    """
    component = set(component_vertices)
    classify_original_source_uv_cut_component(
        cut_graph, component_vertices, set()
    )
    used_edges = set()

    def walk(start, next_vertex):
        chain = [start]
        previous, current = start, next_vertex
        while True:
            edge = (min(previous, current), max(previous, current))
            if edge in used_edges:
                raise ValueError("Original UV source chain repeated a genuine edge.")
            used_edges.add(edge)
            chain.append(current)
            if current == start or len(cut_graph[current]) != 2:
                break
            forward = cut_graph[current] - {previous}
            if len(forward) != 1:
                raise ValueError("Original UV source chain has ambiguous degree-two continuation.")
            previous, current = current, next(iter(forward))
        return chain

    chains = []
    terminals = sorted(v for v in component if len(cut_graph[v]) != 2)
    if terminals:
        for terminal in terminals:
            for neighbor in sorted(cut_graph[terminal]):
                edge = (min(terminal, neighbor), max(terminal, neighbor))
                if edge not in used_edges:
                    chains.append(walk(terminal, neighbor))
    else:
        start = min(component)
        chains.append(walk(start, min(cut_graph[start])))

    all_edges = {
        (min(v, n), max(v, n))
        for v in component for n in cut_graph[v]
    }
    if used_edges != all_edges or sum(len(chain) - 1 for chain in chains) != len(all_edges):
        raise ValueError("Original UV maximal chains did not cover every source edge.")
    if any(
            len(chain) < 2 or (
                chain[0] != chain[-1] and
                (len(cut_graph[chain[0]]) == 2 or len(cut_graph[chain[-1]]) == 2)
            ) for chain in chains):
        raise ValueError("Original UV source chain did not end at a true graph terminal.")
    return chains


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
    uv_gap_by_original_edge = {
        (min(a, b), max(a, b)): gap_mm
        for gap_mm, _real_mm, a, b in uv_unclosed
    }
    if len(uv_gap_by_original_edge) != len(uv_unclosed):
        raise ValueError("Original UV seam gap has duplicated source-edge identity.")
    # Each authentic two-owner source cut edge has TWO source UV endpoint
    # mismatch vectors. Their relative difference distinguishes a chart
    # offset from an endpoint-dependent mismatch, without modifying UVs.
    uv_offset_witness = {}
    for _, _, a, b in uv_unclosed:
        edge = (min(a, b), max(a, b))
        if len(owners[edge]) != 2:
            raise ValueError("Original UV source edge mismatch lacks two real faces.")
        (face_a, (uv_a0, uv_a1)), (face_b, (uv_b0, uv_b1)) = owners[edge]
        offset_0 = tuple((uv_a0[i] - uv_b0[i]) * 1000.0 for i in range(2))
        offset_1 = tuple((uv_a1[i] - uv_b1[i]) * 1000.0 for i in range(2))
        endpoint_gaps = (math.hypot(*offset_0), math.hypot(*offset_1))
        if (not all(math.isfinite(v) for v in (*offset_0, *offset_1))
                or abs(max(endpoint_gaps) - uv_gap_by_original_edge[edge]) > 0.000001):
            raise ValueError("Original UV gap endpoints disagree with actual source owner loops.")
        uv_offset_witness[edge] = (face_a, face_b, offset_0, offset_1)
    if len(uv_offset_witness) != len(uv_unclosed):
        raise ValueError("Original source UV endpoint witnesses lack complete edge coverage.")
    unseen = set(cut_graph)
    network_components = []
    source_chains = []
    source_chain_full_lengths = []
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
        classification = classify_original_source_uv_cut_component(
            cut_graph, component_vertices, original_boundary_vertices
        )
        chains = trace_original_source_uv_cut_chains(
            cut_graph, component_vertices
        )
        classification["originalSourceMinimumVertexIndex"] = min(component_vertices)
        classification["uvCutGraphMaximalChainCount"] = len(chains)
        classification["uvCutGraphMaximalChainEdgeCoverageCount"] = sum(
            len(chain) - 1 for chain in chains
        )
        if classification["uvCutGraphMaximalChainEdgeCoverageCount"] != (
                classification["unclosedUvEdgeCount"]):
            raise ValueError("Original source UV network lost edge-disjoint chain coverage.")
        network_components.append(classification)
        component_chain_lengths = []
        component_chain_max_gap_mm = []
        for chain in chains:
            segment_lengths = [
                math.dist(vertices[a], vertices[b]) * 1000.0
                for a, b in zip(chain, chain[1:])
            ]
            length_mm = math.fsum(segment_lengths)
            if not math.isfinite(length_mm) or length_mm <= 0:
                raise ValueError("Original UV source chain lacks finite 3D edge length.")
            source_chain_full_lengths.append(length_mm)
            component_chain_lengths.append(length_mm)
            chain_gap_edges = [
                (uv_gap_by_original_edge[(min(a, b), max(a, b))],
                 (min(a, b), max(a, b)))
                for a, b in zip(chain, chain[1:])
            ]
            if len(chain_gap_edges) != len(chain) - 1:
                raise ValueError("Original source UV gap trace lost a genuine cut edge.")
            chain_max_gap, chain_max_edge = sorted(
                chain_gap_edges, key=lambda pair: (
                    -pair[0], pair[1][0], pair[1][1]
                )
            )[0]
            component_chain_max_gap_mm.append(chain_max_gap)
            face_a, face_b, offset_0, offset_1 = uv_offset_witness[chain_max_edge]
            endpoint_drift_mm = math.dist(offset_0, offset_1)
            if not math.isfinite(endpoint_drift_mm):
                raise ValueError("Original source UV endpoint mismatch drift is nonfinite.")
            rigid_edge_bound = best_fit_original_source_uv_edge_translation(
                offset_0, offset_1
            )
            source_uv_faces = owners[chain_max_edge]
            rigid_rotation_bound = best_fit_original_source_uv_edge_rigid_alignment(
                [[v * 1000.0 for v in uv] for uv in source_uv_faces[0][1]],
                [[v * 1000.0 for v in uv] for uv in source_uv_faces[1][1]],
            )
            similarity_bound = best_fit_original_source_uv_edge_similarity_alignment(
                [[v * 1000.0 for v in uv] for uv in source_uv_faces[0][1]],
                [[v * 1000.0 for v in uv] for uv in source_uv_faces[1][1]],
            )
            if abs(
                    rigid_edge_bound[
                        "irreducibleSingleRigidTranslationEndpointResidualMm"
                    ] - endpoint_drift_mm / 2
            ) > 0.00001:
                raise ValueError("Actual source edge rigid translation residual lost geometry.")
            source_chains.append({
                "originalSourceComponentMinimumVertexIndex":
                    classification["originalSourceMinimumVertexIndex"],
                # Preserve every REAL source vertex in traversal order, not
                # merely endpoints which cannot reconstruct a 3D cut path.
                # This is metric mesh-source research, never a sewing line.
                "originalSourceVertexPath": list(chain),
                "originalSourceStartVertexIndex": chain[0],
                "originalSourceEndVertexIndex": chain[-1],
                "originalSourceEdgeCount": len(chain) - 1,
                "realOriginalSourceChainLengthMm": round(length_mm, 5),
                "maximumOriginalSourceUvSeamGapMm": round(chain_max_gap, 5),
                "originalSourceEdgeAtMaximumUvSeamGap": list(chain_max_edge),
                "originalSourceFaceOwnersAtMaximumUvGap": [face_a, face_b],
                "sourceUvOffsetAtMaximumGapEdgeEndpointsMm": [
                    [round(v, 5) for v in offset_0],
                    [round(v, 5) for v in offset_1],
                ],
                "relativeSourceUvEndpointDriftMm": round(endpoint_drift_mm, 5),
                **rigid_edge_bound,
                **rigid_rotation_bound,
                **similarity_bound,
                "closedGraphLoop": chain[0] == chain[-1],
                "startsAtOriginalMeshBoundary":
                    chain[0] in original_boundary_vertices,
                "endsAtOriginalMeshBoundary":
                    chain[-1] in original_boundary_vertices,
                "startsAtSourceUvBranchJunction":
                    len(cut_graph[chain[0]]) >= 3,
                "endsAtSourceUvBranchJunction":
                    len(cut_graph[chain[-1]]) >= 3,
            })
        # Attribute every true original edge length to exactly one of the
        # six branched or sixty simple source components. This is not
        # inferred cloth seam allowance or tailored pattern length.
        component_cut_edges_mm = [
            real_mm for _gap, real_mm, a, b in uv_unclosed
            if a in set(component_vertices) and b in set(component_vertices)
        ]
        if (len(component_cut_edges_mm) != classification["unclosedUvEdgeCount"]
                or abs(math.fsum(component_cut_edges_mm) -
                       math.fsum(component_chain_lengths)) > 0.000001):
            raise ValueError("Original source UV component chain lengths do not reconcile.")
        classification["realOriginalSourceUvCutNetworkLengthMm"] = round(
            math.fsum(component_chain_lengths), 5
        )
        component_cut_gaps_mm = [
            gap_mm for gap_mm, _real_mm, a, b in uv_unclosed
            if a in set(component_vertices) and b in set(component_vertices)
        ]
        if (len(component_cut_gaps_mm) != classification["unclosedUvEdgeCount"]
                or max(component_cut_gaps_mm) != max(component_chain_max_gap_mm)):
            raise ValueError("Original UV component seam gap mismatches genuine source paths.")
        classification["maximumOriginalSourceUvSeamGapMm"] = round(
            max(component_cut_gaps_mm), 5
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
        incident_edges = []
        incident_face_pairs = []
        for other in sorted(neighbours):
            edge = (min(source_vertex, other), max(source_vertex, other))
            if len(owners[edge]) != 2:
                raise ValueError("Original source UV branch edge lacks two face owners.")
            (face_a, owner_a), (face_b, owner_b) = owners[edge]
            if face_a >= face_b:
                raise ValueError("Original source UV face-owner order is not deterministic.")
            incident_edges.append((
                edge,
                [[v * 1000.0 for v in uv] for uv in owner_a],
                [[v * 1000.0 for v in uv] for uv in owner_b],
            ))
            incident_face_pairs.append({
                "originalSourceEdge": list(edge),
                "deterministicOwnerFacePair": [face_a, face_b],
            })
        rigid_consistency = compare_original_source_uv_junction_rigid_alignments(
            incident_edges
        )
        junction_rows.append({
            "originalSourceVertexIndex": source_vertex,
            "sourceUvCutGraphDegree": len(neighbours),
            "realOriginalSourcePositionMm": [
                round(value * 1000.0, 5) for value in vertices[source_vertex]
            ],
            "incidentOriginalSourceCutEdgeLengthMm": round(incident_mm, 5),
            "incidentOriginalSourceUvOwnerFacePairs": incident_face_pairs,
            **rigid_consistency,
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
    component_owners = {
        row["originalSourceMinimumVertexIndex"]: row
        for row in network_components
    }
    if len(component_owners) != len(network_components) or any(
            chain["originalSourceComponentMinimumVertexIndex"] not in component_owners
            for chain in source_chains):
        raise ValueError("Original UV source chain does not map to one genuine component.")
    branched_component_ids = {
        row["originalSourceMinimumVertexIndex"] for row in network_components
        if row["uvCutGraphTopology"] == "branched-or-compound"
    }
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
    source_chains.sort(key=lambda row: (
        -row["realOriginalSourceChainLengthMm"],
        -row["originalSourceEdgeCount"],
        row["originalSourceStartVertexIndex"],
        row["originalSourceEndVertexIndex"],
    ))
    if (sum(row["originalSourceEdgeCount"] for row in source_chains) !=
            len(uv_unclosed) or
            abs(math.fsum(source_chain_full_lengths) - total_cut_mm) > 0.000001 or
            sum(row["uvCutGraphMaximalChainCount"]
                for row in network_components) != len(source_chains)):
        raise ValueError("Original source maximal chain lengths/edges do not reconcile.")
    # Original mesh edge identities, source vertices and real 3D segment
    # lengths must be consistent even if a later caller changes sorting.
    all_disconnected = {
        (min(a, b), max(a, b)) for _, _, a, b in uv_unclosed
    }
    checked_chains = set()
    for row in source_chains:
        path = row["originalSourceVertexPath"]
        if (len(path) != row["originalSourceEdgeCount"] + 1
                or path[0] != row["originalSourceStartVertexIndex"]
                or path[-1] != row["originalSourceEndVertexIndex"]
                or any(type(v) is not int or v < 0 or v >= len(vertices)
                       for v in path)):
            raise ValueError("Original UV source chain path has invalid vertex identities.")
        for a, b in zip(path, path[1:]):
            edge = (min(a, b), max(a, b))
            if a == b or edge not in all_disconnected or edge in checked_chains:
                raise ValueError("Original UV source chain path is not a real unique cut edge.")
            checked_chains.add(edge)
    if checked_chains != all_disconnected:
        raise ValueError("Original source UV chain path inventory omitted real cut edges.")
    branched_chain_rows = [
        row for row in source_chains
        if row["originalSourceComponentMinimumVertexIndex"] in branched_component_ids
    ]
    highest_gap_branched_chains = sorted(branched_chain_rows, key=lambda row: (
        -row["maximumOriginalSourceUvSeamGapMm"],
        -row["realOriginalSourceChainLengthMm"],
        row["originalSourceComponentMinimumVertexIndex"],
        row["originalSourceStartVertexIndex"],
        row["originalSourceEndVertexIndex"],
    ))
    if (source_chains and abs(
            max(row["maximumOriginalSourceUvSeamGapMm"]
                for row in source_chains) - max_uv_gap_mm
        ) > 0.00001):
        raise ValueError("Original source UV chain gaps do not cover global maximum.")
    if (sum(component_owners[identifier]["uvCutGraphMaximalChainCount"]
            for identifier in branched_component_ids) != len(branched_chain_rows)
            or sum(component_owners[identifier]["unclosedUvEdgeCount"]
                   for identifier in branched_component_ids) != sum(
                       row["originalSourceEdgeCount"] for row in branched_chain_rows)):
        raise ValueError("Original branched UV source chains have incomplete component ownership.")
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
        "uvCutGraphMaximalSourceChainCount": len(source_chains),
        "uvCutGraphClosedMaximalSourceChainCount": sum(
            row["closedGraphLoop"] for row in source_chains
        ),
        "uvCutGraphMaximalSourceChainEdgeCoverageCount": sum(
            row["originalSourceEdgeCount"] for row in source_chains
        ),
        "uvCutGraphLongestOriginalSourceChainLengthMm": (
            source_chains[0]["realOriginalSourceChainLengthMm"]
            if source_chains else 0.0
        ),
        "actualLongestOriginalSourceUvCutChains": source_chains[:12],
        "actualLongestBranchedOriginalSourceUvCutChains": branched_chain_rows[:12],
        "actualHighestGapBranchedOriginalSourceUvCutChains":
            highest_gap_branched_chains[:12],
        "actualBranchedOriginalSourceUvCutNetworks": [
            row for row in network_components
            if row["uvCutGraphTopology"] == "branched-or-compound"
        ][:12],
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
