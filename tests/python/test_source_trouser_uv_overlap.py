"""Original-source UV triangle-interior intersection: no fabricated approval."""
from pathlib import Path
import math
import runpy

ROOT = Path(__file__).resolve().parents[2]
prior = runpy.run_path(str(ROOT / "tests/python/test_source_trouser_uv_cut_network.py"))
audit = runpy.run_path(str(
    ROOT / "scripts/blender/source-trouser-uv-overlap-audit.py"
))["audit_original_source_uv_triangle_overlaps"]
faces = prior["faces"]
islands = prior["flat_metric"]["face_uv_loops"]

baseline = audit(faces, islands)
assert baseline == audit(faces, islands), "Original UV overlap check is nondeterministic"
assert baseline["actualTrianglesInspected"] == 5300
assert baseline["expectedOriginalSourceQuadCount"] == 2650
assert baseline["narrowphaseTrianglePairCheckCap"] == 100000
assert baseline["auditTruncated"] is False
assert baseline["observedInteriorOverlapTrianglePairsLowerBound"] == 0
assert baseline["canClaimNoInteriorOverlapInThisUvLayout"] is True
assert baseline["completeGarmentUvOverlapFreeApproved"] is False
assert baseline["productionApproved"] is False

# Valid true-original-face fixture coordinates with deliberately overlapping
# research face UV loops. This MUST NOT be mistaken for textile cut approval.
stacked = list(islands)
stacked[1] = [tuple(point) for point in islands[0]]
stacked[2] = [tuple(point) for point in islands[0]]
overlap = audit(faces, stacked)
assert overlap["auditTruncated"] is False
assert overlap["observedInteriorOverlapTrianglePairsLowerBound"] > 0
assert overlap["observedDistinctSourceFacePairsLowerBound"] > 0
assert overlap["observedTriangleOverlapAreaSumLowerBoundMm2"] > 0
assert overlap["largestObservedTriangleInteriorOverlapAreaMm2"] > 0
assert overlap["firstSourceFaceTriangleOverlapWitnesses"]
assert overlap["canClaimNoInteriorOverlapInThisUvLayout"] is False
assert overlap["completeGarmentUvOverlapFreeApproved"] is False

# Exhaustion must be explicit, not a misleading claim that no overlap exists.
bounded = audit(faces, stacked, max_pair_tests=1)
assert bounded["auditTruncated"] is True
assert bounded["narrowphaseTrianglePairsChecked"] == 1
assert bounded["canClaimNoInteriorOverlapInThisUvLayout"] is False
assert bounded["completeGarmentUvOverlapFreeApproved"] is False

def rejects(face_data, uv_data, cap=100000):
    try:
        audit(face_data, uv_data, max_pair_tests=cap)
    except (ValueError, TypeError, OverflowError):
        return
    raise AssertionError("Forged or malformed source UV overlap evidence accepted")

rejects(faces[:-1], islands)
rejects(faces, islands[:-1])
for cap in (0, -1, 250001, True, 2.5, "10"):
    rejects(faces, islands, cap)
for bad in ((math.nan, 0.0), (math.inf, 0.0), (True, 0.0)):
    malformed = list(islands)
    malformed[0] = list(islands[0])
    malformed[0][0] = bad
    rejects(faces, malformed)
degenerate = list(islands)
degenerate[0] = [islands[0][0]] * 4
rejects(faces, degenerate)
inverted = list(islands)
inverted[0] = list(reversed(islands[0]))
rejects(faces, inverted)
bad_faces = list(faces)
bad_faces[0] = (0, 0, 1, 2)
rejects(bad_faces, islands)


compare = runpy.run_path(str(
    ROOT / "scripts/blender/source-trouser-uv-overlap-audit.py"
))["compare_original_source_uv_overlap_evidence"]
same = compare(baseline, baseline)
assert same["bothFullResearchUvScansComplete"] is True
assert same["candidateOverlapTrianglePairDelta"] == 0
assert same["candidateWorsenedRealUvInteriorOverlap"] is False
assert same["bothOriginalResearchUvLayoutsOverlapFree"] is True
assert same["productionApproved"] is False
worse = compare(baseline, overlap)
assert worse["candidateOverlapTrianglePairDelta"] > 0
assert worse["candidateWorsenedRealUvInteriorOverlap"] is True
assert worse["candidateImprovedRealUvInteriorOverlap"] is False
assert worse["bothOriginalResearchUvLayoutsOverlapFree"] is False
assert worse["completeGarmentUvApproved"] is False
unknown = compare(baseline, bounded)
assert unknown["bothFullResearchUvScansComplete"] is False
assert unknown["candidateOverlapTrianglePairDelta"] is None
assert unknown["candidateWorsenedRealUvInteriorOverlap"] is None
assert unknown["bothOriginalResearchUvLayoutsOverlapFree"] is None

def reject_comparison(one, two):
    try:
        compare(one, two)
    except (ValueError, TypeError, KeyError):
        return
    raise AssertionError("Forged native UV overlap comparison was accepted")
for field, fake in (
    ("expectedOriginalSourceQuadCount", 10),
    ("actualTrianglesInspected", 13),
    ("observedInteriorOverlapTrianglePairsLowerBound", -1),
    ("completeGarmentUvOverlapFreeApproved", True),
    ("physicalSourceFitApproved", True),
    ("productionApproved", True),
    ("auditTruncated", "unknown"),
    ("canClaimNoInteriorOverlapInThisUvLayout", True),
):
    forged = dict(overlap)
    forged[field] = fake
    reject_comparison(baseline, forged)
forged = dict(bounded)
forged["canClaimNoInteriorOverlapInThisUvLayout"] = True
reject_comparison(baseline, forged)

print("TITAN_ORIGINAL_SOURCE_UV_INTERIOR_OVERLAP_AUDIT_PURE_PASS")
