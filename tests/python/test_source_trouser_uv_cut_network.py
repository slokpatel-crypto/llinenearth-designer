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
source_graph_module = runpy.run_path(str(root / "source-trouser-uv-cut-network.py"))
audit = source_graph_module["audit_original_source_uv_cut_network"]
classify = source_graph_module["classify_original_source_uv_cut_component"]
trace = source_graph_module["trace_original_source_uv_cut_chains"]
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
assert flat["uvCutGraphCycleRank"] == 0
assert flat["uvCutGraphSimpleOpenPathComponentCount"] == 0
assert flat["uvCutGraphSimpleClosedLoopComponentCount"] == 0
assert flat["uvCutGraphBranchedOrCompoundComponentCount"] == 0
assert flat["uvCutGraphInteriorDegreeOneSourceVertexCount"] == 0
assert flat["uvCutGraphComponentsWithoutActualOriginalOpenBoundary"] == 0
assert flat["uvCutGraphMaximumJunctionDegree"] == 0
assert flat["uvCutGraphJunctionsOnActualOriginalBoundary"] == 0
assert flat["uvCutGraphJunctionsOnGenuineOriginalCrotchCut"] == 0
assert flat["actualLargestOriginalSourceUvCutJunctions"] == []
assert flat["uvCutGraphMaximalSourceChainCount"] == 0
assert flat["uvCutGraphClosedMaximalSourceChainCount"] == 0
assert flat["uvCutGraphMaximalSourceChainEdgeCoverageCount"] == 0
assert flat["uvCutGraphLongestOriginalSourceChainLengthMm"] == 0
assert flat["actualLongestOriginalSourceUvCutChains"] == []
assert flat["actualLongestBranchedOriginalSourceUvCutChains"] == []
assert flat["actualBranchedOriginalSourceUvCutNetworks"] == []
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
assert curved["uvCutGraphCycleRank"] == (
    curved["unclosedSharedUvCutCandidateEdges"] -
    curved["uvCutCandidateSourceVertexCount"] +
    curved["uvCutCandidateGraphComponentCount"]
)
assert curved["uvCutGraphMaximalSourceChainCount"] >= (
    curved["uvCutCandidateGraphComponentCount"]
)
branched = curved["actualBranchedOriginalSourceUvCutNetworks"]
branch_ids = {r["originalSourceMinimumVertexIndex"] for r in branched}
assert len(branched) == curved["uvCutGraphBranchedOrCompoundComponentCount"]
assert len(branched) == len(branch_ids)
assert all(
    row["uvCutGraphTopology"] == "branched-or-compound"
    and row["uvCutGraphMaximalChainCount"] >= 2
    and row["unclosedUvEdgeCount"] ==
        row["uvCutGraphMaximalChainEdgeCoverageCount"]
    and row["realOriginalSourceUvCutNetworkLengthMm"] > 0
    and 0 <= row["originalSourceMinimumVertexIndex"] < len(curved_points)
    for row in branched
)
branch_chains = curved["actualLongestBranchedOriginalSourceUvCutChains"]
assert len(branch_chains) == min(
    sum(row["uvCutGraphMaximalChainCount"] for row in branched), 12
)
assert all(
    row["originalSourceComponentMinimumVertexIndex"] in branch_ids
    and row["originalSourceEdgeCount"] == len(row["originalSourceVertexPath"]) - 1
    and row["realOriginalSourceChainLengthMm"] > 0
    for row in branch_chains
)
assert all(
    row["originalSourceComponentMinimumVertexIndex"] >= 0
    for row in curved["actualLongestOriginalSourceUvCutChains"]
)
assert curved["uvCutGraphMaximalSourceChainEdgeCoverageCount"] == (
    curved["unclosedSharedUvCutCandidateEdges"]
)
assert curved["uvCutGraphClosedMaximalSourceChainCount"] <= (
    curved["uvCutGraphMaximalSourceChainCount"]
)
assert sum(row["uvCutGraphMaximalChainCount"]
           for row in curved["uvCutCandidateGraphLargestComponents"]) <= (
    curved["uvCutGraphMaximalSourceChainCount"]
)
assert all(
    row["uvCutGraphMaximalChainCount"] >= 1 and
    row["uvCutGraphMaximalChainEdgeCoverageCount"] ==
    row["unclosedUvEdgeCount"] and
    type(row["originalSourceMinimumVertexIndex"]) is int
    for row in curved["uvCutCandidateGraphLargestComponents"]
)
assert len(curved["actualLongestOriginalSourceUvCutChains"]) == min(
    curved["uvCutGraphMaximalSourceChainCount"],12
)
# Every top-ranked native source chain now retains the complete ordered
# ORIGINAL source vertex path, enabling exact 3D adjacency and metric checks
# rather than an un-reconstructable pair of endpoints.
actual_source_edges = {
    tuple(sorted((face[i], face[(i+1)%4])))
    for face in faces for i in range(4)
}
top_chains = curved["actualLongestOriginalSourceUvCutChains"]
assert all(
    r["originalSourceEdgeCount"] >= 1
    and r["realOriginalSourceChainLengthMm"] > 0
    and type(r["closedGraphLoop"]) is bool
    and type(r["originalSourceStartVertexIndex"]) is int
    and type(r["originalSourceEndVertexIndex"]) is int
    and len(r["originalSourceVertexPath"]) ==
        r["originalSourceEdgeCount"] + 1
    and all(type(v) is int and 0 <= v < len(curved_points)
            for v in r["originalSourceVertexPath"])
    and r["originalSourceVertexPath"][0] ==
        r["originalSourceStartVertexIndex"]
    and r["originalSourceVertexPath"][-1] ==
        r["originalSourceEndVertexIndex"]
    and all(
        a != b and tuple(sorted((a,b))) in actual_source_edges
        for a,b in zip(r["originalSourceVertexPath"],
                       r["originalSourceVertexPath"][1:])
    )
    and abs(
        math.fsum(
            math.dist(curved_points[a], curved_points[b]) * 1000
            for a,b in zip(r["originalSourceVertexPath"],
                           r["originalSourceVertexPath"][1:])
        ) - r["realOriginalSourceChainLengthMm"]
    ) <= .00002
    and r["closedGraphLoop"] == (
        r["originalSourceStartVertexIndex"] ==
        r["originalSourceEndVertexIndex"]
    )
    for r in top_chains
)
assert len({
    tuple(sorted((a,b)))
    for r in top_chains
    for a,b in zip(r["originalSourceVertexPath"],
                   r["originalSourceVertexPath"][1:])
}) == sum(r["originalSourceEdgeCount"] for r in top_chains)
junction_count = curved["uvCutCandidateDegreeThreePlusSourceVertices"]
junctions = curved["actualLargestOriginalSourceUvCutJunctions"]
assert len(junctions) == min(junction_count,12)
assert 0 <= curved["uvCutGraphJunctionsOnActualOriginalBoundary"] <= junction_count
assert 0 <= curved["uvCutGraphJunctionsOnGenuineOriginalCrotchCut"] <= junction_count
assert curved["uvCutGraphMaximumJunctionDegree"] == (
    junctions[0]["sourceUvCutGraphDegree"] if junctions else 0
)
assert [(-r["sourceUvCutGraphDegree"],
         -r["incidentOriginalSourceCutEdgeLengthMm"],
         r["originalSourceVertexIndex"]) for r in junctions] == sorted(
    [(-r["sourceUvCutGraphDegree"],
      -r["incidentOriginalSourceCutEdgeLengthMm"],
      r["originalSourceVertexIndex"]) for r in junctions]
)
assert all(
    type(r["originalSourceVertexIndex"]) is int
    and 0 <= r["originalSourceVertexIndex"] < len(curved_points)
    and r["sourceUvCutGraphDegree"] >= 3
    and len(r["realOriginalSourcePositionMm"]) == 3
    and all(math.isfinite(x) for x in r["realOriginalSourcePositionMm"])
    and r["incidentOriginalSourceCutEdgeLengthMm"] > 0
    and type(r["touchesActualOriginalOpenBoundary"]) is bool
    and type(r["touchesGenuineOriginalCrotchCut"]) is bool
    for r in junctions
)
assert sum(curved[key] for key in (
    "uvCutGraphSimpleOpenPathComponentCount",
    "uvCutGraphSimpleClosedLoopComponentCount",
    "uvCutGraphBranchedOrCompoundComponentCount"
)) == curved["uvCutCandidateGraphComponentCount"]
assert all(
    row["uvCutGraphCycleRank"] >= 0
    and row["unclosedUvEdgeCount"] - row["originalSourceVertexCount"] + 1
        == row["uvCutGraphCycleRank"]
    and row["interiorDegreeOneSourceVertices"] <= row["degreeOneSourceVertices"]
    and row["originalBoundaryContactSourceVertexCount"] <= row["originalSourceVertexCount"]
    and row["uvCutGraphTopology"] in (
        "simple-open-path", "simple-closed-loop", "branched-or-compound")
    for row in curved["uvCutCandidateGraphLargestComponents"]
)

# Unit geometry fixtures here are abstract original-source edge graphs,
# not verified sewn panels or altered original production 3D source.
def edge_graph(edges):
    graph = {}
    for a,b in edges:
        graph.setdefault(a,set()).add(b)
        graph.setdefault(b,set()).add(a)
    return graph

path_graph = edge_graph(((1,2),(2,3)))
path_report = classify(path_graph, (1,2,3), {1})
assert trace(path_graph, (1,2,3)) == [[1,2,3]]
assert path_report["uvCutGraphTopology"] == "simple-open-path"
assert path_report["uvCutGraphCycleRank"] == 0
assert path_report["unclosedUvEdgeCount"] == 2
assert path_report["degreeOneSourceVertices"] == 2
assert path_report["interiorDegreeOneSourceVertices"] == 1
assert path_report["originalBoundaryContactSourceVertexCount"] == 1

loop_graph = edge_graph(((1,2),(2,3),(3,4),(4,1)))
loop_report = classify(loop_graph, (1,2,3,4), set())
assert trace(loop_graph, (1,2,3,4)) == [[1,2,3,4,1]]
assert loop_report["uvCutGraphTopology"] == "simple-closed-loop"
assert loop_report["uvCutGraphCycleRank"] == 1
assert loop_report["degreeOneSourceVertices"] == 0
assert loop_report["touchesActualOriginalOpenBoundary"] is False

branch_graph = edge_graph(((1,2),(2,3),(2,4)))
branch_report = classify(branch_graph, (1,2,3,4), {1,3})
assert trace(branch_graph, (1,2,3,4)) == [
    [1,2], [2,3], [2,4]
]
assert branch_report["uvCutGraphTopology"] == "branched-or-compound"
assert branch_report["uvCutGraphCycleRank"] == 0
assert branch_report["branchingSourceVertices"] == 1
assert branch_report["degreeOneSourceVertices"] == 3
assert branch_report["interiorDegreeOneSourceVertices"] == 1
# Disconnected graph components can forge the SAME Euler rank and degree
# pattern as a single path/loop unless connectivity is checked separately.
disjoint_path_and_loop = edge_graph((
    (1,2),(2,3),(4,5),(5,6),(6,4)
))
assert len(disjoint_path_and_loop) == 6
assert sum(map(len, disjoint_path_and_loop.values())) // 2 == 5
assert 5 - 6 + 1 == 0  # would masquerade as one simple-open-path
two_disjoint_loops = edge_graph((
    (1,2),(2,3),(3,1),(4,5),(5,6),(6,4)
))
branch_and_loop = edge_graph(((1,2),(2,3),(3,1),(1,4)))
assert trace(branch_and_loop, (1,2,3,4)) == [
    [1,2,3,1], [1,4]
]
assert sum(len(row)-1 for row in trace(branch_and_loop,(1,2,3,4))) == 4
assert 6 - 6 + 1 == 1  # would masquerade as one simple-closed-loop
for invalid_graph, vertices in (
        ({},()),
        ({1:{1}},(1,)),
        ({1:{2},2:set()},(1,2)),
        (path_graph,(1,2,2,3)),  # duplicated source vertex evidence
        (disjoint_path_and_loop,(1,2,3,4,5,6)),
        (two_disjoint_loops,(1,2,3,4,5,6))):
    try:
        classify(invalid_graph, vertices, set())
    except (ValueError,KeyError):
        pass
    else:
        raise AssertionError("Invalid or disconnected source UV cut graph was accepted.")
    try:
        trace(invalid_graph, vertices)
    except (ValueError, KeyError):
        pass
    else:
        raise AssertionError("Invalid/disconnected original UV chain was accepted.")

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

# The genuine original-source cut audit cannot coerce impostor inputs into
# plausible native vertex IDs or physical UV/3D coordinates.
for forged in (False, 0.2, "0"):
    bad_faces = list(faces)
    bad_faces[0] = (forged, *faces[0][1:])
    rejected(flat_points,bad_faces,flat_tree["face_uv_loops"],cuts,flat_tree["report"])
    bad_cuts = list(cuts)
    bad_cuts[0] = (forged,cuts[0][1])
    rejected(flat_points,faces,flat_tree["face_uv_loops"],bad_cuts,flat_tree["report"])
for forged in (True, "0.0", None, complex(0,0)):
    bad_points = list(flat_points)
    bad_points[0] = (forged,*flat_points[0][1:])
    rejected(bad_points,faces,flat_tree["face_uv_loops"],cuts,flat_tree["report"])
for forged in (True, "0.0", None, complex(0,0)):
    bad_uv = list(flat_tree["face_uv_loops"])
    bad_uv[0] = list(bad_uv[0])
    bad_uv[0][0] = (forged,bad_uv[0][0][1])
    rejected(flat_points,faces,bad_uv,cuts,flat_tree["report"])
assert flat_points[0] == (0.0,0.0,0.0)
assert faces[0] == (0,1,nx+2,nx+1)
assert flat["productionApproved"] is False
print("TITAN_ORIGINAL_SOURCE_UV_CUT_NETWORK_SYNTHETIC_PASS")
