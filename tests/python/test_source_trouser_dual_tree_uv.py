"""Deterministic 2,650-face real-topology UV spanning-tree research regression."""
from pathlib import Path
import math
import runpy

ROOT = Path(__file__).resolve().parents[2] / "scripts/blender"
metric = runpy.run_path(str(ROOT / "source-trouser-quad-metric-uv.py"))[
    "unfold_original_trouser_source_quads"
]
connect = runpy.run_path(str(ROOT / "source-trouser-dual-tree-uv.py"))[
    "connect_original_source_uv_forest"
]
columns, rows = 53, 50
assert columns * rows == 2650
points = [
    (float(x) * 0.01, float(y) * 0.01, 0.0)
    for y in range(rows + 1) for x in range(columns + 1)
]
def vertex(x, y):
    return y * (columns + 1) + x

faces = [
    (vertex(x, y), vertex(x + 1, y),
     vertex(x + 1, y + 1), vertex(x, y + 1))
    for y in range(rows) for x in range(columns)
]
cuts = [
    (vertex(x, 0), vertex(x + 1, 0))
    for x in range(8)
]
flat = metric(points, faces, cuts)
connected = connect(faces, flat["face_uv_loops"], cuts)
again = connect(faces, flat["face_uv_loops"], cuts)
assert connected == again, "Original-source tree is not deterministic"
r = connected["report"]
assert r["originalSourceQuadCount"] == 2650
assert r["originalSourceUvLoopCount"] == 10600
assert r["originalSourceCutEdgeCount"] == 8
assert r["dualGraphComponentCount"] == 1
assert r["dualGraphComponentSourceFaceCounts"] == [2650]
assert r["verifiedTreeConnectedSharedEdges"] == 2649
assert r["sharedOriginalSourceEdgeCount"] == (53*49+50*52)
assert r["nonTreeCycleSharedEdges"] == r["sharedOriginalSourceEdgeCount"] - 2649
assert r["nonTreeCycleUnclosedUvEdges"] == 0, "Planar face grid did not close all cycles"
assert r["nonTreeCycleEdgesWithinOneMicrometre"] == r["nonTreeCycleSharedEdges"]
assert r["maximumNonTreeUvSeamGapMm"] <= 0.001
assert r["maximumTreeEdgeUvJoinErrorMm"] <= 0.001
assert r["faceTreeParentsRecorded"] == 2649
assert r["localMetricTrianglesRemainUnscaled"] is True
assert r["sourcePanelsFullyStitchedInUV"] is False
assert r["cyclicSeamsHaveBeenPhysicallyClosed"] is False
assert r["surfaceUvOverlapCertifiedAbsent"] is False
assert r["realSourceToBridgeUvJoined"] is False
assert r["measuredSupplierRepeatMm"] is None
assert r["physicalFabricScaleVerified"] is False
assert r["productionApproved"] is False

# A separate actual source geometry component can be flattened, but is never
# claimed physically sewn to the other source component.
detached = list(faces)
detached[-1] = tuple(len(points)+i for i in range(4))
extra = flat["face_uv_loops"][:]
extra[-1] = flat["face_uv_loops"][-1]
disconnected = connect(detached, extra, cuts)
assert disconnected["report"]["dualGraphComponentCount"] == 2
assert disconnected["report"]["verifiedTreeConnectedSharedEdges"] == 2648

def rejected(source_faces, face_uv, edges):
    try:
        connect(source_faces, face_uv, edges)
    except (ValueError, IndexError, TypeError):
        return
    raise AssertionError("Inconsistent original UV face adjacency was accepted.")

rejected(faces[:-1], flat["face_uv_loops"], cuts)
rejected(faces, flat["face_uv_loops"], cuts[:-1])
bad = list(faces)
bad[22] = (0, 0, 1, 2)
rejected(bad, flat["face_uv_loops"], cuts)
bad = list(faces)
bad[22] = (0, 1, bad[22][2], bad[22][3])
bad[23] = (0, 1, bad[23][2], bad[23][3])
rejected(bad, flat["face_uv_loops"], cuts)
bad_coords = list(flat["face_uv_loops"])
bad_coords[0] = list(bad_coords[0])
bad_coords[0][2] = (math.inf, 0.01)
rejected(faces, bad_coords, cuts)
bad_coords = list(flat["face_uv_loops"])
bad_coords[0] = list(bad_coords[0])
bad_coords[0][2] = bad_coords[0][1]
rejected(faces, bad_coords, cuts)
print("TITAN_ORIGINAL_TROUSER_METRIC_DUAL_TREE_UV_SYNTHETIC_PASS")
