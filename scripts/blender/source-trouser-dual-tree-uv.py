"""Research-only connected UV spanning forest for ACTUAL original trouser quads.

A face adjacency tree rigidly joins true original shared edges without distorting
each 3D-measured quad metric chart. Cycle edges may fail to close: record their
measured 2D gaps instead of falsely calling a stitched/physical UV garment.
No original Blender mesh/source/UV is ever written by this pure helper.
"""
from __future__ import annotations

from collections import defaultdict, deque
import math


def _length(a, b):
    return math.hypot(a[0]-b[0], a[1]-b[1])


def connect_original_source_uv_forest(
        original_faces, separate_face_uv, original_cut_edges,
        preferred_tree_edges=None):
    if len(original_faces) != 2650 or len(separate_face_uv) != 2650:
        raise ValueError("Must use actual 2,650 original trouser-source faces/quad charts.")
    if len(original_cut_edges) != 8:
        raise ValueError("Eight actual unmatched original cut-edge identities required.")
    owners = defaultdict(list)
    original_indices = []
    local = []
    for face_index, (raw_face, raw_uv) in enumerate(zip(original_faces, separate_face_uv)):
        face = tuple(int(v) for v in raw_face)
        coords = [tuple(float(v) for v in uv) for uv in raw_uv]
        if (len(face) != 4 or len(set(face)) != 4 or min(face) < 0
                or len(coords) != 4 or any(
                    len(uv) != 2 or not all(math.isfinite(v) for v in uv)
                    for uv in coords
                )):
            raise ValueError("Original source face or metric UV loop is invalid.")
        # All face UV charts must be nondegenerate, finite and have same orientation.
        cross1 = ((coords[1][0]-coords[0][0])*(coords[2][1]-coords[0][1])
                  -(coords[1][1]-coords[0][1])*(coords[2][0]-coords[0][0]))
        cross2 = ((coords[2][0]-coords[0][0])*(coords[3][1]-coords[0][1])
                  -(coords[2][1]-coords[0][1])*(coords[3][0]-coords[0][0]))
        if cross1 <= 1e-14 or cross2 <= 1e-14:
            raise ValueError("Actual source quad metric UV has inverted or zero-area face.")
        original_indices.append(face)
        local.append({vertex: coord for vertex, coord in zip(face, coords)})
        for j in range(4):
            a, b = face[j], face[(j + 1) % 4]
            edge = (min(a, b), max(a, b))
            owners[edge].append((face_index, (a, b) == edge))
    if any(len(rows) > 2 for rows in owners.values()):
        raise ValueError("Actual source seam has nonmanifold original face ownership.")
    cuts = {tuple(sorted(edge)) for edge in original_cut_edges}
    if len(cuts) != 8 or any(
        len(edge) != 2 or edge[0] == edge[1] or
        len(owners.get(edge, [])) != 1 for edge in cuts
    ):
        raise ValueError("Cannot associate genuine original cut seam with one original owner.")
    adjacent = [[] for _ in original_indices]
    shared = []
    for edge, rows in owners.items():
        if len(rows) != 2:
            continue
        left, right = rows
        if left[1] == right[1]:
            raise ValueError("Original source face has contradictory shared-edge winding.")
        a, b = left[0], right[0]
        adjacent[a].append((b, edge))
        adjacent[b].append((a, edge))
        shared.append((edge, a, b))
    for neighbours in adjacent:
        neighbours.sort(key=lambda row: (row[0], row[1]))

    # Optional maximum-retained-real-edge forest from an independent source
    # geometry Kruskal selector. Validate it is an actual tree for EACH real
    # original source component. It may not silently remove actual faces or
    # fabricate a new connected source mesh.
    expected_original_component_count = None
    allowed_tree = None
    if preferred_tree_edges is not None:
        if not isinstance(preferred_tree_edges, (tuple, list, set, frozenset)):
            raise ValueError("Real source UV tree selection must be an explicit edge collection.")
        source_edge_set = {edge for edge, _, _ in shared}
        proposed = []
        for raw_edge in preferred_tree_edges:
            if len(raw_edge) != 2:
                raise ValueError("Selected original source UV tree edge is not a pair.")
            u, v = (int(raw_edge[0]), int(raw_edge[1]))
            if u >= v or u < 0 or (u, v) not in source_edge_set:
                raise ValueError("Selected UV edge is not a true canonical shared source edge.")
            proposed.append((u, v))
        allowed_tree = set(proposed)
        if len(allowed_tree) != len(proposed):
            raise ValueError("Duplicated original source UV retained tree edges.")
        component_seen = set()
        expected_original_component_count = 0
        for original_face in range(len(local)):
            if original_face in component_seen:
                continue
            expected_original_component_count += 1
            stack = [original_face]
            component_seen.add(original_face)
            while stack:
                current_face = stack.pop()
                for adjacent_face, _edge in adjacent[current_face]:
                    if adjacent_face not in component_seen:
                        component_seen.add(adjacent_face)
                        stack.append(adjacent_face)
        if len(allowed_tree) != len(local) - expected_original_component_count:
            raise ValueError("Selected tree edges must preserve each true source component.")
        adjacent = [
            [(neighbour, edge) for neighbour, edge in neighbours
             if edge in allowed_tree]
            for neighbours in adjacent
        ]

    placed = [None] * len(local)
    component = [-1] * len(local)
    connected_tree_edges = set()
    parent_face = [-1] * len(local)
    component_sizes = []
    max_tree_join_error_mm = 0.0
    for root in range(len(local)):
        if placed[root] is not None:
            continue
        component_id = len(component_sizes)
        component_sizes.append(0)
        placed[root] = dict(local[root])
        component[root] = component_id
        queue = deque([root])
        while queue:
            current = queue.popleft()
            component_sizes[component_id] += 1
            for neighbour, edge in adjacent[current]:
                if placed[neighbour] is not None:
                    continue
                u, v = edge
                source_a, source_b = local[neighbour][u], local[neighbour][v]
                dest_a, dest_b = placed[current][u], placed[current][v]
                sx, sy = source_b[0]-source_a[0], source_b[1]-source_a[1]
                dx, dy = dest_b[0]-dest_a[0], dest_b[1]-dest_a[1]
                source_l = math.hypot(sx, sy)
                dest_l = math.hypot(dx, dy)
                if (not math.isfinite(source_l) or not math.isfinite(dest_l)
                        or source_l <= 1e-9 or dest_l <= 1e-9
                        or abs(source_l - dest_l) * 1000.0 > 0.001):
                    raise ValueError("Actual original shared edge cannot join without stretching.")
                cosine = (sx * dx + sy * dy) / (source_l * dest_l)
                sine = (sx * dy - sy * dx) / (source_l * dest_l)
                if not all(math.isfinite(z) for z in (cosine, sine)):
                    raise ValueError("Original metric source shared-edge rotation invalid.")
                transformed = {}
                for vertex, (px, py) in local[neighbour].items():
                    rx, ry = px - source_a[0], py - source_a[1]
                    transformed[vertex] = (
                        dest_a[0] + cosine * rx - sine * ry,
                        dest_a[1] + sine * rx + cosine * ry,
                    )
                    if not all(math.isfinite(k) for k in transformed[vertex]):
                        raise ValueError("Connected original trouser source UV coordinate invalid.")
                error = max(
                    _length(transformed[u], dest_a),
                    _length(transformed[v], dest_b),
                ) * 1000.0
                if error > 0.001:
                    raise ValueError("Metric original source shared-tree seam did not join.")
                max_tree_join_error_mm = max(max_tree_join_error_mm, error)
                placed[neighbour] = transformed
                component[neighbour] = component_id
                parent_face[neighbour] = current
                connected_tree_edges.add(edge)
                queue.append(neighbour)

    if any(row is None for row in placed) or sum(component_sizes) != len(local):
        raise ValueError("Original source dual-graph traversal lost actual faces.")
    if (expected_original_component_count is not None
            and len(component_sizes) != expected_original_component_count):
        raise ValueError("Selected edges disconnected a real original source component.")
    uv_faces = [[placed[i][vertex] for vertex in face]
                for i, face in enumerate(original_indices)]
    total_shared = len(shared)
    true_tree = len(connected_tree_edges)
    if true_tree != len(local) - len(component_sizes):
        raise ValueError("Source shared-edge spanning forest has incorrect size.")
    cycle_count = 0
    cycle_closed = 0
    cycle_open = 0
    cycle_max_gap_mm = 0.0
    cycle_square_gap_sum = 0.0
    for edge, a, b in shared:
        worst = max(
            _length(placed[a][vertex], placed[b][vertex])
            for vertex in edge
        ) * 1000.0
        if not math.isfinite(worst):
            raise ValueError("Real original quad UV cycle seam has unknown gap.")
        if edge in connected_tree_edges:
            if worst > 0.001:
                raise ValueError("Spanning-tree original source seam silently disconnected.")
        else:
            cycle_count += 1
            cycle_max_gap_mm = max(cycle_max_gap_mm, worst)
            cycle_square_gap_sum += worst * worst
            if worst <= 0.001:
                cycle_closed += 1
            else:
                cycle_open += 1
    if true_tree + cycle_count != total_shared:
        raise ValueError("Original source dual graph lost non-tree sewing seams.")

    # Real UV charts connect along the verified spanning forest, but seam
    # overlap, curvature strain around cycles, fabric grain and fitting remain
    # unapproved. Component identities are connectivity, NOT body/leg labels.
    return {
        "face_uv_loops": uv_faces,
        "report": {
            "researchOnly": True,
            "originalSourceQuadCount": len(original_indices),
            "originalSourceUvLoopCount": sum(len(row) for row in uv_faces),
            "originalSourceCutEdgeCount": len(cuts),
            "openSourceBoundaryEdgeCount": sum(len(rows) == 1 for rows in owners.values()),
            "sharedOriginalSourceEdgeCount": total_shared,
            "dualGraphComponentCount": len(component_sizes),
            "dualGraphComponentSourceFaceCounts": component_sizes,
            "verifiedTreeConnectedSharedEdges": true_tree,
            "nonTreeCycleSharedEdges": cycle_count,
            "nonTreeCycleEdgesWithinOneMicrometre": cycle_closed,
            "nonTreeCycleUnclosedUvEdges": cycle_open,
            "maximumNonTreeUvSeamGapMm": round(cycle_max_gap_mm, 5),
            "rmsNonTreeUvSeamGapMm": round(
                math.sqrt(cycle_square_gap_sum / cycle_count) if cycle_count else 0.0, 5
            ),
            "maximumTreeEdgeUvJoinErrorMm": round(max_tree_join_error_mm, 8),
            "actualOriginalSourceUVTopology": (
                "deterministic max-retained-real-edge spanning forest"
                if preferred_tree_edges is not None
                else "deterministic face-adjacency spanning forest"
            ),
            "selectedForestSource": (
                "explicit validated original-source shared edge list"
                if preferred_tree_edges is not None else "original face-index BFS"
            ),
            "faceTreeParentsRecorded": sum(p >= 0 for p in parent_face),
            "localMetricTrianglesRemainUnscaled": True,
            "sourcePanelsFullyStitchedInUV": False,
            "cyclicSeamsHaveBeenPhysicallyClosed": False,
            "surfaceUvOverlapCertifiedAbsent": False,
            "realSourceToBridgeUvJoined": False,
            "measuredSupplierRepeatMm": None,
            "tailorSeamAllowanceApproved": False,
            "physicalFabricScaleVerified": False,
            "productionApproved": False,
            "metricCaveat": (
                "Tree edges are UV-joined using exact geometric rigid motions, "
                "but real cyclic face loops may not close without distortion; "
                "overlap, physical grain, seam allowance, supplier repeat, "
                "cloth physics and full sewn garment remain UNVERIFIED."
            ),
        },
    }
