import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {hasVerifiedLatestDeliveryQc} from "../src/lib/designer/delivery-qc-approval.ts";

const orderId="123e4567-e89b-42d3-a456-426614174000";
const earlier={order_id:orderId,decision:"approved",inspector:"Checker A",inspection_reference:"QC-1",created_at:"2026-10-29T10:00:00.000Z"};
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

test("J5: timestamp ties cannot promote an ambiguous older approval",()=>{
  assert.equal(hasVerifiedLatestDeliveryQc([approved,{...rework,created_at:approved.created_at}],orderId),false);
  assert.equal(hasVerifiedLatestDeliveryQc([rework,{...approved,created_at:rework.created_at}],orderId),false);
  assert.equal(hasVerifiedLatestDeliveryQc([{...approved,created_at:"2026-10-29T12:00:00+00:00"}],orderId),true);
});

test("privileged delivery status uses latest typed QC gate before status RPC",()=>{
  const source=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const delivered=source.split('if(status==="delivered")')[1]?.split('const updated=await rpc<unknown>("production_order_set_status"')[0]||"";
  assert.match(source,/import \{ hasVerifiedLatestDeliveryQc \} from "@\/lib\/designer\/delivery-qc-approval"/);
  assert.match(delivered,/rpc<unknown>\("finished_garment_qc_list",\{p_limit:500\}\)/);
  assert.match(delivered,/if\(!hasVerifiedLatestDeliveryQc\(inspections,orderId\)\)/);
  assert.doesNotMatch(delivered,/inspections\.find/);
  assert.doesNotMatch(delivered,/String\(latest\.(?:inspector|inspection_reference)/);
  assert.match(delivered,/status:409/);
});

test("release gate verifies the latest typed QC guard instead of obsolete first-match wording",()=>{
  const release=readFileSync("scripts/release-readiness.mjs","utf8");
  assert.match(release,/requireTokens\("src\/lib\/designer\/delivery-qc-approval\.ts"/);
  assert.match(release,/hasVerifiedLatestDeliveryQc\(inspections,orderId\)/);
  assert.match(release,/latest\.decision/);
  assert.match(release,/ambiguous/);
  assert.doesNotMatch(release,/"Finished-garment QC approval is required before delivery\."\,/);
});

test("operator production desk never offers delivery based on first matching stale QC",()=>{
  const ui=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  assert.ok(ui.includes('import { hasVerifiedLatestDeliveryQc } from "@/lib/designer/delivery-qc-approval"'));
  assert.ok(ui.includes("const deliveryQcVerified=hasVerifiedLatestDeliveryQc(qcInspections,item.order_id)"));
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
  assert.ok(load.includes("!Array.isArray(data.quotes)||!Array.isArray(data.orders)"));
  for(const reset of ["setConfigured(false)","setQuotes([])","setOrders([])","setQcInspections([])","setCustomerOutcomes([])","setLearningContexts([])"]){
    assert.ok(load.includes(reset),`missing fail-closed reset: ${reset}`);
  }
  assert.ok(ui.includes("disabled={busy||!configured||!canQuote}"));
  assert.ok(ui.includes("disabled={busy||!configured||!loadedRevision"));
});
