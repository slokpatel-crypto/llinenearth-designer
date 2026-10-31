import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {safeProductionDeliveryTransport} from "../src/lib/designer/production-delivery-transport.ts";

const orderId="123e4567-e89b-42d3-a456-426614174001";
const auditId="123e4567-e89b-42d3-a456-426614174002";
const version="linen-earth-production-first-ten-audit-v2";
const order={
  order_id:orderId,revision_id:"locked-design-v1",recipe_hash:"a".repeat(64),
  status:"delivered",note:"Delivered garment",created_at:"2026-10-01T10:00:00Z",
  delivered_at:"2026-10-02T10:00:00Z",
  customer_phone:"DO-NOT-LEAK-CI-CUSTOMER",internal_unit_cost:"DO-NOT-LEAK-CI-COST",
};
const audit={
  evidence_id:auditId,order_id:orderId,revision_id:order.revision_id,
  recipe_hash:order.recipe_hash,manual_design_reentry:true,
  reentry_fields:["fabric_identity"],note:"Manually re-entered code",
  operator:"Synthetic checker",evidence_reference:"job-card-CI-001",
  created_at:"2026-10-03T10:00:00Z",order_created_at:order.created_at,
  secret_supplier_contact:"DO-NOT-LEAK-CI-SUPPLIER",
};
const basis={
  version,historyValid:true,orders:[{...order,private_customer:"DO-NOT-LEAK-CI-HISTORY-ORDER"}],
  evidence:[{...audit,private_rate:"DO-NOT-LEAK-CI-HISTORY-AUDIT"}],
  private_shop_token:"DO-NOT-LEAK-CI-BASIS",
};

test("private delivery transport preserves adverse evidence and omits all extra SQL columns",()=>{
  const projected=safeProductionDeliveryTransport([order],[audit],basis);
  assert.equal(projected.orders.length,1);
  assert.equal(projected.evidence.length,1);
  assert.equal(projected.evidence[0].manual_design_reentry,true);
  assert.deepEqual(projected.evidence[0].reentry_fields,["fabric_identity"]);
  assert.equal(projected.firstTenBasis?.historyValid,true);
  assert.equal((projected.firstTenBasis as {evidence:Array<{manual_design_reentry:boolean}>}).evidence[0].manual_design_reentry,true);
  assert.deepEqual(Object.keys(projected.orders[0]).sort(),
    ["order_id","revision_id","recipe_hash","status","note","created_at","delivered_at"].sort());
  assert.deepEqual(Object.keys(projected.evidence[0]).sort(),
    ["evidence_id","order_id","revision_id","recipe_hash","manual_design_reentry",
      "reentry_fields","note","operator","evidence_reference","created_at","order_created_at"].sort());
  assert.doesNotMatch(JSON.stringify(projected),/DO-NOT-LEAK-CI-/);
  assert.equal(Object.hasOwn(order,"customer_phone"),true);
  assert.equal(Object.hasOwn(audit,"secret_supplier_contact"),true);
});

test("invalid historical basis remains explicitly invalid without any untrusted private rows",()=>{
  const bad={...basis,historyValid:false,orders:[{...order,extra:"DO-NOT-LEAK-CI-BAD"}],
    evidence:[{...audit,extra:"DO-NOT-LEAK-CI-BAD"}]};
  const safe=safeProductionDeliveryTransport([order],[audit],bad);
  assert.deepEqual(safe.firstTenBasis,{version,historyValid:false,orders:[],evidence:[]});
  assert.doesNotMatch(JSON.stringify(safe),/DO-NOT-LEAK-CI-/);
  assert.equal(safe.firstTenBasis?.historyValid,false);
  assert.equal(safeProductionDeliveryTransport([],[],null).firstTenBasis,null);
});

test("private transport fails closed on malformed raw evidence or contradictory chronology",()=>{
  const failures:Array<[unknown,unknown,unknown]>=[
    [[{...order,status:"fictional"}],[audit],basis],
    [[{...order,note:{phone:"hidden"}}],[audit],basis],
    [[{...order,note:"x".repeat(1201)}],[audit],basis],
    [[order],[{...audit,operator:"x".repeat(121)}],basis],
    [[order],[{...audit,reentry_fields:Array(7).fill("fabric_identity")}],basis],
    [[order],[{...audit,reentry_fields:["fabric_identity","fabric_identity"]}],basis],
    [[order],[{...audit,created_at:"2026-09-30T10:00:00Z"}],basis],
    [[order],[{...audit,recipe_hash:"b".repeat(64)}],basis],
    [[order],[audit],{...basis,version:"unknown"}],
    [[order],[audit],{...basis,historyValid:true,orders:[{...order,status:"created"}]}],
  ];
  for(const triple of failures){
    assert.throws(()=>safeProductionDeliveryTransport(...triple));
  }
});

test("operator delivery route serializes only bounded, revalidated projected fields",()=>{
  const route=readFileSync("src/app/api/operator/production-evidence/route.ts","utf8");
  assert.match(route,/safeProductionDeliveryTransport\(orders,evidence,firstTenBasis\)/);
  assert.match(route,/orders:safe\.orders,evidence:safe\.evidence/);
  assert.match(route,/firstTenBasis:safe\.firstTenBasis,firstTenAuditInstalled/);
  assert.doesNotMatch(route,/return respond\(\{configured:true,orders,evidence,firstTenBasis,firstTenAuditInstalled\}\)/);
});
