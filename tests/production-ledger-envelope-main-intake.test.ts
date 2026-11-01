import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assertProductionLedgerLists} from "../src/lib/designer/production-ledger-envelope.ts";

const empty=()=>({quotes:[],orders:[],qcInspections:[],customerOutcomes:[],learningContexts:[]});
const limits={quotes:100,orders:100,qcInspections:250,customerOutcomes:250,learningContexts:500} as const;

test("valid empty or populated SQL row lists remain readable",()=>{
  assert.doesNotThrow(()=>assertProductionLedgerLists(empty()));
  assert.doesNotThrow(()=>assertProductionLedgerLists({...empty(),quotes:[{id:"q"}],orders:[{id:"o"}],qcInspections:[{id:"qc"}],customerOutcomes:[{id:"co"}],learningContexts:[{id:"lc"}]}));
  for(const name of Object.keys(limits) as Array<keyof typeof limits>){
    assert.doesNotThrow(()=>assertProductionLedgerLists({...empty(),[name]:Array.from({length:limits[name]},()=>({}))}));
  }
});

test("all five ledger sources fail closed on non-arrays, invalid rows and excessive results",()=>{
  for(const name of Object.keys(limits) as Array<keyof typeof limits>){
    for(const invalid of [null,undefined,{},"[]",false,0,[null],[[]],["row"],[7],[true]]){
      assert.throws(()=>assertProductionLedgerLists({...empty(),[name]:invalid}),/shape verification/,
        name+" must not appear empty after malformed SQL");
    }
    assert.throws(()=>assertProductionLedgerLists({...empty(),[name]:Array.from({length:limits[name]+1},()=>({}))}),/shape verification/);
  }
});

test("real production GET validates the entire ledger before returning configured true",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const get=route.split("export async function GET(){")[1]?.split("function privateProductionResponse(")[0]??"";
  const validation=get.indexOf("assertProductionLedgerLists({quotes,orders,qcInspections,customerOutcomes,learningContexts})");
  const success=get.indexOf("return privateProductionResponse({configured:true,quotes,orders,qcInspections,customerOutcomes,learningContexts}");
  assert.ok(validation>=0&&success>validation,"Never return a configured ledger before all five arrays are verified");
  assert.match(get,/catch\(error\)[\s\S]*?status:503/);
  assert.match(route,/response\.headers\.set\("cache-control","private, no-store"\)/);
});
