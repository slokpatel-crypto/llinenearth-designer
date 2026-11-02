import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("native crotch stage snapshots are research-only and preserve production source + physical preflight",()=>{
  const author=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  const diagnostic=readFileSync("scripts/blender/diagnose-crotch-modifier-stages.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  for(const required of [
    '"--experimental-capture-crotch-stages", action="store_true"',
    'if not enabled or obj.name not in ("TrouserLegLFabric", "TrouserLegRFabric")',
    '"TITAN_CrotchStageResearch"',
    'clone.hide_render = True',
    'clone["candidateOnly"] = True',
    'clone["productionApproved"] = False',
    'capture_crotch_stage_for_research(obj, stage, capture_crotch_stages)',
    'options.experimental_capture_crotch_stages',
    'safe_candidate_output(options.output, bpy.data.filepath)',
  ]) assert.ok(author.includes(required), required);
  for(const required of [
    '("selectedBodyShell", "afterSmoothing", "afterBodyClearance", "afterClothThickness")',
    'scene.get("linen_earth_research_crotch_stages_emitted") is not True',
    'if len(research.objects) != 8',
    'candidateOnly',
    '"productionApproved": False',
    'changesProductionGeometry',
    'if final != reports["afterClothThickness"]["legLegPolygonContactPairs"]',
  ]) assert.ok(diagnostic.includes(required), required);
  for(const required of [
    '--experimental-capture-crotch-stages',
    'TITAN_REAL_CROTCH_MODIFIER_STAGES_MATCH_FULL_PREFLIGHT',
    'assert physical["rejectionReasonCount"] == 10',
    'assert source["changesProductionGeometry"] is False',
    'physical["boundaryIntersections"]["garmentLegToLeg"]',
  ]) assert.ok(workflow.includes(required), required);
});
