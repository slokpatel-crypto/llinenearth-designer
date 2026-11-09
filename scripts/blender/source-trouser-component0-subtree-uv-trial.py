"""Bounded UV subtree repacks on the genuine largest source component.

Research only: this removes one retained face-tree join, rigidly translates the
smaller resulting subtree, and reports the real 3D source-edge length exposed.
The two-cut trial composes two distinct ranked rigid repacks without changing
source vertices/faces or approving a sewn cutting pattern.
"""
from __future__ import annotations

from collections import defaultdict, deque
import math


def trial_component0_balanced_subtree_uv_pack(
        points, original_faces, face_uv_loops, retained_source_tree_edges,
        display_gap_mm=5.0, candidate_rank=0, translation_fraction=1.0):
    if (len(original_faces) != 2650 or len(face_uv_loops) != 2650
            or len(retained_source_tree_edges) != 2647 or not points):
        raise ValueError("Component-0 UV trial requires the complete original source forest.")
    if (isinstance(display_gap_mm, bool)
            or not isinstance(display_gap_mm, (int, float))
            or not math.isfinite(display_gap_mm)
            or not 0 < display_gap_mm <= 100):
        raise ValueError("Component-0 UV trial gap must be finite and in (0,100]mm.")
    if type(candidate_rank) is not int or not 0 <= candidate_rank < 48:
        raise ValueError("Component-0 UV trial candidate rank must be in [0,48).")
    if (isinstance(translation_fraction, bool)
            or not isinstance(translation_fraction, (int, float))
            or not math.isfinite(translation_fraction)
            or not 0 < translation_fraction <= 1):
        raise ValueError(
            "Component-0 UV trial translation fraction must be finite and in (0,1]."
        )
    vertices = []
    for raw in points:
        point = tuple(float(value) for value in raw)
        if len(point) != 3 or not all(math.isfinite(value) for value in point):
            raise ValueError("Component-0 UV trial has invalid source positions.")
        vertices.append(point)

    owners = defaultdict(list)
    normalized_uv = []
    for face_id, (raw_face, raw_uv) in enumerate(zip(original_faces, face_uv_loops)):
        face = tuple(raw_face)
        if (len(face) != 4 or len(set(face)) != 4
                or any(type(index) is not int or index < 0 or index >= len(vertices)
                       for index in face)):
            raise ValueError("Component-0 UV trial has invalid source faces.")
        if len(raw_uv) != 4:
            raise ValueError("Component-0 UV trial requires four UV loops per source face.")
        uv = []
        for raw_point in raw_uv:
            if (len(raw_point) != 2 or any(
                    isinstance(value, bool)
                    or not isinstance(value, (int, float))
                    or not math.isfinite(value) for value in raw_point)):
                raise ValueError("Component-0 UV trial has invalid UV coordinates.")
            uv.append((float(raw_point[0]), float(raw_point[1])))
        for triangle in ((0, 1, 2), (0, 2, 3)):
            a, b, c = (uv[index] for index in triangle)
            if ((b[0] - a[0]) * (c[1] - a[1])
                    - (b[1] - a[1]) * (c[0] - a[0])) <= 1e-14:
                raise ValueError("Component-0 UV trial has inverted source UV triangles.")
        normalized_uv.append(uv)
        for index in range(4):
            a, b = face[index], face[(index + 1) % 4]
            edge = tuple(sorted((a, b)))
            owners[edge].append((face_id, (a, b) == edge))
    if any(len(rows) > 2 for rows in owners.values()):
        raise ValueError("Component-0 UV trial source is nonmanifold.")
    for rows in owners.values():
        if len(rows) == 2 and rows[0][1] == rows[1][1]:
            raise ValueError("Component-0 UV trial has inconsistent shared-edge winding.")

    retained = []
    seen = set()
    forest = [[] for _ in original_faces]
    for raw_edge in retained_source_tree_edges:
        if (len(raw_edge) != 2 or any(type(index) is not int for index in raw_edge)):
            raise ValueError("Component-0 UV trial has an invalid retained source edge.")
        edge = tuple(sorted(raw_edge))
        if edge in seen or len(owners.get(edge, [])) != 2:
            raise ValueError("Component-0 UV trial retained forest is forged or duplicated.")
        seen.add(edge)
        retained.append(edge)
        left, right = owners[edge][0][0], owners[edge][1][0]
        forest[left].append((right, edge))
        forest[right].append((left, edge))
    for row in forest:
        row.sort()

    component_ids = [-1] * 2650
    groups = []
    for root in range(2650):
        if component_ids[root] >= 0:
            continue
        component_id = len(groups)
        pending = [root]
        component_ids[root] = component_id
        group = []
        while pending:
            face_id = pending.pop()
            group.append(face_id)
            for neighbor, _edge in reversed(forest[face_id]):
                if component_ids[neighbor] < 0:
                    component_ids[neighbor] = component_id
                    pending.append(neighbor)
        groups.append(sorted(group))
    if [len(group) for group in groups] != [1220, 715, 715]:
        raise ValueError("Component-0 UV trial lost the three measured source components.")
    if any(sum(len(forest[face_id]) for face_id in group) // 2 != len(group) - 1
           for group in groups):
        raise ValueError("Component-0 retained source edges are not a spanning forest.")

    component0 = groups[0]
    parent = {component0[0]: None}
    parent_edge = {}
    order = []
    queue = deque([component0[0]])
    while queue:
        face_id = queue.popleft()
        order.append(face_id)
        for neighbor, edge in forest[face_id]:
            if neighbor == parent.get(face_id):
                continue
            if neighbor in parent:
                raise ValueError("Component-0 retained source tree contains a cycle.")
            parent[neighbor] = face_id
            parent_edge[neighbor] = edge
            queue.append(neighbor)
    descendants = {face_id: {face_id} for face_id in component0}
    for face_id in reversed(order[1:]):
        descendants[parent[face_id]].update(descendants[face_id])
    candidates = []
    component0_set = set(component0)
    for child in order[1:]:
        child_side = descendants[child]
        other_side = component0_set - child_side
        moved = child_side if len(child_side) <= len(other_side) else other_side
        candidates.append((-len(moved), parent_edge[child], min(moved), moved))
    if not candidates:
        raise ValueError("Component-0 UV tree has no genuine retained edge to test.")
    candidates.sort(key=lambda row: (row[0], row[1], row[2]))
    if candidate_rank >= len(candidates):
        raise ValueError("Component-0 UV trial candidate rank exceeds genuine tree edges.")
    _negative_size, cut_edge, _minimum_face, moved = candidates[candidate_rank]
    moved = set(moved)

    # A declared NEW UV seam must originate from an edge that really was
    # joined in the input research UV. The authentic selected source edge
    # having two 3D face owners is insufficient evidence of UV continuity.
    joined_uv_endpoints = []
    selected_owners = owners[cut_edge]
    for vertex_id in cut_edge:
        left_face, right_face = selected_owners[0][0], selected_owners[1][0]
        left_local = tuple(original_faces[left_face]).index(vertex_id)
        right_local = tuple(original_faces[right_face]).index(vertex_id)
        before_gap_mm = math.dist(
            normalized_uv[left_face][left_local],
            normalized_uv[right_face][right_local],
        ) * 1000.0
        if before_gap_mm > 0.001:
            raise ValueError(
                "Selected original retained tree edge is already UV-disconnected."
            )
        joined_uv_endpoints.append(
            (left_face, left_local, right_face, right_local)
        )

    all_points = [point for row in normalized_uv for point in row]
    moving_points = [point for face_id in moved for point in normalized_uv[face_id]]
    maximum_x = max(point[0] for point in all_points)
    minimum_y = min(point[1] for point in all_points)
    moving_minimum_x = min(point[0] for point in moving_points)
    moving_minimum_y = min(point[1] for point in moving_points)
    full_dx = maximum_x + float(display_gap_mm) / 1000.0 - moving_minimum_x
    full_dy = minimum_y - moving_minimum_y
    dx = full_dx * float(translation_fraction)
    dy = full_dy * float(translation_fraction)
    displacement_mm = math.hypot(dx, dy) * 1000.0
    if not math.isfinite(displacement_mm) or displacement_mm <= 0.001:
        raise ValueError(
            "Research UV translation does not open a finite measurable new seam."
        )
    candidate_uv = []
    for face_id, row in enumerate(normalized_uv):
        candidate_uv.append([
            (u + dx, v + dy) if face_id in moved else (u, v)
            for u, v in row
        ])

    for left_face, left_local, right_face, right_local in joined_uv_endpoints:
        after_gap_mm = math.dist(
            candidate_uv[left_face][left_local],
            candidate_uv[right_face][right_local],
        ) * 1000.0
        if not math.isfinite(after_gap_mm) or after_gap_mm <= 0.001:
            raise ValueError(
                "Selected retained source edge did not open a measurable UV seam."
            )

    max_change_mm = 0.0
    for before, after in zip(normalized_uv, candidate_uv):
        for left, right in ((0, 1), (1, 2), (2, 3), (3, 0), (0, 2)):
            max_change_mm = max(max_change_mm, abs(
                math.dist(before[left], before[right])
                - math.dist(after[left], after[right])
            ) * 1000.0)
    if max_change_mm > 0.000001:
        raise ValueError("Rigid subtree repack stretched original UV triangles.")
    edge_length_mm = math.dist(vertices[cut_edge[0]], vertices[cut_edge[1]]) * 1000.0
    if not math.isfinite(edge_length_mm) or edge_length_mm <= 0.000001:
        raise ValueError("Selected genuine source cut edge has invalid 3D length.")
    return {
        "face_uv_loops": candidate_uv,
        "report": {
            "researchOnly": True,
            "originalSourceQuadCount": 2650,
            "originalSourceFaceGraphComponentCounts": [1220, 715, 715],
            "targetComponentId": 0,
            "targetComponentOriginalSourceFaceCount": 1220,
            "selectionRule": "largest smaller side of one retained component-0 tree edge",
            "candidateRankWithinBalancedTreeCuts": candidate_rank,
            "translationFractionOfOutsidePack": round(
                float(translation_fraction), 8
            ),
            "boundedCandidateRankLimit": 48,
            "removedRetainedOriginalSourceEdge": list(cut_edge),
            "addedActualSourceCutEdgeLengthMm": round(edge_length_mm, 5),
            "movedOriginalSourceFaceCount": len(moved),
            "stationaryComponent0FaceCount": 1220 - len(moved),
            "rigidResearchUvTranslationMm": [
                round(dx * 1000.0, 5), round(dy * 1000.0, 5),
            ],
            "fullOutsidePackTranslationMm": [
                round(full_dx * 1000.0, 5), round(full_dy * 1000.0, 5),
            ],
            "maximumOriginalTriangleEdgeChangeMm": round(max_change_mm, 9),
            "retainedSourceUvTreeJoinCountBefore": 2647,
            "retainedSourceUvTreeJoinCountAfter": 2646,
            "newUnclosedSourceUvSeamCount": 1,
            "sourceGeometryAndVertexIDsUnchanged": True,
            "sourceUvExportOrSavePerformed": False,
            "physicalTextileWidthRepeatOrGrainKnown": False,
            "realTailorCutApproved": False,
            "physicalBodyFitApproved": False,
            "productionApproved": False,
            "metricCaveat": (
                "One genuine retained source face-tree edge was opened and the smaller "
                "subtree rigidly translated in research UV space. The numerical gap is "
                "not seam allowance or fabric width. Internal overlaps, all other cyclic "
                "seams, cloth grain, body fit and tailoring remain UNVERIFIED."
            ),
        },
    }


def trial_component0_ranked_two_cut_uv_pack(
        points, original_faces, face_uv_loops, retained_source_tree_edges,
        candidate_ranks, display_gap_mm=5.0):
    if (not isinstance(candidate_ranks, (list, tuple))
            or len(candidate_ranks) != 2
            or any(type(rank) is not int or not 0 <= rank < 48
                   for rank in candidate_ranks)
            or candidate_ranks[0] >= candidate_ranks[1]):
        raise ValueError(
            "Component-0 two-cut trial requires two increasing distinct ranks."
        )
    first = trial_component0_balanced_subtree_uv_pack(
        points, original_faces, face_uv_loops, retained_source_tree_edges,
        display_gap_mm=display_gap_mm, candidate_rank=candidate_ranks[0],
    )
    second = trial_component0_balanced_subtree_uv_pack(
        points, original_faces, first["face_uv_loops"], retained_source_tree_edges,
        display_gap_mm=display_gap_mm, candidate_rank=candidate_ranks[1],
    )
    first_report, second_report = first["report"], second["report"]
    removed_edges = [
        first_report["removedRetainedOriginalSourceEdge"],
        second_report["removedRetainedOriginalSourceEdge"],
    ]
    if len({tuple(edge) for edge in removed_edges}) != 2:
        raise ValueError("Component-0 two-cut trial selected a duplicated source edge.")
    max_change_mm = 0.0
    for before, after in zip(face_uv_loops, second["face_uv_loops"]):
        for left, right in ((0, 1), (1, 2), (2, 3), (3, 0), (0, 2)):
            max_change_mm = max(max_change_mm, abs(
                math.dist(before[left], before[right])
                - math.dist(after[left], after[right])
            ) * 1000.0)
    if max_change_mm > 0.000001:
        raise ValueError("Rigid two-cut subtree repack stretched original UV triangles.")
    added_length_mm = sum(
        report["addedActualSourceCutEdgeLengthMm"]
        for report in (first_report, second_report)
    )
    return {
        "face_uv_loops": second["face_uv_loops"],
        "report": {
            "researchOnly": True,
            "originalSourceQuadCount": 2650,
            "targetComponentId": 0,
            "targetComponentOriginalSourceFaceCount": 1220,
            "selectionRule": (
                "compose two increasing distinct ranks from deterministic "
                "balanced component-0 retained-tree cuts"
            ),
            "candidateRanksWithinBalancedTreeCuts": list(candidate_ranks),
            "removedRetainedOriginalSourceEdges": removed_edges,
            "addedActualSourceCutEdgeLengthMm": round(added_length_mm, 5),
            "movedOriginalSourceFaceCounts": [
                first_report["movedOriginalSourceFaceCount"],
                second_report["movedOriginalSourceFaceCount"],
            ],
            "rigidResearchUvTranslationsMm": [
                first_report["rigidResearchUvTranslationMm"],
                second_report["rigidResearchUvTranslationMm"],
            ],
            "maximumOriginalTriangleEdgeChangeMm": round(max_change_mm, 9),
            "retainedSourceUvTreeJoinCountBefore": 2647,
            "retainedSourceUvTreeJoinCountAfter": 2645,
            "newUnclosedSourceUvSeamCount": 2,
            "sourceGeometryAndVertexIDsUnchanged": True,
            "sourceUvExportOrSavePerformed": False,
            "physicalTextileWidthRepeatOrGrainKnown": False,
            "realTailorCutApproved": False,
            "physicalBodyFitApproved": False,
            "productionApproved": False,
            "metricCaveat": (
                "Two genuine retained source face-tree edges were opened by "
                "sequential rigid research-UV translations. Their numerical "
                "gaps are not seam allowances or fabric width; physical grain, "
                "body fit, overlap-free charts and tailoring remain UNVERIFIED."
            ),
        },
    }
