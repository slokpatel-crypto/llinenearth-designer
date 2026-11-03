import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("real-body 7mm crotch bridge centroid trial preserves source boundaries and cannot approve garments",()=>{
  const author=readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  for(const required of [
    '"--experimental-centroid-clearance-mm", type=float, choices=(0.0, 7.0), default=0.0',
    'def trial_centerline_body_clearance(',
    'closest, normal, _index, distance = body_tree.find_nearest(centre)',
    'candidate = closest + normal.normalized() * (offset_mm / 1000.0)',
    'if set(original_open) != set(fan_open):',
    'if any(n > 2 for n in fan_incidence.values()):',
    'len(mesh.polygons) != 3 * len(bridge_faces)',
    'obj["candidateOnly"] = True',
    'obj["productionApproved"] = False',
    '"equalTopologyControl": control',
    '"equalTopologyDisplaced": candidate',
    '"equalTopologyRadial": radial',
    '"actualBodyContactByOriginalCutEdgePair":per_bridge_pair',
    'row["originalBodyBVHPairs"] for row in per_bridge_pair',
    '"contactingBridgeFaceAreaMm2":round(contact,4)',
    'radial_candidate = centre + (centre - closest).normalized()',
    '"radialCentroidDisplacementMm": {',
    '"radialStrictContactedAreaImprovementObserved": (',
    'contact_faces = {bridge_face for _body_face, bridge_face in overlap}',
    '"contactingBridgeAreaMm2": round(contacted_area, 4)',
    'obj["physicalFitApproved"] = False',
    'obj["sewnGarmentApproved"] = False',
    'research.objects.link(obj)',
    'bpy.data.collections["LinenEarthExport"].objects.get(obj.name)',
    '"researchOnlyCentroidClearanceTrial":clearance_trial',
    '"finalClothQAApproved":False',
    'if args.experimental_centroid_clearance_mm == 7.0:',
    'candidate["bodyPolygonBVHPairs"] < control["bodyPolygonBVHPairs"]',
    'def trial_targeted_seam_reroute(',
    '"positiveBodyNormal": closest + unit_normal * (offset_mm / 1000.0)',
    '"negativeBodyNormal": closest - unit_normal * (offset_mm / 1000.0)',
    'if {tuple(sorted(edge)) for edge in fan_boundary} != original_boundary:',
    '"researchOnlyTargetedSeamRerouteTrial":targeted_reroute_trial',
    'targeted_reroute_trial["targetOriginalCutEdgePair"] = worst',
  ]) assert.ok(author.includes(required),required);
  assert.ok(!author.includes("bpy.ops."),"No original .blend mutation/export permitted");
  for(const required of [
    '"tests/crotch-bridge-centroid-clearance-native.test.ts"',
    '--experimental-centroid-clearance-mm 7',
    'TITAN_REAL_CROTCH_BRIDGE_BODY_CLEARANCE_EXPERIMENT_MEASURED_NO_APPROVAL',
    'trial["originalCutEdgeBoundaryCount"] == trial["preservedCutEdgeBoundaryCount"]',
    'trial["degenerateFaces"] == trial["nonManifoldEdges"] == 0',
    'trial["originalBridgeBodyBVHPairs"] == 20',
    'control=trial["equalTopologyControl"]',
    'candidate=trial["equalTopologyDisplaced"]',
    'trial["strictContactedAreaImprovementObserved"]',
    'trial["radialStrictContactedAreaImprovementObserved"]',
    'shifts["moved"] + shifts["unchanged"] == 6',
    'radial18TriangleBodyPairs',
    'sum(row["originalBodyBVHPairs"] for row in records) == 20',
    'original["actualBodyContactByOriginalCutEdgePair"] == offset["actualBodyContactByOriginalCutEdgePair"]',
    'physical["rejectionReasonCount"] == 10 and physical["preflightReady"] is False',
    'offset["physicalFitApproved"] is False and offset["sewnGarmentApproved"] is False',
    'crotch-bridge-centroid-clearance-research-only.json',
    'targeted=offset["researchOnlyTargetedSeamRerouteTrial"]',
    'set(variants) == {"unchangedControl","positiveBodyNormal","negativeBodyNormal"}',
    'targeted["targetOriginalCutEdgePair"]["originalBodyBVHPairs"] == 17',
  ]) assert.ok(workflow.includes(required),required);
  assert.equal(workflow.split('"tests/crotch-bridge-centroid-clearance-native.test.ts"').length-1,2);
  assert.equal(workflow.split('- name: Trial scanned-body 7mm centroid clearance').length-1,1);
});
