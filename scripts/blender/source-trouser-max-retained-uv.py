"""Maximum-retained-real-edge UV tree for ACTUAL original trouser source.

This is a graph-theoretic minimum of the total 3D length of *non-tree*
shared source edges, not a seam construction, textile cutting plan, fabric
allowance, source face modification, or proved overlap-free UV mapping.
"""
from __future__ import annotations

from collections import defaultdict
import math


def select_original_source_max_retained_uv_tree(points, original_faces, original_cut_edges):
    if len(original_faces) != 2650 or len(original_cut_edges) != 8 or not points:
        raise ValueError("Real source UV optimization requires 2650 faces and 8 true cut edges.")
    verts = []
    for pt in points:
        xyz = tuple(float(x) for x in pt)
        if len(xyz) != 3 or not all(math.isfinite(x) for x in xyz):
            raise ValueError("Original source position is invalid for retaining UV edges.")
        verts.append(xyz)
    owners = defaultdict(list)
    for face_id, face_raw in enumerate(original_faces):
        face = tuple(int(x) for x in face_raw)
        if (len(face) != 4 or len(set(face)) != 4 or min(face) < 0
                or max(face) >= len(verts)):
            raise ValueError("Original source UV max-tree requires valid actual quads.")
        for i in range(4):
            a, b = face[i], face[(i + 1) % 4]
            key = (min(a, b), max(a, b))
            owners[key].append((face_id, (a, b) == key))
    if any(len(rows) > 2 for rows in owners.values()):
        raise ValueError("Original source mesh is nonmanifold.")
    actual_cuts = {tuple(sorted(edge)) for edge in original_cut_edges}
    if len(actual_cuts) != 8 or any(
            len(edge) != 2 or edge[0] == edge[1]
            or len(owners.get(edge, [])) != 1 for edge in actual_cuts):
        raise ValueError("A proposed original crotch edge has no unique source owner.")

    shared = []
    all_mm = 0.0
    for edge, rows in owners.items():
        if len(rows) != 2:
            continue
        if rows[0][1] == rows[1][1]:
            raise ValueError("Original source geometry has wrong shared-edge orientation.")
        a, b = edge
        length_mm = math.dist(verts[a], verts[b]) * 1000.0
        if not math.isfinite(length_mm) or length_mm <= 1e-6:
            raise ValueError("True original source shared edge has invalid 3D length.")
        shared.append((length_mm, edge, rows[0][0], rows[1][0]))
        all_mm += length_mm

    parent = list(range(len(original_faces)))
    rank = [0] * len(original_faces)

    def root(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def join(x, y):
        a, b = root(x), root(y)
        if a == b:
            return False
        if rank[a] < rank[b] or (rank[a] == rank[b] and a > b):
            a, b = b, a
        parent[b] = a
        if rank[a] == rank[b]:
            rank[a] += 1
        return True

    # Kruskal in descending true original 3D edge length. Ties are stable
    # original source vertex indices and owner IDs, never AI or fabric labels.
    shared.sort(key=lambda v: (-v[0], v[1], v[2], v[3]))
    retained = []
    selected_mm = 0.0
    for length_mm, edge, left, right in shared:
        if join(left, right):
            retained.append(edge)
            selected_mm += length_mm
    component_roots = {root(i) for i in range(len(original_faces))}
    components = len(component_roots)
    if len(retained) != len(original_faces) - components:
        raise ValueError("Original source max-retained tree dropped true connected faces.")
    if not all(math.isfinite(v) for v in (selected_mm, all_mm)):
        raise ValueError("Nonfinite original source UV tree physical-geometry metric.")
    remaining = max(0.0, all_mm - selected_mm)
    # This optimum is ONLY a lower bound on 3D length of the omitted source
    # face-graph edges for forest-type UV joining; the actual 2D closure and
    # manufacturing grain cannot be inferred from the edge selection.
    return {
        "retainedOriginalSourceEdges": [list(edge) for edge in retained],
        "report": {
            "researchOnly": True,
            "originalSourceQuadCount": len(original_faces),
            "originalSourceSharedEdgeCount": len(shared),
            "originalSourceComponentCount": components,
            "actualOriginalCutEdgeCount": len(actual_cuts),
            "maximumRetainedTreeEdgeCount": len(retained),
            "theoreticalNonTreeSourceEdgeCount": len(shared) - len(retained),
            "allRealSharedSourceEdgeLengthMm": round(all_mm, 5),
            "realRetainedTreeEdgeLengthMm": round(selected_mm, 5),
            "minimumOmittedOriginalSourceEdgeLengthMm": round(remaining, 5),
            "treeStrategy": "Kruskal maximum original 3D source edge length",
            "metricCaveat": (
                "Minimum omitted 3D source edge length among face spanning "
                "forests is a graph bound, NOT a real cut path, a correct "
                "UV/cloth unwrap, true textile scale or tailor-approved seam."
            ),
            "actualCuttingLinesApproved": False,
            "overlapFreeUvApproved": False,
            "fabricScaleAndGrainApproved": False,
            "physicalCrotchFitApproved": False,
            "productionApproved": False,
        },
    }
