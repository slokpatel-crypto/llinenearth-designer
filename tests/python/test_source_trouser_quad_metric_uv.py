"""Independent original quad triangle metric UV tests; production always rejected."""
from pathlib import Path
import math
import runpy

unfold = runpy.run_path(str(
    Path(__file__).resolve().parents[2] /
    "scripts/blender/source-trouser-quad-metric-uv.py"
))["unfold_original_trouser_source_quads"]

points=[
    (0.05,0.0,0.0),(0.06,0.0,0.001),(0.06,0.01,0.002),
    (0.05,0.01,0.001),(0.071,0.0,0.002),(0.071,0.01,0.0025),
]
quads=[(0,1,2,3),(1,4,5,2)]
for i in range(2648):
    base=0.01+(i%100)*0.00025
    z=(i%79)*0.001
    n=len(points)
    points += [
        (base,0.02,z),(base+0.008,0.02,z+0.001),
        (base+0.009,0.031,z+0.002),(base+0.001,0.030,z+0.0005),
    ]
    quads.append((n,n+1,n+2,n+3))
cuts=[
    (0,1),(0,3),(1,4),(4,5),(5,2),(2,3),
    (quads[2][0],quads[2][1]),(quads[3][0],quads[3][1]),
]
result=unfold(points,quads,cuts)
again=unfold(points,quads,cuts)
assert result==again,"Source quad metric research must be deterministic"
r=result["report"]
assert len(result["face_uv_loops"])==2650
assert r["actualOriginalSourceQuadCount"]==2650
assert r["actualOriginalSourceUvLoopCount"]==10600
assert r["originalSourceCutEdgeCount"]==8
assert r["unstitchedUvIslandCount"]==2650
assert r["sharedOriginalSourceEdgeCount"]==1
assert r["provisionalUvDiscontinuousSharedEdges"]==1
assert r["provisionalUvContinuousSharedEdges"]==0
assert r["sourceOpenBoundaryEdgeCount"]>0
assert r["maximumActualQuadTriangleEdgeErrorMm"]<=0.001
assert r["trueOriginalSourceQuadTriangleAreaMm2"]>0
assert abs(r["trueOriginalSourceQuadTriangleAreaMm2"]-
           r["flattenedUnstitchedQuadTriangleAreaMm2"])<=0.1
assert r["flatChartsHaveConnectedGarmentUV"] is False
assert r["realSourceToBridgeUVJoined"] is False
assert r["physicalTextileGrainVerified"] is False
assert r["sourceUVFromProduction"] is False
assert r["supplierFabricRepeatMm"] is None
assert r["productionApproved"] is False

def must_reject(vertices, faces, edges):
    try:
        unfold(vertices,faces,edges)
    except (ValueError,IndexError,TypeError):
        return
    raise AssertionError("Unreconstructable source original quad falsely passed")

must_reject(points,quads[:-1],cuts)
must_reject(points,quads,cuts[:-1])
bad=list(quads)
bad[2]=(bad[2][0],bad[2][1],bad[2][2])
must_reject(points,bad,cuts)
bad=list(quads)
bad[2]=(bad[2][0],bad[2][0],bad[2][2],bad[2][3])
must_reject(points,bad,cuts)
bad=list(quads)
bad[2]=(bad[2][0],bad[2][1],bad[2][2],len(points)+1)
must_reject(points,bad,cuts)
bad=list(quads)
bad[2]=(1,2,bad[2][2],bad[2][3])
bad[3]=(1,2,bad[3][2],bad[3][3])
must_reject(points,bad,cuts)
broken=list(points)
broken[0]=(math.inf,0,0)
must_reject(broken,quads,cuts)
print("TITAN_ORIGINAL_TROUSER_QUAD_UNSTITCHED_METRIC_UV_TEST_PASS")
