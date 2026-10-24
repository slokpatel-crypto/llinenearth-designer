import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {makeAtelierHandoffId, mergeDistinctAtelierHandoffs, validStoredAtelierHandoffs} from "../src/lib/atelier-handoff-identity.ts";

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
    title:"Linen shirt",status:"requested",garmentSpec:{shirt:"Oxford",trouser:"Flat front",layer:"None",footwear:"Loafer"},
    fabricAssessment:{score:70,verdict:"good",preferredRole:"shirt",bestOutfitType:"Two piece",reasons:["Versatile"]},
    customerNote:"Visit tomorrow",occasion:"Business",venue:"Store",aesthetic:"classic",uploadedFabric:"Ivory linen",
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

test("nested malformed handoff records and unknown statuses are dropped before Atelier rendering",()=>{
  const valid={
    id:"HO-001",designId:"design-a",specHash:"hash",createdAt:"2026-10-24T12:00:00.000Z",
    title:"Shirt",status:"requested",customerNote:"",occasion:"Office",venue:"Store",
    aesthetic:"clean",uploadedFabric:"Linen",garmentSpec:{shirt:"Shirt",trouser:"Trouser",layer:"None",footwear:"Loafer"},
    fabricAssessment:{score:80,verdict:"appropriate",preferredRole:"shirt",bestOutfitType:"Shirt",reasons:["Soft"]},
    palette:["#ffffff"],idealStoreFabrics:[{id:"A",name:"Linen A",reason:"Stock alternative"}]
  };
  const bad=[
    {...valid,status:"completed"},
    {...valid,garmentSpec:{shirt:"Shirt"}},
    {...valid,garmentSpec:[]},
    {...valid,fabricAssessment:{...valid.fabricAssessment,reasons:null}},
    {...valid,fabricAssessment:{...valid.fabricAssessment,reasons:["Fine",{}]}},
    {...valid,fabricAssessment:{...valid.fabricAssessment,score:"80"}},
    {...valid,palette:[{color:"blue"}]},
    {...valid,idealStoreFabrics:[null]},
    {...valid,idealStoreFabrics:[{id:"A",name:"B"}]},
    {...valid,customerNote:{text:"unsafe"}},
    {...valid,staffNote:["bad"]}
  ];
  assert.deepEqual(validStoredAtelierHandoffs([...bad,valid]),[valid]);
});
test("corrupt or legacy oversized storage cannot make Atelier queue exceed its 50 record bound",()=>{
  const valid={
    id:"HO",designId:"D",specHash:"S",createdAt:"2026-10-24",title:"Linen",
    status:"requested",customerNote:"",occasion:"",venue:"",aesthetic:"",uploadedFabric:"",
    garmentSpec:{shirt:"",trouser:"",layer:"",footwear:""},
    fabricAssessment:{score:0,verdict:"pending",preferredRole:"shirt",bestOutfitType:"",reasons:[]},
    palette:[],idealStoreFabrics:[]
  };
  const many=Array.from({length:75},(_,i)=>({...valid,id:`HO-${i}`}));
  const result=validStoredAtelierHandoffs(many);
  assert.equal(result.length,50);
  assert.deepEqual(result.map(x=>x.id),many.slice(0,50).map(x=>x.id));
});
test("Atelier selection always reflects the chosen request's saved note and status",()=>{
  const source=readFileSync("src/components/AtelierQueueClient.tsx","utf8");
  assert.match(source,/setActiveId\(loaded\[0\]\?\.id\|\|null\);setNote\(loaded\[0\]\?\.staffNote\|\|""\)/);
  assert.match(source,/onClick=\{\(\)=>\{setActiveId\(item\.id\);setNote\(item\.staffNote\|\|""\)\}\}/);
  assert.match(source,/<select value=\{active\.status\}/);
  assert.doesNotMatch(source,/<select defaultValue=\{active\.status\}/);
});

test("distinct local requests cannot share a timestamp-derived handoff identifier",()=>{
  const a=new Uint8Array(16),b=new Uint8Array(16);
  a[15]=1; b[15]=2;
  const first=makeAtelierHandoffId("same-hash","same-design",a);
  const second=makeAtelierHandoffId("same-hash","same-design",b);
  assert.notEqual(first,second);
  assert.match(first,/^HO-same-hash-[A-F0-9]{32}$/);
  assert.equal(makeAtelierHandoffId("", "design-only",a).startsWith("HO-design-only-"),true);
  assert.throws(()=>makeAtelierHandoffId("hash","id",new Uint8Array(0)),/128 bits/);
});
test("handoff writer uses browser cryptographic randomness rather than just milliseconds",()=>{
  const source=readFileSync("src/lib/handoff.ts","utf8");
  assert.match(source,/makeAtelierHandoffId\(design\.version\.specHash,design\.id,window\.crypto\.getRandomValues\(new Uint8Array\(16\)\)\)/);
  assert.doesNotMatch(source,/Date\.now\(\)\.toString\(36\)/);
});
test("Atelier local queue must not misrepresent a browser-only write as staff delivery",()=>{
  const source=readFileSync("src/components/AtelierHandoffPanel.tsx","utf8");
  assert.match(source,/Save to local atelier queue/);
  assert.match(source,/It has not been transmitted to Linen Earth staff/);
  assert.match(source,/role="alert"/);
  assert.doesNotMatch(source,/Send to Linen Earth atelier/);
});
