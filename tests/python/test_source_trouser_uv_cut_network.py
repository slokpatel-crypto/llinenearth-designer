"""Actual original-source UV cut candidate metrics: planar and curved fixtures."""
from pathlib import Path
import math
import runpy

root = Path(__file__).resolve().parents[2] / "scripts/blender"
metric = runpy.run_path(str(root / "source-trouser-quad-metric-uv.py"))[
    "unfold_original_trouser_source_quads"
]
join = runpy.run_path(str(root / "source-trouser-dual-tree-uv.py"))[
    "connect_original_source_uv_forest"
]
audit = runpy.run_path(str(root / "source-trouser-uv-cut-network.py"))[
    "audit_original_source_uv_cut_network"
]
nx, ny = 53, 50
assert nx * ny == 2650
def grid(x, y):
    return y * (nx + 1) + x
faces = [
    (grid(x,y),grid(x+1,y),grid(x+1,y+1),grid(x,y+1))
    for y in range(ny) for x in range(nx)
]
cuts = [(grid(x,0),grid(x+1,0)) for x in range(8)]

def run(z):
    points = [
        (x*0.01, y*0.01, z(x,y))
        for y in range(ny+1) for x in range(nx+1)
    ]
    quads = metric(points, faces, cuts)
    joined = join(faces, quads["face_uv_loops"], cuts)
    actual = audit(points, faces, joined["face_uv_loops"], cuts,
                   joined["report"])
    return points, quads, joined, actual

flat_points, flat_metric, flat_tree, flat = run(lambda x,y:0.0)
assert flat == audit(flat_points, faces, flat_tree["face_uv_loops"],
                     cuts,flat_tree["report"])
assert flat["actualOriginalSourceQuadCount"] == 2650
assert flat["originalSourceUvLoopCount"] == 10600
assert flat["originalSharedSourceEdgeCount"] == (nx*(ny-1)+ny*(nx-1))
assert flat["originalOpenSourceBoundaryEdges"] == 2*(nx+ny)
assert flat["genuineCrotchCutEdgeCount"] == 8
assert flat["unclosedSharedUvCutCandidateEdges"] == 0
assert flat["joinedSharedUvEdges"] == flat["originalSharedSourceEdgeCount"]
assert flat["uvCutCandidateGraphComponentCount"] == 0
assert flat["totalRealGeometryOfUvCutCandidatesMm"] == 0
assert flat["uvCutCandidateSourceVertexCount"] == 0
assert flat["actualLargestGapUvCutEdges"] == []
assert flat["seamCutTopologyApproved"] is False
assert flat["realTailorCutLinesApproved"] is False
assert flat["measuredSupplierTextileRepeatMm"] is None
assert flat["productionApproved"] is False

curved_points, curved_metric, curved_tree, curved = run(
    lambda x,y: 0.004*math.sin(x*0.23)*math.sin(y*0.21)
)
assert curved["joinedSharedUvEdges"] == (
    curved_tree["report"]["verifiedTreeConnectedSharedEdges"] +
    curved_tree["report"]["nonTreeCycleEdgesWithinOneMicrometre"]
)
assert curved["unclosedSharedUvCutCandidateEdges"] == (
    curved_tree["report"]["nonTreeCycleUnclosedUvEdges"]
)
assert curved["originalSharedSourceEdgeCount"] == (nx*(ny-1)+ny*(nx-1))
assert curved["joinedSharedUvEdges"] + curved["unclosedSharedUvCutCandidateEdges"] == (nx*(ny-1)+ny*(nx-1))
assert curved["unclosedSharedUvCutCandidateEdges"] > 0
assert curved["totalRealGeometryOfUvCutCandidatesMm"] > 0
assert curved["uvCutCandidateGraphComponentCount"] >= 1
assert curved["maximumUnclosedUvEdgeGapMm"] > 0.001
assert curved["uvCutCandidateSourceVertexCount"] >= 2
assert len(curved["actualLargestGapUvCutEdges"]) <= 12
assert all(v["sourceRealEdgeLengthMm"] > 0 for v in curved["actualLargestGapUvCutEdges"])
assert all(v["provisionalUvEndpointGapMm"] > 0.001 for v in curved["actualLargestGapUvCutEdges"])
assert curved["productionApproved"] is False

def rejected(points, face_list, uv, edges, report):
    try:
        audit(points,face_list,uv,edges,report)
    except (ValueError,IndexError,TypeError,KeyError):
        return
    raise AssertionError("Malformed original source UV seam cut inventory was accepted")

rejected(flat_points,faces,flat_tree["face_uv_loops"],cuts[:-1],flat_tree["report"])
rejected(flat_points,faces[:-1],flat_tree["face_uv_loops"],cuts,flat_tree["report"])
bad_faces = list(faces)
bad_faces[10] = (0,0,bad_faces[10][2],bad_faces[10][3])
rejected(flat_points,bad_faces,flat_tree["face_uv_loops"],cuts,flat_tree["report"])
bad_points = list(flat_points)
bad_points[0] = (math.nan,0,0)
rejected(bad_points,faces,flat_tree["face_uv_loops"],cuts,flat_tree["report"])
bad_uv = list(flat_tree["face_uv_loops"])
bad_uv[0] = list(bad_uv[0])
bad_uv[0][0] = (math.inf,0)
rejected(flat_points,faces,bad_uv,cuts,flat_tree["report"])
bad_uv = list(flat_tree["face_uv_loops"])
bad_uv[0] = [(x + 0.01, y) for x,y in bad_uv[0]]
rejected(flat_points,faces,bad_uv,cuts,flat_tree["report"])
bad_report = dict(flat_tree["report"])
bad_report["nonTreeCycleUnclosedUvEdges"] = 17
rejected(flat_points,faces,flat_tree["face_uv_loops"],cuts,bad_report)
print("TITAN_ORIGINAL_SOURCE_UV_CUT_NETWORK_SYNTHETIC_PASS")
