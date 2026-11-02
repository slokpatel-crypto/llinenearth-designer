import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {requireDeliveryEvidenceSnapshot} from "../src/lib/designer/operator-delivery-snapshot.ts";

const uuid=(n:number)=>"00000000-0000-4000-8000-"+n.toString(16).padStart(12,"0");
const order=(n:number)=>({
  order_id:uuid(n),revision_id:"REV-"+n,recipe_hash:"a".repeat(64),
  status:"delivered",note:"",created_at:"2026-10-01T10:00:00Z",
});
const receipt=(n:number)=>({
  evidence_id:uuid(100+n),order_id:uuid(n),
  revision_id:"REV-"+n,recipe_hash:"a".repeat(64),
  manual_design_reentry:false,reentry_fields:[],note:"",
  operator:"Tailor A",evidence_reference:"Dispatch "+n,
  created_at:"2026-10-02T10:00:00Z",
  order_created_at:"2026-10-01T10:00:00Z",
});

test("valid authenticated delivery audit data is available after strict snapshot verification",()=>{
  const snapshot=requireDeliveryEvidenceSnapshot({
    configured:true,
    orders:[order(1),order(2)],
    evidence:[receipt(1)],
  });
  assert.equal(snapshot.orders.length,2);
  assert.equal(snapshot.evidence.length,1);
  assert.equal(snapshot.evidence[0].manual_design_reentry,false);
  const legacy=requireDeliveryEvidenceSnapshot({
    configured:true,orders:[order(1)],
    evidence:[{...receipt(1),operator:null,evidence_reference:null}],
  });
  assert.equal(legacy.evidence[0].operator,"");
  assert.equal(legacy.evidence[0].evidence_reference,"");
});

test("unconfigured, malformed, oversized or invented delivery responses cannot certify phase 8",()=>{
  for(const data of [
    null,false,{},[],{configured:false,orders:[],evidence:[]},
    {configured:true,orders:[],evidence:{}},
    {configured:true,orders:null,evidence:[]},
    {configured:true,orders:Array.from({length:501},(_,i)=>order(i+1)),evidence:[]},
    {configured:true,orders:[],evidence:Array.from({length:501},(_,i)=>receipt(i+1))},
    {configured:true,orders:[null],evidence:[]},
  ]) assert.throws(()=>requireDeliveryEvidenceSnapshot(data),
    /Unverified production delivery snapshot/);
});

test("duplicate order/audit identities and unverifiable source fields fail closed",()=>{
  const base={configured:true,orders:[order(1)],evidence:[receipt(1)]};
  const variants=[
    {...base,orders:[order(1),order(1)]},
    {...base,evidence:[receipt(1),receipt(1)]},
    {...base,evidence:[receipt(1),{...receipt(2),order_id:uuid(1)}]},
    {...base,orders:[{...order(1),status:"fabricated"}]},
    {...base,orders:[{...order(1),recipe_hash:"bad"}]},
    {...base,orders:[{...order(1),order_id:"not-a-uuid"}]},
    {...base,orders:[{...order(1),created_at:"invalid"}]},
    {...base,evidence:[{...receipt(1),manual_design_reentry:"false"}]},
    {...base,evidence:[{...receipt(1),manual_design_reentry:null}]},
    {...base,evidence:[{...receipt(1),reentry_fields:["unknown"]}]},
    {...base,evidence:[{...receipt(1),created_at:"2026-09-20T10:00:00Z"}]},
    {...base,evidence:[{...receipt(1),order_created_at:"2026-10-02T10:00:00Z"}]},
    {...base,evidence:[{...receipt(1),recipe_hash:"b".repeat(64)}]},
    {...base,evidence:[{...receipt(1),revision_id:"OTHER"}]},
    {...base,evidence:[{...receipt(1),operator:{untrusted:true}}]},
  ];
  for(const v of variants)assert.throws(()=>requireDeliveryEvidenceSnapshot(v),
    /Unverified production delivery snapshot/);
});

test("failed delivery-audit refresh clears old counts and cannot retain an optimistic first-ten gate",()=>{
  const source=readFileSync(
    "src/app/operator/production-evidence/ProductionEvidenceClient.tsx","utf8");
  const load=source.split('async function load(expectedReceipt?')[1]?.split('  useEffect(')[0]??"";
  assert.ok(load.includes("const generation=++refreshGeneration.current"));
  assert.ok(load.indexOf('setOrders([]);setEvidence([])')<
    load.indexOf('fetch("/api/operator/production-evidence"'));
  assert.ok(load.includes('if(generation!==refreshGeneration.current)return false'));
  assert.ok(load.includes('requireDeliveryEvidenceSnapshot(await response.json())'));
  assert.ok(load.includes('row.evidence_id.toLowerCase()===expectedReceipt.evidenceId.toLowerCase()'));
  assert.ok(load.includes('setSelectedOrderId("");setSnapshotState("error")'));
  assert.ok(source.includes('snapshotState!=="ready"?"UNVERIFIED"'));
  assert.ok(source.includes('snapshotState==="ready"?summary.deliveredCount:"—"'));
  assert.ok(source.includes('Refresh delivery evidence'));
});

test("unknown delivery audit write outcome cannot be called saved or retried before reconciliation",()=>{
  const source=readFileSync(
    "src/app/operator/production-evidence/ProductionEvidenceClient.tsx","utf8");
  const save=source.split("  async function saveEvidence(){")[1]?.split("\n  return <main")[0]??"";
  assert.ok(source.includes("useRef(createOperatorMutationGate())"));
  assert.ok(save.includes('snapshotState!=="ready"||!mutationGate.current.enter()'));
  assert.ok(save.includes("refreshGeneration.current++"));
  assert.ok(save.includes("requireOperatorCreatedId(receipt)"));
  assert.ok(save.includes('const refreshed=await load({orderId:selected.order_id,evidenceId})'));
  assert.ok(save.includes('setSelectedOrderId("");setSnapshotState("error")'));
  assert.ok(save.includes('mutationGate.current.exit()'));
  assert.ok(source.includes('disabled={busy||!choiceValid||snapshotState!=="ready"||!configured}'));
  assert.ok(source.includes('Previous approval totals were cleared'));
});
