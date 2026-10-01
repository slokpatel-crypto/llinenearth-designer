import test from "node:test";
import assert from "node:assert/strict";
import { normalizeManualStockEvent, stockSnapshot } from "../src/lib/designer/stock-ledger.ts";

test("reservation reduces available stock without changing physical stock",()=>{
  assert.deepEqual(stockSnapshot([
    {type:"receipt",quantityMetres:10},
    {type:"reserve",quantityMetres:2},
  ]),{physicalMetres:10,reservedMetres:2,availableMetres:8});
});

test("consuming a fully reserved quantity reduces physical and reserved equally",()=>{
  assert.deepEqual(stockSnapshot([
    {type:"receipt",quantityMetres:10},
    {type:"reserve",quantityMetres:2},
    {type:"consume",quantityMetres:2},
  ]),{physicalMetres:8,reservedMetres:0,availableMetres:8});
});

test("partial consumption plus release restores unused reserved metres",()=>{
  assert.deepEqual(stockSnapshot([
    {type:"receipt",quantityMetres:10},
    {type:"reserve",quantityMetres:3},
    {type:"consume",quantityMetres:2},
    {type:"release",quantityMetres:1},
  ]),{physicalMetres:8,reservedMetres:0,availableMetres:8});
});


test("manual physical stock evidence requires named provenance",()=>{
  assert.throws(()=>normalizeManualStockEvent({
    fabricId:"shirt-1",eventType:"receipt",quantityMetres:12,recordedBy:"",sourceReference:"roll-count-1",
  }),/Named stock checker/i);
  assert.throws(()=>normalizeManualStockEvent({
    fabricId:"shirt-1",eventType:"receipt",quantityMetres:12,recordedBy:"SP",sourceReference:"",
  }),/source reference/i);
  assert.deepEqual(normalizeManualStockEvent({
    fabricId:"shirt-1",eventType:"receipt",quantityMetres:12.34567,recordedBy:" SP ",sourceReference:" Roll tag LE-42 ",
  }),{
    fabricId:"shirt-1",eventType:"receipt",quantityMetres:12.346,note:"",recordedBy:"SP",sourceReference:"Roll tag LE-42",
  });
});
