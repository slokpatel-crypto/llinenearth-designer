import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ORDER_TRANSITIONS,canTransitionOrder} from "../src/lib/designer/production-state.ts";
import {latestQcForOrder} from "../src/lib/designer/finished-garment-qc.ts";

test("Production Desk must not use a capped global QC list to authorize or hide delivery",()=>{
  // An older order may be absent from the global last-250 inspections even
  // though its order-scoped latest QC is valid on the backend.
  const ui=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const service=readFileSync("src/app/api/operator/production/route.ts","utf8");
  assert.ok(ORDER_TRANSITIONS.ready.includes("delivered"));
  assert.equal(canTransitionOrder("ready","delivered"),true);
  assert.equal(latestQcForOrder([],"older-order"),null);

  assert.match(ui,/const latestQc=latestQcForOrder\(qcInspections,item\.order_id\)/);
  assert.match(ui,/const nextStatuses=ORDER_TRANSITIONS\[item\.status as ProductionOrderStatus\]\|\|\[\]/);
  assert.doesNotMatch(ui,/\.filter\(\(status\)=>status!=="delivered"\|\|latestQc\?\.decision==="approved"\)/);
  assert.match(ui,/capped ledger shown here is not delivery authorization/);
  assert.match(ui,/Recent QC ledger preview/);
  assert.match(service,/rpc<unknown>\("finished_garment_qc_latest_for_order",\{p_order_id:orderId\}/);
  assert.match(service,/if\(latest\?\.decision!=="approved"\)/);
  assert.ok(service.indexOf('"finished_garment_qc_latest_for_order"')<service.lastIndexOf('"production_order_set_status"'),
    "order-scoped QC read must gate the delivery mutation");
});

test("QC ledger preview shows latest listed evidence, not list order or a supposed verified state",()=>{
  const old={order_id:"older-order",decision:"approved",created_at:"2026-10-01T10:00:00Z"};
  const newer={order_id:"older-order",decision:"rework",created_at:"2026-10-01T11:00:00Z"};
  assert.equal(latestQcForOrder([old,newer],"older-order")?.decision,"rework");
  assert.equal(latestQcForOrder([newer,old],"older-order")?.decision,"rework");
  assert.equal(latestQcForOrder([],"older-order"),null);
  assert.equal(latestQcForOrder([old,{...newer,created_at:old.created_at}],"older-order"),null);
});
