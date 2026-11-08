"""Pure regression for one genuine component-0 UV tree cut/repack."""
from pathlib import Path
import copy
import math
import runpy

ROOT = Path(__file__).resolve().parents[2]
trial_ops = runpy.run_path(str(
    ROOT / "scripts/blender/source-trouser-component0-subtree-uv-trial.py"
))
trial = trial_ops["trial_component0_balanced_subtree_uv_pack"]
two_cut_trial = trial_ops["trial_component0_ranked_two_cut_uv_pack"]
audit = runpy.run_path(str(
    ROOT / "scripts/blender/source-trouser-uv-overlap-audit.py"
))["audit_original_source_uv_triangle_overlaps"]


def grid(width, height, vertex_offset, x_offset):
    points = []
    for y in range(height + 1):
        for x in range(width + 1):
            points.append((x_offset + x * .01, y * .01, 0.0))
    faces, loops = [], []
    stride = width + 1
    for y in range(height):
        for x in range(width):
            a = vertex_offset + y * stride + x
            faces.append((a, a + 1, a + 1 + stride, a + stride))
            loops.append([
                (x_offset + x * .01, y * .01),
                (x_offset + (x + 1) * .01, y * .01),
                (x_offset + (x + 1) * .01, (y + 1) * .01),
                (x_offset + x * .01, (y + 1) * .01),
            ])
    return points, faces, loops


parts = [grid(61, 20, 0, 0.0)]
next_vertex = len(parts[0][0])
parts.append(grid(55, 13, next_vertex, 1.0))
next_vertex += len(parts[1][0])
parts.append(grid(55, 13, next_vertex, 2.0))
points = [point for part in parts for point in part[0]]
faces = [face for part in parts for face in part[1]]
loops = [row for part in parts for row in part[2]]

# Deterministic row-major spanning forest: left edge within a row, then the
# first vertical edge of each subsequent row.
retained = []
face_start = 0
for width, height in ((61, 20), (55, 13), (55, 13)):
    component_faces = faces[face_start:face_start + width * height]
    for y in range(height):
        for x in range(1, width):
            left = component_faces[y * width + x - 1]
            right = component_faces[y * width + x]
            retained.append(tuple(sorted(set(left).intersection(right))))
    for y in range(1, height):
        above = component_faces[(y - 1) * width]
        below = component_faces[y * width]
        retained.append(tuple(sorted(set(above).intersection(below))))
    face_start += width * height
assert len(faces) == 2650 and len(retained) == 2647

original_points = copy.deepcopy(points)
original_faces = copy.deepcopy(faces)
original_loops = copy.deepcopy(loops)
baseline = trial(points, faces, loops, retained)
assert baseline == trial(points, faces, loops, retained)
report = baseline["report"]
assert report["targetComponentId"] == 0
assert report["targetComponentOriginalSourceFaceCount"] == 1220
assert report["candidateRankWithinBalancedTreeCuts"] == 0
assert report["translationFractionOfOutsidePack"] == 1.0
assert (report["rigidResearchUvTranslationMm"] ==
        report["fullOutsidePackTranslationMm"])
assert report["boundedCandidateRankLimit"] == 48
assert 1 <= report["movedOriginalSourceFaceCount"] <= 610
assert (report["movedOriginalSourceFaceCount"]
        + report["stationaryComponent0FaceCount"] == 1220)
assert report["addedActualSourceCutEdgeLengthMm"] > 0
assert report["maximumOriginalTriangleEdgeChangeMm"] <= .000001
assert report["retainedSourceUvTreeJoinCountAfter"] == 2646
assert report["newUnclosedSourceUvSeamCount"] == 1
assert report["sourceGeometryAndVertexIDsUnchanged"] is True
assert report["sourceUvExportOrSavePerformed"] is False
assert report["realTailorCutApproved"] is False
assert report["physicalBodyFitApproved"] is False
assert report["productionApproved"] is False
assert points == original_points and faces == original_faces and loops == original_loops

ranked = [trial(points, faces, loops, retained, candidate_rank=rank)
          for rank in range(4)]
assert [row["report"]["candidateRankWithinBalancedTreeCuts"]
        for row in ranked] == [0, 1, 2, 3]
assert len({tuple(row["report"]["removedRetainedOriginalSourceEdge"])
            for row in ranked}) == 4
assert all(row["report"]["movedOriginalSourceFaceCount"] <= 610
           for row in ranked)

fractional = trial(
    points, faces, loops, retained, candidate_rank=0, translation_fraction=0.5
)
fractional_report = fractional["report"]
assert fractional_report["translationFractionOfOutsidePack"] == 0.5
assert fractional_report["removedRetainedOriginalSourceEdge"] == (
    report["removedRetainedOriginalSourceEdge"]
)
assert fractional_report["addedActualSourceCutEdgeLengthMm"] == (
    report["addedActualSourceCutEdgeLengthMm"]
)
for applied, full in zip(
        fractional_report["rigidResearchUvTranslationMm"],
        fractional_report["fullOutsidePackTranslationMm"]):
    assert abs(applied - full * 0.5) <= 0.00001
assert fractional_report["maximumOriginalTriangleEdgeChangeMm"] <= .000001
assert points == original_points and faces == original_faces and loops == original_loops

two_cut = two_cut_trial(points, faces, loops, retained, [0, 2])
assert two_cut == two_cut_trial(points, faces, loops, retained, (0, 2))
two_report = two_cut["report"]
assert two_report["candidateRanksWithinBalancedTreeCuts"] == [0, 2]
assert len(two_report["removedRetainedOriginalSourceEdges"]) == 2
assert len({tuple(edge) for edge in
            two_report["removedRetainedOriginalSourceEdges"]}) == 2
assert two_report["addedActualSourceCutEdgeLengthMm"] > 0
assert two_report["maximumOriginalTriangleEdgeChangeMm"] <= .000001
assert two_report["retainedSourceUvTreeJoinCountAfter"] == 2645
assert two_report["newUnclosedSourceUvSeamCount"] == 2
assert two_report["sourceGeometryAndVertexIDsUnchanged"] is True
assert two_report["sourceUvExportOrSavePerformed"] is False
assert two_report["realTailorCutApproved"] is False
assert two_report["productionApproved"] is False
assert points == original_points and faces == original_faces and loops == original_loops

# Stack the deterministically selected subtree over stationary component-0
# faces, then prove the same one-cut trial removes cross-subtree intersections.
moved = [index for index, (before, after) in enumerate(zip(loops, baseline["face_uv_loops"]))
         if before != after]
stacked = copy.deepcopy(loops)
for offset, face_id in enumerate(moved):
    target = offset % (1220 - len(moved))
    stacked[face_id] = copy.deepcopy(loops[target])
before = audit(faces, stacked)
candidate = trial(points, faces, stacked, retained)
after = audit(faces, candidate["face_uv_loops"])
assert before["auditTruncated"] is False and after["auditTruncated"] is False
assert before["observedInteriorOverlapTrianglePairsLowerBound"] > 0
assert after["observedInteriorOverlapTrianglePairsLowerBound"] == 0


def reject(source_points=points, source_faces=faces, source_uv=loops,
           source_retained=retained, gap=5.0, candidate_rank=0,
           translation_fraction=1.0):
    try:
        trial(source_points, source_faces, source_uv, source_retained, gap,
              candidate_rank, translation_fraction)
    except (ValueError, TypeError, IndexError):
        return
    raise AssertionError("Component-0 UV trial accepted forged source evidence")


reject(source_faces=faces[:-1])
reject(source_uv=loops[:-1])
reject(source_retained=retained[:-1])
reject(source_retained=retained[:-1] + [retained[0]])
for gap in (0, -1, 101, math.nan, math.inf, True, "5"):
    reject(gap=gap)
for rank in (-1, 48, 1.0, True, "1"):
    reject(candidate_rank=rank)
for fraction in (0, -1, 1.00001, math.nan, math.inf, True, "0.5"):
    reject(translation_fraction=fraction)


def reject_two(ranks):
    try:
        two_cut_trial(points, faces, loops, retained, ranks)
    except (ValueError, TypeError, IndexError):
        return
    raise AssertionError("Component-0 two-cut trial accepted forged ranks")


for ranks in (None, [], [0], [0, 1, 2], [0, 0], [2, 0],
              [-1, 2], [0, 48], [0, 1.0], [False, 1], "0,1"):
    reject_two(ranks)
bad_points = list(points)
bad_points[0] = (math.nan, 0, 0)
reject(source_points=bad_points)
bad_uv = copy.deepcopy(loops)
bad_uv[0] = list(reversed(bad_uv[0]))
reject(source_uv=bad_uv)
bad_faces = list(faces)
bad_faces[1] = tuple(reversed(bad_faces[1]))
reject(source_faces=bad_faces)

print("TITAN_COMPONENT0_BALANCED_SUBTREE_UV_PURE_PASS")
