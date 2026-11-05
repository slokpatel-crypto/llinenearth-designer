"""Real original source UV maximum-retained-edge candidate: pure regression.

The maximum spanning tree minimizes omitted 3D source-edge length among
spanning forests; this is NOT a manufacturing cut/seam allowance choice.
"""
from pathlib import Path
import math
import runpy

ROOT = Path(__file__).resolve().parents[2]
scripts = ROOT / "scripts/blender"
previous = runpy.run_path(str(
    ROOT / "tests/python/test_source_trouser_uv_cut_network.py"
))
select = runpy.run_path(str(
    scripts / "source-trouser-max-retained-uv.py"
))["select_original_source_max_retained_uv_tree"]
join = runpy.run_path(str(
    scripts / "source-trouser-dual-tree-uv.py"
))["connect_original_source_uv_forest"]
cut = runpy.run_path(str(
    scripts / "source-trouser-uv-cut-network.py"
))["audit_original_source_uv_cut_network"]

for name in ("flat", "curved"):
    points = previous[name + "_points"]
    metric = previous[name + "_metric"]
    previous_tree = previous[name + "_tree"]
    original_faces = previous["faces"]
    original_cut_edges = previous["cuts"]
    result = select(points, original_faces, original_cut_edges)
    assert result == select(points, original_faces, original_cut_edges), "Original source Kruskal choice nondeterministic"
    summary = result["report"]
    assert summary["originalSourceQuadCount"] == 2650
    assert summary["originalSourceComponentCount"] == 1
    assert summary["originalSourceSharedEdgeCount"] == (53*49+50*52)
    assert summary["actualOriginalCutEdgeCount"] == 8
    assert summary["maximumRetainedTreeEdgeCount"] == 2649
    assert summary["theoreticalNonTreeSourceEdgeCount"] == summary["originalSourceSharedEdgeCount"] - 2649
    assert len(result["retainedOriginalSourceEdges"]) == 2649
    assert len({tuple(e) for e in result["retainedOriginalSourceEdges"]}) == 2649
    assert 0 < summary["realRetainedTreeEdgeLengthMm"] <= summary["allRealSharedSourceEdgeLengthMm"]
    assert 0 <= summary["minimumOmittedOriginalSourceEdgeLengthMm"] < summary["allRealSharedSourceEdgeLengthMm"]
    assert summary["productionApproved"] is False

    connected = join(
        original_faces, metric["face_uv_loops"], original_cut_edges,
        preferred_tree_edges=result["retainedOriginalSourceEdges"]
    )
    assert connected == join(
        original_faces, metric["face_uv_loops"], original_cut_edges,
        preferred_tree_edges=result["retainedOriginalSourceEdges"]
    )
    cr = connected["report"]
    assert cr["dualGraphComponentCount"] == 1
    assert cr["verifiedTreeConnectedSharedEdges"] == 2649
    assert cr["nonTreeCycleSharedEdges"] == summary["theoreticalNonTreeSourceEdgeCount"]
    assert cr["maximumTreeEdgeUvJoinErrorMm"] <= 0.001
    assert cr["selectedForestSource"] == "explicit validated original-source shared edge list"
    actual_cut = cut(
        points, original_faces, connected["face_uv_loops"],
        original_cut_edges, cr
    )
    assert actual_cut["unclosedSharedUvCutCandidateEdges"] == cr["nonTreeCycleUnclosedUvEdges"]
    assert actual_cut["joinedSharedUvEdges"] + actual_cut["unclosedSharedUvCutCandidateEdges"] == summary["originalSourceSharedEdgeCount"]
    assert actual_cut["seamCutTopologyApproved"] is False
    assert actual_cut["productionApproved"] is False
    if name == "flat":
        assert actual_cut["unclosedSharedUvCutCandidateEdges"] == 0
    else:
        assert actual_cut["totalRealGeometryOfUvCutCandidatesMm"] >= 0

# Validation must not silently accept incomplete or fabricated spanning forests.
points = previous["flat_points"]
faces = previous["faces"]
cuts = previous["cuts"]
uv = previous["flat_metric"]["face_uv_loops"]
good = select(points, faces, cuts)["retainedOriginalSourceEdges"]
def reject_tree(edges):
    try:
        join(faces, uv, cuts, preferred_tree_edges=edges)
    except (ValueError, TypeError, IndexError):
        return
    raise AssertionError("Invalid selected source edge forest was accepted.")

reject_tree([])
reject_tree(good[:-1])
reject_tree(good + [good[0]])
reject_tree([(0, 999999)] + good[1:])
reject_tree([(17, 17)] + good[1:])
reject_tree([(max(e), min(e)) for e in good])
def reject_source(vertices, source_faces, cuts):
    try:
        select(vertices, source_faces, cuts)
    except (ValueError, TypeError, IndexError):
        return
    raise AssertionError("Unknown original source metric was used as valid.")
reject_source(points,faces,cuts[:-1])
bad_points = list(points)
bad_points[0] = (math.nan,0.0,0.0)
reject_source(bad_points,faces,cuts)
bad_faces = list(faces)
bad_faces[0] = (0,0,1,2)
reject_source(points,bad_faces,cuts)

trial = runpy.run_path(str(
    scripts / "source-trouser-max-retained-uv.py"
))["select_original_source_branch_aware_uv_trial"]

for name in ("flat", "curved"):
    source = previous[name + "_points"]
    originals = previous["faces"]
    cuts = previous["cuts"]
    baseline_edges = {
        tuple(x) for x in select(source, originals, cuts)["retainedOriginalSourceEdges"]
    }
    proposal = trial(source, originals, cuts)
    assert proposal == trial(source, originals, cuts)
    report = proposal["report"]
    next_edges = {tuple(x) for x in proposal["retainedOriginalSourceEdges"]}
    assert len(next_edges) == len(baseline_edges) == 2649
    assert report["originalSourceSharedEdgeCount"] == (53*49+50*52)
    assert report["originalSourceComponentCount"] == 1
    assert report["evaluatedOmittedOriginalEdges"] == 48
    assert report["candidateResearchObjectiveMm"] <= report["baselineResearchObjectiveMm"] + 0.00002
    assert report["productionApproved"] is False
    assert report["actualUvClosureMeasured"] is False
    if report["swapPerformed"]:
        assert len(next_edges - baseline_edges) == 1
        assert len(baseline_edges - next_edges) == 1
        assert tuple(report["addedOriginalSharedEdge"]) in next_edges
        assert tuple(report["removedOriginalSharedEdge"]) not in next_edges
    else:
        assert next_edges == baseline_edges
    joined = join(
        originals, previous[name + "_metric"]["face_uv_loops"], cuts,
        preferred_tree_edges=proposal["retainedOriginalSourceEdges"],
    )
    assert joined["report"]["verifiedTreeConnectedSharedEdges"] == 2649
    actual = cut(source, originals, joined["face_uv_loops"],
                 cuts, joined["report"])
    assert actual["productionApproved"] is False

for bad_weight in (-2, 0, math.nan, math.inf, True, "100"):
    try:
        trial(points, faces, cuts, branch_penalty_mm=bad_weight)
    except (ValueError, TypeError):
        pass
    else:
        raise AssertionError("Invalid branch penalty was accepted")
for bad_cap in (-1, 0, 65, 2.5, True, "48"):
    try:
        trial(points, faces, cuts, max_candidate_edges=bad_cap)
    except (ValueError, TypeError):
        pass
    else:
        raise AssertionError("Invalid bounded-search candidate cap was accepted")

print("TITAN_ORIGINAL_SOURCE_MAX_RETAINED_EDGE_UV_PURE_PASS")
