import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("original crotch cut boundaries are ray-tested on locked scanned body without fit approval", () => {
  const source = readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py", "utf8");
  const workflow = readFileSync(".github/workflows/titan-native-source-candidate.yml", "utf8");

  for (const required of [
    "def measure_fixed_bridge_boundary_body_rays(",
    "original_cut_edges.issubset(patch_edges)",
    "body_tree.ray_cast(",
    "start + direction * trim, direction, length - 2.0 * trim",
    '"edgeKind": ("originalSourceCutEdge"',
    'else "experimentalConnector")',
    '"originalSourceCutEdgeInteriorRayHits": source_hits',
    '"experimentalConnectorInteriorRayHits": connector_hits',
    '"originalSourceCutEdgeHitMakesFixedBoundaryClearanceImpossible": source_hits > 0',
    '"productionApproved": False',
    '"fixedBridgeBoundaryBodyRayEvidence": fixed_boundary_ray_evidence',
    '(tuple(worst["leftEdge"]), tuple(worst["rightEdge"]))',
    "zero rays does not prove clearance",
  ]) assert.ok(source.includes(required), required);

  assert.ok(!source.includes("bpy.ops."), "No source .blend alteration or export");
  assert.ok(!source.includes("save_as_mainfile"));
  for (const needle of [
    '"tests/crotch-fixed-boundary-body-ray-native.test.ts"',
    'fixed=targeted["fixedBridgeBoundaryBodyRayEvidence"]',
    'expected_cut_edges={tuple(sorted(pair)) for pair in (',
    'assert fixed["originalSourceCutEdgeInteriorRayHits"] == sum(',
    'fixed["originalSourceCutEdgeHitMakesFixedBoundaryClearanceImpossible"]',
    '"fixedBoundaryBodyRayEvidence":targeted["fixedBridgeBoundaryBodyRayEvidence"]',
    "physical[\"rejectionReasonCount\"] == 10",
  ]) assert.ok(workflow.includes(needle), needle);
  assert.equal(
    workflow.split('"tests/crotch-fixed-boundary-body-ray-native.test.ts"').length - 1,
    2,
    "Native source workflow must track both PR and main-path changes"
  );
});
