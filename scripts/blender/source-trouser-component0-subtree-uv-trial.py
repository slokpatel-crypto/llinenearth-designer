"""One-cut UV subtree repack on the genuine largest source component.

Research only: this removes one retained face-tree join, rigidly translates the
smaller resulting subtree, and reports the real 3D source-edge length exposed.
It never changes source vertices/faces or approves a sewn cutting pattern.
"""
from __future__ import annotations

from collections import defaultdict, deque
import math


def trial_component0_balanced_subtree_uv_pack(
        points, original_faces, face_uv_loops, retained_source_tree_edges,
        display_gap_mm=5.0):
    if (len(original_faces) != 2650 or len(face_uv_loops) != 2650
            or len(retained_source_tree_edges) != 2647 or not points):
        raise ValueError("Component-0 UV trial requires the complete original source forest.")
    if (isinstance(display_gap_mm, bool)
            or not isinstance(display_gap_mm, (int, float))
            or not math.isfinite(display_gap_mm)
            or not 0 < display_gap_mm <= 100):
        raise ValueError("Component-0 UV trial gap must be finite and in (0,100]mm.")
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
    _negative_size, cut_edge, _minimum_face, moved = min(candidates)
    moved = set(moved)

    all_points = [point for row in normalized_uv for point in row]
    moving_points = [point for face_id in moved for point in normalized_uv[face_id]]
    maximum_x = max(point[0] for point in all_points)
    minimum_y = min(point[1] for point in all_points)
    moving_minimum_x = min(point[0] for point in moving_points)
    moving_minimum_y = min(point[1] for point in moving_points)
    dx = maximum_x + float(display_gap_mm) / 1000.0 - moving_minimum_x
    dy = minimum_y - moving_minimum_y
    candidate_uv = []
    for face_id, row in enumerate(normalized_uv):
        candidate_uv.append([
            (u + dx, v + dy) if face_id in moved else (u, v)
            for u, v in row
        ])

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
            "removedRetainedOriginalSourceEdge": list(cut_edge),
            "addedActualSourceCutEdgeLengthMm": round(edge_length_mm, 5),
            "movedOriginalSourceFaceCount": len(moved),
            "stationaryComponent0FaceCount": 1220 - len(moved),
            "rigidResearchUvTranslationMm": [
                round(dx * 1000.0, 5), round(dy * 1000.0, 5),
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
