"""Synthetic deterministic unit regressions; actual body tests run in native Blender."""
from pathlib import Path
import runpy

helper = runpy.run_path(str(
    Path(__file__).resolve().parents[2] /
    "scripts/blender/source-crotch-seam-winding.py"
))["solve_original_source_seam_winding"]

# Three distinct actual bridge shapes: two quads (2 triangles each),
# two triangular connectors (one triangle each); all source faces immutable.
cut_edges = [
    (0, 1), (3, 2), (4, 5), (5, 6),
    (7, 8), (10, 9), (11, 12), (12, 13),
]
base_faces = [
    (a, b, 100 + i) for i, (a, b) in enumerate(cut_edges)
]
base_faces.extend([
    (1000 + i * 3, 1001 + i * 3, 1002 + i * 3)
    for i in range(2650 - len(base_faces))
])
bridge_faces = [
    (0, 1, 3), (0, 3, 2), (4, 5, 6),
    (7, 8, 10), (7, 10, 9), (11, 12, 13)
]

one = helper(base_faces, bridge_faces, cut_edges)
two = helper(base_faces, bridge_faces, cut_edges)
assert one == two, "Source winding solver must be deterministic"
assert one["exhaustiveWindingCombinationsChecked"] == 64
assert one["originalCutEdgeCount"] == 8
assert one["originalSourceFaceCount"] == 2650
assert one["experimentalBridgeFaceCount"] == 6
assert len(one["control"]["newResearchBridgeWindingMismatchEdges"]) >= 8
assert not one["corrected"]["newResearchBridgeWindingMismatchEdges"]
assert one["strictBridgeSeamWindingImprovementObserved"] is True
assert one["allNewResearchBridgeTwoOwnerEdgesOppositelyWound"] is True
assert all(row["originalAndResearchOppositeWinding"]
           for row in one["corrected"]["originalCutEdgeOwnership"])
assert one["control"]["openBoundaryEdgeCount"] == one["corrected"]["openBoundaryEdgeCount"]
assert one["corrected"]["nonManifoldEdgeCount"] == 0
assert one["productionApproved"] is False
assert one["sourceUVAndFabricRepeatVerified"] is False
assert one["changesProductionGeometry"] is False
assert one["sewnGarmentApproved"] is False
assert len(one["flippedResearchBridgeFaceIndices"]) >= 1

# The oriented topology is already minimal, so reapplying leaves it unchanged.
oriented = [tuple(face) for face in one["correctedResearchBridgeFaces"]]
again = helper(base_faces, oriented, cut_edges)
assert again["correctedResearchBridgeFaces"] == one["correctedResearchBridgeFaces"]
assert not again["flippedResearchBridgeFaceIndices"]

def must_reject(*args):
    try:
        helper(*args)
    except ValueError:
        return
    raise AssertionError("Invalid source ownership was accepted")

must_reject(base_faces, bridge_faces, cut_edges[:-1])
must_reject(base_faces, bridge_faces, cut_edges[:-1] + [(20000, 20001)])
must_reject(base_faces, bridge_faces[:-1], cut_edges)
must_reject(base_faces[:-1], bridge_faces, cut_edges)
mutated = list(base_faces)
mutated[0] = (0, 0, 100)
must_reject(mutated, bridge_faces, cut_edges)
print("TITAN_3D_ORIGINAL_SOURCE_SEAM_WINDING_PURE_TEST_PASS")
