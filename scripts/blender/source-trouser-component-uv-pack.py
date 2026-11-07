"""Research-only, rigid 2D packing of TRUE disconnected original-source UVs.

A finite translation of an entire genuine face-graph component cannot distort
its local 2D triangles or close its cyclic seams. It CAN remove false overlaps
between independent source UV components. This is NOT source garment cutting,
tailor panel layout, real fabric width/repeat, seam allowance, or model export.
"""
from __future__ import annotations

from collections import defaultdict, deque
import math


def pack_original_source_uv_face_components(
        original_faces, face_uv_loops, display_gap_mm=5.0):
    if len(original_faces) != 2650 or len(face_uv_loops) != 2650:
        raise ValueError("All 2650 genuine source face UV charts are mandatory.")
    if (isinstance(display_gap_mm, bool)
            or not isinstance(display_gap_mm, (int, float))
            or not math.isfinite(display_gap_mm)
            or not 0 < display_gap_mm <= 100):
        raise ValueError("Only finite positive research UV display gap in (0,100]mm.")
    # Source face graph: shared 3D vertex IDs, never UV pixel overlap or
    # inferred left/right leg labels. No geometry or original IDs are changed.
    owner = defaultdict(list)
    normalized = []
    for face_id, (raw_face, raw_uv) in enumerate(zip(original_faces, face_uv_loops)):
        face = tuple(raw_face)
        if (len(face) != 4 or len(set(face)) != 4
                or any(type(i) is not int or i < 0 for i in face)):
            raise ValueError("Original source UV component contains invalid face IDs.")
        if len(raw_uv) != 4:
            raise ValueError("Source UV component is not a four-loop original quad.")
        uv = []
        for point in raw_uv:
            if (len(point) != 2 or any(
                    isinstance(v, bool) or not isinstance(v, (int, float))
                    or not math.isfinite(v) for v in point)):
                raise ValueError("Original source UV component has invalid coordinates.")
            uv.append((float(point[0]), float(point[1])))
        for triangle in ((0, 1, 2), (0, 2, 3)):
            a, b, c = (uv[i] for i in triangle)
            if ((b[0] - a[0]) * (c[1] - a[1])
                    - (b[1] - a[1]) * (c[0] - a[0])) <= 1e-14:
                raise ValueError("Research source UV component has inverted triangle.")
        normalized.append(uv)
        for i in range(4):
            a, b = face[i], face[(i + 1) % 4]
            edge = (min(a, b), max(a, b))
            owner[edge].append((face_id, (a, b) == edge))
    if any(len(rows) > 2 for rows in owner.values()):
        raise ValueError("Nonmanifold original source shared edge in UV packing.")
    adjacency = [[] for _ in normalized]
    for owners in owner.values():
        if len(owners) == 2:
            (a, winding_a), (b, winding_b) = owners
            if winding_a == winding_b:
                raise ValueError("Original source face adjacency has inconsistent seam winding.")
            adjacency[a].append(b)
            adjacency[b].append(a)
    for neighbors in adjacency:
        neighbors.sort()
    visited = set()
    components = []
    for root in range(len(normalized)):
        if root in visited:
            continue
        queue = deque([root])
        visited.add(root)
        group = []
        while queue:
            face_id = queue.popleft()
            group.append(face_id)
            for neighbor in adjacency[face_id]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        components.append(sorted(group))
    if sum(len(group) for group in components) != 2650:
        raise ValueError("Original UV component traversal omitted source faces.")

    packed = [None] * 2650
    reports = []
    gap = float(display_gap_mm) / 1000.0
    right = None
    initial_y = None
    for component_id, group in enumerate(components):
        all_points = [p for face_id in group for p in normalized[face_id]]
        lowx = min(p[0] for p in all_points)
        highx = max(p[0] for p in all_points)
        lowy = min(p[1] for p in all_points)
        highy = max(p[1] for p in all_points)
        if highx <= lowx or highy <= lowy:
            raise ValueError("Source UV component has no 2D bounding area.")
        # Keep component 0 exactly in place, align subsequent source-component
        # bounding boxes horizontally. Research screen margin is not cloth.
        if component_id == 0:
            dx = dy = 0.0
            initial_y = lowy
        else:
            dx = right + gap - lowx
            dy = initial_y - lowy
        for face_id in group:
            packed[face_id] = [
                (u + dx, v + dy) for u, v in normalized[face_id]
            ]
        right = highx + dx
        reports.append({
            "componentId": component_id,
            "rootOriginalSourceFaceId": min(group),
            "originalSourceFaceCount": len(group),
            "originalSourceUVBoundingBoxMm": [
                round(v * 1000.0, 5) for v in (lowx, lowy, highx, highy)
            ],
            "rigidResearchUvTranslationMm": [
                round(dx * 1000.0, 5), round(dy * 1000.0, 5)
            ],
            "packedResearchUvBoundingBoxMm": [
                round(v * 1000.0, 5)
                for v in (lowx + dx, lowy + dy, highx + dx, highy + dy)
            ],
        })
    if any(row is None for row in packed):
        raise ValueError("Lost an actual original source UV face while packing.")
    # Every original face pairwise edge remains the same length, up to the
    # numerical error of floating point translation (never a fabric stretch).
    max_change = 0.0
    for before, after in zip(normalized, packed):
        for i, j in ((0, 1), (1, 2), (2, 3), (3, 0), (0, 2)):
            delta = abs(math.dist(before[i], before[j])
                        - math.dist(after[i], after[j])) * 1000.0
            max_change = max(max_change, delta)
    if max_change > 0.000001:
        raise ValueError("UV component translation introduced triangle-edge stretch.")
    for left, right_report in zip(reports, reports[1:]):
        if (right_report["packedResearchUvBoundingBoxMm"][0] <
                left["packedResearchUvBoundingBoxMm"][2]
                + display_gap_mm - 0.00003):
            raise ValueError("Research source UV packing overlapped component bounds.")
    return {
        "face_uv_loops": packed,
        "report": {
            "researchOnly": True,
            "originalSourceQuadCount": 2650,
            "originalSourceUvLoopCount": 10600,
            "originalSourceFaceGraphComponentCount": len(components),
            "originalSourceComponentFaceCounts": [len(g) for g in components],
            "components": reports,
            "nominalNumericalDisplayGapMm": float(display_gap_mm),
            "maximumOriginalTriangleEdgeChangeMm": round(max_change, 9),
            "sourceGeometryAndVertexIDsUnchanged": True,
            "originalSourceUvTreeUnchanged": True,
            "physicalTextileWidthOrRepeatKnown": False,
            "realTailorSeamsApproved": False,
            "sourcePanelsOverlapFreeApproved": False,
            "physicalBodyClearanceApproved": False,
            "productionApproved": False,
            "metricCaveat": (
                "Entire disconnected source UV face-graph components were "
                "rigidly translated in a research coordinate plane. Their "
                "internal UV collisions, cyclic seam gaps, fabric width, "
                "repeat, grain, tailored cuts and body fit remain UNVERIFIED. "
                "A numerical display margin is NOT a physical seam allowance."
            ),
        },
    }
