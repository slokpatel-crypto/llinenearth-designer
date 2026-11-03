"""Pure original-trouser/source seam winding evidence; never an approved sewn pattern.

Only six existing experimental bridge triangles may reverse winding. Original
source faces, cut-edge endpoints and geometry coordinates remain immutable.
A zero winding mismatch does NOT prove UV, physical cloth, or seam approval.
"""
from collections import defaultdict


def _directed_owners(original_faces, bridge_faces):
    owners = defaultdict(list)
    for kind, faces in (("original", original_faces), ("researchBridge", bridge_faces)):
        for i, face in enumerate(faces):
            if len(face) < 3 or len(face) != len(set(face)):
                raise ValueError("Original source/bridge has a degenerate face index cycle.")
            for j in range(len(face)):
                a, b = int(face[j]), int(face[(j + 1) % len(face)])
                if a == b or min(a, b) < 0:
                    raise ValueError("Source seam vertex indices are invalid.")
                edge = (min(a, b), max(a, b))
                owners[edge].append((kind, i, 1 if (a, b) == edge else -1))
    if any(len(value) > 2 for value in owners.values()):
        raise ValueError("Source bridge seam topology has nonmanifold edge owners.")
    return owners


def _inspect(original_faces, bridge_faces, original_unmatched_edges):
    owners = _directed_owners(original_faces, bridge_faces)
    bad_added = []
    bad_original = []
    for edge, rows in owners.items():
        if len(rows) != 2 or rows[0][2] != rows[1][2]:
            continue
        (bad_added if any(row[0] == "researchBridge" for row in rows)
         else bad_original).append(list(edge))
    original_cut = []
    for edge in original_unmatched_edges:
        key = tuple(sorted(edge))
        rows = owners.get(key, [])
        if len(rows) != 2 or {row[0] for row in rows} != {
                "original", "researchBridge"}:
            raise ValueError("Real source cut edge did not join one original face and one research bridge face.")
        original_cut.append({
            "originalCutEdge": list(key),
            "originalAndResearchOppositeWinding": rows[0][2] != rows[1][2],
            "originalFaceIndex": next(i for kind, i, _ in rows if kind == "original"),
            "bridgeFaceIndex": next(i for kind, i, _ in rows if kind == "researchBridge"),
        })
    return {
        "newResearchBridgeWindingMismatchEdges": sorted(bad_added),
        "unchangedOriginalSourceWindingMismatchEdges": sorted(bad_original),
        "originalCutEdgeOwnership": original_cut,
        "openBoundaryEdgeCount": sum(len(rows) == 1 for rows in owners.values()),
        "nonManifoldEdgeCount": sum(len(rows) > 2 for rows in owners.values()),
    }


def solve_original_source_seam_winding(original_faces, bridge_faces,
                                       original_unmatched_edges):
    """Try ALL 2^N actual source triangle reversals; score only bridge seams."""
    original_faces = [tuple(row) for row in original_faces]
    bridge_faces = [tuple(row) for row in bridge_faces]
    expected_edges = {tuple(sorted(edge)) for edge in original_unmatched_edges}
    if len(bridge_faces) != 6 or len(original_faces) != 2650:
        raise ValueError("Only the actual measured six-bridge/2650-original source topology is supported.")
    if len(expected_edges) != 8 or any(len(edge) != 2 or edge[0] == edge[1]
                                       for edge in expected_edges):
        raise ValueError("Expected eight unique actual original-source unmatched cut edges.")
    control = _inspect(original_faces, bridge_faces, sorted(expected_edges))
    best = None
    for mask in range(1 << len(bridge_faces)):
        flipped = [
            tuple(reversed(face)) if mask & (1 << i) else tuple(face)
            for i, face in enumerate(bridge_faces)
        ]
        metrics = _inspect(original_faces, flipped, sorted(expected_edges))
        if metrics["openBoundaryEdgeCount"] != control["openBoundaryEdgeCount"]:
            raise ValueError("Winding reversal changed actual original source open edge count.")
        if (metrics["unchangedOriginalSourceWindingMismatchEdges"] !=
                control["unchangedOriginalSourceWindingMismatchEdges"]):
            raise ValueError("Original source face orientation was modified.")
        score = (
            len(metrics["newResearchBridgeWindingMismatchEdges"]),
            mask.bit_count(),
            mask,
        )
        if best is None or score < best[0]:
            best = (score, flipped, metrics, mask)
    if best is None:
        raise ValueError("Cannot construct deterministic research seam orientation evidence.")
    _, corrected, metrics, mask = best
    return {
        "researchOnly": True,
        "originalSourceFaceCount": len(original_faces),
        "experimentalBridgeFaceCount": len(bridge_faces),
        "originalCutEdgeCount": len(expected_edges),
        "exhaustiveWindingCombinationsChecked": 1 << len(bridge_faces),
        "flippedResearchBridgeFaceIndices": [
            i for i in range(len(bridge_faces)) if mask & (1 << i)
        ],
        "control": control,
        "corrected": metrics,
        "correctedResearchBridgeFaces": [list(face) for face in corrected],
        "strictBridgeSeamWindingImprovementObserved": (
            len(metrics["newResearchBridgeWindingMismatchEdges"]) <
            len(control["newResearchBridgeWindingMismatchEdges"])
        ),
        "allNewResearchBridgeTwoOwnerEdgesOppositelyWound": (
            len(metrics["newResearchBridgeWindingMismatchEdges"]) == 0
        ),
        "sewnGarmentApproved": False,
        "sourceUVAndFabricRepeatVerified": False,
        "productionApproved": False,
        "changesProductionGeometry": False,
        "metricCaveat": (
            "Only original six research-bridge triangle windings can reverse. "
            "Opposite edge winding is necessary but never sufficient for sewn "
            "cloth, UV, seam allowances, inside/outside body fit or production."
        ),
    }
