import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("real source UV spanning forest joins actual original mesh edges but rejects cycles and cloth approval", () => {
  const pure=readFileSync("scripts/blender/source-trouser-dual-tree-uv.py","utf8");
  const blender=readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  const fixture=readFileSync("tests/python/test_source_trouser_dual_tree_uv.py","utf8");
  for (const term of [
    "def connect_original_source_uv_forest(",
    "preferred_tree_edges=None):",
    "Selected edges disconnected a real original source component.",
    "if len(original_faces) != 2650 or len(separate_face_uv) != 2650:",
    "if left[1] == right[1]:",
    "adjacent[a].append((b, edge))",
    "queue = deque([root])",
    "for neighbour, edge in adjacent[current]:",
    "abs(source_l - dest_l) * 1000.0 > 0.001",
    "if error > 0.001:",
    "connected_tree_edges.add(edge)",
    "if worst > 0.001:",
    '"verifiedTreeConnectedSharedEdges": true_tree',
    '"nonTreeCycleUnclosedUvEdges": cycle_open',
    '"maximumNonTreeUvSeamGapMm": round(cycle_max_gap_mm, 5)',
    '"faceTreeParentsRecorded": sum(p >= 0 for p in parent_face)',
    '"sourcePanelsFullyStitchedInUV": False',
    '"surfaceUvOverlapCertifiedAbsent": False',
    '"measuredSupplierRepeatMm": None',
    '"productionApproved": False',
  ]) assert.ok(pure.includes(term), term);
  for (const term of [
    '"source-trouser-dual-tree-uv.py"',
    'tree_ops["connect_original_source_uv_forest"]',
    'base_faces, quad_evidence["face_uv_loops"]',
    '"TITAN_RESEARCH_OriginalTrouserDualTreeUVUnclosedCycles"',
    '"TITAN_RESEARCH_ONLY_METRIC_DUAL_TREE_NOT_SEWN"',
    'tree_mesh.from_pydata(merged_verts, [], base_faces)',
    'tree_layer.data[loop_id].uv = uv',
    'research.objects.link(tree_obj)',
    'export.objects.get(tree_name)',
    'len(tree_body_pairs) != unchanged_source_pairs',
    'seam_winding["researchOnlyOriginalSourceDualTreeUvSurvey"] = tree_report',
  ]) assert.ok(blender.includes(term), term);
  // Original Blender mesh IDs and UV measurements cannot be fabricated by
  // int()/float() coercion, including in explicitly selected source UV trees.
  for (const term of [
    "any(type(v) is not int or v < 0 for v in raw_face)",
    "isinstance(v, bool) or not isinstance(v, (int, float))",
    "Original source cut-edge identities must be integer vertex IDs.",
    "Selected original source UV tree edge is not a strict integer pair.",
  ]) assert.ok(pure.includes(term), "source provenance guard missing: "+term);
  assert.ok(!pure.includes("int(raw_edge[0])"));
  assert.ok(!pure.includes("tuple(int(v) for v in raw_face)"));
  assert.ok(!pure.includes("tuple(float(v) for v in uv) for uv in raw_uv"));
  assert.ok(!pure.includes("bpy.ops."),"Pure source UV seam routine cannot mutate Blender");
  assert.ok(!blender.includes("save_as_mainfile"),"Original Blender scene cannot be saved");
  for (const term of [
    '"scripts/blender/source-trouser-dual-tree-uv.py"',
    '"tests/crotch-trouser-dual-tree-uv-native.test.ts"',
    '"tests/python/test_source_trouser_dual_tree_uv.py"',
    'python3 tests/python/test_source_trouser_dual_tree_uv.py',
    'tree=oriented["researchOnlyOriginalSourceDualTreeUvSurvey"]',
    'tree["verifiedTreeConnectedSharedEdges"] == 2650-tree["dualGraphComponentCount"]',
    'tree["nativeRealOriginalSourceBodyPairsUnchanged"]',
    'tree["sourcePanelsFullyStitchedInUV"] is False',
    '"originalSourceUvSpanningTreeEvidence": {',
  ]) assert.ok(workflow.includes(term),term);
  for (const term of [
    '"scripts/blender/source-trouser-dual-tree-uv.py"',
    '"tests/crotch-trouser-dual-tree-uv-native.test.ts"',
  ]) assert.equal(workflow.split(term).length-1,2,"Native workflow must watch original-source UV work in PR and push paths");
  assert.ok(fixture.includes("assert connected == again"));
  assert.ok(fixture.includes('assert r["nonTreeCycleUnclosedUvEdges"] == 0'));
  assert.ok(fixture.includes('assert disconnected["report"]["dualGraphComponentCount"] == 2'));
});
