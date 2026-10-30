import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {hasVerifiedLatestDeliveryQc,hasVerifiedDeliveryQcOrderLineage} from "../src/lib/designer/delivery-qc-approval.ts";
import {FINISHED_GARMENT_QC_CHECKS} from "../src/lib/designer/finished-garment-qc.ts";

const orderId="123e4567-e89b-42d3-a456-426614174000";
const passingChecks=Object.fromEntries(FINISHED_GARMENT_QC_CHECKS.map(item=>[item.id,true]));
const earlier={order_id:orderId,decision:"approved",checks:passingChecks,inspector:"Checker A",inspection_reference:"QC-1",created_at:"2026-10-29T10:00:00.000Z"};
const rework={...earlier,decision:"rework",created_at:"2026-10-29T11:00:00.000Z"};
const approved={...earlier,decision:"approved",created_at:"2026-10-29T12:00:00.000Z"};

test("J5: only the newest same-order QC event can release a garment",()=>{
  assert.equal(hasVerifiedLatestDeliveryQc([earlier],orderId),true);
  assert.equal(hasVerifiedLatestDeliveryQc([earlier,rework],orderId),false);
  assert.equal(hasVerifiedLatestDeliveryQc([rework,earlier],orderId),false);
  assert.equal(hasVerifiedLatestDeliveryQc([rework,approved,earlier],orderId),true);
  assert.equal(hasVerifiedLatestDeliveryQc([approved,earlier,rework],orderId),true);
  assert.equal(hasVerifiedLatestDeliveryQc([{...rework,order_id:"another-order"},approved],orderId),true);
  assert.equal(hasVerifiedLatestDeliveryQc([],orderId),false);
  assert.equal(hasVerifiedLatestDeliveryQc([earlier],"another-order"),false);
});

test("J5: malformed or coerced QC provenance cannot become a delivery approval",()=>{
  for(const value of [null,undefined,false,{}, {rows:[approved]}, "[]", [null], [false], [approved,{}]]){
    assert.equal(hasVerifiedLatestDeliveryQc(value,orderId),false,String(value));
  }
  for(const invalid of [
    {...approved,order_id:[orderId]},
    {...approved,decision:["approved"]},
    {...approved,inspector:["Checker A"]},
    {...approved,inspection_reference:["QC-1"]},
    {...approved,inspector:" "},
    {...approved,inspector:" x "},
    {...approved,inspection_reference:" QC-1 "},
    {...approved,created_at:["2026-10-29T12:00:00Z"]},
    {...approved,created_at:"not-a-time"},
    {...approved,created_at:"2026-10-29"},
  ]){
    assert.equal(hasVerifiedLatestDeliveryQc([invalid],orderId),false,JSON.stringify(invalid));
  }
});

test("J5: a forged approval cannot unlock delivery without six literal physical checks",()=>{
  for(const invalidChecks of [
    undefined,null,{},[],{"recipe_match":true},
    {...passingChecks,recipe_match:false},
    {...passingChecks,fabric_match:"true"},
    {...passingChecks,unverified_extra:true},
  ]){
    assert.equal(hasVerifiedLatestDeliveryQc([{...approved,checks:invalidChecks}],orderId),false,
      JSON.stringify(invalidChecks));
  }
  assert.equal(hasVerifiedLatestDeliveryQc([{...approved,checks:passingChecks}],orderId),true);
  assert.equal(hasVerifiedLatestDeliveryQc([earlier,{...rework,checks:{}}],orderId),false,
    "newer rework must still veto an earlier passing approval");
});

test("J5: timestamp ties cannot promote an ambiguous older approval",()=>{
  assert.equal(hasVerifiedLatestDeliveryQc([approved,{...rework,created_at:approved.created_at}],orderId),false);
  assert.equal(hasVerifiedLatestDeliveryQc([rework,{...approved,created_at:rework.created_at}],orderId),false);
  assert.equal(hasVerifiedLatestDeliveryQc([{...approved,created_at:"2026-10-29T12:00:00+00:00"}],orderId),true);
});

test("J5: only a physical inspection for the current ready order and immutable recipe can release delivery",()=>{
  const order={order_id:orderId,revision_id:"locked-revision-001",recipe_hash:"a".repeat(64),
    status:"ready",created_at:"2026-10-29T09:00:00.000Z"};
  const physical={...approved,inspection_id:"123e4567-e89b-42d3-a456-426614174111",
    revision_id:order.revision_id,recipe_hash:order.recipe_hash};
  assert.equal(hasVerifiedDeliveryQcOrderLineage([physical],order),true);
  assert.equal(hasVerifiedLatestDeliveryQc([physical],orderId,500),true);
  for(const forged of [
    {...physical,inspection_id:undefined},
    {...physical,inspection_id:" 123e4567-e89b-42d3-a456-426614174111 "},
    {...physical,inspection_id:[physical.inspection_id]},
    {...physical,revision_id:"different-revision-001"},
    {...physical,recipe_hash:"b".repeat(64)},
    {...physical,recipe_hash:["a".repeat(64)]},
    {...physical,created_at:"2026-10-29T08:59:59Z"},
    {...physical,created_at:"2026-02-31T12:00:00Z"},
  ]){
    assert.equal(hasVerifiedDeliveryQcOrderLineage([forged],order),false,JSON.stringify(forged));
    assert.equal(hasVerifiedDeliveryQcOrderLineage([physical,forged],order),false,
      "an older forged matching-order inspection must not be ignored");
  }
  assert.equal(hasVerifiedDeliveryQcOrderLineage([physical],{...order,status:"stitching"}),false);
  assert.equal(hasVerifiedDeliveryQcOrderLineage([physical],{...order,created_at:"2026-10-29T13:00:00Z"}),false);
  assert.equal(hasVerifiedDeliveryQcOrderLineage([physical],{...order,recipe_hash:"b".repeat(64)}),false);
  assert.equal(hasVerifiedDeliveryQcOrderLineage([],order),false);
  assert.equal(hasVerifiedDeliveryQcOrderLineage([physical],null),false);
  assert.equal(hasVerifiedDeliveryQcOrderLineage([physical,{...physical,order_id:"another-order"}],order),true,
    "unrelated historical QC does not change the current order's recipe");
});

test("privileged delivery status uses latest typed QC gate before status RPC",()=>{
  const source=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const delivered=source.split('if(status==="delivered")')[1]?.split('const updated=await rpc<unknown>("production_order_set_status"')[0]||"";
  assert.match(source,/import \{ hasVerifiedLatestDeliveryQc, hasVerifiedDeliveryQcOrderLineage \} from "@\/lib\/designer\/delivery-qc-approval"/);
  assert.match(delivered,/rpc<unknown>\("finished_garment_qc_list",\{p_limit:500\}\)/);
  assert.match(delivered,/if\(!hasVerifiedLatestDeliveryQc\(inspections,orderId,500\)\)/);
  assert.match(delivered,/rpc<unknown>\("production_order_list",\{p_limit:150\}\)/);
  assert.match(delivered,/validProductionQcOrderRows\(candidateOrders\)/);
  assert.match(delivered,/candidateOrders\.length>=150/);
  assert.match(delivered,/hasVerifiedDeliveryQcOrderLineage\(inspections,currentOrder\)/);
  assert.ok(delivered.includes("if(!hasVerifiedDeliveryQcOrderLineage(inspections,currentOrder))"),"lineage guard must precede status mutation");
  assert.doesNotMatch(delivered,/inspections\.find/);
  assert.doesNotMatch(delivered,/String\(latest\.(?:inspector|inspection_reference)/);
  assert.match(delivered,/status:409/);
});

test("release gate verifies the latest typed QC guard instead of obsolete first-match wording",()=>{
  const release=readFileSync("scripts/release-readiness.mjs","utf8");
  assert.match(release,/requireTokens\("src\/lib\/designer\/delivery-qc-approval\.ts"/);
  assert.match(release,/hasVerifiedLatestDeliveryQc\(inspections,orderId,500\)/);
  assert.match(release,/latest\.decision/);
  assert.match(release,/ambiguous/);
  assert.doesNotMatch(release,/"Finished-garment QC approval is required before delivery\."\,/);
});

test("operator production desk never offers delivery based on first matching stale QC",()=>{
  const ui=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  assert.ok(ui.includes('import { hasVerifiedLatestDeliveryQc, hasVerifiedDeliveryQcOrderLineage } from "@/lib/designer/delivery-qc-approval"'));
  assert.ok(ui.includes("const deliveryQcVerified=hasVerifiedLatestDeliveryQc(qcInspections,item.order_id,250)"));
  assert.ok(ui.includes("hasVerifiedDeliveryQcOrderLineage(qcInspections,item)"));
  assert.ok(ui.includes('status!=="delivered"||deliveryQcVerified'));
  assert.ok(ui.includes('deliveryQcVerified?"approved with provenance":"pending / rework / unverified"'));
  assert.ok(!ui.includes("qcInspections.find("));
  assert.ok(!ui.includes('latestQc?.decision==="approved"'));
  assert.equal(hasVerifiedLatestDeliveryQc([earlier,rework],orderId),false);
  assert.equal(hasVerifiedLatestDeliveryQc([rework,approved],orderId),true);
});

test("operator desk clears stale production records and disables mutation controls on ledger failure",()=>{
  const ui=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const load=ui.split("async function load(){")[1]?.split("useEffect(()=>{void load();},[])")[0]||"";
  assert.ok(load.includes("if(!response.ok) throw new Error"));
  assert.ok(load.includes("if(!validProductionDeskResponse(data))"),"the browser must validate the complete typed ledger envelope, not merely two arrays");
  assert.ok(load.includes("setConfigured(data.configured)"),"never assume missing configured means true");
  for(const reset of ["setConfigured(false)","setQuotes([])","setOrders([])","setQcInspections([])","setCustomerOutcomes([])","setLearningContexts([])"]){
    assert.ok(load.includes(reset),`missing fail-closed reset: ${reset}`);
  }
  assert.ok(ui.includes("disabled={busy||!configured||!canQuote}"));
  assert.ok(ui.includes("disabled={busy||!configured||!loadedRevision"));
});

test("J5: impossible QC calendar dates cannot outrank a real later rework",()=>{
  const realRework={...rework,created_at:"2026-03-02T12:00:00Z"};
  const phantomApproval={...approved,created_at:"2026-02-31T12:00:00Z"};
  // Date.parse(phantomApproval.created_at) normalizes to March 3, after rework.
  assert.equal(hasVerifiedLatestDeliveryQc([realRework,phantomApproval],orderId),false);
  assert.equal(hasVerifiedLatestDeliveryQc([phantomApproval,realRework],orderId),false);
  for(const created_at of [
    "2026-02-29T12:00:00Z",
    "2026-04-31T12:00:00Z",
    "2026-10-29T24:00:00Z",
    "2026-10-29T12:60:00Z",
    "2026-10-29T12:00:60Z",
  ]){
    assert.equal(hasVerifiedLatestDeliveryQc([{...approved,created_at}],orderId),false,created_at);
  }
  for(const created_at of [
    "2024-02-29T12:00:00Z",
    "2026-10-29T12:00:00.123456Z",
    "2026-10-29T12:00:00+05:30",
  ]){
    assert.equal(hasVerifiedLatestDeliveryQc([{...approved,created_at}],orderId),true,created_at);
  }
});

test("J5: a saturated global QC ledger cannot certify latest-by-order delivery",()=>{
  // A list limited to N rows cannot prove that it includes every inspection.
  // Fail closed even when a valid approval is visible in the returned page.
  const full500=[approved,...Array.from({length:499},()=>({...earlier,order_id:"unrelated-order"}))];
  assert.equal(hasVerifiedLatestDeliveryQc(full500,orderId,500),false);
  assert.equal(hasVerifiedLatestDeliveryQc(full500.slice(0,499),orderId,500),true);
  assert.equal(hasVerifiedLatestDeliveryQc(full500,orderId,501),true);
  const full250=full500.slice(0,250);
  assert.equal(hasVerifiedLatestDeliveryQc(full250,orderId,250),false);
  assert.equal(hasVerifiedLatestDeliveryQc(full250.slice(0,249),orderId,250),true);
  for(const invalidLimit of [0,-1,1.5,NaN]) {
    assert.equal(hasVerifiedLatestDeliveryQc([approved],orderId,invalidLimit),false);
  }
  assert.equal(hasVerifiedLatestDeliveryQc([approved],orderId),true);
});
