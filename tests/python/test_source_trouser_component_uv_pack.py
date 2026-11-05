"""Genuine original-face-graph disconnected UV layout: research-only tests."""
from pathlib import Path
import copy
import math
import runpy

ROOT = Path(__file__).resolve().parents[2]
base = ROOT / "scripts/blender"
fixture = runpy.run_path(str(ROOT / "tests/python/test_source_trouser_uv_cut_network.py"))
pack = runpy.run_path(str(base / "source-trouser-component-uv-pack.py"))[
    "pack_original_source_uv_face_components"]
overlap = runpy.run_path(str(base / "source-trouser-uv-overlap-audit.py"))[
    "audit_original_source_uv_triangle_overlaps"]
faces = fixture["faces"]
loops = fixture["flat_tree"]["face_uv_loops"]

original_faces = copy.deepcopy(faces)
original_uv = copy.deepcopy(loops)
one = pack(faces, loops)
assert one == pack(faces, loops)
assert one["face_uv_loops"] == loops
assert one["report"]["originalSourceFaceGraphComponentCount"] == 1
assert one["report"]["originalSourceComponentFaceCounts"] == [2650]
assert one["report"]["maximumOriginalTriangleEdgeChangeMm"] <= 0.000001
assert one["report"]["sourceGeometryAndVertexIDsUnchanged"] is True
assert one["report"]["sourcePanelsOverlapFreeApproved"] is False
assert one["report"]["productionApproved"] is False
assert faces == original_faces and loops == original_uv

# Actual-grid-derived two-component negative/positive layout fixture.
# 53 columns x 50 rows, split 25+25 rows, rename the second half's
# source vertex IDs to prevent an invented 3D shared-edge connection.
second_half_start = 53 * 25
split_faces = list(faces[:second_half_start]) + [
    tuple(i + 100000 for i in face) for face in faces[second_half_start:]
]
# Shift only the second disconnected region's UNAPPROVED test UV charts
# onto the first component, introducing exact interior overlaps.
stacked = [list(row) for row in loops]
for face_id in range(second_half_start, len(stacked)):
    stacked[face_id] = [(x, y - .25) for x, y in stacked[face_id]]
before = overlap(split_faces, stacked)
assert before["auditTruncated"] is False
assert before["observedInteriorOverlapTrianglePairsLowerBound"] > 0
candidate = pack(split_faces, stacked)
assert candidate == pack(split_faces, stacked)
summary = candidate["report"]
assert summary["originalSourceFaceGraphComponentCount"] == 2
assert summary["originalSourceComponentFaceCounts"] == [1325, 1325]
assert summary["originalSourceQuadCount"] == 2650
assert summary["originalSourceUvLoopCount"] == 10600
assert summary["maximumOriginalTriangleEdgeChangeMm"] <= 0.000001
assert summary["sourceGeometryAndVertexIDsUnchanged"] is True
assert summary["originalSourceUvTreeUnchanged"] is True
assert summary["physicalTextileWidthOrRepeatKnown"] is False
assert summary["realTailorSeamsApproved"] is False
assert summary["physicalBodyClearanceApproved"] is False
assert summary["sourcePanelsOverlapFreeApproved"] is False
assert summary["productionApproved"] is False
assert summary["components"][0]["rigidResearchUvTranslationMm"] == [0.0, 0.0]
assert (summary["components"][1]["packedResearchUvBoundingBoxMm"][0] >=
        summary["components"][0]["packedResearchUvBoundingBoxMm"][2] + 4.9999)
after = overlap(split_faces, candidate["face_uv_loops"])
assert after["auditTruncated"] is False
assert after["observedInteriorOverlapTrianglePairsLowerBound"] == 0
assert before["observedInteriorOverlapTrianglePairsLowerBound"] > (
    after["observedInteriorOverlapTrianglePairsLowerBound"])
assert split_faces[:second_half_start] == faces[:second_half_start]
assert candidate["face_uv_loops"] is not stacked

def reject(source_faces, source_uv, gap=5.0):
    try:
        pack(source_faces, source_uv, display_gap_mm=gap)
    except (ValueError, TypeError, IndexError):
        return
    raise AssertionError("UV pack accepted invalid original source or fake gap")

reject(faces[:-1], loops)
reject(faces, loops[:-1])
for gap in (0, -1, 101, math.nan, math.inf, True, "5"):
    reject(faces, loops, gap)
malformed = [list(row) for row in loops]
malformed[0] = [malformed[0][0]] * 4
reject(faces, malformed)
nonfinite = [list(row) for row in loops]
nonfinite[0][0] = (math.nan, 0)
reject(faces, nonfinite)
inverted = [list(row) for row in loops]
inverted[0] = list(reversed(inverted[0]))
reject(faces, inverted)
invalid_faces = list(faces)
invalid_faces[0] = (0, 0, 1, 2)
reject(invalid_faces, loops)
nonmanifold = list(faces)
nonmanifold[10] = nonmanifold[0]
reject(nonmanifold, loops)

print("TITAN_ORIGINAL_SOURCE_COMPONENT_UV_PACK_PURE_PASS")
