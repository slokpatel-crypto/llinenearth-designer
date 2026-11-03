"""Original source bridge flat charts: exact source-triangle metric tests."""
from pathlib import Path
import runpy

flatten = runpy.run_path(str(
    Path(__file__).resolve().parents[2] /
    "scripts/blender/source-crotch-bridge-flat-charts.py"
))["flatten_original_bridge_charts"]

points = [
    (0,0,0),(0.025,0,0),(0.024,0.031,0.003),(0,0.032,0.001),
    (0.05,0,0),(0.074,0,0),(0.073,0.027,0.003),
    (0,0.06,0),(0.025,0.06,0.002),(0.026,0.092,0.001),(0.001,0.092,0.003),
    (0.05,0.06,0),(0.075,0.06,0.002),(0.074,0.086,0.004),
]
faces=[
    (0,1,3),(0,3,2),(4,5,6),
    (7,8,10),(7,10,9),(11,12,13),
]
pairs=[
    {"leftEdge":[0,1],"rightEdge":[3,2],"bridgeTriangles":2},
    {"leftEdge":[4,5],"rightEdge":[5,6],"bridgeTriangles":1},
    {"leftEdge":[7,8],"rightEdge":[10,9],"bridgeTriangles":2},
    {"leftEdge":[11,12],"rightEdge":[12,13],"bridgeTriangles":1},
]
flat=flatten(points,faces,pairs)
assert flat["researchOnly"] is True
assert flat["chartCount"] == 4 and flat["triangleCount"] == 6
assert flat["flattenedBridgeHasEdgeLengthAccuracyToOneMicrometre"] is True
assert flat["originalSourceUVContinuityProven"] is False
assert flat["supplierFabricRepeatVerified"] is False
assert flat["productionApproved"] is False
assert [v["triangleCount"] for v in flat["charts"]] == [2,1,2,1]
assert sum(len(v["actualBridgeFaceIndices"]) for v in flat["charts"]) == 6
assert all(v["maxActualBridgeEdgeLengthErrorMm"] <= 0.001 for v in flat["charts"])
assert all(v["flattenedSurfaceAreaMm2"] > 0 for v in flat["charts"])
assert all(v["actualCutEdgeLengthMismatchMm"] >= 0 for v in flat["charts"])
assert all(v["sourceTrouserLegUVContinuityVerified"] is False for v in flat["charts"])
assert all(v["tailorSeamAllowanceApproved"] is False for v in flat["charts"])
assert all(len(v["flatChartLocalVertexCoordsMm"]) in (3,4) for v in flat["charts"])
assert flat == flatten(points,faces,pairs), "Native source chart flattening is nondeterministic"

def must_reject(vertices, triangles, segments):
    try:
        flatten(vertices,triangles,segments)
    except (ValueError,IndexError,TypeError):
        return
    raise AssertionError("Invalid real bridge geometry or topology was silently flattened.")

must_reject(points, faces[:-1], pairs)
must_reject(points, [(0,1,3),(0,3,1)] + faces[2:], pairs)
must_reject(points, [(0,1,3),(0,2,4)] + faces[2:], pairs)
must_reject(points, faces, pairs[:-1])
must_reject(points, faces, [{"leftEdge":[0,1],"rightEdge":[3,2],"bridgeTriangles":3}]+pairs[1:])
must_reject(points, faces, [dict(pairs[0],rightEdge=[999,2])]+pairs[1:])
duplicated=list(points)
duplicated[1]=duplicated[0]
must_reject(duplicated, faces,pairs)
print("TITAN_SOURCE_BRIDGE_METRIC_FLAT_CHART_PURE_TEST_PASS")
