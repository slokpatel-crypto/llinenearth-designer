"""Synthetic reproducibility of real-topology provisional UV research, never cloth."""
from pathlib import Path
import math
import runpy

survey = runpy.run_path(str(
    Path(__file__).resolve().parents[2] /
    "scripts/blender/source-trouser-provisional-uv.py"
))["study_original_source_trouser_uv"]

# Exactly 2,650 distinct original-source faces. The first two share a real
# owner edge; all later faces are isolated fixtures (not sewn/physical cloth).
points = [
    (0.04, 0.01, 0.0),
    (0.045, 0.017, 0.008),
    (0.039, 0.022, 0.003),
    (0.052, 0.024, 0.013),
]
faces = [(0, 1, 2), (2, 1, 3)]
for i in range(2648):
    theta = (i % 200) * 0.023
    r = 0.06 + (i % 4)*0.001
    x, y = r * math.cos(theta), r * math.sin(theta)
    z = (i % 170) * 0.0004
    idx = len(points)
    points += [(x,y,z), (x+0.006,y+0.003,z+0.007), (x+0.001,y+0.008,z+0.005)]
    faces.append((idx, idx+1, idx+2))
cut_edges = [(0,1),(0,2),(1,3),(2,3)] + [
    (faces[i][0], faces[i][1]) for i in range(2,6)
]
result = survey(points, faces, cut_edges)
again = survey(points, faces, cut_edges)
assert result == again, "Provisional original-source geometry evidence must be deterministic"
report = result["report"]
assert report["researchOnly"] is True
assert report["actualOriginalSourceFaceCount"] == 2650
assert len(result["face_uv_loops"]) == 2650
assert report["provisionalUvLoopCount"] == 7950
assert report["originalCutEdgeCount"] == 8
assert report["sharedOriginalSourceEdgeCount"] == 1
assert report["displayUvContinuousSharedEdges"] + report["displayUvDiscontinuousSharedEdges"] == 1
assert report["uniqueSourceEdgeCount"] > 2650
assert len(report["actualOriginalCutEdgeUvEvidence"]) == 8
assert all(row["realOriginalSourceEdgeLengthMm"] > 0
           and row["physicalFabricScaleApproved"] is False
           for row in report["actualOriginalCutEdgeUvEvidence"])
assert report["maximumDisplayUvEdgeStretchErrorMm"] >= 0
assert report["rmsDisplayUvEdgeStretchErrorMm"] >= 0
assert report["maximumDisplayUvToOriginalFaceAreaRatio"] >= 0
assert report["originalSourcePanelUVApproved"] is False
assert report["sourceToBridgeUVContinuityVerified"] is False
assert report["textureGrainDirectionVerified"] is False
assert report["physicalTextileScaleVerified"] is False
assert report["measuredSupplierFabricRepeatMm"] is None
assert report["sewnGarmentApproved"] is False
assert report["productionApproved"] is False

def must_reject(vertices, polygons, cuts):
    try:
        survey(vertices, polygons, cuts)
    except (ValueError, TypeError, IndexError):
        return
    raise AssertionError("Invalid original-source UV survey unexpectedly passed")

must_reject(points, faces[:-1], cut_edges)
must_reject(points, faces, cut_edges[:-1])
must_reject(points, faces, cut_edges[:-1]+[(0,1)])
invalid_faces = list(faces)
invalid_faces[10] = (0, 0, 1)
must_reject(points, invalid_faces, cut_edges)
invalid_faces = list(faces)
invalid_faces[10] = (0, 1, len(points)+5)
must_reject(points, invalid_faces, cut_edges)
nonmanifold_faces = list(faces)
nonmanifold_faces[10] = (0, 1, nonmanifold_faces[10][2])
nonmanifold_faces[11] = (0, 1, nonmanifold_faces[11][2])
must_reject(points, nonmanifold_faces, cut_edges)
broken_points = list(points)
broken_points[0] = (math.nan, 0.01, 0.03)
must_reject(broken_points, faces, cut_edges)
print("TITAN_PROVISIONAL_ORIGINAL_SOURCE_TROUSER_UV_SURVEY_SYNTHETIC_PASS")
