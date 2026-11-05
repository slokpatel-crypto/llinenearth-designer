"""Maximum-retained-real-edge UV tree for ACTUAL original trouser source.

This is a graph-theoretic minimum of the total 3D length of *non-tree*
shared source edges, not a seam construction, textile cutting plan, fabric
allowance, source face modification, or proved overlap-free UV mapping.
"""
from __future__ import annotations

from collections import defaultdict
import math


def select_original_source_max_retained_uv_tree(points, original_faces, original_cut_edges):
    if len(original_faces) != 2650 or len(original_cut_edges) != 8 or not points:
        raise ValueError("Real source UV optimization requires 2650 faces and 8 true cut edges.")
    verts = []
    for pt in points:
        xyz = tuple(float(x) for x in pt)
        if len(xyz) != 3 or not all(math.isfinite(x) for x in xyz):
            raise ValueError("Original source position is invalid for retaining UV edges.")
        verts.append(xyz)
    owners = defaultdict(list)
    for face_id, face_raw in enumerate(original_faces):
        face = tuple(int(x) for x in face_raw)
        if (len(face) != 4 or len(set(face)) != 4 or min(face) < 0
                or max(face) >= len(verts)):
            raise ValueError("Original source UV max-tree requires valid actual quads.")
        for i in range(4):
            a, b = face[i], face[(i + 1) % 4]
            key = (min(a, b), max(a, b))
            owners[key].append((face_id, (a, b) == key))
    if any(len(rows) > 2 for rows in owners.values()):
        raise ValueError("Original source mesh is nonmanifold.")
    actual_cuts = {tuple(sorted(edge)) for edge in original_cut_edges}
    if len(actual_cuts) != 8 or any(
            len(edge) != 2 or edge[0] == edge[1]
            or len(owners.get(edge, [])) != 1 for edge in actual_cuts):
        raise ValueError("A proposed original crotch edge has no unique source owner.")

    shared = []
    all_mm = 0.0
    for edge, rows in owners.items():
        if len(rows) != 2:
            continue
        if rows[0][1] == rows[1][1]:
            raise ValueError("Original source geometry has wrong shared-edge orientation.")
        a, b = edge
        length_mm = math.dist(verts[a], verts[b]) * 1000.0
        if not math.isfinite(length_mm) or length_mm <= 1e-6:
            raise ValueError("True original source shared edge has invalid 3D length.")
        shared.append((length_mm, edge, rows[0][0], rows[1][0]))
        all_mm += length_mm

    parent = list(range(len(original_faces)))
    rank = [0] * len(original_faces)

    def root(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def join(x, y):
        a, b = root(x), root(y)
        if a == b:
            return False
        if rank[a] < rank[b] or (rank[a] == rank[b] and a > b):
            a, b = b, a
        parent[b] = a
        if rank[a] == rank[b]:
            rank[a] += 1
        return True

    # Kruskal in descending true original 3D edge length. Ties are stable
    # original source vertex indices and owner IDs, never AI or fabric labels.
    shared.sort(key=lambda v: (-v[0], v[1], v[2], v[3]))
    retained = []
    selected_mm = 0.0
    for length_mm, edge, left, right in shared:
        if join(left, right):
            retained.append(edge)
            selected_mm += length_mm
    component_roots = {root(i) for i in range(len(original_faces))}
    components = len(component_roots)
    if len(retained) != len(original_faces) - components:
        raise ValueError("Original source max-retained tree dropped true connected faces.")
    if not all(math.isfinite(v) for v in (selected_mm, all_mm)):
        raise ValueError("Nonfinite original source UV tree physical-geometry metric.")
    remaining = max(0.0, all_mm - selected_mm)
    # This optimum is ONLY a lower bound on 3D length of the omitted source
    # face-graph edges for forest-type UV joining; the actual 2D closure and
    # manufacturing grain cannot be inferred from the edge selection.
    return {
        "retainedOriginalSourceEdges": [list(edge) for edge in retained],
        "report": {
            "researchOnly": True,
            "originalSourceQuadCount": len(original_faces),
            "originalSourceSharedEdgeCount": len(shared),
            "originalSourceComponentCount": components,
            "actualOriginalCutEdgeCount": len(actual_cuts),
            "maximumRetainedTreeEdgeCount": len(retained),
            "theoreticalNonTreeSourceEdgeCount": len(shared) - len(retained),
            "allRealSharedSourceEdgeLengthMm": round(all_mm, 5),
            "realRetainedTreeEdgeLengthMm": round(selected_mm, 5),
            "minimumOmittedOriginalSourceEdgeLengthMm": round(remaining, 5),
            "treeStrategy": "Kruskal maximum original 3D source edge length",
            "metricCaveat": (
                "Minimum omitted 3D source edge length among face spanning "
                "forests is a graph bound, NOT a real cut path, a correct "
                "UV/cloth unwrap, true textile scale or tailor-approved seam."
            ),
            "actualCuttingLinesApproved": False,
            "overlapFreeUvApproved": False,
            "fabricScaleAndGrainApproved": False,
            "physicalCrotchFitApproved": False,
            "productionApproved": False,
        },
    }


def select_original_source_branch_aware_uv_trial(
        points, original_faces, original_cut_edges,
        branch_penalty_mm=100.0, max_candidate_edges=48):
    """One bounded, deterministic face-tree exchange on REAL source edges.

    The research objective is omitted original 3D edge length plus a *virtual*
    mm penalty per excess cut-network edge at source vertices of degree >= 3.
    This is not an actual flattened UV measurement or a textile cut plan.
    """
    from collections import deque

    if (isinstance(branch_penalty_mm, bool)
            or not isinstance(branch_penalty_mm, (int, float))
            or not math.isfinite(branch_penalty_mm)
            or branch_penalty_mm <= 0):
        raise ValueError("Branch penalty must be finite positive research weight.")
    if (type(max_candidate_edges) is not int or
            not 1 <= max_candidate_edges <= 64):
        raise ValueError("Research source-edge candidate bound must be 1..64.")

    baseline = select_original_source_max_retained_uv_tree(
        points, original_faces, original_cut_edges)
    retained = {tuple(e) for e in baseline["retainedOriginalSourceEdges"]}
    # Source points and topology have already passed the original-source
    # selector's strict quads, cut ownership, winding and finite checks.
    owners = defaultdict(list)
    for face_id, face in enumerate(original_faces):
        for i in range(4):
            edge = tuple(sorted((face[i], face[(i + 1) % 4])))
            owners[edge].append(face_id)
    shared = {
        edge: (pair[0], pair[1], math.dist(points[edge[0]], points[edge[1]]) * 1000.0)
        for edge, pair in owners.items() if len(pair) == 2
    }
    if len(shared) != baseline["report"]["originalSourceSharedEdgeCount"] or not retained <= shared.keys():
        raise ValueError("Original source face adjacency changed during branch-aware research.")
    omitted = set(shared) - retained
    degree = defaultdict(int)
    for a, b in omitted:
        degree[a] += 1
        degree[b] += 1

    def excess(d):
        return max(0, d - 2)

    def diagnostics(cut_edges):
        cuts = defaultdict(int)
        for a, b in cut_edges:
            cuts[a] += 1
            cuts[b] += 1
        length = sum(shared[edge][2] for edge in cut_edges)
        junctions = sum(d >= 3 for d in cuts.values())
        excess_arms = sum(excess(d) for d in cuts.values())
        return length, junctions, excess_arms, length + branch_penalty_mm * excess_arms

    before = diagnostics(omitted)
    tree_adj = [[] for _ in original_faces]
    for edge in retained:
        a, b, _ = shared[edge]
        tree_adj[a].append((b, edge))
        tree_adj[b].append((a, edge))
    for row in tree_adj:
        row.sort()

    # Prioritize real omitted edges incident to existing branched source
    # vertices. Evaluate at most 48 candidates; no hidden stochastic search.
    ranked = sorted(
        omitted,
        key=lambda e: (
            -(excess(degree[e[0]]) + excess(degree[e[1]])),
            -shared[e][2], e
        ),
    )[:max_candidate_edges]
    best = None
    for added in ranked:
        start, target, add_mm = shared[added]
        queue = deque([start])
        predecessor = {start: None}
        while queue and target not in predecessor:
            current = queue.popleft()
            for neighbour, edge in tree_adj[current]:
                if neighbour not in predecessor:
                    predecessor[neighbour] = (current, edge)
                    queue.append(neighbour)
        if target not in predecessor:
            raise ValueError("Retained forest disconnected actual original neighboring faces.")
        at = target
        while at != start:
            prev, removed = predecessor[at]
            rem_mm = shared[removed][2]
            touch = set(added + removed)
            change = {v: 0 for v in touch}
            for v in added:
                change[v] -= 1
            for v in removed:
                change[v] += 1
            excess_change = sum(
                excess(degree[v] + change[v]) - excess(degree[v])
                for v in touch
            )
            delta = rem_mm - add_mm + branch_penalty_mm * excess_change
            candidate = (round(delta, 9), added, removed)
            if delta < -1e-7 and (best is None or candidate < best):
                best = candidate
            at = prev
    proposed = set(retained)
    if best is not None:
        _delta, add, remove = best
        proposed.remove(remove)
        proposed.add(add)
    proposed_cuts = set(shared) - proposed
    after = diagnostics(proposed_cuts)
    if (len(proposed) != len(retained) or
            after[3] > before[3] + 1e-6 or
            (best is None and proposed != retained)):
        raise ValueError("Bounded source-edge exchange violated its baseline research objective.")
    return {
        "retainedOriginalSourceEdges": [list(e) for e in sorted(proposed)],
        "report": {
            "researchOnly": True,
            "strategy": "bounded single face-tree exchange with source cut junction surrogate",
            "branchPenaltyResearchWeightMm": branch_penalty_mm,
            "candidateEdgeCap": max_candidate_edges,
            "evaluatedOmittedOriginalEdges": len(ranked),
            "originalSourceQuadCount": len(original_faces),
            "originalSourceSharedEdgeCount": len(shared),
            "originalSourceComponentCount": baseline["report"]["originalSourceComponentCount"],
            "retainedOriginalSourceTreeEdges": len(proposed),
            "swapPerformed": best is not None,
            "addedOriginalSharedEdge": list(best[1]) if best else None,
            "removedOriginalSharedEdge": list(best[2]) if best else None,
            "baselineOmittedRealEdgeLengthMm": round(before[0], 5),
            "candidateOmittedRealEdgeLengthMm": round(after[0], 5),
            "baselineCutBranchingSourceVertices": before[1],
            "candidateCutBranchingSourceVertices": after[1],
            "baselineExcessBranchArms": before[2],
            "candidateExcessBranchArms": after[2],
            "baselineResearchObjectiveMm": round(before[3], 5),
            "candidateResearchObjectiveMm": round(after[3], 5),
            "metricCaveat": (
                "Branch penalty is a chosen virtual research weight, not "
                "measured seam allowance or manufacturing cost. Face-tree "
                "exchange has NO proven actual UV closure, overlap, grain, "
                "physical cloth clearance or tailor cutting validity."
            ),
            "actualUvClosureMeasured": False,
            "physicalFabricScaleApproved": False,
            "sourceBodyFitApproved": False,
            "tailorSeamsApproved": False,
            "productionApproved": False,
        },
    }


def compare_measured_original_source_uv_research_candidates(
        baseline_cut, candidate_cut, baseline_tree, candidate_tree):
    """Independently compare ACTUAL diagnostic UV metrics, never fit approval.

    A virtual graph-penalty reduction does not count as a source UV improvement
    if measured cut length, real vertex branching, worst gap or RMS UV gap
    worsens. This evaluates native reports; it cannot certify 2D chart overlap,
    fabric, tailor lines, cloth-body separation, or export readiness.
    """
    def require_real_cut(report):
        required_ints = (
            "actualOriginalSourceQuadCount", "originalSharedSourceEdgeCount",
            "originalOpenSourceBoundaryEdges", "genuineCrotchCutEdgeCount",
            "unclosedSharedUvCutCandidateEdges",
            "uvCutCandidateDegreeThreePlusSourceVertices",
        )
        required_mm = (
            "totalRealGeometryOfUvCutCandidatesMm",
            "maximumUnclosedUvEdgeGapMm",
        )
        if (report.get("researchOnly") is not True
                or report.get("productionApproved") is not False
                or report.get("realTailorCutLinesApproved") is not False
                or report.get("sourcePanelUVContinuityVerified") is not False):
            raise ValueError("A source UV cut report falsely claims real fabric approval.")
        for key in required_ints:
            if type(report.get(key)) is not int or report[key] < 0:
                raise ValueError("Invalid actual original-source UV topology metric: " + key)
        for key in required_mm:
            v = report.get(key)
            if (isinstance(v, bool) or not isinstance(v, (int, float))
                    or not math.isfinite(v) or v < 0):
                raise ValueError("Invalid measured source UV geometry: " + key)
        if (report["originalSharedSourceEdgeCount"] <
                report["unclosedSharedUvCutCandidateEdges"]):
            raise ValueError("Unclosed source edges exceed genuine shared source edges.")

    def require_real_tree(report):
        if (report.get("researchOnly") is not True
                or report.get("productionApproved") is not False
                or report.get("sourcePanelsFullyStitchedInUV") is not False
                or report.get("surfaceUvOverlapCertifiedAbsent") is not False):
            raise ValueError("Forged UV tree closure or production certificate.")
        for key in ("dualGraphComponentCount", "verifiedTreeConnectedSharedEdges",
                    "nonTreeCycleUnclosedUvEdges", "sharedOriginalSourceEdgeCount"):
            if type(report.get(key)) is not int or report[key] < 0:
                raise ValueError("Invalid real UV tree topology metric: " + key)
        for key in ("maximumNonTreeUvSeamGapMm", "rmsNonTreeUvSeamGapMm"):
            v = report.get(key)
            if (isinstance(v, bool) or not isinstance(v, (int, float))
                    or not math.isfinite(v) or v < 0):
                raise ValueError("Unknown measured native 2D UV gap: " + key)

    for item in (baseline_cut, candidate_cut):
        require_real_cut(item)
    for item in (baseline_tree, candidate_tree):
        require_real_tree(item)
    for key in ("actualOriginalSourceQuadCount", "originalSharedSourceEdgeCount",
                "originalOpenSourceBoundaryEdges", "genuineCrotchCutEdgeCount"):
        if baseline_cut[key] != candidate_cut[key]:
            raise ValueError("Measured UV alternative changed original source topology.")
    for key in ("dualGraphComponentCount", "verifiedTreeConnectedSharedEdges",
                "sharedOriginalSourceEdgeCount"):
        if baseline_tree[key] != candidate_tree[key]:
            raise ValueError("Research UV alternative changed native face-tree provenance.")
    for cut, tree in ((baseline_cut, baseline_tree), (candidate_cut, candidate_tree)):
        if (cut["originalSharedSourceEdgeCount"] != tree["sharedOriginalSourceEdgeCount"]
                or cut["unclosedSharedUvCutCandidateEdges"] != tree["nonTreeCycleUnclosedUvEdges"]):
            raise ValueError("Native original-source cut report disagrees with its UV tree.")

    metrics = (
        ("cutCandidateMeshLengthMm", baseline_cut, candidate_cut,
         "totalRealGeometryOfUvCutCandidatesMm"),
        ("branchJunctions", baseline_cut, candidate_cut,
         "uvCutCandidateDegreeThreePlusSourceVertices"),
        ("maxUnclosedUvGapMm", baseline_cut, candidate_cut,
         "maximumUnclosedUvEdgeGapMm"),
        ("rmsUnclosedUvGapMm", baseline_tree, candidate_tree,
         "rmsNonTreeUvSeamGapMm"),
        ("unclosedUvSeamCount", baseline_cut, candidate_cut,
         "unclosedSharedUvCutCandidateEdges"),
    )
    deltas = {
        name: round(float(trial[field]) - float(control[field]), 5)
        for name, control, trial, field in metrics
    }
    tolerance = 0.00002
    no_worsening = all(value <= tolerance for value in deltas.values())
    strict_improvement = any(value < -tolerance for value in deltas.values())
    improvement = no_worsening and strict_improvement
    return {
        "researchOnly": True,
        "nativeSourceTopologyPreserved": True,
        "measuredSourceUvDeltasVsWeighted": deltas,
        "measuredResearchParetoImprovement": improvement,
        "measuredTradeoffObserved": (
            any(value > tolerance for value in deltas.values())
            and any(value < -tolerance for value in deltas.values())
        ),
        "comparatorMetrics": list(deltas),
        "physicalBodyFitApproved": False,
        "uvOverlapCertifiedAbsent": False,
        "sewnTextileCutLinesApproved": False,
        "productionApproved": False,
        "metricCaveat": (
            "Even Pareto-improving research geometry alone cannot certify "
            "actual UV overlap, sewn seams, body/cloth clearance, grain, "
            "textile dimensions or manufacturer approval."
        ),
    }
