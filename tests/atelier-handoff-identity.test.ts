import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mergeDistinctAtelierHandoffs, validStoredAtelierHandoffs} from "../src/lib/atelier-handoff-identity.ts";

type Enquiry={designId:string;specHash:string;customerNote:string};

test("two saved designs with the same locked garment spec keep independent handoffs",()=>{
  const first:Enquiry={designId:"design-customer-a",specHash:"identical-outfit",customerNote:"Customer A wants a consultation"};
  const second:Enquiry={designId:"design-customer-b",specHash:"identical-outfit",customerNote:"Customer B wants a later fitting"};
  const records=mergeDistinctAtelierHandoffs([first],second);
  assert.deepEqual(records,[second,first]);
  assert.equal(records[1].customerNote,first.customerNote);
});

test("resubmitting the same saved design version updates one handoff",()=>{
  const old:Enquiry={designId:"design-a",specHash:"version-1",customerNote:"Old request"};
  const newest:Enquiry={...old,customerNote:"Updated consultation note"};
  const records=mergeDistinctAtelierHandoffs([old],newest);
  assert.deepEqual(records,[newest]);
});

test("distinct locked versions of one saved design remain independently reviewable",()=>{
  const old:Enquiry={designId:"design-a",specHash:"hash-old",customerNote:"First cut"};
  const updated:Enquiry={...old,specHash:"hash-revised",customerNote:"Revised collar"};
  assert.deepEqual(mergeDistinctAtelierHandoffs([old],updated),[updated,old]);
});

test("handoff storage cap remains 50 without mutating caller records",()=>{
  const previous=Array.from({length:50},(_,i)=>({designId:String(i),specHash:"same",customerNote:"Note"}));
  const original=[...previous];
  const result=mergeDistinctAtelierHandoffs(previous,{designId:"new",specHash:"same",customerNote:"New"});
  assert.equal(result.length,50);
  assert.equal(result[0].designId,"new");
  assert.deepEqual(previous,original);
});

test("production atelier writer uses composite handoff identity rather than specHash alone",()=>{
  const source=readFileSync("src/lib/handoff.ts","utf8");
  assert.match(source,/mergeDistinctAtelierHandoffs\(existing,item\)/);
  assert.doesNotMatch(source,/filter\(\(x\)=>x\.specHash!==item\.specHash\)/);
});

test("corrupted local handoff rows cannot poison new customer requests",()=>{
  const valid={
    id:"HO-001",designId:"design-a",specHash:"same-pattern",createdAt:"2026-10-24T12:00:00.000Z",
    title:"Linen shirt",status:"requested",garmentSpec:{},fabricAssessment:{score:70},
    palette:["ivory"],idealStoreFabrics:[],
  };
  const stored=[null,false,"broken",{}, {...valid,id:""}, {...valid,palette:"blue"},valid];
  const snapshot=JSON.stringify(stored);
  const recovered=validStoredAtelierHandoffs<typeof valid>(stored);
  assert.deepEqual(recovered,[valid]);
  assert.equal(JSON.stringify(stored),snapshot);
  assert.deepEqual(mergeDistinctAtelierHandoffs(recovered,{...valid,id:"HO-002",designId:"design-b"}).map(x=>x.id),["HO-002","HO-001"]);
});

test("invalid JSON storage shape does not produce fake atelier handoffs",()=>{
  for(const value of [null,{},[],false,"[bad JSON]"]) {
    assert.deepEqual(validStoredAtelierHandoffs(value),[]);
  }
});

test("browser Atelier reader validates storage rows before render/update",()=>{
  const source=readFileSync("src/lib/handoff.ts","utf8");
  assert.match(source,/validStoredAtelierHandoffs<AtelierHandoff>\(value\)/);
});
